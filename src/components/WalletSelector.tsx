import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Wallet, MoreVertical, Pencil, Trash2 } from 'lucide-react';

interface WalletSelectorProps {
  selectedWalletId: string | null;
  onSelectWallet: (walletId: string) => void;
}

export const WalletSelector = ({ selectedWalletId, onSelectWallet }: WalletSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingWallet, setEditingWallet] = useState<any>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const createWallet = useMutation({
    mutationFn: async (walletData: { name: string; description: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('wallets')
        .insert({
          user_id: user.id,
          name: walletData.name,
          description: walletData.description,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      onSelectWallet(data.id);
      setOpen(false);
      setName('');
      setDescription('');
      toast({
        title: t('common.success'),
        description: 'Wallet created successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateWallet = useMutation({
    mutationFn: async ({ id, name, description }: { id: string; name: string; description: string }) => {
      const { error } = await supabase
        .from('wallets')
        .update({ name, description })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setEditOpen(false);
      setEditingWallet(null);
      setName('');
      setDescription('');
      toast({
        title: t('common.success'),
        description: 'Wallet updated successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteWallet = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('wallets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setDeleteId(null);
      if (selectedWalletId === deleteId) {
        onSelectWallet('');
      }
      toast({
        title: t('common.success'),
        description: 'Wallet deleted successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWallet.mutate({ name, description });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingWallet) {
      updateWallet.mutate({ id: editingWallet.id, name, description });
    }
  };

  const handleEdit = (wallet: any) => {
    setEditingWallet(wallet);
    setName(wallet.name);
    setDescription(wallet.description || '');
    setEditOpen(true);
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3 w-full">
      {wallets && wallets.length > 0 ? (
        <div className="flex items-center gap-2 flex-1">
          <Select value={selectedWalletId || undefined} onValueChange={onSelectWallet}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('wallet.select')} />
            </SelectTrigger>
            <SelectContent>
              {wallets.map((wallet) => (
                <SelectItem key={wallet.id} value={wallet.id}>
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    {wallet.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedWalletId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  const wallet = wallets.find(w => w.id === selectedWalletId);
                  if (wallet) handleEdit(wallet);
                }}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Wallet
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteId(selectedWalletId)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Wallet
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('wallet.noWallets')}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('wallet.create')}</DialogTitle>
            <DialogDescription>Create a new wallet to organize your finances</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="walletName">{t('wallet.name')}</Label>
              <Input
                id="walletName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Personal Wallet"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">{t('wallet.description')}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="My main wallet for daily expenses"
              />
            </div>
            <Button type="submit" className="w-full" disabled={createWallet.isPending}>
              {createWallet.isPending ? t('wallet.creating') : t('wallet.create')}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Wallet Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Wallet</DialogTitle>
            <DialogDescription>Update your wallet information</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editWalletName">{t('wallet.name')}</Label>
              <Input
                id="editWalletName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">{t('wallet.description')}</Label>
              <Textarea
                id="editDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateWallet.isPending}>
              {updateWallet.isPending ? 'Updating...' : 'Update Wallet'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this wallet? All transactions in this wallet will also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteWallet.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};