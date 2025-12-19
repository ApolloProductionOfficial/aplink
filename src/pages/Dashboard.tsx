import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, Users, Calendar, Clock, LogOut, User, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import CustomCursor from '@/components/CustomCursor';
import AnimatedBackground from '@/components/AnimatedBackground';
import logoVideo from '@/assets/logo-video.mov';

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

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isLoading, signOut } = useAuth();
  const { toast } = useToast();
  const [transcripts, setTranscripts] = useState<MeetingTranscript[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ display_name: string | null } | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      navigate('/auth');
    }
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setLoading(true);
      
      // Fetch user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profileData) {
        setProfile(profileData);
        setEditedName(profileData.display_name || '');
      }
      
      // Fetch transcripts where user participated
      const { data: transcriptsData } = await supabase
        .from('meeting_transcripts')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (transcriptsData) {
        setTranscripts(transcriptsData as MeetingTranscript[]);
      }
      
      setLoading(false);
    };
    
    fetchData();
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleSaveName = async () => {
    if (!user || !editedName.trim()) return;
    
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: editedName.trim() })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, display_name: editedName.trim() } : null);
      setIsEditingName(false);
      toast({
        title: 'Имя сохранено',
        description: 'Ваше имя успешно обновлено',
      });
    } catch (error) {
      console.error('Error saving name:', error);
      toast({
        title: 'Ошибка',
        description: 'Не удалось сохранить имя',
        variant: 'destructive',
      });
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(profile?.display_name || '');
    setIsEditingName(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background cursor-none">
      <CustomCursor />
      <AnimatedBackground />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <video 
                src={logoVideo} 
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-8 h-8 object-cover rounded-full"
              />
              <span className="font-semibold">APLink</span>
            </Button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-primary" />
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="h-8 w-40"
                    placeholder="Ваше имя"
                    disabled={savingName}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handleSaveName}
                    disabled={savingName || !editedName.trim()}
                  >
                    <Check className="w-4 h-4 text-green-500" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={handleCancelEdit}
                    disabled={savingName}
                  >
                    <X className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>{profile?.display_name || user.email}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => setIsEditingName(true)}
                  >
                    <Pencil className="w-3 h-3 text-muted-foreground hover:text-primary" />
                  </Button>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              На главную
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="space-y-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Мои созвоны
          </h1>
          
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : transcripts.length === 0 ? (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Пока нет записей созвонов</p>
                <p className="text-sm mt-2">После завершения созвона здесь появится его конспект</p>
                <Button
                  onClick={() => navigate('/')}
                  className="mt-4"
                >
                  Начать созвон
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {transcripts.map((transcript) => (
                <Card key={transcript.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="w-5 h-5 text-primary" />
                          {transcript.room_name}
                        </CardTitle>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(transcript.started_at)}
                          </span>
                          {transcript.participants && (
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {transcript.participants.length} участников
                            </span>
                          )}
                        </div>
                      </div>
                      {transcript.ended_at && (
                        <Badge variant="secondary">Завершён</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {transcript.summary && (
                      <div className="mb-4">
                        <h4 className="font-medium mb-2">Краткое содержание</h4>
                        <p className="text-muted-foreground">{transcript.summary}</p>
                      </div>
                    )}
                    
                    {transcript.key_points && (
                      <Accordion type="single" collapsible className="w-full">
                        {transcript.key_points.keyPoints && transcript.key_points.keyPoints.length > 0 && (
                          <AccordionItem value="key-points">
                            <AccordionTrigger>Ключевые моменты</AccordionTrigger>
                            <AccordionContent>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                {transcript.key_points.keyPoints.map((point, i) => (
                                  <li key={i}>{point}</li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        
                        {transcript.key_points.actionItems && transcript.key_points.actionItems.length > 0 && (
                          <AccordionItem value="actions">
                            <AccordionTrigger>Задачи к выполнению</AccordionTrigger>
                            <AccordionContent>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                {transcript.key_points.actionItems.map((item, i) => (
                                  <li key={i}>{item}</li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        
                        {transcript.key_points.decisions && transcript.key_points.decisions.length > 0 && (
                          <AccordionItem value="decisions">
                            <AccordionTrigger>Принятые решения</AccordionTrigger>
                            <AccordionContent>
                              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                                {transcript.key_points.decisions.map((decision, i) => (
                                  <li key={i}>{decision}</li>
                                ))}
                              </ul>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                        
                        {transcript.transcript && (
                          <AccordionItem value="transcript">
                            <AccordionTrigger>Полная транскрипция</AccordionTrigger>
                            <AccordionContent>
                              <div className="bg-muted/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <pre className="whitespace-pre-wrap text-sm text-muted-foreground font-mono">
                                  {transcript.transcript}
                                </pre>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        )}
                      </Accordion>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
