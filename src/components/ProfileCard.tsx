import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, UserPlus, Phone, Trash2, Circle, User, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
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

interface ProfileCardProps {
  userUsername: string | null;
  userAvatarUrl: string | null;
  showUsernameForm: boolean;
  newUsername: string;
  setNewUsername: (val: string) => void;
  savingUsername: boolean;
  onSaveUsername: () => void;
  onCopyUsername: () => void;
  copied: boolean;
}

const ProfileCard = ({
  userUsername,
  userAvatarUrl,
  showUsernameForm,
  newUsername,
  setNewUsername,
  savingUsername,
  onSaveUsername,
  onCopyUsername,
  copied,
}: ProfileCardProps) => {
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
  const [contactsExpanded, setContactsExpanded] = useState(true);

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
    
    const channel = supabase
      .channel('presence-updates-profile')
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
    const cleanUsername = searchName.trim().toLowerCase().replace(/^@/, '');
    
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
    
    const link = `${window.location.origin}/room/${roomName}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: favorites.linkCopied,
      description: `${favorites.sendTo} ${contact.nickname || contact.profile?.display_name || favorites.user}`,
    });
    
    navigate(`/room/${roomName}?name=${encodeURIComponent(userName)}`);
  };

  if (!user) return null;

  const onlineCount = contacts.filter(c => c.presence?.is_online).length;

  return (
    <motion.div 
      className="glass rounded-2xl border border-primary/20 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Profile Header */}
      <div className="p-4 border-b border-border/30">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/30 overflow-hidden">
              {userAvatarUrl ? (
                <img 
                  src={userAvatarUrl} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-primary" />
              )}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
          </div>
          
          <div className="flex-1 min-w-0">
            {userUsername ? (
              <div 
                onClick={onCopyUsername}
                className="cursor-pointer group"
              >
                <p className="text-sm text-muted-foreground">{(t.aplink as any)?.yourUsername || 'Your @username'}</p>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg text-primary group-hover:text-primary/80 transition-colors">@{userUsername}</p>
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-yellow-500 font-medium">{(t.aplink as any)?.addUsername || 'Add @username'}</p>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="username"
                    value={newUsername}
                    onChange={(e) =>
                      setNewUsername(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, '')
                          .slice(0, 20)
                      )
                    }
                    className="bg-background/50 border-border/50 h-9"
                    onKeyDown={(e) => e.key === 'Enter' && onSaveUsername()}
                  />
                  <Button
                    onClick={onSaveUsername}
                    disabled={savingUsername || newUsername.trim().length < 3}
                    size="sm"
                    className="shrink-0 h-9"
                  >
                    {savingUsername ? (
                      <div className="w-4 h-4 rounded-full border-2 border-background/30 border-t-background animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Contacts Section */}
      <div className="p-4">
        <div 
          className="flex items-center justify-between mb-3 cursor-pointer"
          onClick={() => setContactsExpanded(!contactsExpanded)}
        >
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">{favorites.title}</h3>
            {contacts.length > 0 && (
              <span className="text-xs text-muted-foreground px-2 py-0.5 bg-primary/10 rounded-full">
                {onlineCount > 0 && <span className="text-green-500">{onlineCount} онлайн · </span>}
                {contacts.length} всего
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-7 w-7 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
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
            
            {contactsExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        <AnimatePresence>
          {contactsExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              {loading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
                </div>
              ) : contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {favorites.noContacts}
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {contacts.map((contact) => (
                    <motion.div
                      key={contact.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-all duration-200 group"
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
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => inviteToRoom(contact)}
                        >
                          <Phone className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeContact(contact.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default ProfileCard;
