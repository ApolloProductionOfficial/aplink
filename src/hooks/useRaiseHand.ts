import { useState, useCallback, useEffect, useRef } from 'react';
import { Room, RoomEvent } from 'livekit-client';

interface RaisedHand {
  participantIdentity: string;
  participantName: string;
  raisedAt: number;
}

interface UseRaiseHandReturn {
  isHandRaised: boolean;
  raisedHands: Map<string, RaisedHand>;
  toggleHand: () => void;
  raiseHand: () => void;
  lowerHand: () => void;
}

const HAND_MESSAGE_TYPE = 'RAISE_HAND';

export const useRaiseHand = (
  room: Room | null,
  participantName: string
): UseRaiseHandReturn => {
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Map<string, RaisedHand>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play notification sound when someone raises hand
  const playHandSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      
      // Create a pleasant notification sound
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5
      oscillator.frequency.setValueAtTime(1100, ctx.currentTime + 0.1); // C#6
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    } catch (err) {
      console.error('[RaiseHand] Failed to play sound:', err);
    }
  }, []);

  // Send hand state via data channel
  const sendHandState = useCallback((raised: boolean) => {
    if (!room?.localParticipant) return;

    const message = {
      type: HAND_MESSAGE_TYPE,
      participantIdentity: room.localParticipant.identity,
      participantName: participantName,
      raised: raised,
      timestamp: Date.now(),
    };

    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(message));

    room.localParticipant.publishData(data, { reliable: true });
    console.log('[RaiseHand] Sent hand state:', raised);
  }, [room, participantName]);

  // Handle incoming hand messages
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant: any) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        if (message.type === HAND_MESSAGE_TYPE) {
          const { participantIdentity, participantName: name, raised } = message;

          setRaisedHands((prev) => {
            const next = new Map(prev);
            
            if (raised) {
              next.set(participantIdentity, {
                participantIdentity,
                participantName: name,
                raisedAt: Date.now(),
              });
              // Play sound for others' raised hands
              if (participantIdentity !== room.localParticipant?.identity) {
                playHandSound();
              }
            } else {
              next.delete(participantIdentity);
            }
            
            return next;
          });

          console.log('[RaiseHand] Received hand state:', name, raised);
        }
      } catch {
        // Not a hand message
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, playHandSound]);

  // Clean up audio context
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Clean up raised hands when participants leave
  useEffect(() => {
    if (!room) return;

    const handleParticipantDisconnected = (participant: any) => {
      setRaisedHands((prev) => {
        const next = new Map(prev);
        next.delete(participant.identity);
        return next;
      });
    };

    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  const raiseHand = useCallback(() => {
    setIsHandRaised(true);
    sendHandState(true);
    playHandSound();
  }, [sendHandState, playHandSound]);

  const lowerHand = useCallback(() => {
    setIsHandRaised(false);
    sendHandState(false);
  }, [sendHandState]);

  const toggleHand = useCallback(() => {
    if (isHandRaised) {
      lowerHand();
    } else {
      raiseHand();
    }
  }, [isHandRaised, raiseHand, lowerHand]);

  return {
    isHandRaised,
    raisedHands,
    toggleHand,
    raiseHand,
    lowerHand,
  };
};
