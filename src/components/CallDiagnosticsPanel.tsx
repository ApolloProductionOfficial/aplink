import React, { useState } from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Smartphone, 
  Monitor, 
  Camera, 
  CameraOff, 
  Mic, 
  MicOff,
  Users,
  RefreshCw,
  Send,
  ChevronDown,
  ChevronUp,
  Clock,
  AlertCircle,
  CheckCircle,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
} from 'lucide-react';
import { ConnectionQuality, ConnectionState } from 'livekit-client';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { DiagnosticsState } from '@/hooks/useCallDiagnostics';

interface CallDiagnosticsPanelProps {
  state: DiagnosticsState;
  onSendReport: () => void;
  isIOSSafeMode: boolean;
}

function getConnectionQualityIcon(quality: ConnectionQuality | null) {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return <SignalHigh className="w-4 h-4 text-green-400" />;
    case ConnectionQuality.Good:
      return <SignalMedium className="w-4 h-4 text-green-400" />;
    case ConnectionQuality.Poor:
      return <SignalLow className="w-4 h-4 text-yellow-400" />;
    case ConnectionQuality.Lost:
      return <WifiOff className="w-4 h-4 text-red-400" />;
    default:
      return <Signal className="w-4 h-4 text-muted-foreground" />;
  }
}

function getConnectionStateColor(state: ConnectionState | null): string {
  switch (state) {
    case ConnectionState.Connected:
      return 'text-green-400';
    case ConnectionState.Connecting:
      return 'text-yellow-400';
    case ConnectionState.Reconnecting:
      return 'text-orange-400 animate-pulse';
    case ConnectionState.Disconnected:
      return 'text-red-400';
    default:
      return 'text-muted-foreground';
  }
}

function getConnectionStateText(state: ConnectionState | null): string {
  switch (state) {
    case ConnectionState.Connected:
      return 'Подключено';
    case ConnectionState.Connecting:
      return 'Подключение...';
    case ConnectionState.Reconnecting:
      return 'Переподключение...';
    case ConnectionState.Disconnected:
      return 'Отключено';
    default:
      return 'Неизвестно';
  }
}

function formatEventTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('ru-RU', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit' 
  });
}

function getEventIcon(type: string) {
  if (type.includes('RECONNECT')) return <RefreshCw className="w-3 h-3" />;
  if (type.includes('TRACK')) return <Activity className="w-3 h-3" />;
  if (type.includes('PARTICIPANT')) return <Users className="w-3 h-3" />;
  if (type.includes('CAMERA')) return <Camera className="w-3 h-3" />;
  if (type.includes('MICROPHONE')) return <Mic className="w-3 h-3" />;
  if (type.includes('CONNECTION')) return <Wifi className="w-3 h-3" />;
  return <AlertCircle className="w-3 h-3" />;
}

export function CallDiagnosticsPanel({ 
  state, 
  onSendReport, 
  isIOSSafeMode 
}: CallDiagnosticsPanelProps) {
  const [showEvents, setShowEvents] = useState(false);
  
  const sessionDuration = Math.round((Date.now() - state.startTime) / 1000);
  const sessionMinutes = Math.floor(sessionDuration / 60);
  const sessionSeconds = sessionDuration % 60;

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all hover:scale-105 border-white/[0.08]",
                state.reconnectCount > 0 
                  ? "bg-orange-500/20 border-orange-500/30" 
                  : "bg-white/10 hover:bg-white/20"
              )}
            >
              <Activity className={cn(
                "w-3.5 h-3.5 sm:w-4 sm:h-4",
                state.connectionState === ConnectionState.Reconnecting && "animate-pulse text-orange-400"
              )} />
              {state.reconnectCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center">
                  {state.reconnectCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-black/80 border-white/10">
          <p>Диагностика звонка</p>
        </TooltipContent>
      </Tooltip>

      <PopoverContent 
        side="bottom" 
        align="end" 
        sideOffset={8}
        className="w-80 p-0 bg-black/60 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
      >
        <div className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Диагностика
            </h3>
            {isIOSSafeMode && (
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-[10px] font-medium rounded-full">
                Safe Mode
              </span>
            )}
          </div>

          {/* Connection Status */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Статус</span>
              <span className={cn("font-medium flex items-center gap-1.5", getConnectionStateColor(state.connectionState))}>
                {state.connectionState === ConnectionState.Connected ? (
                  <CheckCircle className="w-3.5 h-3.5" />
                ) : state.connectionState === ConnectionState.Reconnecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5" />
                )}
                {getConnectionStateText(state.connectionState)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Качество связи</span>
              <span className="flex items-center gap-1.5">
                {getConnectionQualityIcon(state.networkMetrics.connectionQuality)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Реконнекты</span>
              <span className={cn(
                "font-mono",
                state.reconnectCount > 2 ? "text-red-400" : state.reconnectCount > 0 ? "text-orange-400" : "text-green-400"
              )}>
                {state.reconnectCount}
              </span>
            </div>
          </div>

          {/* Network Info */}
          {(state.networkMetrics.rtt || state.networkMetrics.downlink) && (
            <div className="space-y-2 pt-2 border-t border-white/[0.05]">
              <span className="text-xs text-muted-foreground font-medium">Сеть</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {state.networkMetrics.rtt && (
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span>{state.networkMetrics.rtt}ms</span>
                  </div>
                )}
                {state.networkMetrics.downlink && (
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5">
                    <Wifi className="w-3 h-3 text-muted-foreground" />
                    <span>{state.networkMetrics.downlink} Mbps</span>
                  </div>
                )}
                {state.networkMetrics.effectiveType && (
                  <div className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2 py-1.5 col-span-2">
                    <Signal className="w-3 h-3 text-muted-foreground" />
                    <span>{state.networkMetrics.effectiveType.toUpperCase()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Media & Participants */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.05]">
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
              state.isCameraEnabled ? "bg-green-500/20 text-green-400" : "bg-white/5 text-muted-foreground"
            )}>
              {state.isCameraEnabled ? <Camera className="w-3 h-3" /> : <CameraOff className="w-3 h-3" />}
            </div>
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
              state.isMicEnabled ? "bg-green-500/20 text-green-400" : "bg-white/5 text-muted-foreground"
            )}>
              {state.isMicEnabled ? <Mic className="w-3 h-3" /> : <MicOff className="w-3 h-3" />}
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span>{state.participantCount}</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/5 ml-auto">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>{sessionMinutes}:{sessionSeconds.toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Device Info */}
          <div className="flex items-center gap-2 pt-2 border-t border-white/[0.05]">
            {state.deviceInfo.platform === 'ios' || state.deviceInfo.platform === 'android' ? (
              <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
            )}
            <span className="text-xs text-muted-foreground">
              {state.deviceInfo.platform.toUpperCase()} • {state.deviceInfo.browser}
            </span>
          </div>

          {/* Events Log Toggle */}
          <button
            onClick={() => setShowEvents(!showEvents)}
            className="w-full flex items-center justify-between text-xs text-muted-foreground hover:text-foreground transition-colors pt-2 border-t border-white/[0.05]"
          >
            <span>Последние события ({state.events.length})</span>
            {showEvents ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Events Log */}
          {showEvents && (
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {state.events.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Нет событий</p>
                ) : (
                  state.events.map((event, i) => (
                    <div 
                      key={`${event.timestamp}-${i}`}
                      className="flex items-start gap-2 text-xs p-1.5 rounded-lg hover:bg-white/5"
                    >
                      <span className="text-muted-foreground shrink-0">
                        {formatEventTime(event.timestamp)}
                      </span>
                      <span className="shrink-0 mt-0.5">
                        {getEventIcon(event.type)}
                      </span>
                      <span className="truncate">
                        {event.type}
                        {event.details && (
                          <span className="text-muted-foreground ml-1">
                            ({event.details})
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Send Report Button */}
          <Button
            onClick={onSendReport}
            size="sm"
            className="w-full bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
          >
            <Send className="w-3.5 h-3.5 mr-2" />
            Отправить отчёт
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default CallDiagnosticsPanel;
