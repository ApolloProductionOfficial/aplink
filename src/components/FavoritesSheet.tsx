import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, UserPlus, Phone, Trash2, Circle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/useTranslation';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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

interface FavoritesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FavoritesSheet = ({ open, onOpenChange }: FavoritesSheetProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();
  const favorites = t.favorites;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState('');
  const [addNickname, setAddNickname] = useState('');
  const [adding, setAdding] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    
    fetchContacts();
  }, [user, open]);

  const fetchContacts = async () => {
    if (!user) return;
    setLoading(true);
    
    const { data: contactsData, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching contacts:', error);
      setLoading(false);
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
        toast({ title: favorites.alreadyAdded, variant: 'destructive' });
      } else {
        toast({ title: favorites.error, description: error.message, variant: 'destructive' });
      }
    } else {
      toast({ title: favorites.contactAdded });
      setSearchName('');
      setAddNickname('');
      setDialogOpen(false);
      fetchContacts();
    }
    
    setAdding(false);
  };

  const removeContact = async (contactId: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', contactId);

    if (!error) {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
      toast({ title: favorites.contactRemoved });
    }
  };

  const inviteToRoom = (contact: Contact) => {
    const roomName = `Звонок-${Date.now().toString(36)}`;
    const userName = user?.email?.split('@')[0] || 'User';
    
    // Use production domain
    const link = `https://aplink.live/room/${roomName}`;
    navigator.clipboard.writeText(link);
    
    toast({
      title: favorites.linkCopied,
      description: `${favorites.sendTo} ${contact.nickname || contact.profile?.display_name || favorites.user}`,
    });
    
    onOpenChange(false);
    navigate(`/room/${roomName}?name=${encodeURIComponent(userName)}`);
  };

  // Handle swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    (e.currentTarget as any).touchStartY = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const startY = (e.currentTarget as any).touchStartY || 0;
    const deltaY = touch.clientY - startY;
    
    // Swipe down threshold (80px)
    if (deltaY > 80) {
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="bottom" 
        className="h-[70vh] rounded-t-3xl bg-card/95 backdrop-blur-xl border-t border-primary/30"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Swipe indicator */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        
        <SheetHeader className="pb-4 pt-2">
          <SheetTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary" />
              {favorites.title}
            </span>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-2">
                  <UserPlus className="w-4 h-4" />
                  {favorites.add}
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
                  <Button onClick={addContact} disabled={adding || !searchName.trim()} className="w-full">
                    {adding ? favorites.adding : favorites.add}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </SheetTitle>
        </SheetHeader>

        <div className="overflow-y-auto h-[calc(100%-80px)] pr-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : contacts.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">{favorites.noContacts}</p>
              {/* Подсказка убрана */}
            </div>
          ) : (
            <div className="space-y-2">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors border border-border/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <span className="text-sm font-medium">
                          {(contact.nickname || contact.profile?.display_name || 'U')[0].toUpperCase()}
                        </span>
                      </div>
                      <Circle
                        className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 ${
                          contact.presence?.is_online
                            ? 'text-green-500 fill-green-500'
                            : 'text-muted-foreground fill-muted-foreground'
                        }`}
                      />
                    </div>
                    <div>
                      <p className="font-medium">
                        {contact.nickname || contact.profile?.display_name || favorites.user}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.profile?.username && <span className="text-primary">@{contact.profile.username}</span>}
                        {contact.profile?.username && ' · '}
                        {contact.presence?.is_online
                          ? contact.presence.current_room
                            ? favorites.inRoom
                            : favorites.online
                          : favorites.offline}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-primary hover:text-primary hover:bg-primary/10"
                      onClick={() => inviteToRoom(contact)}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
      </SheetContent>
    </Sheet>
  );
};

export default FavoritesSheet;
