import { useEffect, useState, useRef, useCallback } from 'react';
import { X, Globe, MapPin, Loader2, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ParticipantGeoData {
  id: string;
  participant_id: string;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  country_code: string | null;
  region: string | null;
  user_name?: string;
  joined_at?: string;
}

interface ParticipantsIPPanelProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Optional: anchor position under a button */
  anchorPosition?: { x: number; y: number } | null;
}

const ParticipantsIPPanel = ({ roomId, isOpen, onClose, anchorPosition }: ParticipantsIPPanelProps) => {
  const [participants, setParticipants] = useState<ParticipantGeoData[]>([]);
  const [loading, setLoading] = useState(true);

  // DOM ref for direct manipulation
  const panelRef = useRef<HTMLDivElement>(null);
  
  // Position stored in ref for smooth dragging (no re-renders during drag)
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const [initialPos, setInitialPos] = useState<{ x: number; y: number } | null>(null);
  
  // Dragging state
  const draggingRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  // Initialize position when panel opens
  useEffect(() => {
    if (!isOpen) {
      posRef.current = null;
      setInitialPos(null);
      return;
    }
    
    if (posRef.current !== null) return;
    
    // Try to restore from storage
    try {
      const saved = sessionStorage.getItem('ip-panel-pos');
      if (saved) {
        const pos = JSON.parse(saved);
        posRef.current = pos;
        setInitialPos(pos);
        return;
      }
    } catch {}
    
    // Use anchor position if provided, otherwise default to top-right
    const defaultPos = anchorPosition 
      ? { x: anchorPosition.x - 160, y: anchorPosition.y + 10 }
      : { x: window.innerWidth - 340, y: 64 };
    
    posRef.current = defaultPos;
    setInitialPos(defaultPos);
  }, [isOpen, anchorPosition]);

  // Persist position on unmount
  useEffect(() => {
    return () => {
      if (posRef.current) {
        try { 
          sessionStorage.setItem('ip-panel-pos', JSON.stringify(posRef.current)); 
        } catch {}
      }
    };
  }, []);

  // Apply position to DOM directly for smooth dragging
  const applyPosition = useCallback(() => {
    if (!panelRef.current || !posRef.current) return;
    panelRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
  }, []);

  // Handle pointer down - start dragging
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!posRef.current) return;
    
    draggingRef.current = true;
    startRef.current = { 
      x: posRef.current.x, 
      y: posRef.current.y, 
      px: e.clientX, 
      py: e.clientY 
    };
    
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  // Handle pointer move - update position using RAF for smooth animation
  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current || !startRef.current || !panelRef.current) return;
    
    const rect = panelRef.current.getBoundingClientRect();
    const dx = e.clientX - startRef.current.px;
    const dy = e.clientY - startRef.current.py;
    
    const margin = 4;
    const nextX = Math.min(Math.max(margin, startRef.current.x + dx), window.innerWidth - rect.width - margin);
    const nextY = Math.min(Math.max(margin, startRef.current.y + dy), window.innerHeight - rect.height - margin);
    
    posRef.current = { x: nextX, y: nextY };
    
    // Apply directly to DOM for smooth performance
    requestAnimationFrame(applyPosition);
  }, [applyPosition]);

  // Handle pointer up - end dragging
  const handlePointerUp = useCallback(() => {
    if (draggingRef.current && posRef.current) {
      // Persist position
      try { 
        sessionStorage.setItem('ip-panel-pos', JSON.stringify(posRef.current)); 
      } catch {}
    }
    draggingRef.current = false;
    startRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const fetchParticipantsData = async () => {
      setLoading(true);
      try {
        console.log('Fetching participants for room:', roomId);
        
        const { data: meetingParticipants, error: mpError } = await supabase
          .from('meeting_participants')
          .select('id, user_name, joined_at')
          .eq('room_id', roomId)
          .is('left_at', null);

        console.log('Meeting participants result:', { meetingParticipants, error: mpError });

        if (mpError) {
          console.error('Error fetching participants:', mpError);
          setLoading(false);
          return;
        }

        if (!meetingParticipants || meetingParticipants.length === 0) {
          setParticipants([]);
          setLoading(false);
          return;
        }

        const participantIds = meetingParticipants.map(p => p.id);
        console.log('Fetching geo data for participant IDs:', participantIds);
        
        const { data: geoData, error: geoError } = await supabase
          .from('participant_geo_data')
          .select('*')
          .in('participant_id', participantIds);

        console.log('Geo data result:', { geoData, error: geoError });

        if (geoError) {
          console.error('Error fetching geo data:', geoError);
        }

        const mergedData = meetingParticipants.map(mp => {
          const geo = geoData?.find(g => g.participant_id === mp.id);
          return {
            id: mp.id,
            participant_id: mp.id,
            user_name: mp.user_name,
            joined_at: mp.joined_at,
            ip_address: geo?.ip_address || null,
            city: geo?.city || null,
            country: geo?.country || null,
            country_code: geo?.country_code || null,
            region: geo?.region || null,
          };
        });

        setParticipants(mergedData);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchParticipantsData();

    const channel = supabase
      .channel('participants-panel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meeting_participants',
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          fetchParticipantsData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isOpen]);

  // Apply initial position once we have it
  useEffect(() => {
    if (initialPos && panelRef.current) {
      panelRef.current.style.transform = `translate(${initialPos.x}px, ${initialPos.y}px)`;
    }
  }, [initialPos]);

  if (!isOpen || !initialPos) return null;

  return (
    <div 
      ref={panelRef}
      className="fixed z-[80] w-80 max-h-96 bg-black/40 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_0_1px_rgba(255,255,255,0.1)] overflow-hidden will-change-transform"
      style={{ 
        left: 0, 
        top: 0, 
        transform: `translate(${initialPos.x}px, ${initialPos.y}px)` 
      }}
    >
      {/* Drag handle */}
      <div
        className="flex items-center justify-center py-1.5 cursor-grab active:cursor-grabbing border-b border-white/[0.08] bg-white/[0.02] touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <GripHorizontal className="w-4 h-4 text-white/30" />
      </div>
      
      <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">Участники ({participants.length})</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="overflow-y-auto max-h-72 p-2 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : participants.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Нет активных участников
          </div>
        ) : (
          participants.map((participant) => (
            <div
              key={participant.id}
              className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.05] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm truncate max-w-[150px]">
                  {participant.user_name || 'Аноним'}
                </span>
                {participant.ip_address && (
                  <a
                    href={`https://ipinfo.io/${participant.ip_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-primary hover:underline"
                  >
                    {participant.ip_address}
                  </a>
                )}
              </div>

              {(participant.city || participant.country) && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span>
                    {[participant.city, participant.region, participant.country]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                  {participant.country_code && (
                    <span className="ml-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {participant.country_code}
                    </span>
                  )}
                </div>
              )}

              {participant.joined_at && (
                <div className="text-[10px] text-muted-foreground/70">
                  Присоединился: {new Date(participant.joined_at).toLocaleTimeString('ru-RU')}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ParticipantsIPPanel;
