import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { ArrowLeftRight } from 'lucide-react';
import { format } from 'date-fns';

export const TransferDialog = () => {
  const [open, setOpen] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: wallets = [] } = useQuery({
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
      return data || [];
    },
  });

  const transfer = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const transferAmount = parseFloat(amount);
      const desc = description || `Transfer to wallet`;

      const { error: e1 } = await supabase.from('transactions').insert({
        wallet_id: fromWalletId,
        type: 'expense' as const,
        amount: transferAmount,
        category: 'transfer',
        description: `[Transfer Out] ${desc}`,
        transaction_date: today,
      });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from('transactions').insert({
        wallet_id: toWalletId,
        type: 'income' as const,
        amount: transferAmount,
        category: 'transfer',
        description: `[Transfer In] ${desc}`,
        transaction_date: today,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setOpen(false);
      setFromWalletId('');
      setToWalletId('');
      setAmount('');
      setDescription('');
      toast({ title: t('common.success'), description: t('transfer.success') });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const canSubmit = fromWalletId && toWalletId && fromWalletId !== toWalletId && parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeftRight className="w-4 h-4" />
          <span className="hidden sm:inline">{t('transfer.button')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('transfer.title')}</DialogTitle>
          <DialogDescription>Move funds between your wallets</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('transfer.from')}</Label>
            <Select value={fromWalletId} onValueChange={setFromWalletId}>
              <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
              <SelectContent>
                {wallets.filter(w => w.id !== toWalletId).map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('transfer.to')}</Label>
            <Select value={toWalletId} onValueChange={setToWalletId}>
              <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
              <SelectContent>
                {wallets.filter(w => w.id !== fromWalletId).map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('transfer.amount')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('transaction.description')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note"
            />
          </div>
          <Button
            className="w-full"
            onClick={() => transfer.mutate()}
            disabled={!canSubmit || transfer.isPending}
          >
            {transfer.isPending ? t('transfer.transferring') : t('transfer.submit')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
