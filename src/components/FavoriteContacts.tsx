import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, UserPlus, Phone, Trash2, Circle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface Contact {
  id: string;
  contact_user_id: string;
  nickname: string | null;
  profile?: {
    display_name: string | null;
  };
  presence?: {
    is_online: boolean;
    current_room: string | null;
  };
}

const FavoriteContacts = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [adding, setAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    
    fetchContacts();
    
    // Subscribe to presence changes
    const channel = supabase
      .channel('presence-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence',
        },
        () => {
          fetchContacts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchContacts = async () => {
    if (!user) return;
    
    const { data: contactsData, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching contacts:', error);
      return;
    }

    // Fetch profiles and presence for each contact
    const contactsWithDetails = await Promise.all(
      (contactsData || []).map(async (contact) => {
        const [profileRes, presenceRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', contact.contact_user_id)
            .maybeSingle(),
          supabase
            .from('user_presence')
            .select('is_online, current_room')
            .eq('user_id', contact.contact_user_id)
            .maybeSingle(),
        ]);

        return {
          ...contact,
          profile: profileRes.data || undefined,
          presence: presenceRes.data || undefined,
        };
      })
    );

    setContacts(contactsWithDetails);
    setLoading(false);
  };

  const addContact = async () => {
    if (!user || !searchName.trim()) return;
    
    setAdding(true);
    
    // Find user by display_name
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('user_id')
      .ilike('display_name', `%${searchName.trim()}%`)
      .neq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (profileError || !profileData) {
      toast({
        title: 'Пользователь не найден',
        description: 'Проверьте имя пользователя',
        variant: 'destructive',
      });
      setAdding(false);
      return;
    }

    const { error } = await supabase.from('contacts').insert({
      user_id: user.id,
      contact_user_id: profileData.user_id,
      nickname: addNickname.trim() || null,
    });

    if (error) {
      if (error.code === '23505') {
        toast({
          title: 'Контакт уже добавлен',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Ошибка',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Контакт добавлен',
      });
      setSearchName('');
      setAddNickname('');
      setDialogOpen(false);
      fetchContacts();
      setDialogOpen(false);
      fetchContacts();
    }
    
    setAdding(false);
  };

  const removeContact = async (contactId: string) => {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', contactId);

    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast({ title: 'Контакт удалён' });
    }
  };

  const inviteToRoom = (contact: Contact) => {
    const roomName = `Звонок-${Date.now().toString(36)}`;
    const userName = user?.email?.split('@')[0] || 'User';
    
    // Copy invite link
    const link = `${window.location.origin}/room/${roomName}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: 'Ссылка скопирована',
      description: `Отправьте её ${contact.nickname || contact.profile?.display_name || 'контакту'}`,
    });
    
    // Navigate to room
    navigate(`/room/${roomName}?name=${encodeURIComponent(userName)}`);
  };

  if (!user) return null;

  return (
    <div className="glass rounded-2xl p-4 border border-primary/20">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-primary" />
          Избранные контакты
        </h3>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
              <UserPlus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle>Добавить контакт</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <Input
                placeholder="Имя пользователя"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
              <Input
                placeholder="Никнейм (необязательно)"
                value={addNickname}
                onChange={(e) => setAddNickname(e.target.value)}
              />
              <Button
                onClick={addContact}
                disabled={adding || !searchName.trim()}
                className="w-full"
              >
                {adding ? 'Добавление...' : 'Добавить'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Нет избранных контактов
        </p>
      ) : (
        <div className="space-y-2">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-xs font-medium">
                      {(contact.nickname || contact.profile?.display_name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <Circle
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${
                      contact.presence?.is_online
                        ? 'text-green-500 fill-green-500'
                        : 'text-muted-foreground fill-muted-foreground'
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {contact.nickname || contact.profile?.display_name || 'Пользователь'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {contact.presence?.is_online
                      ? contact.presence.current_room
                        ? `В комнате: ${contact.presence.current_room}`
                        : 'Онлайн'
                      : 'Офлайн'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                  onClick={() => inviteToRoom(contact)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeContact(contact.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoriteContacts;
