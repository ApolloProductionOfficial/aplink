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

    // Search queries based on language - search on news sites, not OnlyFans
    const searchQueriesByLang: Record<string, string[]> = {
      ru: [
        'site:xbiz.com OnlyFans',
        'site:avn.com creator platform',
        'site:xbiz.com content creator',
        'site:avn.com adult industry'
      ],
      en: [
        'site:xbiz.com OnlyFans',
        'site:avn.com content creator',
        'site:xbiz.com adult industry',
        'site:avn.com creator platform'
      ],
      uk: [
        'site:xbiz.com OnlyFans',
        'site:avn.com content creator',
        'site:xbiz.com creator platform',
        'site:avn.com adult industry'
      ]
    };

    const queries = searchQueriesByLang[language] || searchQueriesByLang.en;
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    console.log('Searching for:', randomQuery);

    // Using Brave Search API for real news
    const braveApiKey = Deno.env.get('BRAVE_API_KEY');
    // PRIMARY = Venice (uncensored); fall back to Groq. Lovable retired.
    const veniceKey = Deno.env.get('VENICE_API_KEY') || Deno.env.get('VENICE_INFERENCE_KEY');
    const groqKey = Deno.env.get('GROQ_API_KEY');
    const translateKeyAvailable = !!(veniceKey || groqKey);
    
    if (!braveApiKey) {
      console.log('BRAVE_API_KEY not set, using fallback');
    }

    const newsResponse = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(randomQuery)}&count=5`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': braveApiKey || ''
      }
    });

    let newsItems: NewsItem[] = [];

    if (newsResponse.ok && braveApiKey) {
      const newsData = await newsResponse.json();
      console.log('Search results received');

      if (newsData.web && newsData.web.results && newsData.web.results.length > 0) {
        const rawItems = newsData.web.results
          .filter((item: any) => item.url && !item.url.includes('onlyfans.com'))
          .slice(0, 2)
          .map((item: any) => {
            // Remove HTML tags from description
            const cleanDescription = (item.description || 'New developments in the creator economy')
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&quot;/g, '"')
              .trim();
            
            return {
              title: item.title || 'Industry Update',
              description: cleanDescription,
              source: new URL(item.url).hostname.replace('www.', ''),
              url: item.url,
              language: 'en' // Original language is English
            };
          });
        
        // Translate if needed and a chat provider is available (Venice→Groq)
        if (language !== 'en' && translateKeyAvailable && rawItems.length > 0) {
          console.log('Translating news to', language);

          try {
            const translateMessages = [
              {
                role: 'system',
                content: `You are a professional translator. Translate news titles and descriptions from English to ${language === 'ru' ? 'Russian' : 'Ukrainian'}. Return ONLY a JSON array with translated items in format: [{"title": "...", "description": "..."}]. Do not add any other text.`
              },
              {
                role: 'user',
                content: JSON.stringify(rawItems.map((item: any) => ({ title: item.title, description: item.description })))
              }
            ];
            const trChain: { name: string; url: string; key: string; model: string }[] = [];
            if (veniceKey) trChain.push({ name: 'venice', url: 'https://api.venice.ai/api/v1/chat/completions', key: veniceKey, model: 'venice-uncensored' });
            if (groqKey) trChain.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: groqKey, model: 'llama-3.3-70b-versatile' });

            let translationResponse: Response = new Response(null, { status: 500 });
            for (const t of trChain) {
              const r = await fetch(t.url, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${t.key}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: t.model, messages: translateMessages }),
              });
              if (r.ok) { translationResponse = r; break; }
              console.error(`[fetch-adult-news] translate provider=${t.name} failed`, r.status);
            }

            if (translationResponse.ok) {
              const translationData = await translationResponse.json();
              const translatedText = translationData.choices[0].message.content;
              
              // Extract JSON from the response
              const jsonMatch = translatedText.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                const translatedItems = JSON.parse(jsonMatch[0]);
                newsItems = rawItems.map((item: any, index: number) => ({
                  ...item,
                  title: translatedItems[index]?.title || item.title,
                  description: translatedItems[index]?.description || item.description
                }));
                console.log('Translation successful');
              } else {
                console.log('Could not extract JSON from translation, using original');
                newsItems = rawItems;
              }
            } else {
              console.log('Translation failed, using original');
              newsItems = rawItems;
            }
          } catch (error) {
            console.error('Translation error:', error);
            newsItems = rawItems;
          }
        } else {
          newsItems = rawItems;
        }
        
        console.log(`Found ${newsItems.length} news items`);
      }
    }

    // Fallback news if search returns nothing
    if (newsItems.length === 0) {
      console.log('No news found from search, using fallback');
      const fallbackNews: Record<string, NewsItem[]> = {
        ru: [
          {
            title: "Рост индустрии создателей контента",
            description: "Платформы для создателей контента продолжают расти, предоставляя новые возможности для монетизации",
            source: "Industry Report",
            url: "https://xbiz.com"
          },
          {
            title: "Новые тренды в продвижении",
            description: "Социальные сети остаются ключевым источником трафика для создателей контента",
            source: "Industry Analysis",
            url: "https://avn.com"
          }
        ],
        en: [
          {
            title: "Creator Economy Growth",
            description: "Content creator platforms continue to grow, offering new monetization opportunities",
            source: "Industry Report",
            url: "https://xbiz.com"
          },
          {
            title: "New Marketing Trends",
            description: "Social media remains a key traffic source for content creators",
            source: "Industry Analysis",
            url: "https://avn.com"
          }
        ],
        uk: [
          {
            title: "Зростання індустрії творців контенту",
            description: "Платформи для творців контенту продовжують рости, надаючи нові можливості монетизації",
            source: "Industry Report",
            url: "https://xbiz.com"
          },
          {
            title: "Нові тренди в просуванні",
            description: "Соціальні мережі залишаються ключовим джерелом трафіку для творців контенту",
            source: "Industry Analysis",
            url: "https://avn.com"
          }
        ]
      };
      
      newsItems = fallbackNews[language] || fallbackNews.en;
    }

    // Save news to database
    const { data, error } = await supabase
      .from('news')
      .insert(newsItems.map(item => ({
        title: item.title,
        description: item.description,
        source: item.source,
        url: item.url,
        published_at: new Date().toISOString(),
        language: language
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
