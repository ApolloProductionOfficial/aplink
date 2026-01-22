import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar, Clock, Users, Loader2, Plus, Trash2, Phone, Bell } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CalendarExport from './CalendarExport';

interface ScheduledCall {
  id: string;
  room_name: string;
  scheduled_at: string;
  participants_telegram_ids: number[] | null;
  description: string | null;
  status: string;
  reminder_sent: boolean;
  reminder_minutes: number;
  created_at: string;
}

const CallScheduler = () => {
  const { user } = useAuth();
  const [scheduledCalls, setScheduledCalls] = useState<ScheduledCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [roomName, setRoomName] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [description, setDescription] = useState('');
  const [participantIds, setParticipantIds] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState('15');

  useEffect(() => {
    fetchScheduledCalls();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('scheduled-calls-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_calls' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setScheduledCalls(prev => [payload.new as ScheduledCall, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setScheduledCalls(prev => 
              prev.map(call => call.id === payload.new.id ? payload.new as ScheduledCall : call)
            );
          } else if (payload.eventType === 'DELETE') {
            setScheduledCalls(prev => prev.filter(call => call.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchScheduledCalls = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_calls')
        .select('*')
        .order('scheduled_at', { ascending: true });
      
      if (error) throw error;
      setScheduledCalls((data || []) as ScheduledCall[]);
    } catch (error) {
      console.error('Error fetching scheduled calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateScheduledCall = async () => {
    if (!user || !roomName.trim() || !scheduledAt) {
      toast.error('Заполните название комнаты и время');
      return;
    }
    
    setCreating(true);
    try {
      // Parse participant IDs
      const ids = participantIds
        .split(',')
        .map(id => parseInt(id.trim()))
        .filter(id => !isNaN(id));
      
      const { error } = await supabase
        .from('scheduled_calls')
        .insert({
          created_by: user.id,
          room_name: roomName.trim(),
          scheduled_at: new Date(scheduledAt).toISOString(),
          participants_telegram_ids: ids,
          description: description.trim() || null,
          reminder_minutes: parseInt(reminderMinutes),
        });
      
      if (error) throw error;
      
      toast.success('Звонок запланирован!');
      setShowForm(false);
      setRoomName('');
      setScheduledAt('');
      setDescription('');
      setParticipantIds('');
      setReminderMinutes('15');
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteScheduledCall = async (id: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_calls')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Запланированный звонок удалён');
    } catch (error: any) {
      toast.error('Ошибка удаления: ' + error.message);
    }
  };

  const handleStartCall = async (call: ScheduledCall) => {
    try {
      if (!user) {
        toast.error('Нужно войти в аккаунт');
        return;
      }

      const participantIds = call.participants_telegram_ids ?? [];

      // Update status
      await supabase
        .from('scheduled_calls')
        .update({ status: 'started' })
        .eq('id', call.id);
      
      // Create call request
      const { error } = await supabase
        .from('call_requests')
        .insert({
          created_by: user.id,
          room_name: call.room_name,
          is_group_call: participantIds.length > 1,
          status: 'active',
        });
      
      if (error) throw error;
      
      toast.success('Звонок начат!');
    } catch (error: any) {
      toast.error('Ошибка: ' + error.message);
    }
  };

  const getStatusBadge = (status: string, scheduledAt: string) => {
    const scheduledTime = new Date(scheduledAt);
    const now = new Date();
    
    if (status === 'started') {
      return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Начат</Badge>;
    }
    if (status === 'completed') {
      return <Badge variant="secondary">Завершён</Badge>;
    }
    if (scheduledTime < now) {
      return <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30">Просрочен</Badge>;
    }
    return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">Запланирован</Badge>;
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Планировщик звонков
          </CardTitle>
          <Button 
            size="sm" 
            onClick={() => setShowForm(!showForm)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Запланировать
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Create Form */}
        {showForm && (
          <div className="p-4 rounded-lg bg-background/50 border border-border/30 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="roomName">Название комнаты</Label>
                <Input
                  id="roomName"
                  placeholder="Название встречи"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="scheduledAt">Дата и время</Label>
                <Input
                  id="scheduledAt"
                  type="datetime-local"
                  min={getMinDateTime()}
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="participantIds">Telegram ID участников (через запятую)</Label>
              <Input
                id="participantIds"
                placeholder="123456789, 987654321"
                value={participantIds}
                onChange={(e) => setParticipantIds(e.target.value)}
              />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="reminderMinutes">Напоминание за</Label>
                <Select value={reminderMinutes} onValueChange={setReminderMinutes}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 минут</SelectItem>
                    <SelectItem value="10">10 минут</SelectItem>
                    <SelectItem value="15">15 минут</SelectItem>
                    <SelectItem value="30">30 минут</SelectItem>
                    <SelectItem value="60">1 час</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Описание (опционально)</Label>
                <Textarea
                  id="description"
                  placeholder="О чём будет звонок..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                onClick={handleCreateScheduledCall}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4 mr-2" />
                )}
                Запланировать
              </Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        {/* Scheduled Calls List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : scheduledCalls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Нет запланированных звонков</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {scheduledCalls.map((call) => (
              <div
                key={call.id}
                className="bg-background/50 rounded-lg p-4 border border-border/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Phone className="w-4 h-4 text-primary" />
                      <span className="font-medium">{call.room_name}</span>
                      {getStatusBadge(call.status, call.scheduled_at)}
                      {call.reminder_sent && (
                        <Bell className="w-3 h-3 text-amber-500" />
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(call.scheduled_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(new Date(call.scheduled_at), { locale: ru, addSuffix: true })}
                      </span>
                      {call.participants_telegram_ids?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {call.participants_telegram_ids.length} участников
                        </span>
                      )}
                    </div>
                    
                    {call.description && (
                      <p className="text-sm text-muted-foreground">{call.description}</p>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Calendar Export */}
                    <CalendarExport
                      roomName={call.room_name}
                      scheduledAt={call.scheduled_at}
                      description={call.description}
                      participantCount={call.participants_telegram_ids?.length}
                    />
                    
                    {call.status === 'scheduled' && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleStartCall(call)}
                        className="gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        Начать
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteScheduledCall(call.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CallScheduler;
