import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Newspaper } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const MobileNews = () => {
  const { language } = useLanguage();
  
  const { data: news } = useQuery({
    queryKey: ['news', language],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(4);
      
      if (error) throw error;
      return data;
    },
  });

  if (!news || news.length === 0) return null;

  return (
    <div className="lg:hidden px-4 py-6 space-y-4 border-t border-border/50">
      <h2 className="text-base font-semibold flex items-center gap-2">
        <Newspaper className="h-4 w-4" />
        {language === 'ru' ? 'Новости' : language === 'uk' ? 'Новини' : 'News'}
      </h2>
      <div className="space-y-2">
        {news.map((item) => (
          <a
            key={item.id}
            href={item.url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="block px-3 py-2.5 rounded-lg bg-card/50 hover:bg-card border border-border/50 transition-colors"
          >
            <h3 className="text-xs font-medium leading-tight line-clamp-2 mb-1">
              {item.title}
            </h3>
            <p className="text-[10px] text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          </a>
        ))}
      </div>
    </div>
  );
};

export default MobileNews;
