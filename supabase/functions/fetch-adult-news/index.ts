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

    // Search for adult industry news using web search
    const searchQueries = [
      'OnlyFans news updates',
      'adult content industry news',
      'content creator platform updates',
      'OnlyFans creator earnings news'
    ];

    const randomQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];
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
      const fallbackNews = [
        {
          title: 'Content Creator Economy Continues Growth',
          description: 'The creator economy shows strong momentum with increased earnings across major platforms.',
          source: 'Industry Insights'
        },
        {
          title: 'New Platform Features for Content Creators',
          description: 'Major platforms announce new tools and features to help creators monetize their content.',
          source: 'Platform Updates'
        }
      ];
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
