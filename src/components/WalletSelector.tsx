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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Wallet } from 'lucide-react';

interface WalletSelectorProps {
  selectedWalletId: string | null;
  onSelectWallet: (walletId: string) => void;
}

export const WalletSelector = ({ selectedWalletId, onSelectWallet }: WalletSelectorProps) => {
  const [open, setOpen] = useState(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createWallet.mutate({ name, description });
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div className="flex items-center gap-3">
      {wallets && wallets.length > 0 ? (
        <Select value={selectedWalletId || undefined} onValueChange={onSelectWallet}>
          <SelectTrigger className="w-[250px]">
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
      ) : (
        <p className="text-sm text-muted-foreground">{t('wallet.noWallets')}</p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="icon" variant="outline">
            <Plus className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent>
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
    </div>
  );
};