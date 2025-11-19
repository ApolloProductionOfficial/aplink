import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t, language } = useTranslation();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Animated hint that appears periodically
  useEffect(() => {
    if (isOpen) return; // Don't show hint if chat is open
    
    const showHintTimer = setInterval(() => {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 5000); // Show for 5 seconds
    }, 15000); // Show every 15 seconds

    // Show hint after 3 seconds on first load
    const initialTimer = setTimeout(() => {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 5000);
    }, 3000);

    return () => {
      clearInterval(showHintTimer);
      clearTimeout(initialTimer);
    };
  }, [isOpen]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: { messages: [...messages, userMessage] }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Ошибка",
          description: data.error,
          variant: "destructive"
        });
        return;
      }

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.choices[0].message.content
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось получить ответ. Попробуйте еще раз.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Array of hint messages that will rotate
  const hintMessages = language === 'ru' 
    ? [
        "Я знаю всё об адалте и отвечу на любой вопрос",
        "Я найду информацию на сайте за тебя если ты не нашел то что искал",
        "Нажми на меня 👋"
      ]
    : language === 'uk' 
    ? [
        "Я знаю все про адалт і відповім на будь-яке питання",
        "Я знайду інформацію на сайті за тебе якщо ти не знайшов те що шукав",
        "Натисни на мене 👋"
      ]
    : [
        "I know everything about adult industry and will answer any question",
        "I can find information on the site for you if you didn't find what you were looking for",
        "Click me 👋"
      ];
  
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const hintText = hintMessages[currentHintIndex];
  
  // Rotate hint messages
  useEffect(() => {
    const rotateHints = setInterval(() => {
      setCurrentHintIndex(prev => (prev + 1) % hintMessages.length);
    }, 5000);
    return () => clearInterval(rotateHints);
  }, [hintMessages.length]);

  // Function to format text with markdown-like syntax
  const formatMessage = (text: string) => {
    // Replace **text** with bold
    return text.split(/(\*\*.*?\*\*)/).map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Sync with music player visibility on mobile
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < lastScrollY && currentScrollY > 100) {
        setIsVisible(false);
      } else if (currentScrollY > lastScrollY) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <>
      {/* Animated Hint Tooltip */}
      {showHint && !isOpen && (
        <div className={`fixed bottom-[6rem] md:bottom-24 right-6 z-50 animate-fade-in transition-all duration-300 ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0'
        }`}>
          <div className="bg-primary text-primary-foreground px-2 py-1.5 md:px-4 md:py-3 rounded-lg shadow-xl relative animate-bounce flex items-center gap-1.5 max-w-[140px] md:max-w-none">
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-primary transform rotate-45"></div>
            <Bot className="w-3 h-3 md:w-6 md:h-6 flex-shrink-0" />
            <p className="text-[10px] md:text-sm font-medium md:whitespace-nowrap leading-tight">{hintText}</p>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <Button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowHint(false);
        }}
        className={`fixed bottom-16 md:bottom-6 right-6 z-50 h-16 w-16 rounded-full shadow-lg shadow-primary/50 transition-all duration-300 bg-primary backdrop-blur-sm border-2 border-primary flex flex-col items-center justify-center gap-0.5 p-2 ${
          isVisible ? 'translate-x-0 opacity-100' : 'translate-x-32 opacity-0'
        }`}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-primary-foreground" />
        ) : (
          <>
            <Bot className="h-6 w-6 text-primary-foreground" />
            <span className="text-[8px] font-bold text-primary-foreground tracking-wider leading-none">APOLLO AI</span>
          </>
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-[5.5rem] md:bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] h-[500px] bg-card border-2 border-primary/30 rounded-2xl shadow-2xl shadow-primary/20 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-lg">AI Помощник</h3>
            <p className="text-xs text-muted-foreground">Навигация по сайту</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm pt-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                <p>Привет! Я помогу тебе найти информацию на сайте.</p>
                <p className="mt-2 text-xs">Спроси меня о наших услугах, ценах или контактах.</p>
              </div>
            )}
            
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{formatMessage(msg.content)}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted p-3 rounded-lg">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите сообщение..."
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-primary hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Если не могу ответить - направлю в{" "}
              <a 
                href="https://t.me/Apollo_Production" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Telegram
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default AIChatBot;
