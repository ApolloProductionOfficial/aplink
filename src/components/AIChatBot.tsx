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

  // Array of hint messages that will rotate - shortened versions
  const hintMessages = language === 'ru' 
    ? [
        "Помогу найти всё!",
        "Задай вопрос 👋"
      ]
    : language === 'uk' 
    ? [
        "Допоможу знайти все!",
        "Задай питання 👋"
      ]
    : [
        "I'll help you find everything!",
        "Ask me 👋"
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
        <div className="hidden md:block fixed bottom-[110px] right-4 z-50">
          <div className="relative animate-cosmic-appear">
            {/* Outer cosmic glow - slightly offset so doesn't overlap text */}
            <div className="absolute -inset-4 rounded-2xl bg-primary/8 blur-3xl opacity-40 animate-pulse-glow" />
            
            <div className="relative bg-gradient-to-br from-primary via-primary/95 to-primary/90 text-primary-foreground px-4 py-2.5 rounded-2xl shadow-xl shadow-primary/30 backdrop-blur-2xl overflow-hidden flex items-center gap-2 border-2 border-primary-foreground/25">
              {/* Very subtle dark overlay for minimal contrast */}
              <div className="absolute inset-0 bg-black/5 rounded-2xl" />
              
              {/* Cosmic glow inside - subtle */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary-foreground/5 to-transparent animate-shimmer opacity-30" />
              
              {/* Rotating shimmer - subtle */}
              <div className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-primary-foreground/10 border-r-primary-foreground/5 animate-spin opacity-25" style={{ animationDuration: '4s' }} />
              
              {/* Floating particles inside hint - subtle and fewer */}
              <div className="absolute top-1 left-3 w-0.5 h-0.5 rounded-full bg-primary-foreground/20 animate-float" style={{ animationDuration: '2s' }} />
              <div className="absolute bottom-1.5 right-4 w-0.5 h-0.5 rounded-full bg-primary-foreground/15 animate-float" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
              
              <Bot className="w-5 h-5 flex-shrink-0 relative z-10 drop-shadow-lg" />
              <p className="text-sm font-semibold whitespace-nowrap leading-tight relative z-10 drop-shadow-md">
                {hintText}
              </p>
              
              {/* Arrow pointing to bot */}
              <div className="absolute -bottom-2 right-8 w-4 h-4 bg-gradient-to-br from-primary to-primary/95 transform rotate-45 shadow-lg shadow-primary/30 border-r border-b border-primary-foreground/15" />
            </div>
          </div>
        </div>
      )}

      {/* Chat Button - hidden visually on mobile but accessible via BottomNavigation click */}
      <Button
        data-chat-button
        onClick={() => {
          setIsOpen(!isOpen);
          setShowHint(false);
        }}
        className="opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto fixed bottom-6 right-6 z-50 h-16 w-16 p-0 bg-transparent border-0 overflow-visible"
        size="icon"
      >
        {/* Outer cosmic glow layers - outside the button */}
        <div className="absolute -inset-4 rounded-full bg-primary/10 blur-3xl opacity-40 animate-pulse-glow" />
        <div className="absolute -inset-6 rounded-full bg-primary/5 blur-2xl opacity-25 animate-pulse" style={{ animationDuration: '4s' }} />
        
        <div className={`relative w-full h-full rounded-full transition-all duration-500 group ${
          isOpen 
            ? 'bg-gradient-to-br from-primary via-primary to-primary/90 scale-95' 
            : 'bg-gradient-to-br from-primary/90 via-primary to-primary/80 hover:scale-110'
        }`}>
          {/* Liquid drop effect - multiple layers */}
          <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/30 via-primary/20 to-transparent blur-2xl opacity-50 group-hover:opacity-70 animate-pulse-glow" />
          <div className="absolute -inset-1 rounded-full bg-gradient-to-t from-primary/25 to-transparent blur-xl opacity-40 animate-pulse" style={{ animationDuration: '3s' }} />
          
          {/* Multiple ripple rings with different speeds */}
          <div className="absolute -inset-3 rounded-full border-2 border-primary/20 animate-ping opacity-20" style={{ animationDuration: '2s' }} />
          <div className="absolute -inset-4 rounded-full border border-primary/15 animate-ping opacity-12" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
          <div className="absolute -inset-5 rounded-full border border-primary/10 animate-ping opacity-8" style={{ animationDuration: '4s', animationDelay: '1s' }} />
          
          {/* Shimmer wave effect */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer" />
          </div>
          
          {/* Rotating glow ring */}
          <div className="absolute inset-0 rounded-full">
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary/25 border-r-primary/15 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          
          {/* Floating particles */}
          <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary-foreground/40 animate-float shadow-[0_0_4px_rgba(255,255,255,0.3)]" style={{ animationDuration: '2s' }} />
          <div className="absolute bottom-3 left-3 w-1 h-1 rounded-full bg-primary-foreground/25 animate-float shadow-[0_0_3px_rgba(255,255,255,0.2)]" style={{ animationDuration: '3s', animationDelay: '0.5s' }} />
          <div className="absolute top-4 left-2 w-0.5 h-0.5 rounded-full bg-primary-foreground/30 animate-float shadow-[0_0_2px_rgba(255,255,255,0.25)]" style={{ animationDuration: '2.5s', animationDelay: '1s' }} />
          <div className="absolute bottom-1 right-4 w-0.5 h-0.5 rounded-full bg-primary-foreground/20 animate-float shadow-[0_0_2px_rgba(255,255,255,0.15)]" style={{ animationDuration: '2.8s', animationDelay: '0.3s' }} />
          
          {/* Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
            {isOpen ? (
              <X className="h-7 w-7 text-primary-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
            ) : (
              <>
                <Bot className="h-7 w-7 text-primary-foreground drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)] animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="text-[8px] font-bold text-primary-foreground tracking-tight leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)] mt-0.5">APOLLO AI</span>
              </>
            )}
          </div>
          
          {/* Inner glow border */}
          <div className="absolute inset-0 rounded-full border-2 border-primary-foreground/20 group-hover:border-primary-foreground/30 transition-all duration-300 shadow-[inset_0_0_15px_rgba(255,255,255,0.05)]" />
        </div>
      </Button>

      {/* Chat Window */}
      {isOpen && (
        <div ref={chatWindowRef} className="fixed bottom-20 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] h-[500px] backdrop-blur-xl bg-gradient-to-br from-card/95 via-card/90 to-card/95 border-2 border-primary/20 rounded-2xl shadow-xl shadow-primary/15 flex flex-col overflow-hidden">
          {/* Cosmic background effects */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5 animate-pulse-glow pointer-events-none" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent animate-shimmer" />
          
          {/* Header */}
          <div className="relative p-4 border-b border-primary/15 bg-gradient-to-r from-primary/5 via-primary/3 to-primary/5">
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
                      ? 'bg-gradient-to-br from-primary via-primary to-primary/90 text-primary-foreground shadow-md shadow-primary/15'
                      : 'bg-gradient-to-br from-primary/3 via-muted/90 to-primary/5 border border-primary/15 shadow-sm shadow-primary/5'
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
