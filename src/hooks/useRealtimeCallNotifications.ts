import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

interface CallRequest {
  id: string;
  room_name: string;
  created_by: string | null;
  is_group_call: boolean;
  status: string;
  created_at: string;
  expires_at: string;
}

interface CallParticipant {
  id: string;
  call_request_id: string;
  user_id: string | null;
  telegram_id: number | null;
  status: string;
  invited_at: string;
  responded_at: string | null;
}

export const useRealtimeCallNotifications = () => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<CallRequest | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<CallRequest[]>([]);
  const [callParticipants, setCallParticipants] = useState<Map<string, CallParticipant[]>>(new Map());

  const handleNewCall = useCallback((call: CallRequest) => {
    if (call.created_by !== user?.id) {
      setIncomingCalls(prev => [...prev, call]);
      
      // Show toast notification
      toast.info(`📞 Входящий звонок: ${call.room_name}`, {
        duration: 10000,
        action: {
          label: 'Принять',
          onClick: () => window.open(`/meeting/${call.room_name}`, '_blank'),
        },
      });
      
      // Play notification sound if available
      try {
        const audio = new Audio('/audio/call-notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {});
      } catch (e) {
        // Ignore audio errors
      }
    }
  }, [user?.id]);

  const handleCallUpdate = useCallback((call: CallRequest) => {
    if (call.status === 'active') {
      if (incomingCalls.some(c => c.id === call.id)) {
        toast.success(`✅ Звонок ${call.room_name} начался`);
      }
    } else if (call.status === 'ended') {
      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
      if (activeCall?.id === call.id) {
        setActiveCall(null);
        toast.info(`📴 Звонок ${call.room_name} завершён`);
      }
    }
    
    // Update in list
    setIncomingCalls(prev => 
      prev.map(c => c.id === call.id ? call : c)
    );
  }, [activeCall, incomingCalls]);

  const handleParticipantUpdate = useCallback((participant: CallParticipant) => {
    setCallParticipants(prev => {
      const updated = new Map(prev);
      const existing = updated.get(participant.call_request_id) || [];
      const index = existing.findIndex(p => p.id === participant.id);
      
      if (index >= 0) {
        existing[index] = participant;
      } else {
        existing.push(participant);
      }
      
      updated.set(participant.call_request_id, existing);
      return updated;
    });

    // Show notification for participant status changes
    // REMOVED: "Вы присоединились к звонку" toast per user request
    // It was overlapping important notifications like recording prompts
    if (participant.user_id !== user?.id) {
      if (participant.status === 'joined') {
        toast.info('Участник присоединился к звонку');
      } else if (participant.status === 'declined') {
        toast.warning('Участник отклонил приглашение');
      }
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to call_requests changes
    const callsChannel = supabase
      .channel('realtime-calls')
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'aplink', 
          table: 'call_requests' 
        },
        (payload) => {
          console.log('New call:', payload.new);
          handleNewCall(payload.new as CallRequest);
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'aplink', 
          table: 'call_requests' 
        },
        (payload) => {
          console.log('Call updated:', payload.new);
          handleCallUpdate(payload.new as CallRequest);
        }
      )
      .subscribe();

    // Subscribe to call_participants changes
    const participantsChannel = supabase
      .channel('realtime-participants')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'aplink', 
          table: 'call_participants' 
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            handleParticipantUpdate(payload.new as CallParticipant);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(callsChannel);
      supabase.removeChannel(participantsChannel);
    };
  }, [user, handleNewCall, handleCallUpdate, handleParticipantUpdate]);

  const acceptCall = async (callId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('call_participants')
        .update({ 
          status: 'accepted',
          responded_at: new Date().toISOString()
        })
        .eq('call_request_id', callId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setIncomingCalls(prev => prev.filter(c => c.id !== callId));
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const declineCall = async (callId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('call_participants')
        .update({ 
          status: 'declined',
          responded_at: new Date().toISOString()
        })
        .eq('call_request_id', callId)
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setIncomingCalls(prev => prev.filter(c => c.id !== callId));
      toast.info('Звонок отклонён');
    } catch (error) {
      console.error('Error declining call:', error);
    }
  };

  const dismissCall = (callId: string) => {
    setIncomingCalls(prev => prev.filter(c => c.id !== callId));
  };

  return {
    activeCall,
    incomingCalls,
    callParticipants,
    acceptCall,
    declineCall,
    dismissCall,
  };
};
