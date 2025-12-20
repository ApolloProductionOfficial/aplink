import { useEffect, useState } from 'react';
import { X, Globe, MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

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
}

const ParticipantsIPPanel = ({ roomId, isOpen, onClose }: ParticipantsIPPanelProps) => {
  const [participants, setParticipants] = useState<ParticipantGeoData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;

    const fetchParticipantsData = async () => {
      setLoading(true);
      try {
        // Get participants for this room
        const { data: meetingParticipants, error: mpError } = await supabase
          .from('meeting_participants')
          .select('id, user_name, joined_at')
          .eq('room_id', roomId)
          .is('left_at', null);

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

        // Get geo data for these participants
        const participantIds = meetingParticipants.map(p => p.id);
        const { data: geoData, error: geoError } = await supabase
          .from('participant_geo_data')
          .select('*')
          .in('participant_id', participantIds);

        if (geoError) {
          console.error('Error fetching geo data:', geoError);
        }

        // Merge data
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

    // Subscribe to realtime updates
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

  if (!isOpen) return null;

  return (
    <div className="absolute top-16 right-4 z-50 w-80 max-h-96 bg-card/95 backdrop-blur-xl border border-border rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
      <div className="flex items-center justify-between p-3 border-b border-border/50">
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
              className="p-3 bg-background/50 rounded-lg border border-border/30 space-y-2"
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
