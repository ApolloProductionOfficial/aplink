import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { useNavigate } from "react-router-dom";

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
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  
  // Use scroll visibility hook - mobile only, hide during scroll
  const isVisible = useScrollVisibility(true, 200);

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

  // Function to format text with markdown-like syntax including links
  const formatMessage = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    
    // Regex to match **bold** and [text](link)
    const regex = /(\*\*.*?\*\*|\[.*?\]\(.*?\))/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const matched = match[0];
      
      // Handle bold text
      if (matched.startsWith('**') && matched.endsWith('**')) {
        parts.push(<strong key={match.index}>{matched.slice(2, -2)}</strong>);
      }
      // Handle links [text](url)
      else if (matched.startsWith('[')) {
        const linkMatch = matched.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          const [, linkText, linkUrl] = linkMatch;
          parts.push(
            <a
              key={match.index}
              href={linkUrl}
              onClick={(e) => {
                e.preventDefault();
                navigate(linkUrl);
                setIsOpen(false);
              }}
              className="text-primary hover:underline font-semibold cursor-pointer"
            >
              {linkText}
            </a>
          );
        }
      }
      
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts;
  };

  // Close chat when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only on mobile
      if (window.innerWidth >= 768) return;
      
      if (
        isOpen &&
        chatWindowRef.current &&
        !chatWindowRef.current.contains(event.target as Node)
      ) {
        // Check if click is not on the chat button itself
        const target = event.target as HTMLElement;
        if (!target.closest('button[class*="bottom-16"]')) {
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <>
      {/* Animated Hint Tooltip */}
      {showHint && !isOpen && (
        <div className="hidden md:block fixed bottom-20 right-4 z-50 animate-fade-in">
          <div className="bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-xl relative animate-bounce flex items-center gap-1.5">
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-primary transform rotate-45"></div>
            <Bot className="w-6 h-6 flex-shrink-0" />
            <p className="text-sm font-medium whitespace-nowrap leading-tight">{hintText}</p>
          </div>
        </div>
      )}

      {/* Chat Button */}
      <Button
        data-chat-button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowHint(false);
        }}
        className={`hidden md:flex fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg shadow-primary/50 transition-all duration-300 bg-primary backdrop-blur-sm border-2 border-primary flex-col items-center justify-center gap-0.5 p-2`}
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6 text-primary-foreground" />
        ) : (
          <>
            <Bot className="h-6 w-6 text-primary-foreground" />
            <span className="text-[7px] font-bold text-primary-foreground tracking-tight leading-none">APOLLO AI</span>
          </>
        )}
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div ref={chatWindowRef} className="fixed bottom-20 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] bg-card border-2 border-primary/30 rounded-2xl shadow-2xl shadow-primary/20 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <h3 className="font-semibold text-lg">{t.chatbot.title}</h3>
            <p className="text-xs text-muted-foreground">{t.chatbot.subtitle}</p>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-muted-foreground text-sm pt-8">
                <MessageCircle className="h-12 w-12 mx-auto mb-4 text-primary/50" />
                <p>{t.chatbot.welcome}</p>
                <p className="mt-2 text-xs">{t.chatbot.welcomeDetails}</p>
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
                placeholder={t.chatbot.placeholder}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-primary"
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
              {t.chatbot.disclaimer}{" "}
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
