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

// Rate limiting helper with email alerts
async function checkRateLimit(ip: string, functionName: string, maxRequests = 100): Promise<{ allowed: boolean; remaining?: number; retryAfter?: number; current_count?: number }> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_ip_address: ip,
      p_function_name: functionName,
      p_max_requests: maxRequests
    });
    
    if (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true };
    }
    
    // Send email alert if rate limit exceeded
    if (!data.allowed && data.current_count) {
      const overLimit = data.current_count - maxRequests;
      if (overLimit === 1 || overLimit % 50 === 0) {
        try {
          await supabase.functions.invoke('send-rate-limit-alert', {
            body: {
              ip_address: ip,
              function_name: functionName,
              request_count: data.current_count,
              max_requests: maxRequests
            }
          });
          console.log(`Rate limit alert sent for IP: ${ip}`);
        } catch (alertError) {
          console.error('Failed to send rate limit alert:', alertError);
        }
      }
    }
    
    return data;
  } catch (e) {
    console.error('Rate limit error:', e);
    return { allowed: true };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Rate limiting
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('cf-connecting-ip') || 'unknown';
    const rateLimit = await checkRateLimit(clientIP, 'fetch-adult-news', 30); // Lower limit for news
    
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for IP: ${clientIP}`);
      return new Response(JSON.stringify({ 
        error: 'Слишком много запросов. Попробуйте через минуту.',
        retry_after: rateLimit.retryAfter,
        success: false
      }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter || 60)
        },
      });
    }
    console.log('Starting adult industry news fetch...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get language from request body
    const body = req.method === 'POST' ? await req.json() : {};
    const language = body.language || 'en';
    
    console.log('Fetching news for language:', language);

    // Search queries based on language - search for RECENT news only (2025-2026)
    // Adding year filter to get fresh content
    const currentYear = new Date().getFullYear();
    const searchQueriesByLang: Record<string, string[]> = {
      ru: [
        `site:xbiz.com OnlyFans ${currentYear}`,
        `site:avn.com creator platform ${currentYear}`,
        `site:xbiz.com content creator news ${currentYear}`,
        `site:avn.com adult industry ${currentYear}`
      ],
      en: [
        `site:xbiz.com OnlyFans ${currentYear}`,
        `site:avn.com content creator ${currentYear}`,
        `site:xbiz.com adult industry news ${currentYear}`,
        `site:avn.com creator platform ${currentYear}`
      ],
      uk: [
        `site:xbiz.com OnlyFans ${currentYear}`,
        `site:avn.com content creator ${currentYear}`,
        `site:xbiz.com creator platform ${currentYear}`,
        `site:avn.com adult industry ${currentYear}`
      ]
    };

    const queries = searchQueriesByLang[language] || searchQueriesByLang.en;
    const randomQuery = queries[Math.floor(Math.random() * queries.length)];
    console.log('Searching for:', randomQuery);

    // Using Brave Search API for real news
    const braveApiKey = Deno.env.get('BRAVE_API_KEY');
    const openrouterApiKey = Deno.env.get('OPENROUTER_API_KEY');
    const veniceApiKey = Deno.env.get('APOLLO_AI_API_KEY');
    
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
          .filter((item: any) => {
            if (!item.url) return false;
            // Skip OnlyFans direct links
            if (item.url.includes('onlyfans.com')) return false;
            // Skip homepage and category pages - only allow article URLs
            const url = item.url.toLowerCase();
            if (url.match(/^https?:\/\/[^\/]+\/?$/)) return false; // Homepage
            if (url.match(/^https?:\/\/[^\/]+\/news\/?$/)) return false; // /news page
            if (url.match(/^https?:\/\/[^\/]+\/[a-z-]+\/?$/)) return false; // Single category
            // Must have a specific article path (contains numbers or long slugs)
            const path = url.replace(/^https?:\/\/[^\/]+/, '');
            if (path.length < 15) return false; // Too short path = likely not an article
            return true;
          })
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
        
        // Translate if needed
        if (language !== 'en' && (openrouterApiKey || veniceApiKey) && rawItems.length > 0) {
          console.log('Translating news to', language);
          
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

          try {
            let translationResponse: Response | null = null;

            // Try OpenRouter first
            if (openrouterApiKey) {
              translationResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${openrouterApiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://apolloproduction.studio', 'X-Title': 'Apollo News' },
                body: JSON.stringify({ model: 'openrouter/free', messages: translateMessages, plugins: [] }),
              });
              if (!translationResponse.ok) {
                console.warn('OpenRouter translate failed:', translationResponse.status);
                translationResponse = null;
              }
            }
            // HuggingFace fallback (free)
            const hfApiKey = Deno.env.get('HUGGINGFACE_API_KEY');
            if (!translationResponse && hfApiKey) {
              for (const hfModel of ['Qwen/Qwen2.5-72B-Instruct', 'meta-llama/Llama-3.3-70B-Instruct']) {
                translationResponse = await fetch('https://router.huggingface.co/v1/chat/completions', {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${hfApiKey}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({ model: hfModel, messages: translateMessages, max_tokens: 2048 }),
                });
                if (translationResponse.ok) break;
                console.warn(`HuggingFace ${hfModel} translate failed:`, translationResponse.status);
                translationResponse = null;
              }
            }
            // Venice fallback
            if (!translationResponse && veniceApiKey) {
              translationResponse = await fetch('https://api.venice.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${veniceApiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'zai-org-glm-4.7-flash', messages: translateMessages }),
              });
              if (!translationResponse.ok) translationResponse = null;
            }

            if (translationResponse) {
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
            title: "Платформы для создателей контента продолжают развиваться",
            description: "Индустрия создателей контента демонстрирует стабильный рост и новые возможности для монетизации",
            source: "xbiz.com",
            url: "https://www.xbiz.com/news/293733/onlyfans-institutes-criminal-background-checks-for-us-creators"
          },
          {
            title: "Новые инструменты для продвижения контента",
            description: "Создатели контента получают доступ к новым маркетинговым инструментам",
            source: "avn.com",
            url: "https://avn.com/news/video/joey-kim-launches-creator-platform-muselink-179494"
          }
        ],
        en: [
          {
            title: "Content Creator Platforms Continue to Evolve",
            description: "The creator economy shows steady growth with new monetization opportunities",
            source: "xbiz.com",
            url: "https://www.xbiz.com/news/293733/onlyfans-institutes-criminal-background-checks-for-us-creators"
          },
          {
            title: "New Marketing Tools for Content Promotion",
            description: "Content creators gain access to new promotional tools and platforms",
            source: "avn.com",
            url: "https://avn.com/news/video/joey-kim-launches-creator-platform-muselink-179494"
          }
        ],
        uk: [
          {
            title: "Платформи для творців контенту продовжують розвиватися",
            description: "Індустрія творців контенту демонструє стабільне зростання та нові можливості монетизації",
            source: "xbiz.com",
            url: "https://www.xbiz.com/news/293733/onlyfans-institutes-criminal-background-checks-for-us-creators"
          },
          {
            title: "Нові інструменти для просування контенту",
            description: "Творці контенту отримують доступ до нових маркетингових інструментів",
            source: "avn.com",
            url: "https://avn.com/news/video/joey-kim-launches-creator-platform-muselink-179494"
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
