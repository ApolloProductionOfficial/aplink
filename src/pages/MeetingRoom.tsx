import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const MeetingRoom = () => {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get("name");
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Redirect to home page if no name provided - user must introduce themselves
  useEffect(() => {
    if (!userName) {
      navigate(`/?room=${encodeURIComponent(roomId || "")}`);
    }
  }, [userName, roomId, navigate]);

  const roomLink = `${window.location.origin}/room/${roomId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      toast({
        title: "Ссылка скопирована!",
        description: "Отправьте её участникам для подключения",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: "Ошибка",
        description: "Не удалось скопировать ссылку",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const initJitsi = () => {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) {
        // Retry if API not loaded yet
        setTimeout(initJitsi, 500);
        return;
      }

      try {
        const domain = "8x8.vc";
        const options = {
          roomName: `vpaas-magic-cookie-0dd6b184ec7a4883bb89cbfc8c186c8a/${roomId}`,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: {
            displayName: userName,
          },
          configOverwrite: {
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            defaultLanguage: "ru",
            toolbarButtons: [
              'camera',
              'chat',
              'closedcaptions',
              'desktop',
              'download',
              'embedmeeting',
              'etherpad',
              'feedback',
              'filmstrip',
              'fullscreen',
              'hangup',
              'help',
              'highlight',
              'invite',
              'linktosalesforce',
              'livestreaming',
              'microphone',
              'noisesuppression',
              'participants-pane',
              'profile',
              'raisehand',
              'recording',
              'security',
              'select-background',
              'settings',
              'shareaudio',
              'sharedvideo',
              'shortcuts',
              'stats',
              'tileview',
              'toggle-camera',
              'videoquality',
              'whiteboard',
            ],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_BRAND_WATERMARK: false,
            BRAND_WATERMARK_LINK: "",
            DEFAULT_BACKGROUND: "#050505",
            TOOLBAR_ALWAYS_VISIBLE: true,
            MOBILE_APP_PROMO: false,
            TOOLBAR_BACKGROUND: "#0a0a0a",
          },
        };

        apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
        setIsLoading(false);

        // Inject custom CSS to style the toolbar to match site theme
        const injectCustomStyles = () => {
          const iframe = containerRef.current?.querySelector('iframe');
          if (iframe && iframe.contentDocument) {
            const style = iframe.contentDocument.createElement('style');
            style.textContent = `
              .new-toolbox {
                background: linear-gradient(to top, rgba(10, 10, 10, 0.95), rgba(10, 10, 10, 0.8)) !important;
                border-top: 1px solid rgba(139, 92, 246, 0.2) !important;
              }
              .toolbox-background {
                background: linear-gradient(to top, rgba(10, 10, 10, 0.95), transparent) !important;
              }
            `;
            iframe.contentDocument.head.appendChild(style);
          }
        };
        
        // Try to inject styles after iframe loads
        setTimeout(injectCustomStyles, 2000);
        setTimeout(injectCustomStyles, 4000);

        // Handle call end - redirect to Apollo Production
        apiRef.current.addEventListener("readyToClose", () => {
          window.location.href = "https://apolloproduction.studio";
        });

        apiRef.current.addEventListener("videoConferenceLeft", () => {
          window.location.href = "https://apolloproduction.studio";
        });

      } catch (error) {
        console.error("Failed to initialize Jitsi:", error);
        toast({
          title: "Ошибка подключения",
          description: "Не удалось подключиться к комнате. Попробуйте обновить страницу.",
          variant: "destructive",
        });
      }
    };

    initJitsi();

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
      }
    };
  }, [roomId, userName, toast]);

  // Don't render if no username - redirecting
  if (!userName) {
    return null;
  }

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-card/80 backdrop-blur-xl border-b border-border/50 z-10">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="hidden sm:inline">APLink</span>
          </a>
          <div className="h-6 w-px bg-border/50" />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate max-w-[200px]">{roomId}</span>
          </div>
        </div>
        
        <Button
          onClick={copyLink}
          variant="outline"
          size="sm"
          className="border-primary/50 hover:bg-primary/10"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-2 text-green-500" />
              Скопировано
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Скопировать ссылку
            </>
          )}
        </Button>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-20">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full border-4 border-primary/30 border-t-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Подключение к комнате...</p>
          </div>
        </div>
      )}

      {/* Jitsi Container */}
      <div 
        ref={containerRef} 
        className="flex-1 w-full"
        style={{ minHeight: 0 }}
      />
    </div>
  );
};

export default MeetingRoom;
