// Фикс рассинхрона формата озвучки (05.10.2026).
// Прод-функция elevenlabs-tts отдаёт JSON { audioContent: base64 }, а клиент читал
// response.blob() (ждал audio/mpeg) -> blob оказывался JSON-текстом, Audio.play() падал,
// звука нет, а вызов ElevenLabs уже оплачен. Хелпер читает ОБА формата и безопасен
// при любом состоянии функции (бинарь audio/* или JSON с audioContent).
export async function ttsResponseToAudioUrl(r: Response): Promise<string | null> {
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('audio')) {
    return URL.createObjectURL(await r.blob());
  }
  try {
    const d = await r.json();
    if (d && typeof d.audioContent === 'string' && d.audioContent) {
      return `data:audio/mpeg;base64,${d.audioContent}`;
    }
  } catch {
    /* тело не JSON */
  }
  return null;
}
