import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, UserPlus, Phone, Trash2, Circle, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import GroupCallDialog from './GroupCallDialog';

interface Contact {
  id: string;
  contact_user_id: string;
  nickname: string | null;
  profile?: {
    display_name: string | null;
    username: string | null;
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
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [adding, setAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [groupCallOpen, setGroupCallOpen] = useState(false);

  const favorites = t.favorites || {
    title: 'Избранные контакты',
    addContact: 'Добавить контакт',
    noContacts: 'Нет избранных контактов',
    userNotFound: 'Пользователь не найден',
    userNotFoundDesc: 'Пользователь @{username} не найден',
    alreadyAdded: 'Контакт уже добавлен',
    contactAdded: 'Контакт добавлен',
    contactRemoved: 'Контакт удалён',
    linkCopied: 'Ссылка скопирована',
    sendTo: 'Отправьте её',
    username: 'username',
    nickname: 'Никнейм (необязательно)',
    add: 'Добавить',
    adding: 'Добавление...',
    online: 'Онлайн',
    offline: 'Офлайн',
    inRoom: 'В комнате',
    user: 'Пользователь',
    error: 'Ошибка'
  };

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
            .select('display_name, username')
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
    
    // Clean the username (remove @ if present)
    const cleanUsername = searchName.trim().toLowerCase().replace(/^@/, '');
    
    // Use security definer function to search for user by username
    const { data: profileData, error: profileError } = await supabase
      .rpc('search_profile_by_username', { search_username: cleanUsername })
      .maybeSingle();

    if (profileError || !profileData || profileData.user_id === user.id) {
      toast({
        title: favorites.userNotFound,
        description: favorites.userNotFoundDesc.replace('{username}', cleanUsername),
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
          title: favorites.alreadyAdded,
          variant: 'destructive',
        });
      } else {
        toast({
          title: favorites.error,
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: favorites.contactAdded,
      });
      setSearchName('');
      setAddNickname('');
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
      toast({ title: favorites.contactRemoved });
    }
  };

  const inviteToRoom = (contact: Contact) => {
    const roomName = `Звонок-${Date.now().toString(36)}`;
    const userName = user?.email?.split('@')[0] || 'User';
    
    // Copy invite link - use production domain
    const link = `https://aplink.live/room/${roomName}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: favorites.linkCopied,
      description: `${favorites.sendTo} ${contact.nickname || contact.profile?.display_name || favorites.user}`,
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
          {favorites.title}
        </h3>
        
        <div className="flex items-center gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-8 w-8 p-0"
            onClick={() => setGroupCallOpen(true)}
            title="Групповой звонок"
          >
            <Users className="w-4 h-4" />
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <UserPlus className="w-4 h-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle>{favorites.addContact}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    placeholder={favorites.username}
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    className="pl-8"
                  />
                </div>
                <Input
                  placeholder={favorites.nickname}
                  value={addNickname}
                  onChange={(e) => setAddNickname(e.target.value)}
                />
                <Button
                  onClick={addContact}
                  disabled={adding || !searchName.trim()}
                  className="w-full"
                >
                  {adding ? favorites.adding : favorites.add}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {favorites.noContacts}
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
                    {contact.nickname || contact.profile?.display_name || favorites.user}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {contact.profile?.username && <span className="text-primary">@{contact.profile.username}</span>}
                    {contact.profile?.username && ' · '}
                    {contact.presence?.is_online
                      ? contact.presence.current_room
                        ? `${favorites.inRoom}: ${contact.presence.current_room}`
                        : favorites.online
                      : favorites.offline}
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
      
      <GroupCallDialog open={groupCallOpen} onOpenChange={setGroupCallOpen} />
    </div>
  );
};

export default FavoriteContacts;
