import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NewsItem {
  title: string;
  description: string;
  source: string;
  url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting adult industry news fetch...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get language from request body
    const body = req.method === 'POST' ? await req.json() : {};
    const language = body.language || 'en';
    
    console.log('Fetching news for language:', language);

    // Search queries based on language
    const searchQueriesByLang: Record<string, string[]> = {
      ru: [
        'OnlyFans новости',
        'новости индустрии контента для взрослых',
        'заработок создателей контента новости',
        'OnlyFans обновления платформы'
      ],
      en: [
        'OnlyFans news updates',
        'adult content industry news',
        'content creator earnings news',
        'OnlyFans platform updates'
      ],
      uk: [
        'OnlyFans новини',
        'новини індустрії контенту для дорослих',
        'заробіток創аторів контенту новини',
        'OnlyFans оновлення платформи'
      ]
    };

    const queries = searchQueriesByLang[language] || searchQueriesByLang.en;
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    console.log('Searching for:', randomQuery);

    // Using a simple news API approach
    const newsResponse = await fetch(`https://api.search.brave.com/res/v1/news/search?q=${encodeURIComponent(randomQuery)}&count=2`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': Deno.env.get('BRAVE_API_KEY') || 'demo'
      }
    });

    let newsItems: NewsItem[] = [];

    if (newsResponse.ok) {
      const newsData = await newsResponse.json();
      console.log('News data received:', newsData);

      if (newsData.results && newsData.results.length > 0) {
        newsItems = newsData.results.slice(0, 2).map((item: any) => ({
          title: item.title || 'Industry Update',
          description: item.description || item.snippet || 'New developments in the adult content industry',
          source: item.source || 'Industry News',
          url: item.url
        }));
      }
    }

    // Fallback news if API fails or no key
    if (newsItems.length === 0) {
      console.log('Using fallback news');
      const fallbackNewsByLang: Record<string, any[]> = {
        ru: [
          {
            title: 'Экономика создателей контента продолжает рост',
            description: 'Индустрия создателей контента показывает сильный рост с увеличением доходов на всех основных платформах.',
            source: 'Отраслевая аналитика',
            url: 'https://onlyfans.com'
          },
          {
            title: 'Новые функции для создателей контента',
            description: 'Основные платформы анонсируют новые инструменты для монетизации контента.',
            source: 'Новости платформ',
            url: 'https://onlyfans.com'
          }
        ],
        en: [
          {
            title: 'Content Creator Economy Continues Growth',
            description: 'The creator economy shows strong momentum with increased earnings across major platforms.',
            source: 'Industry Insights',
            url: 'https://onlyfans.com'
          },
          {
            title: 'New Platform Features for Content Creators',
            description: 'Major platforms announce new tools and features to help creators monetize their content.',
            source: 'Platform Updates',
            url: 'https://onlyfans.com'
          }
        ],
        uk: [
          {
            title: 'Економіка творців контенту продовжує зростання',
            description: 'Індустрія творців контенту показує сильне зростання зі збільшенням доходів на всіх основних платформах.',
            source: 'Галузева аналітика',
            url: 'https://onlyfans.com'
          },
          {
            title: 'Нові функції для творців контенту',
            description: 'Основні платформи анонсують нові інструменти для монетизації контенту.',
            source: 'Новини платформ',
            url: 'https://onlyfans.com'
          }
        ]
      };
      const fallbackNews = fallbackNewsByLang[language] || fallbackNewsByLang.en;
      newsItems = [fallbackNews[Math.floor(Math.random() * fallbackNews.length)]];
    }

    // Save news to database
    const { data, error } = await supabase
      .from('news')
      .insert(newsItems.map(item => ({
        title: item.title,
        description: item.description,
        source: item.source,
        url: item.url,
        published_at: new Date().toISOString()
      })));

    if (error) {
      console.error('Error saving news:', error);
      throw error;
    }

    console.log(`Successfully saved ${newsItems.length} news items`);

    return new Response(JSON.stringify({ 
      success: true, 
      count: newsItems.length,
      items: newsItems
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error fetching news:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to fetch news',
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
