import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { useScrollVisibility } from "@/hooks/useScrollVisibility";
import { useNavigate } from "react-router-dom";
import OscarWelcome from "./OscarWelcome";

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
  const [showOscarWelcome, setShowOscarWelcome] = useState(false);
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

      // Check for Oscar special effect
      if (data.special_effect === "oscar_welcome") {
        setShowOscarWelcome(true);
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

  // Function to format text with markdown-like syntax including links and telegram mentions
  const formatMessage = (text: string) => {
    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    
    // Regex to match @username, **[text](link)** (bold links), **bold**, [text](link), and emoji
    // Put @username FIRST so it matches before bold text processing
    const regex = /(@[a-zA-Z0-9_]+|\*\*\[.*?\]\(.*?\)\*\*|\*\*.*?\*\*|\[.*?\]\(.*?\)|[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu;
    let match;
    let emojiIndex = 0;
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      const matched = match[0];
      
      // Handle telegram mentions @username FIRST
      if (matched.startsWith('@')) {
        const username = matched.slice(1);
        parts.push(
          <a
            key={match.index}
            href={`https://t.me/${username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline hover:text-primary/80 font-bold cursor-pointer transition-colors duration-200"
          >
            {matched}
          </a>
        );
      }
      // Handle emoji
      else if (/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(matched)) {
        parts.push(
          <span
            key={match.index}
            className="inline-block animate-emoji-bounce"
            style={{ animationDelay: `${emojiIndex * 0.15}s` }}
          >
            {matched}
          </span>
        );
        emojiIndex++;
      }
      // Handle bold links **[text](url)**
      else if (matched.startsWith('**[') && matched.endsWith(')**')) {
        const linkMatch = matched.match(/\*\*\[(.*?)\]\((.*?)\)\*\*/);
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
              className="text-primary hover:underline font-bold cursor-pointer"
            >
              {linkText}
            </a>
          );
        }
      }
      // Handle bold text **text** - but check if it contains @username
      else if (matched.startsWith('**') && matched.endsWith('**')) {
        const boldContent = matched.slice(2, -2);
        // Check if bold content contains @username
        if (boldContent.includes('@')) {
          // Recursively format the bold content to handle @username inside
          parts.push(<strong key={match.index}>{formatMessage(boldContent)}</strong>);
        } else {
          parts.push(<strong key={match.index}>{boldContent}</strong>);
        }
      }
      // Handle regular links [text](url)
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
      {/* Oscar Welcome Effect */}
      {showOscarWelcome && (
        <OscarWelcome onComplete={() => setShowOscarWelcome(false)} />
      )}

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
        className={`hidden md:flex fixed bottom-4 right-4 z-50 h-16 w-16 rounded-full transition-all duration-300 backdrop-blur-sm flex-col items-center justify-center gap-0.5 p-2 relative group ${
          isOpen 
            ? 'bg-gradient-to-br from-primary via-primary to-primary/90 border-2 border-primary shadow-2xl shadow-primary/60' 
            : 'bg-gradient-to-br from-primary/90 via-primary to-primary/80 border-2 border-primary shadow-2xl shadow-primary/60 hover:shadow-primary/80 hover:scale-110'
        }`}
        size="icon"
      >
        {/* Cosmic glow effect - always visible */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40 blur-xl opacity-60 group-hover:opacity-100 animate-pulse-glow" />
        
        {/* Animated shimmer ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary/0 group-hover:border-primary/40 animate-shimmer" />
        
        {/* Rotating cosmic particles */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute top-0 left-1/2 w-1 h-1 bg-primary/60 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
          <div className="absolute bottom-0 right-1/2 w-1 h-1 bg-primary/60 rounded-full animate-spin" style={{ animationDuration: '4s', animationDirection: 'reverse' }} />
        </div>
        
        {/* Content */}
        <div className="relative z-10">
          {isOpen ? (
            <X className="h-7 w-7 text-primary-foreground drop-shadow-lg" />
          ) : (
            <>
              <Bot className="h-7 w-7 text-primary-foreground drop-shadow-lg" />
              <span className="text-[8px] font-bold text-primary-foreground tracking-tight leading-none drop-shadow-md">APOLLO AI</span>
            </>
          )}
        </div>
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div ref={chatWindowRef} className="fixed bottom-20 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-2 border-primary/30 rounded-2xl shadow-2xl shadow-primary/30 flex flex-col overflow-hidden">
          {/* Cosmic background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 animate-pulse-glow pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-shimmer" />
          
          {/* Header */}
          <div className="relative p-4 border-b border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10">
            <h3 className="font-semibold text-lg bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{t.chatbot.title}</h3>
            <p className="text-xs text-muted-foreground">{t.chatbot.subtitle}</p>
          </div>

          {/* Messages */}
          <div className="relative flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
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
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-xl backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-lg shadow-primary/30'
                      : 'bg-gradient-to-br from-primary/5 via-muted/90 to-primary/10 border border-primary/20 shadow-md shadow-primary/10'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{formatMessage(msg.content)}</p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-gradient-to-br from-muted/80 to-muted/60 p-3 rounded-xl border border-primary/10 shadow-md backdrop-blur-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-sm shadow-primary/50" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-sm shadow-primary/50" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce shadow-sm shadow-primary/50" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="relative p-4 border-t border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t.chatbot.placeholder}
                className="flex-1 px-4 py-2.5 bg-background/50 backdrop-blur-sm border border-primary/20 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary/40 transition-all duration-300 placeholder:text-muted-foreground/60"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="bg-gradient-to-br from-primary via-primary to-primary/90 hover:from-primary/90 hover:via-primary/80 hover:to-primary/70 shadow-lg shadow-primary/30 transition-all duration-300 hover:scale-105"
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
                className="text-primary hover:underline font-semibold"
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
