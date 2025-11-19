import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProductNews {
  title: string;
  description: string;
  category: string;
}

const productNews: ProductNews[] = [
  {
    title: "Apollo Production запускает партнёрскую программу с доходом 40%",
    description: "Стартовала уникальная партнёрская программа для агентств и рекрутеров. Получайте 40% пассивного дохода с каждой приведённой модели на всех платформах: OnlyFans, Fansly, MYM и других. Полная прозрачность выплат, еженедельные отчёты и профессиональная поддержка на каждом этапе.",
    category: "partnership"
  },
  {
    title: "Разблокировка крипто-выводов Fansly теперь за 24 часа",
    description: "Apollo Production предлагает экспресс-разблокировку криптовалютных платежей на Fansly. Более 70 успешных кейсов, гарантия результата и полное сопровождение процесса. Все легально и безопасно с полной анонимностью. Начните получать выплаты в USDT уже завтра!",
    category: "crypto"
  },
  {
    title: "Верификация OnlyFans для моделей из РФ и СНГ - решение проблемы FACEBAN",
    description: "Специальное предложение для моделей из России и СНГ: полная верификация OnlyFans даже при блокировке FACEBAN. Включает настройку OF, SKRILL и PAXUM не выходя из дома. Работаем с любыми гарантами для вашей безопасности. Помощь от А до Я в прохождении верификации.",
    category: "verification"
  },
  {
    title: "Набор моделей на 12+ платформ - диверсификация дохода",
    description: "Apollo Production открывает набор моделей для работы одновременно на нескольких платформах: OnlyFans, Fansly, LoyalFans, ManyVids, 4based, FanCentro и других. Профессиональный менеджмент, контент-планы, помощь с трафиком и маркетингом. Заработок от $3000 до $50000+ в месяц.",
    category: "recruitment"
  },
  {
    title: "Получение резидентства в Дубае для моделей и создателей контента",
    description: "Эксклюзивная услуга от Apollo Production: помощь в получении резидентства в ОАЭ для моделей и контент-мейкеров. Легальное налоговое планирование, открытие счетов, визовая поддержка. Работайте из любой точки мира с комфортом и безопасностью.",
    category: "dubai"
  },
  {
    title: "Вебкам-услуги премиум класса от Apollo Production",
    description: "Запускаем направление премиум вебкам-услуг с профессиональной студией, качественным оборудованием и опытными операторами. Высокие ставки, гибкий график, полная конфиденциальность. Идеально для моделей, желающих диверсифицировать источники дохода.",
    category: "webcam"
  },
  {
    title: "Автоматизация Instagram и TikTok - фермы для трафика на OnlyFans",
    description: "Apollo Production представляет систему автоматизации Instagram и TikTok для привлечения целевого трафика. 200-400+ аккаунтов на устройство, AI-управление 24/7, умные алгоритмы прогрева. Масштабируйте свой трафик без дополнительных затрат времени.",
    category: "automation"
  },
  {
    title: "Источники трафика от Apollo Production - полный комплекс услуг",
    description: "Используем все доступные каналы привлечения трафика: TikTok, Instagram, Twitter, Telegram, Dating, PPC, SEO и коллаборации с инфлюенсерами. Системный подход, детальная аналитика, постоянная оптимизация. Превращаем трафик в стабильный доход для ваших моделей.",
    category: "traffic"
  }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily product news posting...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get a random product news
    const randomNews = productNews[Math.floor(Math.random() * productNews.length)];
    console.log('Selected news:', randomNews.title);

    // Check if we already posted news today
    const today = new Date().toISOString().split('T')[0];
    const { data: existingNews } = await supabase
      .from('news')
      .select('id')
      .eq('source', 'Only4riends')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`);

    if (existingNews && existingNews.length > 0) {
      console.log('News already posted today');
      return new Response(
        JSON.stringify({ message: 'News already posted today' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Insert the news into database
    const { error: insertError } = await supabase
      .from('news')
      .insert({
        title: randomNews.title,
        description: randomNews.description,
        source: 'Only4riends',
        url: 'https://t.me/MenuOnly4Friends',
        published_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error inserting news:', insertError);
      throw insertError;
    }

    console.log('Product news posted successfully');

    return new Response(
      JSON.stringify({ 
        message: 'Product news posted successfully',
        news: randomNews
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in post-product-news function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
