

# План: Исправление ошибки "Failed to toggle screen share: {}"

## Проблема

При попытке демонстрации экрана в консоли появляется ошибка:
```
Failed to toggle screen share: {}
```

## Причина

Когда пользователь **отменяет** диалог выбора экрана (нажимает "Отмена" или Esc), браузер выбрасывает `NotAllowedError`. LiveKit SDK обёртывает эту ошибку, и при логировании она отображается как пустой объект `{}`.

Текущий код в `LiveKitRoom.tsx` (строки 1249-1263):
```typescript
} catch (err: any) {
  if ((err?.code === 13 || err?.name === 'NegotiationError') && !isRoomReconnecting) {
    // Обработка NegotiationError...
  } else {
    console.error('Failed to toggle screen share:', err); // ← Это выводит {}
  }
}
```

Проблема: `NotAllowedError` (отмена пользователем) не обрабатывается, и всегда логируется как ошибка.

## Решение

Добавить специальную обработку для `NotAllowedError`:

1. Если пользователь отменил выбор — тихо выйти без ошибки
2. Если ошибка связана с политикой безопасности — показать понятное сообщение
3. Улучшить логирование для других ошибок

## Файл для изменения

### `src/components/LiveKitRoom.tsx`

**Строки 1249-1263** — улучшить обработку ошибок screen share:

```diff
    } catch (err: any) {
+     // Handle user cancellation (not an error - user just closed the picker)
+     if (err?.name === 'NotAllowedError' || err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
+       console.log('[LiveKitRoom] Screen share cancelled by user');
+       return; // Silent exit, not an error
+     }
+     
+     // Handle security/permission errors
+     if (err?.name === 'SecurityError' || err?.message?.includes('permission')) {
+       console.warn('[LiveKitRoom] Screen share blocked by browser security policy');
+       toast.error('Демонстрация экрана заблокирована', { 
+         description: 'Проверьте разрешения браузера'
+       });
+       return;
+     }
+     
      if ((err?.code === 13 || err?.name === 'NegotiationError') && !isRoomReconnecting) {
        console.warn('[LiveKitRoom] NegotiationError on screen share, retrying...');
        onNegotiationError?.(err);
        await new Promise(r => setTimeout(r, 600));
        try {
          const currentState = localParticipant?.isScreenShareEnabled ?? false;
          await localParticipant?.setScreenShareEnabled(!currentState);
        } catch (retryErr) {
          console.error('Failed to toggle screen share after retry:', retryErr);
          toast.error('Не удалось включить демонстрацию экрана');
        }
      } else {
-       console.error('Failed to toggle screen share:', err);
+       // Log with more details for debugging
+       console.error('Failed to toggle screen share:', {
+         name: err?.name,
+         message: err?.message,
+         code: err?.code,
+         stack: err?.stack
+       });
+       toast.error('Ошибка демонстрации экрана', {
+         description: err?.message || 'Попробуйте ещё раз'
+       });
      }
    }
```

## Техническая схема

```text
СЕЙЧАС:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Пользователь нажал "Отмена" в диалоге выбора экрана                   │
│           ↓                                                             │
│  Браузер выбрасывает NotAllowedError                                   │
│           ↓                                                             │
│  LiveKit SDK обёртывает в объект без свойств                           │
│           ↓                                                             │
│  console.error('Failed to toggle screen share:', {})                   │
│           ↓                                                             │
│  ОШИБКА в консоли (хотя это НЕ ошибка)                                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

ПОСЛЕ:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  Пользователь нажал "Отмена"                                           │
│           ↓                                                             │
│  err?.name === 'NotAllowedError'?                                      │
│           ↓                                                             │
│  ДА → console.log('cancelled by user') → return                        │
│  НЕТ → продолжаем обработку ошибки → toast.error()                     │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Ожидаемый результат

1. **Отмена пользователем**: Тихий выход, без ошибки в консоли
2. **Блокировка браузером**: Понятное сообщение "Демонстрация экрана заблокирована"
3. **Другие ошибки**: Детальное логирование с name/message/code для отладки
4. **Все ошибки**: Показывают toast с описанием проблемы

