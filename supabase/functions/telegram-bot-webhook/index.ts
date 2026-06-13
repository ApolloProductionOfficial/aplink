import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const WEB_APP_URL = "https://aplink.live";

// Branded APLink welcome animation (GIF wolf animation)
// NOTE: Telegram fetches this URL server-side; it must return raw bytes (not HTML).
const WELCOME_GIF_URL = "https://aplink.live/animations/aplink-welcome.gif";

// Cache-bust helper: appends __cb=timestamp to force WebKit to fetch fresh assets
const cbUrl = (path: string): string => {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}__cb=${Date.now()}`;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  my_chat_member?: {
    chat?: { id: number; title?: string; type?: string };
    from?: { id: number; username?: string; language_code?: string };
    new_chat_member?: {
      status: string;
      user?: { id: number; is_bot?: boolean; username?: string };
    };
  };
  callback_query?: {
    id: string;
    data: string;
    from?: { id: number; username?: string; first_name?: string; language_code?: string };
    message?: {
      chat?: { id: number };
      message_id?: number;
      text?: string;
    };
  };
  message?: {
    chat?: { id: number; title?: string; type?: string };
    from?: { id: number; username?: string; first_name?: string; language_code?: string };
    text?: string;
    caption?: string;
    animation?: { file_id: string };
    video?: { file_id: string };
    document?: { file_id: string; mime_type?: string };
    photo?: Array<{ file_id: string }>;
    voice?: {
      file_id: string;
      duration: number;
      file_size?: number;
    };
    audio?: {
      file_id: string;
      duration: number;
      file_size?: number;
    };
    reply_to_message?: {
      text?: string;
      caption?: string;
      animation?: { file_id: string };
      video?: { file_id: string };
      document?: { file_id: string; mime_type?: string };
      photo?: Array<{ file_id: string }>;
      voice?: { file_id: string };
    };
  };
}

const ADMIN_TELEGRAM_ID = 2061785720; // Admin user ID (Apollo_Production)

// Extended to 3 languages: Russian, English, Ukrainian
type BotLang = "ru" | "en" | "uk";

const normalizeLang = (raw?: string | null): BotLang | null => {
  const v = (raw || "").toLowerCase().trim();
  if (v === "ru" || v === "рус" || v === "русский" || v === "russian") return "ru";
  if (v === "en" || v === "eng" || v === "english" || v === "англ" || v === "английский") return "en";
  if (v === "uk" || v === "ua" || v === "укр" || v === "українська" || v === "ukrainian") return "uk";
  return null;
};

const inferLangFromTelegram = (languageCode?: string | null): BotLang => {
  const lc = (languageCode || "").toLowerCase();
  if (lc.startsWith("en")) return "en";
  if (lc.startsWith("uk") || lc.startsWith("ua")) return "uk";
  return "ru";
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getStoredLang = async (supabase: any, telegramId: number): Promise<BotLang | null> => {
  try {
    const { data } = await supabase
      .from("telegram_activity_log")
      .select("metadata, created_at")
      .eq("telegram_id", telegramId)
      .eq("action", "bot_lang_set")
      .order("created_at", { ascending: false })
      .limit(1);

    const last = data?.[0]?.metadata;
    const lang = last?.lang;
    const normalized = normalizeLang(typeof lang === "string" ? lang : undefined);
    return normalized;
  } catch {
    return null;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getProfileLang = async (supabase: any, telegramId: number): Promise<BotLang | null> => {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("bot_language")
      .eq("telegram_id", telegramId)
      .maybeSingle();

    const raw = (data as Record<string, unknown> | null)?.bot_language;
    return normalizeLang(typeof raw === "string" ? raw : undefined);
  } catch {
    return null;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resolveLang = async (supabase: any, fromUser?: { id: number; language_code?: string }): Promise<BotLang> => {
  if (!fromUser?.id) return "ru";
  const stored = await getStoredLang(supabase, fromUser.id);
  if (stored) return stored;
  const profileLang = await getProfileLang(supabase, fromUser.id);
  if (profileLang) return profileLang;
  return inferLangFromTelegram(fromUser.language_code);
};

// =================== LOCALIZED TEXTS ===================

const i18n = {
  // /start & /help
  helpTitle: { ru: "🎥 APLink Bot", en: "🎥 APLink Bot", uk: "🎥 APLink Bot" },
  helpCmdsHeader: { ru: "Доступные команды", en: "Available commands", uk: "Доступні команди" },
  helpGroupCmdsHeader: { ru: "Команды для групп", en: "Group commands", uk: "Команди для груп" },
  helpCall: { ru: "Позвонить", en: "Call", uk: "Зателефонувати" },
  helpGroupCall: { ru: "Групповой звонок", en: "Group call", uk: "Груповий дзвінок" },
  helpMissed: { ru: "Пропущенные звонки", en: "Missed calls", uk: "Пропущені дзвінки" },
  helpMyCalls: { ru: "История звонков", en: "Call history", uk: "Історія дзвінків" },
  helpContacts: { ru: "Мои контакты", en: "My contacts", uk: "Мої контакти" },
  helpLink: { ru: "Привязать аккаунт", en: "Link account", uk: "Прив'язати акаунт" },
  helpSettings: { ru: "Настройки", en: "Settings", uk: "Налаштування" },
  helpStats: { ru: "Статистика", en: "Stats", uk: "Статистика" },
  helpLang: { ru: "Язык", en: "Language", uk: "Мова" },
  helpVoice: { ru: "Голосовое — Транскрипция", en: "Voice — Transcription", uk: "Голосове — Транскрипція" },
  helpVoiceTip: { ru: "💡 Отправьте голосовое сообщение для транскрипции и перевода!", en: "💡 Send a voice message for transcription & translation!", uk: "💡 Надішліть голосове повідомлення для транскрипції та перекладу!" },
  helpGroupJoinTip: { ru: "Все участники чата могут присоединиться нажав на кнопку.", en: "Anyone in the chat can join by tapping the button.", uk: "Усі учасники чату можуть приєднатися, натиснувши кнопку." },
  helpStartCall: { ru: "Начать групповой звонок", en: "Start a group call", uk: "Почати груповий дзвінок" },

  // Language picker
  langPrompt: { ru: "🌐 Язык бота\n\nВыберите язык:", en: "🌐 Bot language\n\nChoose language:", uk: "🌐 Мова бота\n\nОберіть мову:" },
  langSet: { ru: "✅ Язык установлен: Русский", en: "✅ Language set to English", uk: "✅ Мова встановлена: Українська" },
  langUnsupported: { ru: "❌ Неподдерживаемый язык", en: "❌ Unsupported language", uk: "❌ Непідтримувана мова" },
  langChooseFirst: { ru: "🌐 Выберите язык бота:", en: "🌐 Choose bot language:", uk: "🌐 Оберіть мову бота:" },

  // Buttons
  btnLink: { ru: "🔗 Привязать аккаунт", en: "🔗 Link account", uk: "🔗 Прив'язати акаунт" },
  btnOpen: { ru: "🎥 Открыть APLink", en: "🎥 Open APLink", uk: "🎥 Відкрити APLink" },
  btnLang: { ru: "🌐 Язык", en: "🌐 Language", uk: "🌐 Мова" },
  btnJoin: { ru: "🎥 Присоединиться к звонку", en: "🎥 Join call", uk: "🎥 Приєднатися до дзвінка" },
  btnDecline: { ru: "❌ Отклонить", en: "❌ Decline", uk: "❌ Відхилити" },

  // Group welcome
  groupWelcomeTitle: { ru: "👋 APLink Bot добавлен!", en: "👋 APLink Bot added!", uk: "👋 APLink Bot додано!" },
  groupWelcomeDesc: { ru: "Теперь вы можете организовывать групповые видеозвонки прямо из этого чата.", en: "You can now organize group video calls directly from this chat.", uk: "Тепер ви можете організовувати групові відеодзвінки прямо з цього чату." },

  // Settings
  settingsTitle: { ru: "⚙️ Настройки APLink", en: "⚙️ APLink Settings", uk: "⚙️ Налаштування APLink" },
  settingsCurrent: { ru: "Текущие настройки:", en: "Current settings:", uk: "Поточні налаштування:" },
  settingsDnd: { ru: "Режим 'Не беспокоить'", en: "Do not disturb", uk: "Режим 'Не турбувати'" },
  settingsDndOn: { ru: "🔕 Включён", en: "🔕 On", uk: "🔕 Увімкнено" },
  settingsDndOff: { ru: "🔔 Выключен", en: "🔔 Off", uk: "🔔 Вимкнено" },
  settingsDndEnable: { ru: "🔕 Включить 'Не беспокоить'", en: "🔕 Enable Do not disturb", uk: "🔕 Увімкнути 'Не турбувати'" },
  settingsDndDisable: { ru: "🔔 Выключить 'Не беспокоить'", en: "🔔 Disable Do not disturb", uk: "🔔 Вимкнути 'Не турбувати'" },
  settingsEnabledToast: { ru: "🔕 Режим 'Не беспокоить' включён", en: "🔕 Do not disturb enabled", uk: "🔕 Режим 'Не турбувати' увімкнено" },
  settingsDisabledToast: { ru: "🔔 Уведомления включены", en: "🔔 Notifications enabled", uk: "🔔 Сповіщення увімкнено" },

  // Errors & messages
  errAccountNotLinked: { ru: "❌ Аккаунт не привязан. Используйте /link", en: "❌ Account not linked. Use /link", uk: "❌ Акаунт не прив'язаний. Використовуйте /link" },
  errUserNotFound: { ru: "❌ Пользователь не найден.", en: "❌ User not found.", uk: "❌ Користувача не знайдено." },
  errUserNoTelegram: { ru: "❌ У пользователя не привязан Telegram.", en: "❌ User has no Telegram linked.", uk: "❌ У користувача не прив'язаний Telegram." },
  errCallFailed: { ru: "❌ Ошибка создания звонка. Попробуйте позже.", en: "❌ Failed to create call. Try later.", uk: "❌ Помилка створення дзвінка. Спробуйте пізніше." },
  errGeneric: { ru: "❌ Произошла ошибка", en: "❌ An error occurred", uk: "❌ Сталася помилка" },

  // /call
  callUsage: { ru: "❌ *Использование:*\n`/call @username`\n\nПример: `/call @ivan`", en: "❌ *Usage:*\n`/call @username`\n\nExample: `/call @ivan`", uk: "❌ *Використання:*\n`/call @username`\n\nПриклад: `/call @ivan`" },
  callIncoming: { ru: "📞 *Входящий звонок!*", en: "📞 *Incoming call!*", uk: "📞 *Вхідний дзвінок!*" },
  callFrom: { ru: "👤 *От:*", en: "👤 *From:*", uk: "👤 *Від:*" },
  callExpires: { ru: "⏱ *Истекает через:* 2 минуты", en: "⏱ *Expires in:* 2 minutes", uk: "⏱ *Закінчується через:* 2 хвилини" },
  callAcceptBtn: { ru: "📞 Принять звонок", en: "📞 Accept call", uk: "📞 Прийняти дзвінок" },
  callCreated: { ru: "✅ *Звонок создан!*", en: "✅ *Call created!*", uk: "✅ *Дзвінок створено!*" },
  callRoom: { ru: "📍 Комната:", en: "📍 Room:", uk: "📍 Кімната:" },
  callWaiting: { ru: "⏳ Ожидание ответа...", en: "⏳ Waiting for response...", uk: "⏳ Очікування відповіді..." },
  callDndActive: { ru: "🌙 *Режим 'Не беспокоить'*\n\nПользователь сейчас недоступен:", en: "🌙 *Do not disturb*\n\nUser is currently unavailable:", uk: "🌙 *Режим 'Не турбувати'*\n\nКористувач зараз недоступний:" },

  // /groupcall
  groupCallUsage: { ru: "❌ *Использование:*\n`/groupcall @user1 @user2`\n\nПример: `/groupcall @anna @petr @maria`", en: "❌ *Usage:*\n`/groupcall @user1 @user2`\n\nExample: `/groupcall @anna @petr @maria`", uk: "❌ *Використання:*\n`/groupcall @user1 @user2`\n\nПриклад: `/groupcall @anna @petr @maria`" },
  groupCallCreated: { ru: "✅ *Групповой звонок создан!*", en: "✅ *Group call created!*", uk: "✅ *Груповий дзвінок створено!*" },
  groupCallInvited: { ru: "👥 Приглашено:", en: "👥 Invited:", uk: "👥 Запрошено:" },
  groupCallNotified: { ru: "📨 Уведомлено:", en: "📨 Notified:", uk: "📨 Сповіщено:" },
  groupCallExpires: { ru: "⏱ Истекает через 2 минуты", en: "⏱ Expires in 2 minutes", uk: "⏱ Закінчується через 2 хвилини" },

  // /mycalls
  myCallsTitle: { ru: "📋 *История звонков:*", en: "📋 *Call history:*", uk: "📋 *Історія дзвінків:*" },
  myCallsEmpty: { ru: "📋 У вас пока нет звонков.", en: "📋 You have no calls yet.", uk: "📋 У вас поки немає дзвінків." },

  // /contacts
  contactsTitle: { ru: "⭐ *Ваши контакты:*", en: "⭐ *Your contacts:*", uk: "⭐ *Ваші контакти:*" },
  contactsEmpty: { ru: "⭐ У вас пока нет контактов.", en: "⭐ You have no contacts yet.", uk: "⭐ У вас поки немає контактів." },
  contactsTelegramHint: { ru: "📱 = Telegram привязан", en: "📱 = Telegram linked", uk: "📱 = Telegram прив'язаний" },

  // /link
  linkTitle: { ru: "🔗 *Привязка аккаунта*", en: "🔗 *Link account*", uk: "🔗 *Прив'язка акаунту*" },
  linkDesc: { ru: "Откройте APLink через кнопку ниже и войдите в свой аккаунт. Telegram будет автоматически привязан.", en: "Open APLink via the button below and sign in. Telegram will be linked automatically.", uk: "Відкрийте APLink через кнопку нижче та увійдіть в акаунт. Telegram буде автоматично прив'язаний." },

  // /missed
  missedTitle: { ru: "📵 *Пропущенные звонки:*", en: "📵 *Missed calls:*", uk: "📵 *Пропущені дзвінки:*" },
  missedEmpty: { ru: "📵 Нет пропущенных звонков", en: "📵 No missed calls", uk: "📵 Немає пропущених дзвінків" },
  missedFrom: { ru: "От:", en: "From:", uk: "Від:" },

  // /startcall (group)
  startCallTitle: { ru: "🎥 *Групповой звонок*", en: "🎥 *Group call*", uk: "🎥 *Груповий дзвінок*" },
  startCallOrganizer: { ru: "👤 Организатор:", en: "👤 Organizer:", uk: "👤 Організатор:" },
  startCallChat: { ru: "💬 Чат:", en: "💬 Chat:", uk: "💬 Чат:" },
  startCallExpires5: { ru: "⏱ Истекает через 5 минут", en: "⏱ Expires in 5 minutes", uk: "⏱ Закінчується через 5 хвилин" },
  startCallJoinTip: { ru: "Нажмите кнопку ниже, чтобы присоединиться!", en: "Click the button below to join!", uk: "Натисніть кнопку нижче, щоб приєднатися!" },
  startCallNotLinked: { ru: "❌ Ваш аккаунт не привязан к APLink.\nИспользуйте @aplink\\_live\\_bot в личных сообщениях и команду /link", en: "❌ Your account is not linked to APLink.\nUse @aplink\\_live\\_bot in private messages and /link command", uk: "❌ Ваш акаунт не прив'язаний до APLink.\nВикористовуйте @aplink\\_live\\_bot в приватних повідомленнях та команду /link" },

  // /stats
  statsTitle: { ru: "📊 *Статистика APLink*", en: "📊 *APLink Stats*", uk: "📊 *Статистика APLink*" },
  statsErrors: { ru: "Ошибки:", en: "Errors:", uk: "Помилки:" },
  statsCalls: { ru: "Звонки:", en: "Calls:", uk: "Дзвінки:" },
  statsTotal: { ru: "Всего:", en: "Total:", uk: "Всього:" },
  statsToday: { ru: "Сегодня:", en: "Today:", uk: "Сьогодні:" },

  // Quick reply callbacks
  quickReply5min: { ru: "перезвонит через 5 минут", en: "will call back in 5 min", uk: "передзвонить через 5 хвилин" },
  quickReply15min: { ru: "перезвонит через 15 минут", en: "will call back in 15 min", uk: "передзвонить через 15 хвилин" },
  quickReplyBusy: { ru: "сейчас занят. Напишите сообщение.", en: "is busy now. Send a message.", uk: "зараз зайнятий. Надішліть повідомлення." },
  quickReplySent: { ru: "Отправлено", en: "Sent", uk: "Надіслано" },

  // Callback responses
  callbackDeclined: { ru: "❌ Вы отклонили приглашение", en: "❌ You declined the invitation", uk: "❌ Ви відхилили запрошення" },
  callbackExpired: { ru: "⏰ Приглашение истекло", en: "⏰ Invitation expired", uk: "⏰ Запрошення закінчилось" },
  callbackJoinNow: { ru: "🎥 Присоединяйтесь к звонку!", en: "🎥 Join the call!", uk: "🎥 Приєднуйтесь до дзвінка!" },

  // Voice processing
  voiceProcessing: { ru: "🎤 Обработка голосового сообщения...", en: "🎤 Processing voice message...", uk: "🎤 Обробка голосового повідомлення..." },
  voiceTranscription: { ru: "📝 *Транскрипция:*", en: "📝 *Transcription:*", uk: "📝 *Транскрипція:*" },
  voiceTranslateBtn: { ru: "Перевести", en: "Translate", uk: "Перекласти" },

  // Contact requests
  contactRequestTitle: { ru: "🤝 *Запрос в контакты*", en: "🤝 *Contact request*", uk: "🤝 *Запит у контакти*" },
  contactRequestFrom: { ru: "От:", en: "From:", uk: "Від:" },
  contactRequestMessage: { ru: "Сообщение:", en: "Message:", uk: "Повідомлення:" },
  contactRequestAccept: { ru: "✅ Принять", en: "✅ Accept", uk: "✅ Прийняти" },
  contactRequestDecline: { ru: "❌ Отклонить", en: "❌ Decline", uk: "❌ Відхилити" },
  contactRequestAccepted: { ru: "✅ Вы приняли запрос в контакты", en: "✅ You accepted the contact request", uk: "✅ Ви прийняли запит у контакти" },
  contactRequestDeclined: { ru: "❌ Вы отклонили запрос в контакты", en: "❌ You declined the contact request", uk: "❌ Ви відхилили запит у контакти" },
  contactRequestYouAreNowContacts: { ru: "🎉 Теперь вы в контактах!", en: "🎉 You are now contacts!", uk: "🎉 Тепер ви в контактах!" },
};

const t = (key: keyof typeof i18n, lang: BotLang): string => {
  return i18n[key]?.[lang] || i18n[key]?.["ru"] || String(key);
};

const buildHelpMessage = (lang: BotLang, isGroupChat: boolean) => {
  if (isGroupChat) {
    return [
      `<b>${t("helpTitle", lang)}</b>`,
      ``,
      `<blockquote>${t("helpGroupCmdsHeader", lang)}</blockquote>`,
      `├ 📞 <b>/startcall</b> — ${t("helpStartCall", lang)}`,
      `╰ 📵 <b>/missed</b> — ${t("helpMissed", lang)}`,
      ``,
      `<blockquote>${t("helpGroupJoinTip", lang)}</blockquote>`,
    ].join("\n");
  }

  return [
    `<b>${t("helpTitle", lang)}</b>`,
    ``,
    `<blockquote>${t("helpCmdsHeader", lang)}</blockquote>`,
    `├ 📞 <b>/call</b> @username — ${t("helpCall", lang)}`,
    `├ 👥 <b>/groupcall</b> @user1 @user2 — ${t("helpGroupCall", lang)}`,
    `├ 📵 <b>/missed</b> — ${t("helpMissed", lang)}`,
    `├ 📋 <b>/mycalls</b> — ${t("helpMyCalls", lang)}`,
    `├ ⭐ <b>/contacts</b> — ${t("helpContacts", lang)}`,
    `├ 🔗 <b>/link</b> — ${t("helpLink", lang)}`,
    `├ ⚙️ <b>/settings</b> — ${t("helpSettings", lang)}`,
    `├ 📊 <b>/stats</b> — ${t("helpStats", lang)}`,
    `├ 🌐 <b>/lang</b> — ${t("helpLang", lang)}`,
    `╰ 🎤 ${t("helpVoice", lang)}`,
    ``,
    `<blockquote>${t("helpVoiceTip", lang)}</blockquote>`,
  ].join("\n");
};

const buildGroupWelcome = (lang: BotLang, chatTitle: string) => {
  return [
    `<b>${t("groupWelcomeTitle", lang)}</b>`,
    ``,
    `<blockquote>${t("groupWelcomeDesc", lang)}</blockquote>`,
    ``,
    `<blockquote>${t("helpGroupCmdsHeader", lang)}</blockquote>`,
    `├ 📞 <b>/startcall</b> — ${t("helpStartCall", lang)}`,
    `╰ 📵 <b>/missed</b> — ${t("helpMissed", lang)}`,
    ``,
    `<blockquote>${t("helpGroupJoinTip", lang)}</blockquote>`,
  ].join("\n");
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const update: TelegramUpdate = await req.json();
    
    console.log("Webhook received:", JSON.stringify(update).substring(0, 500));
    
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("TELEGRAM_BOT_TOKEN not configured");
      return new Response("Bot token not configured", { status: 500 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { db: { schema: "aplink" } }
    );

    // Handle my_chat_member (bot added to group)
    if (update.my_chat_member) {
      const chatId = update.my_chat_member.chat?.id;
      const chatTitle = update.my_chat_member.chat?.title || "группу";
      const chatType = update.my_chat_member.chat?.type;
      const newStatus = update.my_chat_member.new_chat_member?.status;
      const newMemberBot = update.my_chat_member.new_chat_member?.user?.is_bot;
      const fromUser = update.my_chat_member.from;
      
      console.log("my_chat_member update:", { chatId, chatType, newStatus, newMemberBot });
      
      // Only handle when bot is added to group/supergroup
      if (chatId && (chatType === "group" || chatType === "supergroup") && 
          (newStatus === "member" || newStatus === "administrator") && newMemberBot) {
        
        // Resolve language from the user who added the bot
        const lang = await resolveLang(supabase, fromUser);
        const welcomeMessage = buildGroupWelcome(lang, chatTitle);
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeMessage,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: t("btnOpen", lang), web_app: { url: WEB_APP_URL } }
              ]]
            }
          })
        });
        
        // Log activity
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser?.id || null,
          action: "bot_added_to_group",
          metadata: { chat_id: chatId, chat_title: chatTitle, chat_type: chatType },
        });
      }
    }

    // Handle callback_query (button press)
    if (update.callback_query) {
      const callbackData = update.callback_query.data;
      const chatId = update.callback_query.message?.chat?.id;
      const messageId = update.callback_query.message?.message_id;
      const fromUser = update.callback_query.from;
      const lang = await resolveLang(supabase, fromUser);
      
      console.log("Callback received:", callbackData);

      let responseText = "";

      if (callbackData.startsWith("lang:")) {
        const requestedLang = normalizeLang(callbackData.split(":")[1]);
        if (requestedLang && fromUser?.id) {
          await supabase.from("telegram_activity_log").insert({
            telegram_id: fromUser.id,
            action: "bot_lang_set",
            metadata: { lang: requestedLang },
          });
          // Also sync to profile if exists
          await supabase
            .from("profiles")
            .update({ bot_language: requestedLang })
            .eq("telegram_id", fromUser.id);
            
          responseText = t("langSet", requestedLang);

          // Immediately update the current welcome/help message to the selected language
          // so it feels like the bot "switched" right away.
          if (chatId && messageId) {
            const isGroupChat = chatId < 0;
            const newHelp = buildHelpMessage(requestedLang, isGroupChat);

            // First try editing caption (works if original message was sendAnimation)
            const editCaptionRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageCaption`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                caption: newHelp,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: isGroupChat
                    ? [[{ text: t("btnOpen", requestedLang), web_app: { url: cbUrl(WEB_APP_URL) } }]]
                    : [
                        [{ text: t("btnOpen", requestedLang), web_app: { url: cbUrl(WEB_APP_URL) } }],
                        [{ text: t("btnLang", requestedLang), callback_data: "lang_menu" }],
                      ],
                },
              }),
            });
            const editCaptionData = await editCaptionRes.json();
            console.log("editMessageCaption result:", JSON.stringify(editCaptionData));

            // If it wasn't an animation message (caption edit fails), fallback to edit text.
            if (!editCaptionData?.ok) {
              const editTextRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: newHelp,
                  parse_mode: "HTML",
                  reply_markup: {
                    inline_keyboard: isGroupChat
                      ? [[{ text: t("btnOpen", requestedLang), web_app: { url: cbUrl(WEB_APP_URL) } }]]
                      : [
                          [{ text: t("btnOpen", requestedLang), web_app: { url: cbUrl(WEB_APP_URL) } }],
                          [{ text: t("btnLang", requestedLang), callback_data: "lang_menu" }],
                        ],
                  },
                }),
              });
              const editTextData = await editTextRes.json();
              console.log("editMessageText fallback result:", JSON.stringify(editTextData));
            }
          }
        } else {
          responseText = t("langUnsupported", lang);
        }

      } else if (callbackData === "lang_menu") {
        // Show language picker
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `<b>${t("langPrompt", lang)}</b>`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [[
                { text: "🇷🇺 Русский", callback_data: "lang:ru" },
                { text: "🇬🇧 English", callback_data: "lang:en" },
                { text: "🇺🇦 Українська", callback_data: "lang:uk" },
              ]],
            },
          }),
        });
        responseText = "";

      } else if (callbackData.startsWith("ignore:")) {
        const groupId = callbackData.split(":")[1];
        if (groupId && groupId !== "new") {
          await supabase.from("error_groups").delete().eq("id", groupId);
        }
        responseText = "✅";
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, message_id: messageId })
          });
        }
        
      } else if (callbackData.startsWith("decline_group:")) {
        const callRequestId = callbackData.split(":")[1];
        
        // Update participant status
        if (fromUser?.id) {
          await supabase
            .from("call_participants")
            .update({ status: "declined", responded_at: new Date().toISOString() })
            .eq("call_request_id", callRequestId)
            .eq("telegram_id", fromUser.id);
        }
        
        responseText = t("callbackDeclined", lang);
        
        // Log activity
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser?.id || null,
          action: "group_call_declined",
          metadata: { call_request_id: callRequestId },
        });
        
      } else if (callbackData.startsWith("join_group:")) {
        const callRequestId = callbackData.split(":")[1];
        
        // Get call request
        const { data: callRequest } = await supabase
          .from("call_requests")
          .select("room_name, expires_at")
          .eq("id", callRequestId)
          .single();
        
        if (callRequest && new Date(callRequest.expires_at) > new Date()) {
          // Update participant status
          if (fromUser?.id) {
            await supabase
              .from("call_participants")
              .update({ status: "joined", responded_at: new Date().toISOString() })
              .eq("call_request_id", callRequestId)
              .eq("telegram_id", fromUser.id);
          }
          
          responseText = t("callbackJoinNow", lang);
          
          // Send message with web app button
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `${t("callbackJoinNow", lang)}\n\n${t("callRoom", lang)} \`${callRequest.room_name}\``,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  { text: t("btnOpen", lang), web_app: { url: cbUrl(`${WEB_APP_URL}/room/${callRequest.room_name}`) } }
                ]]
              }
            })
          });
        } else {
          responseText = t("callbackExpired", lang);
        }
        
      } else if (callbackData === "clear_logs") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: deletedLogs } = await supabase
          .from("error_logs")
          .delete()
          .lt("created_at", weekAgo)
          .select("id");
        const { data: deletedGroups } = await supabase
          .from("error_groups")
          .delete()
          .lt("last_seen", weekAgo)
          .select("id");
        responseText = `🗑 Logs: ${deletedLogs?.length || 0}, Groups: ${deletedGroups?.length || 0}`;
        
      } else if (callbackData === "show_stats") {
        const today = new Date().toISOString().split("T")[0];
        const { count: totalLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true });
        const { count: todayLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true }).gte("created_at", today);
        const { count: criticalLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true }).eq("severity", "critical");
        const { count: activeGroups } = await supabase.from("error_groups").select("*", { count: "exact", head: true });
        responseText = `${t("statsTotal", lang)} ${totalLogs || 0}\n${t("statsToday", lang)} ${todayLogs || 0}`;
      
      } else if (callbackData.startsWith("callback_5min:") || callbackData.startsWith("callback_15min:") || callbackData.startsWith("callback_busy:")) {
        // Quick reply callbacks
        const parts = callbackData.split(":");
        const action = parts[0];
        const callerId = parts[1];
        
        // Get caller's profile
        const { data: callerProfile } = await supabase
          .from("profiles")
          .select("telegram_id, display_name, username")
          .eq("user_id", callerId)
          .single();
        
        // Get responder's profile
        const { data: responderProfile } = await supabase
          .from("profiles")
          .select("display_name, username")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        const responderName = responderProfile?.display_name || responderProfile?.username || "User";
        
        let callerMessage = "";
        let buttonText = "";
        
        if (action === "callback_5min") {
          callerMessage = `📞 *${responderName}* ${t("quickReply5min", lang)}`;
          buttonText = "✅ 5 min";
          responseText = t("quickReplySent", lang);
        } else if (action === "callback_15min") {
          callerMessage = `📞 *${responderName}* ${t("quickReply15min", lang)}`;
          buttonText = "✅ 15 min";
          responseText = t("quickReplySent", lang);
        } else if (action === "callback_busy") {
          callerMessage = `💬 *${responderName}* ${t("quickReplyBusy", lang)}`;
          buttonText = "✅";
          responseText = t("quickReplySent", lang);
        }
        
        // Send message to caller
        if (callerProfile?.telegram_id) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: callerProfile.telegram_id,
              text: callerMessage,
              parse_mode: "Markdown",
            }),
          });
        }
        
        // Update original message markup
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: { inline_keyboard: [[{ text: buttonText, callback_data: "noop" }]] },
            }),
          });
        }
        
        // Log activity
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser?.id || null,
          action: `quick_reply_${action.replace("callback_", "")}`,
          metadata: { caller_id: callerId },
        });
      
      } else if (callbackData.startsWith("translate:")) {
        // Handle translation callback for voice messages
        const parts = callbackData.split(":");
        const targetLang = parts[1];
        
        const langName = targetLang === "en" ? "English" 
          : targetLang === "ru" ? "Русский" 
          : targetLang === "uk" ? "Українська"
          : targetLang;
            
        responseText = `${t("voiceTranslateBtn", lang)}: ${langName}`;
      
      } else if (callbackData === "link_account") {
        // Handle link account button from welcome message
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${t("linkTitle", lang)}\n\n${t("linkDesc", lang)}`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: t("btnLink", lang), web_app: { url: cbUrl(`${WEB_APP_URL}/auth?mode=login&redirect=/`) } }
              ]]
            }
          })
        });
        responseText = "";
      
      } else if (callbackData === "settings_dnd_on" || callbackData === "settings_dnd_off") {
        // Toggle DND setting
        const dndEnabled = callbackData === "settings_dnd_on";
        
        if (fromUser?.id) {
          await supabase
            .from("profiles")
            .update({ dnd_enabled: dndEnabled })
            .eq("telegram_id", fromUser.id);
        }
        
        responseText = dndEnabled ? t("settingsEnabledToast", lang) : t("settingsDisabledToast", lang);
        
        // Update message with new buttons
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              reply_markup: {
                inline_keyboard: [
                  [{ text: dndEnabled ? t("settingsDndDisable", lang) : t("settingsDndEnable", lang), callback_data: dndEnabled ? "settings_dnd_off" : "settings_dnd_on" }],
                  [{ text: t("btnOpen", lang), web_app: { url: cbUrl(WEB_APP_URL) } }],
                ]
              }
            })
          });
        }
        
      } else if (callbackData === "settings_back") {
        // Go back to main settings
        if (chatId && messageId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `${t("settingsTitle", lang)}\n\n${t("settingsCurrent", lang)}`,
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [
                  [{ text: t("settingsDndEnable", lang), callback_data: "settings_dnd_on" }],
                  [{ text: t("settingsDndDisable", lang), callback_data: "settings_dnd_off" }],
                  [{ text: t("btnOpen", lang), web_app: { url: cbUrl(WEB_APP_URL) } }]
                ]
              }
            })
          });
        }
        responseText = "";
      
      } else if (callbackData === "admin_change_welcome") {
        // Admin button: show /setwelcome format hint
        if (fromUser?.id === ADMIN_TELEGRAM_ID) {
          const formatHint = `✏️ *Сменить приветствие*

Отправьте GIF/видео/фото с командой в caption:
\`\`\`
/setwelcome

🇷🇺 RU:
Текст на русском

🇬🇧 EN:
Text in English

🇺🇦 UK:
Текст українською
\`\`\`

*ИЛИ:* ответьте \`/setwelcome\` reply на сообщение с медиа.

💡 Если язык не указан — текст будет использован для всех языков.`;

          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: formatHint,
              parse_mode: "Markdown",
            }),
          });
          responseText = "";
        } else {
          responseText = "⛔ Admin only";
        }
      
      } else if (callbackData === "noop") {
        // No-op for already handled buttons
        responseText = "";
      
      } else if (callbackData.startsWith("contact_accept:") || callbackData.startsWith("contact_decline:")) {
        // Handle contact request Accept/Decline
        const parts = callbackData.split(":");
        const action = parts[0];
        const requestId = parts[1];
        
        if (requestId && fromUser?.id) {
          // Get the contact request
          const { data: request } = await supabase
            .from("contact_requests")
            .select("id, from_user_id, to_user_id, status")
            .eq("id", requestId)
            .single();
          
          if (request && request.status === "pending") {
            // Verify the responder is the to_user by checking their telegram_id
            const { data: toProfile } = await supabase
              .from("profiles")
              .select("user_id")
              .eq("telegram_id", fromUser.id)
              .single();
            
            if (toProfile && toProfile.user_id === request.to_user_id) {
              if (action === "contact_accept") {
                // Update status to accepted (trigger will create mutual contacts)
                await supabase
                  .from("contact_requests")
                  .update({ 
                    status: "accepted", 
                    responded_at: new Date().toISOString() 
                  })
                  .eq("id", requestId);
                
                responseText = t("contactRequestAccepted", lang);
                
                // Notify the sender
                const { data: fromProfile } = await supabase
                  .from("profiles")
                  .select("telegram_id, display_name")
                  .eq("user_id", request.from_user_id)
                  .single();
                
                if (fromProfile?.telegram_id) {
                  const toDisplayName = (await supabase
                    .from("profiles")
                    .select("display_name, username")
                    .eq("user_id", request.to_user_id)
                    .single())?.data;
                  
                  const toName = toDisplayName?.display_name || toDisplayName?.username || "User";
                  
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: fromProfile.telegram_id,
                      text: `${t("contactRequestYouAreNowContacts", lang)}\n\n*${toName}* принял ваш запрос.`,
                      parse_mode: "Markdown",
                    }),
                  });
                }
                
                // Update the message to show accepted status
                if (chatId && messageId) {
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      message_id: messageId,
                      reply_markup: { 
                        inline_keyboard: [[{ text: "✅ Принято", callback_data: "noop" }]] 
                      },
                    }),
                  });
                }
                
              } else {
                // Decline
                await supabase
                  .from("contact_requests")
                  .update({ 
                    status: "declined", 
                    responded_at: new Date().toISOString() 
                  })
                  .eq("id", requestId);
                
                responseText = t("contactRequestDeclined", lang);
                
                // Update the message to show declined status
                if (chatId && messageId) {
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      message_id: messageId,
                      reply_markup: { 
                        inline_keyboard: [[{ text: "❌ Отклонено", callback_data: "noop" }]] 
                      },
                    }),
                  });
                }
              }
            } else {
              responseText = "❌ Только получатель может ответить";
            }
          } else {
            responseText = "⏰ Запрос уже обработан";
          }
        }
      }
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: update.callback_query.id,
          text: responseText,
          show_alert: responseText.length > 0
        })
      });
    }

    // Handle text commands
    if (update.message?.text) {
      const chatId = update.message.chat?.id;
      const text = update.message.text;
      const fromUser = update.message.from;
      const lang = await resolveLang(supabase, fromUser);
      
      // Log activity
      if (fromUser?.id) {
        await supabase.from("telegram_activity_log").insert({
          telegram_id: fromUser.id,
          action: "bot_command",
          metadata: { command: text, username: fromUser.username },
        });
      }
      
      if (text.startsWith("/lang")) {
        const parts = text.split(/\s+/).filter(Boolean);
        const arg = parts[1];
        const requested = normalizeLang(arg);

        if (!requested) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: `<b>${t("langPrompt", lang)}</b>`,
              parse_mode: "HTML",
              reply_markup: {
                inline_keyboard: [[
                  { text: "🇷🇺 Русский", callback_data: "lang:ru" },
                  { text: "🇬🇧 English", callback_data: "lang:en" },
                  { text: "🇺🇦 Українська", callback_data: "lang:uk" },
                ]],
              },
            }),
          });
        } else if (fromUser?.id) {
          await supabase.from("telegram_activity_log").insert({
            telegram_id: fromUser.id,
            action: "bot_lang_set",
            metadata: { lang: requested },
          });
          // Also sync to profile if exists
          await supabase
            .from("profiles")
            .update({ bot_language: requested })
            .eq("telegram_id", fromUser.id);

          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("langSet", requested) }),
          });
        }

      } else if (text === "/settings") {
        // Settings command
        const { data: profile } = await supabase
          .from("profiles")
          .select("dnd_enabled, voice_preference")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        const dndStatus = profile?.dnd_enabled ? t("settingsDndOn", lang) : t("settingsDndOff", lang);
        
        const settingsMessage = `${t("settingsTitle", lang)}\n\n*${t("settingsCurrent", lang)}*\n• ${t("settingsDnd", lang)}: ${dndStatus}`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: settingsMessage,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [{ text: profile?.dnd_enabled ? t("settingsDndDisable", lang) : t("settingsDndEnable", lang), callback_data: profile?.dnd_enabled ? "settings_dnd_off" : "settings_dnd_on" }],
                [{ text: t("btnLang", lang), callback_data: "lang_menu" }],
                [{ text: t("btnOpen", lang), web_app: { url: cbUrl(WEB_APP_URL) } }]
              ]
            }
          })
        });
      
      } else if (text === "/stats" || text === "/status") {
        const today = new Date().toISOString().split("T")[0];
        const { count: totalLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true });
        const { count: todayLogs } = await supabase.from("error_logs").select("*", { count: "exact", head: true }).gte("created_at", today);
        const { count: totalCalls } = await supabase.from("call_requests").select("*", { count: "exact", head: true });
        const { count: todayCalls } = await supabase.from("call_requests").select("*", { count: "exact", head: true }).gte("created_at", today);
        
        const statsMessage = `${t("statsTitle", lang)}\n\n*${t("statsErrors", lang)}*\n• ${t("statsTotal", lang)} ${totalLogs || 0}\n• ${t("statsToday", lang)} ${todayLogs || 0}\n\n*${t("statsCalls", lang)}*\n• ${t("statsTotal", lang)} ${totalCalls || 0}\n• ${t("statsToday", lang)} ${todayCalls || 0}`;
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: statsMessage, parse_mode: "Markdown" })
        });
        
      } else if (text === "/clear") {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data: deletedLogs } = await supabase.from("error_logs").delete().lt("created_at", weekAgo).select("id");
        const { data: deletedGroups } = await supabase.from("error_groups").delete().lt("last_seen", weekAgo).select("id");
        
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `🗑 Logs: ${deletedLogs?.length || 0}, Groups: ${deletedGroups?.length || 0}`,
            parse_mode: "Markdown"
          })
        });
        
      } else if (text.startsWith("/call ")) {
        // Handle /call @username command
        const parts = text.split(/\s+/);
        const targetUsername = parts[1]?.replace("@", "").toLowerCase();
        
        if (!targetUsername) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("callUsage", lang), parse_mode: "Markdown" })
          });
        } else {
          // Get caller's profile
          const { data: callerProfile } = await supabase
            .from("profiles")
            .select("user_id, display_name, username")
            .eq("telegram_id", fromUser?.id)
            .single();
          
          if (!callerProfile) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t("errAccountNotLinked", lang), parse_mode: "Markdown" })
            });
          } else {
            // Find target user
            const { data: targetProfile } = await supabase
              .from("profiles")
              .select("user_id, display_name, telegram_id, dnd_enabled, dnd_start_time, dnd_end_time, dnd_auto_reply")
              .eq("username", targetUsername)
              .single();
            
            if (!targetProfile) {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: `${t("errUserNotFound", lang)} @${targetUsername}`, parse_mode: "Markdown" })
              });
            } else if (!targetProfile.telegram_id) {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: `${t("errUserNoTelegram", lang)} @${targetUsername}`, parse_mode: "Markdown" })
              });
            } else {
              // Check DND status
              let dndActive = false;
              if (targetProfile.dnd_enabled) {
                const now = new Date();
                const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
                const startTime = targetProfile.dnd_start_time || "22:00";
                const endTime = targetProfile.dnd_end_time || "08:00";
                
                if (startTime > endTime) {
                  dndActive = currentTime >= startTime || currentTime <= endTime;
                } else {
                  dndActive = currentTime >= startTime && currentTime <= endTime;
                }
              }
              
              if (dndActive) {
                const autoReply = targetProfile.dnd_auto_reply || "";
                await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: `${t("callDndActive", lang)}\n_${autoReply}_`,
                    parse_mode: "Markdown"
                  })
                });
              } else {
                // Create room and call request
                const roomName = `call-${Date.now().toString(36)}`;
                const expiresAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
                
                const { data: callRequest, error: callError } = await supabase
                  .from("call_requests")
                  .insert({
                    room_name: roomName,
                    created_by: callerProfile.user_id,
                    is_group_call: false,
                    status: "pending",
                    expires_at: expiresAt,
                  })
                  .select()
                  .single();
                
                if (callError || !callRequest) {
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ chat_id: chatId, text: t("errCallFailed", lang), parse_mode: "Markdown" })
                  });
                } else {
                  const callerName = callerProfile.display_name || callerProfile.username || "User";
                  
                  // Add participant
                  await supabase.from("call_participants").insert({
                    call_request_id: callRequest.id,
                    user_id: targetProfile.user_id,
                    telegram_id: targetProfile.telegram_id,
                    status: "invited",
                  });
                  
                  // Get target's language
                  const targetLang = await resolveLang(supabase, { id: targetProfile.telegram_id });
                  
                  // Send text notification to target
                  const callMessage = `${t("callIncoming", targetLang)}\n\n${t("callFrom", targetLang)} ${callerName}\n${t("callExpires", targetLang)}`;
                  
                  const keyboard = {
                  inline_keyboard: [
                    [{ text: t("callAcceptBtn", targetLang), web_app: { url: cbUrl(`${WEB_APP_URL}/room/${roomName}`) } }],
                      [
                        { text: "⏰ 5 min", callback_data: `callback_5min:${callerProfile.user_id}` },
                        { text: "⏰ 15 min", callback_data: `callback_15min:${callerProfile.user_id}` }
                      ],
                      [
                        { text: "💬", callback_data: `callback_busy:${callerProfile.user_id}` },
                        { text: t("btnDecline", targetLang), callback_data: `decline_group:${callRequest.id}` }
                      ]
                    ]
                  };
                  
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: targetProfile.telegram_id,
                      text: callMessage,
                      parse_mode: "Markdown",
                      reply_markup: keyboard
                    })
                  });
                  
                  // Send confirmation to caller
                  await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: `${t("callCreated", lang)}\n\n${t("callRoom", lang)} \`${roomName}\`\n${t("callWaiting", lang)}`,
                      parse_mode: "Markdown",
                      reply_markup: {
                        inline_keyboard: [[
                          { text: t("btnOpen", lang), web_app: { url: cbUrl(`${WEB_APP_URL}/room/${roomName}`) } }
                        ]]
                      }
                    })
                  });
                  
                  // Log activity
                  await supabase.from("telegram_activity_log").insert({
                    telegram_id: fromUser?.id || null,
                    action: "call_initiated",
                    metadata: { target_username: targetUsername, room_name: roomName },
                  });
                }
              }
            }
          }
        }
        
      } else if (text.startsWith("/groupcall ")) {
        // Handle /groupcall @user1 @user2 command
        const parts = text.split(/\s+/).slice(1);
        const usernames = parts.map(p => p.replace("@", "").toLowerCase()).filter(Boolean);
        
        if (usernames.length === 0) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("groupCallUsage", lang), parse_mode: "Markdown" })
          });
        } else {
          // Get caller's profile
          const { data: callerProfile } = await supabase
            .from("profiles")
            .select("user_id, display_name, username")
            .eq("telegram_id", fromUser?.id)
            .single();
          
          if (!callerProfile) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t("errAccountNotLinked", lang), parse_mode: "Markdown" })
            });
          } else {
            // Invoke group call function
            const response = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/telegram-group-call`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  created_by: callerProfile.user_id,
                  participants: usernames,
                }),
              }
            );
            
            const result = await response.json();
            
            if (result.success) {
              const notifiedCount = result.participants.filter((p: { status: string }) => p.status === "notified").length;
              
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `${t("groupCallCreated", lang)}\n\n${t("callRoom", lang)} \`${result.room_name}\`\n${t("groupCallInvited", lang)} ${usernames.length}\n${t("groupCallNotified", lang)} ${notifiedCount}\n${t("groupCallExpires", lang)}`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [[
                      { text: t("btnJoin", lang), web_app: { url: cbUrl(result.room_url) } }
                    ]]
                  }
                })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: `${t("errGeneric", lang)}: ${result.error}`, parse_mode: "Markdown" })
              });
            }
          }
        }
        
      } else if (text === "/mycalls") {
        // Get user's call history
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (profile) {
          const { data: calls } = await supabase
            .from("call_requests")
            .select("room_name, is_group_call, created_at, status")
            .eq("created_by", profile.user_id)
            .order("created_at", { ascending: false })
            .limit(10);
          
          if (calls && calls.length > 0) {
            const callsList = calls.map(c => {
              const icon = c.is_group_call ? "👥" : "📞";
              const status = c.status === "active" ? "🟢" : c.status === "ended" ? "⚫" : "⏳";
              const date = new Date(c.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
              return `${icon} ${status} ${c.room_name}\n   _${date}_`;
            }).join("\n\n");
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: `${t("myCallsTitle", lang)}\n\n${callsList}`, parse_mode: "Markdown" })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t("myCallsEmpty", lang), parse_mode: "Markdown" })
            });
          }
        } else {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("errAccountNotLinked", lang), parse_mode: "Markdown" })
          });
        }
        
      } else if (text === "/contacts") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (profile) {
          const { data: contacts } = await supabase
            .from("contacts")
            .select("nickname, contact_user_id")
            .eq("user_id", profile.user_id)
            .limit(20);
          
          if (contacts && contacts.length > 0) {
            // Get profiles for contacts
            const contactsList = await Promise.all(contacts.map(async (c) => {
              const { data: contactProfile } = await supabase
                .from("profiles")
                .select("display_name, username, telegram_id")
                .eq("user_id", c.contact_user_id)
                .single();
              
              const name = c.nickname || contactProfile?.display_name || "User";
              const username = contactProfile?.username ? `@${contactProfile.username}` : "";
              const hasTelegram = contactProfile?.telegram_id ? "📱" : "";
              return `• ${name} ${username} ${hasTelegram}`;
            }));
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `${t("contactsTitle", lang)}\n\n${contactsList.join("\n")}\n\n${t("contactsTelegramHint", lang)}`,
                parse_mode: "Markdown"
              })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t("contactsEmpty", lang), parse_mode: "Markdown" })
            });
          }
        } else {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("errAccountNotLinked", lang), parse_mode: "Markdown" })
          });
        }
        
      } else if (text === "/link") {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `${t("linkTitle", lang)}\n\n${t("linkDesc", lang)}`,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [[
                { text: t("btnLink", lang), web_app: { url: cbUrl(`${WEB_APP_URL}/auth?mode=login&redirect=/`) } }
              ]]
            }
          })
        });
        
      } else if (text === "/missed") {
        // Get user's missed calls
        const { data: profile } = await supabase
          .from("profiles")
          .select("telegram_id")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (profile) {
          const { data: missedCalls } = await supabase
            .from("call_participants")
            .select("call_request_id, status, invited_at")
            .eq("telegram_id", fromUser?.id)
            .in("status", ["invited", "declined"])
            .order("invited_at", { ascending: false })
            .limit(10);
          
          if (missedCalls && missedCalls.length > 0) {
            // Get call request details
            const callIds = missedCalls.map(c => c.call_request_id);
            const { data: callRequests } = await supabase
              .from("call_requests")
              .select("id, room_name, created_by, created_at")
              .in("id", callIds);
            
            // Get creator profiles
            const creatorIds = callRequests?.map(c => c.created_by).filter(Boolean) || [];
            const { data: creatorProfiles } = await supabase
              .from("profiles")
              .select("user_id, display_name, username")
              .in("user_id", creatorIds);
            
            const callsList = missedCalls.map(c => {
              const request = callRequests?.find(r => r.id === c.call_request_id);
              const creator = creatorProfiles?.find(p => p.user_id === request?.created_by);
              const name = creator?.display_name || (creator?.username ? `@${creator.username}` : "Unknown");
              const date = new Date(c.invited_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
              const status = c.status === "declined" ? "❌" : "📵";
              return `${status} ${t("missedFrom", lang)} *${name}*\n   _${date}_`;
            }).join("\n\n");
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: `${t("missedTitle", lang)}\n\n${callsList}`, parse_mode: "Markdown" })
            });
          } else {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t("missedEmpty", lang), parse_mode: "Markdown" })
            });
          }
        } else {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("errAccountNotLinked", lang), parse_mode: "Markdown" })
          });
        }
        
      } else if (text === "/startcall" && chatId && chatId < 0) {
        // Group chat command to start a group call
        // Get chat info
        const chatInfoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId })
        });
        const chatInfo = await chatInfoResponse.json();
        const chatTitle = chatInfo.result?.title || "Group";
        
        // Check if caller is linked
        const { data: callerProfile } = await supabase
          .from("profiles")
          .select("user_id, display_name")
          .eq("telegram_id", fromUser?.id)
          .single();
        
        if (!callerProfile) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("startCallNotLinked", lang), parse_mode: "Markdown" })
          });
        } else {
          // Create a room with group chat name
          const roomName = `group-${chatId.toString().replace("-", "")}-${Date.now().toString(36)}`;
          
          // Create call request
          const { data: callRequest, error: insertError } = await supabase
            .from("call_requests")
            .insert({
              room_name: roomName,
              created_by: callerProfile.user_id,
              is_group_call: true,
              status: "pending",
              expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            })
            .select()
            .single();
          
          if (insertError || !callRequest) {
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: t("errCallFailed", lang), parse_mode: "Markdown" })
            });
          } else {
            const callerName = callerProfile.display_name || fromUser?.first_name || "User";
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `${t("startCallTitle", lang)}\n\n${t("startCallOrganizer", lang)} *${callerName}*\n${t("startCallChat", lang)} *${chatTitle}*\n${t("startCallExpires5", lang)}\n\n${t("startCallJoinTip", lang)}`,
                parse_mode: "Markdown",
                reply_markup: {
                  inline_keyboard: [
                    [{ text: t("btnJoin", lang), web_app: { url: cbUrl(`${WEB_APP_URL}/room/${roomName}`) } }],
                    [{ text: t("btnDecline", lang), callback_data: `decline_group:${callRequest.id}` }]
                  ]
                }
              })
            });
            
            // Log activity
            await supabase.from("telegram_activity_log").insert({
              telegram_id: fromUser?.id || null,
              action: "group_chat_call_started",
              metadata: { chat_id: chatId, room_name: roomName, chat_title: chatTitle },
            });
          }
        }
        
      } else if (text === "/help" || text === "/start") {
        const isGroupChat = chatId && chatId < 0;
        
        // Check if user has language set
        const stored = fromUser?.id
          ? (await getStoredLang(supabase, fromUser.id)) ?? (await getProfileLang(supabase, fromUser.id))
          : null;

        // Fetch custom welcome settings from DB (if admin uploaded custom media/captions)
        const { data: welcomeSettings } = await supabase
          .from("bot_welcome_settings")
          .select("file_id, media_url, caption_ru, caption_en, caption_uk")
          .limit(1)
          .maybeSingle();

        const dbFileId = (welcomeSettings as Record<string, unknown> | null)?.file_id as string | null;
        const dbMediaUrl = (welcomeSettings as Record<string, unknown> | null)?.media_url as string | null;
        const dbCaptionRu = (welcomeSettings as Record<string, unknown> | null)?.caption_ru as string | null;
        const dbCaptionEn = (welcomeSettings as Record<string, unknown> | null)?.caption_en as string | null;
        const dbCaptionUk = (welcomeSettings as Record<string, unknown> | null)?.caption_uk as string | null;

        // Resolve the caption based on current lang preference
        const getDbCaption = (l: BotLang) => {
          if (l === "en" && dbCaptionEn) return dbCaptionEn;
          if (l === "uk" && dbCaptionUk) return dbCaptionUk;
          return dbCaptionRu || null;
        };

        // Helper to send welcome with DB media if available, otherwise fallback
        const sendWelcomeMedia = async (caption: string, replyMarkup: unknown) => {
          // Priority 1: Use Telegram file_id if available (fastest, cached by Telegram)
          if (dbFileId) {
            // Try sending as animation first (works for MP4/GIF file_id)
            const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                animation: dbFileId,
                caption,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }),
            });
            const data = await res.json();
            console.log("sendAnimation with DB file_id result:", JSON.stringify(data));
            if (data?.ok) return true;

            // If animation fails (e.g. it's a photo not animation), try sendPhoto
            const photoRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                photo: dbFileId,
                caption,
                parse_mode: "HTML",
                reply_markup: replyMarkup,
              }),
            });
            const photoData = await photoRes.json();
            if (photoData?.ok) return true;
          }

          // Priority 2: Use media_url from admin panel upload
          const mediaUrlToUse = dbMediaUrl || WELCOME_GIF_URL;
          console.log("Using media URL:", mediaUrlToUse);

          // Try as animation (GIF/MP4)
          const urlRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAnimation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              animation: mediaUrlToUse,
              caption,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
          });
          const urlData = await urlRes.json();
          console.log("sendAnimation with URL result:", JSON.stringify(urlData));
          if (urlData?.ok) return true;

          // Try as photo if animation failed
          const photoUrlRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              photo: mediaUrlToUse,
              caption,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
          });
          const photoUrlData = await photoUrlRes.json();
          if (photoUrlData?.ok) return true;

          // Final fallback: plain text message
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: caption,
              parse_mode: "HTML",
              reply_markup: replyMarkup,
            }),
          });
          return false;
        };
        
        // Private chat: if no language stored, show language selection first
        if (!isGroupChat && !stored) {
          console.log("Sending language selection for new user");
          const caption = getDbCaption(lang) || `<b>🎥 APLink Bot</b>\n\n<blockquote>${t("langChooseFirst", lang)}</blockquote>`;
          await sendWelcomeMedia(caption, {
            inline_keyboard: [[
              { text: "🇷🇺 Русский", callback_data: "lang:ru" },
              { text: "🇬🇧 English", callback_data: "lang:en" },
              { text: "🇺🇦 Українська", callback_data: "lang:uk" },
            ]],
          });
        } else {
          const helpMessage = getDbCaption(lang) || buildHelpMessage(lang, !!isGroupChat);
          
          // Private chat: send animation WITH caption
          // Add admin button if user is admin
          if (!isGroupChat) {
            console.log("Sending help animation for existing user with lang:", lang);
            const keyboard = [
              [{ text: t("btnOpen", lang), web_app: { url: cbUrl(WEB_APP_URL) } }],
              [{ text: t("btnLang", lang), callback_data: "lang_menu" }],
            ];
            await sendWelcomeMedia(helpMessage, { inline_keyboard: keyboard });
          } else {
            // Group chat: plain message with button
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: helpMessage,
                parse_mode: "HTML",
                reply_markup: {
                  inline_keyboard: [[
                    { text: t("btnOpen", lang), web_app: { url: cbUrl(WEB_APP_URL) } }
                  ]]
                }
              }),
            });
          }
        }
      }
    }
    const msgText = update.message?.text || update.message?.caption || "";
    if (msgText.startsWith("/setwelcome") && update.message?.from) {
      const chatId = update.message.chat?.id;
      const fromUser = update.message.from;
      const lang = await resolveLang(supabase, fromUser);

      // Only admin can use this command
      if (fromUser.id !== ADMIN_TELEGRAM_ID) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "⛔ Только для админа / Admin only" }),
        });
      } else {
        // Determine file_id from attached media OR from replied message media
        const msg = update.message;
        const replied = update.message.reply_to_message;

        const getMediaFileId = (m: typeof msg | typeof replied | undefined | null): string | null => {
          if (!m) return null;
          // Prefer animation (works best for MP4/GIF), then video, then video-document, then photo
          if ((m as any).animation?.file_id) return (m as any).animation.file_id;
          if ((m as any).video?.file_id) return (m as any).video.file_id;
          if ((m as any).document?.file_id && (m as any).document?.mime_type?.startsWith("video/")) {
            return (m as any).document.file_id;
          }
          if ((m as any).photo && (m as any).photo.length > 0) {
            return (m as any).photo[(m as any).photo.length - 1].file_id;
          }
          return null;
        };

        const fileId = getMediaFileId(msg) || getMediaFileId(replied);
        console.log("/setwelcome media resolved:", {
          hasMsgMedia: !!getMediaFileId(msg),
          hasReplyMedia: !!getMediaFileId(replied),
          fileId: fileId ? "<present>" : null,
        });

        if (!fileId) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "❌ *Прикрепите GIF/видео/фото вместе с командой /setwelcome*\n\n*ИЛИ:* ответьте командой `/setwelcome` *reply* на сообщение с GIF/видео/фото.\n\n*Формат многоязычного текста:*\n```\n/setwelcome\n\n🇷🇺 RU:\nПриветственный текст на русском\nМожно в несколько строк\n\n🇬🇧 EN:\nWelcome text in English\nMultiple lines supported\n\n🇺🇦 UK:\nПривітальний текст українською\nПідтримується багато рядків\n```\n\n💡 Если язык не указан — текст будет использован для всех языков.",
              parse_mode: "Markdown",
            }),
          });
        } else {
          // Parse captions from message text (support multi-line blocks)
          const primaryText = (msg.caption || msg.text || "");
          const replyText = (replied?.caption || replied?.text || "");

          const stripSetWelcome = (text: string) => text.replace(/^\/setwelcome(?:@\w+)?\s*/i, "").trim();

          // Prefer text provided in the command message; fall back to replied media caption/text.
          const captionText = stripSetWelcome(primaryText) || stripSetWelcome(replyText);
          
          // Advanced multi-line extraction: find blocks between language markers
          const extractBlock = (text: string, markers: string[]): string | null => {
            for (const marker of markers) {
              const regex = new RegExp(`(?:^|\\n)${marker}[:\\s]*\\n?([\\s\\S]*?)(?=\\n(?:🇷🇺|🇬🇧|🇺🇦|RU:|EN:|UK:)|$)`, "i");
              const match = text.match(regex);
              if (match && match[1]?.trim()) {
                return match[1].trim();
              }
            }
            return null;
          };
          
          const captionRu = extractBlock(captionText, ["🇷🇺 RU", "🇷🇺", "RU"]);
          const captionEn = extractBlock(captionText, ["🇬🇧 EN", "🇬🇧", "EN"]);
          const captionUk = extractBlock(captionText, ["🇺🇦 UK", "🇺🇦", "UK", "UA"]);
          
          // Fallback: if no language markers found, use entire text for all languages
          const fallbackCaption = (!captionRu && !captionEn && !captionUk && captionText) ? captionText : null;
          const finalRu = captionRu || fallbackCaption;
          const finalEn = captionEn || fallbackCaption;
          const finalUk = captionUk || fallbackCaption;

          // Update or insert DB row
          const { data: existing } = await supabase
            .from("bot_welcome_settings")
            .select("id")
            .limit(1)
            .maybeSingle();
          
          let updateErr: Error | null = null;
          if (existing) {
            const { error } = await supabase
              .from("bot_welcome_settings")
              .update({
                file_id: fileId,
                caption_ru: finalRu,
                caption_en: finalEn,
                caption_uk: finalUk,
                updated_at: new Date().toISOString(),
                updated_by: null, // Telegram admin doesn't have web user_id
              })
              .eq("id", existing.id);
            if (error) updateErr = error;
          } else {
            const { error } = await supabase
              .from("bot_welcome_settings")
              .insert({
                file_id: fileId,
                caption_ru: finalRu,
                caption_en: finalEn,
                caption_uk: finalUk,
              });
            if (error) updateErr = error;
          }

          if (updateErr) {
            console.error("Failed to update welcome settings:", updateErr);
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, text: `❌ DB error: ${updateErr.message}` }),
            });
          } else {
            // Preview what was saved
            const previewRu = (finalRu || "—").substring(0, 50) + ((finalRu?.length || 0) > 50 ? "..." : "");
            const previewEn = (finalEn || "—").substring(0, 50) + ((finalEn?.length || 0) > 50 ? "..." : "");
            const previewUk = (finalUk || "—").substring(0, 50) + ((finalUk?.length || 0) > 50 ? "..." : "");
            
            await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                text: `✅ *Welcome обновлён!*\n\n📎 file_id сохранён\n\n🇷🇺 *RU:*\n${previewRu}\n\n🇬🇧 *EN:*\n${previewEn}\n\n🇺🇦 *UK:*\n${previewUk}`,
                parse_mode: "Markdown",
              }),
            });
          }
        }
      }
    }

    // Handle voice messages
    if (update.message?.voice || update.message?.audio) {
      const chatId = update.message.chat?.id;
      const fromUser = update.message.from;
      const voice = update.message.voice || update.message.audio;
      const lang = await resolveLang(supabase, fromUser);
      
      if (voice && chatId && chatId > 0) { // Only in private chats
        console.log("Voice message received:", voice.file_id);
        
        // Send processing message
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, action: "typing" })
        });

        try {
          // Get file path from Telegram
          const fileResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ file_id: voice.file_id })
          });
          const fileData = await fileResponse.json();
          
          if (fileData.ok && fileData.result?.file_path) {
            const audioUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
            
            // Send to ElevenLabs for transcription
            const transcriptionResponse = await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/elevenlabs-transcribe`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({ audioUrl, languageCode: "auto" }),
              }
            );
            
            const transcription = await transcriptionResponse.json();
            
            if (transcription.text) {
              // Log activity
              await supabase.from("telegram_activity_log").insert({
                telegram_id: fromUser?.id || null,
                action: "voice_transcribed",
                metadata: { 
                  text_length: transcription.text.length,
                  detected_language: transcription.detected_language 
                },
              });
              
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  text: `${t("voiceTranscription", lang)}\n\n${transcription.text}`,
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [[
                      { text: `🇬🇧 ${t("voiceTranslateBtn", lang)}`, callback_data: "translate:en" },
                      { text: `🇷🇺 ${t("voiceTranslateBtn", lang)}`, callback_data: "translate:ru" },
                      { text: `🇺🇦 ${t("voiceTranslateBtn", lang)}`, callback_data: "translate:uk" },
                    ]]
                  }
                })
              });
            } else {
              await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ chat_id: chatId, text: t("errGeneric", lang) })
              });
            }
          }
        } catch (err) {
          console.error("Voice processing error:", err);
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: t("errGeneric", lang) })
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
