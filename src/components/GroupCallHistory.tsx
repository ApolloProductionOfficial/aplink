import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, Calendar, Clock, Search, Phone, User, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

interface CallParticipant {
  id: string;
  telegram_id: number | null;
  user_id: string | null;
  status: string;
  invited_at: string;
  responded_at: string | null;
}

interface CallRequest {
  id: string;
  room_name: string;
  created_by: string | null;
  is_group_call: boolean;
  status: string;
  created_at: string;
  expires_at: string;
  participants?: CallParticipant[];
  creator_name?: string;
}

const GroupCallHistory = () => {
  const [calls, setCalls] = useState<CallRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'active' | 'ended'>('all');

  useEffect(() => {
    fetchCalls();
  }, [dateFilter, statusFilter]);

  const fetchCalls = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('call_requests')
        .select('*')
        .order('created_at', { ascending: false });

      // Date filter
      const now = new Date();
      if (dateFilter === 'today') {
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        query = query.gte('created_at', todayStart);
      } else if (dateFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', weekAgo);
      } else if (dateFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
        query = query.gte('created_at', monthAgo);
      }

      // Status filter
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data: callsData, error } = await query.limit(100);

      if (error) throw error;

      // Fetch participants for each call
      const callsWithParticipants = await Promise.all(
        (callsData || []).map(async (call) => {
          const { data: participants } = await supabase
            .from('call_participants')
            .select('*')
            .eq('call_request_id', call.id);

          // Get creator name if available
          let creatorName = 'Система';
          if (call.created_by) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('display_name, username')
              .eq('user_id', call.created_by)
              .single();
            creatorName = profile?.display_name || profile?.username || 'Пользователь';
          }

          return {
            ...call,
            participants: participants || [],
            creator_name: creatorName,
          };
        })
      );

      setCalls(callsWithParticipants);
    } catch (error) {
      console.error('Error fetching calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter((call) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      call.room_name.toLowerCase().includes(query) ||
      call.creator_name?.toLowerCase().includes(query) ||
      call.participants?.some(p => 
        p.telegram_id?.toString().includes(query)
      )
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-yellow-500 border-yellow-500">Ожидание</Badge>;
      case 'active':
        return <Badge variant="outline" className="text-green-500 border-green-500">Активен</Badge>;
      case 'ended':
        return <Badge variant="secondary">Завершён</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getParticipantStatusIcon = (status: string) => {
    switch (status) {
      case 'joined':
        return <CheckCircle className="w-3 h-3 text-green-500" />;
      case 'accepted':
        return <CheckCircle className="w-3 h-3 text-blue-500" />;
      case 'declined':
        return <XCircle className="w-3 h-3 text-red-500" />;
      case 'invited':
        return <Clock className="w-3 h-3 text-yellow-500" />;
      default:
        return <Clock className="w-3 h-3 text-muted-foreground" />;
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          История групповых звонков
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по комнате или участнику..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={dateFilter} onValueChange={(v: typeof dateFilter) => setDateFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все время</SelectItem>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="week">Неделя</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="pending">Ожидание</SelectItem>
              <SelectItem value="active">Активные</SelectItem>
              <SelectItem value="ended">Завершённые</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={fetchCalls}>
            Обновить
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary">{calls.length}</div>
            <div className="text-xs text-muted-foreground">Всего звонков</div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">
              {calls.filter(c => c.is_group_call).length}
            </div>
            <div className="text-xs text-muted-foreground">Групповых</div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-500">
              {calls.reduce((acc, c) => acc + (c.participants?.length || 0), 0)}
            </div>
            <div className="text-xs text-muted-foreground">Участников</div>
          </div>
          <div className="bg-background/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-yellow-500">
              {calls.filter(c => c.status === 'active').length}
            </div>
            <div className="text-xs text-muted-foreground">Активных</div>
          </div>
        </div>

        {/* Call list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Нет звонков для отображения</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {filteredCalls.map((call) => (
              <div
                key={call.id}
                className="bg-background/50 rounded-lg p-4 border border-border/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {call.is_group_call ? (
                        <Users className="w-4 h-4 text-primary" />
                      ) : (
                        <Phone className="w-4 h-4 text-primary" />
                      )}
                      <span className="font-medium">{call.room_name}</span>
                      {getStatusBadge(call.status)}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {call.creator_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(call.created_at), 'dd MMM yyyy, HH:mm', { locale: ru })}
                      </span>
                    </div>

                    {/* Participants */}
                    {call.participants && call.participants.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {call.participants.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-1 text-xs bg-background rounded px-2 py-1"
                          >
                            {getParticipantStatusIcon(p.status)}
                            <span>
                              {p.telegram_id ? `TG:${p.telegram_id}` : p.user_id?.slice(0, 8) || 'Гость'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
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

export default GroupCallHistory;
