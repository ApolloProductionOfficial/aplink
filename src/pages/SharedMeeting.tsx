import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Users, Calendar, ArrowLeft, Download, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { generateMeetingPdf } from '@/utils/generateMeetingPdf';
import apolloLogo from '@/assets/apollo-logo.mp4';

interface MeetingTranscript {
  id: string;
  room_id: string;
  room_name: string;
  started_at: string;
  ended_at: string | null;
  transcript: string | null;
  summary: string | null;
  key_points: {
    summary?: string;
    keyPoints?: string[];
    actionItems?: string[];
    decisions?: string[];
  } | null;
  participants: string[] | null;
}

const SharedMeeting = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meeting, setMeeting] = useState<MeetingTranscript | null>(null);

  useEffect(() => {
    const fetchSharedMeeting = async () => {
      if (!token) {
        setError('Ссылка недействительна');
        setLoading(false);
        return;
      }

      // First, get the share link
      const { data: linkData, error: linkError } = await supabase
        .from('shared_meeting_links')
        .select('meeting_id, is_active, expires_at')
        .eq('share_token', token)
        .maybeSingle();

      if (linkError || !linkData) {
        setError('Ссылка не найдена или недействительна');
        setLoading(false);
        return;
      }

      if (!linkData.is_active) {
        setError('Эта ссылка была деактивирована');
        setLoading(false);
        return;
      }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('Срок действия ссылки истёк');
        setLoading(false);
        return;
      }

      // Fetch the meeting using service role via edge function
      const { data: meetingData, error: meetingError } = await supabase.functions.invoke('get-shared-meeting', {
        body: { meetingId: linkData.meeting_id }
      });

      if (meetingError || !meetingData?.meeting) {
        setError('Не удалось загрузить созвон');
        setLoading(false);
        return;
      }

      setMeeting(meetingData.meeting);
      setLoading(false);
    };

    fetchSharedMeeting();
  }, [token]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-card/50 backdrop-blur-sm border-border/50">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h1 className="text-xl font-bold mb-2">Ошибка</h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Button onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              На главную
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!meeting) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 md:gap-3 cursor-pointer group"
          >
            <div className="relative w-10 h-10 md:w-12 md:h-12">
              <div className="absolute inset-0 rounded-full bg-primary/40 blur-md animate-pulse" />
              <div className="relative w-10 h-10 md:w-12 md:h-12 rounded-full overflow-hidden ring-2 ring-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.6)]">
                <video 
                  src={apolloLogo} 
                  autoPlay 
                  loop 
                  muted 
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover scale-[1.3] origin-center"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-lg md:text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent group-hover:opacity-80 transition-opacity">
                APLink
              </span>
              <span className="text-[9px] md:text-xs text-muted-foreground -mt-1">
                by Apollo Production
              </span>
            </div>
          </div>
          
          <Badge variant="secondary" className="gap-1">
            <FileText className="w-3 h-3" />
            Публичный конспект
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <Users className="w-6 h-6 text-primary" />
                  {meeting.room_name}
                </CardTitle>
                <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {formatDate(meeting.started_at)}
                  </span>
                  {meeting.participants && (
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {meeting.participants.length} участников
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => generateMeetingPdf(meeting)}
                className="gap-1.5"
              >
                <Download className="w-4 h-4" />
                Скачать PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {meeting.summary && (
              <div>
                <h3 className="font-semibold mb-2 text-lg">Краткое содержание</h3>
                <p className="text-muted-foreground leading-relaxed">{meeting.summary}</p>
              </div>
            )}

            {meeting.key_points && (
              <Accordion type="multiple" className="w-full" defaultValue={['key-points', 'actions']}>
                {meeting.key_points.keyPoints && meeting.key_points.keyPoints.length > 0 && (
                  <AccordionItem value="key-points">
                    <AccordionTrigger className="text-base font-semibold">
                      🎯 Ключевые моменты
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        {meeting.key_points.keyPoints.map((point, i) => (
                          <li key={i}>{point}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {meeting.key_points.actionItems && meeting.key_points.actionItems.length > 0 && (
                  <AccordionItem value="actions">
                    <AccordionTrigger className="text-base font-semibold">
                      ✅ Задачи к выполнению
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-2 text-muted-foreground">
                        {meeting.key_points.actionItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary">☐</span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {meeting.key_points.decisions && meeting.key_points.decisions.length > 0 && (
                  <AccordionItem value="decisions">
                    <AccordionTrigger className="text-base font-semibold">
                      💡 Принятые решения
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                        {meeting.key_points.decisions.map((decision, i) => (
                          <li key={i}>{decision}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {meeting.transcript && (
                  <AccordionItem value="transcript">
                    <AccordionTrigger className="text-base font-semibold">
                      📄 Полная транскрипция
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
                          {meeting.transcript}
                        </pre>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-8">
          Конспект создан с помощью APLink by Apollo Production
        </p>
      </main>
    </div>
  );
};

export default SharedMeeting;
