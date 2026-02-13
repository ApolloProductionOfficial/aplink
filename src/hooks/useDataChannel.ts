import { useEffect, useRef, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';

/**
 * Centralized Data Channel message dispatcher.
 * 
 * Instead of 9+ separate DataReceived handlers each doing JSON.parse,
 * this uses a single listener per Room that parses once and dispatches
 * to registered type-based callbacks.
 * 
 * Usage:
 *   useDataChannelMessage(room, 'RAISE_HAND', (message) => { ... });
 *   useDataChannelMessage(room, ['chat_message', 'voice_message'], (message) => { ... });
 */

type MessageHandler = (message: any, participant?: any) => void;

interface RoomDispatcher {
  handlers: Map<string, Set<MessageHandler>>;
  wildcardHandlers: Set<MessageHandler>;
  cleanup: () => void;
}

// WeakMap ensures automatic cleanup when Room is garbage collected
const roomDispatchers = new WeakMap<Room, RoomDispatcher>();

function getOrCreateDispatcher(room: Room): RoomDispatcher {
  let dispatcher = roomDispatchers.get(room);
  if (dispatcher) return dispatcher;

  const handlers = new Map<string, Set<MessageHandler>>();
  const wildcardHandlers = new Set<MessageHandler>();

  const masterHandler = (payload: Uint8Array, participant?: any) => {
    try {
      const message = JSON.parse(new TextDecoder().decode(payload));
      const type = message.type as string;

      // Dispatch to type-specific handlers
      if (type) {
        const typeHandlers = handlers.get(type);
        if (typeHandlers) {
          typeHandlers.forEach(handler => {
            try {
              handler(message, participant);
            } catch (err) {
              console.error(`[DataChannel] Error in handler for type "${type}":`, err);
            }
          });
        }

        // Also check for prefix-based handlers (e.g., 'TIMER_' matches 'TIMER_START')
        handlers.forEach((prefixHandlers, key) => {
          if (key.endsWith('*') && type.startsWith(key.slice(0, -1))) {
            prefixHandlers.forEach(handler => {
              try {
                handler(message, participant);
              } catch (err) {
                console.error(`[DataChannel] Error in prefix handler for "${key}":`, err);
              }
            });
          }
        });
      }

      // Dispatch to wildcard handlers (they get everything)
      wildcardHandlers.forEach(handler => {
        try {
          handler(message, participant);
        } catch (err) {
          console.error('[DataChannel] Error in wildcard handler:', err);
        }
      });
    } catch {
      // Not JSON — ignore silently (binary data, etc.)
    }
  };

  room.on(RoomEvent.DataReceived, masterHandler);

  const cleanup = () => {
    room.off(RoomEvent.DataReceived, masterHandler);
    handlers.clear();
    wildcardHandlers.clear();
    roomDispatchers.delete(room);
  };

  dispatcher = { handlers, wildcardHandlers, cleanup };
  roomDispatchers.set(room, dispatcher);

  return dispatcher;
}

/**
 * Subscribe to specific Data Channel message types.
 * JSON is parsed ONCE by the central dispatcher, not per-handler.
 * 
 * @param room - LiveKit Room instance
 * @param types - Message type(s) to listen for. Use '*' suffix for prefix matching (e.g., 'TIMER_*').
 *                Pass null/undefined to listen to ALL messages (wildcard).
 * @param handler - Callback receiving the parsed message object
 */
export function useDataChannelMessage(
  room: Room | null,
  types: string | string[] | null,
  handler: MessageHandler,
) {
  // Store handler in ref to avoid re-registrations on every render
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // Stable wrapper that delegates to the ref
  const stableHandler = useCallback((message: any, participant?: any) => {
    handlerRef.current(message, participant);
  }, []);

  useEffect(() => {
    if (!room) return;

    const dispatcher = getOrCreateDispatcher(room);

    if (types === null || types === undefined) {
      // Wildcard — receive all messages
      dispatcher.wildcardHandlers.add(stableHandler);
      return () => {
        dispatcher.wildcardHandlers.delete(stableHandler);
      };
    }

    const typeArray = Array.isArray(types) ? types : [types];

    typeArray.forEach(type => {
      if (!dispatcher.handlers.has(type)) {
        dispatcher.handlers.set(type, new Set());
      }
      dispatcher.handlers.get(type)!.add(stableHandler);
    });

    return () => {
      typeArray.forEach(type => {
        dispatcher.handlers.get(type)?.delete(stableHandler);
        // Clean up empty sets
        if (dispatcher.handlers.get(type)?.size === 0) {
          dispatcher.handlers.delete(type);
        }
      });
    };
  }, [room, stableHandler, types ? (Array.isArray(types) ? types.join(',') : types) : '__wildcard__']);
}
