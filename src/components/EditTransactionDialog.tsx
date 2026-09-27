import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, Store, Wallet, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface EditTransactionDialogProps {
  transaction: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const EditTransactionDialog: React.FC<EditTransactionDialogProps> = ({
  transaction,
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [targetWalletId, setTargetWalletId] = useState('');

  // Fetch wallets for the wallet selector
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

  // Prepopulate form when transaction opens
  useEffect(() => {
    if (transaction) {
      setType(transaction.type || 'expense');
      setAmount(transaction.amount ? transaction.amount.toString() : '');
      setCategory(transaction.category || '');
      setTargetWalletId(transaction.wallet_id || '');

      if (transaction.transaction_date) {
        const d = new Date(transaction.transaction_date);
        setDate(isNaN(d.getTime()) ? new Date() : d);
      } else {
        setDate(new Date());
      }

      // Check if merchant was saved in [Merchant] format
      const rawDesc = transaction.description || '';
      const match = rawDesc.match(/^\[(.*?)\]\s*(.*)$/);
      if (match) {
        setMerchant(match[1]);
        setDescription(match[2]);
      } else {
        setMerchant('');
        setDescription(rawDesc);
      }
    }
  }, [transaction]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!transaction?.id) throw new Error('No transaction ID');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let fullDescription = description.trim();
      if (merchant.trim()) {
        if (!fullDescription.toLowerCase().includes(merchant.trim().toLowerCase())) {
          fullDescription = fullDescription
            ? `[${merchant.trim()}] ${fullDescription}`
            : merchant.trim();
        }
      }

      const { error } = await supabase
        .from('transactions')
        .update({
          type,
          amount: parseFloat(amount),
          category,
          description: fullDescription || null,
          transaction_date: format(date, 'yyyy-MM-dd'),
          wallet_id: targetWalletId || transaction.wallet_id,
        })
        .eq('id', transaction.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast({
        title: t('common.success'),
        description: t('transaction.updateSuccess') || 'Transaction updated successfully!',
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({
        title: t('common.error'),
        description: 'Please enter a valid amount.',
        variant: 'destructive',
      });
      return;
    }
    if (!category) {
      toast({
        title: t('common.error'),
        description: 'Please select a category.',
        variant: 'destructive',
      });
      return;
    }

    updateMutation.mutate();
  };

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('transaction.edit')}</DialogTitle>
          <DialogDescription>
            Modify transaction details and save changes
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6 py-1">
          <form id="edit-tx-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label htmlFor="edit-type">{t('transaction.type')}</Label>
              <Select
                value={type}
                onValueChange={(val: any) => {
                  setType(val);
                  setCategory('');
                }}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">{t('transaction.income')}</SelectItem>
                  <SelectItem value="expense">{t('transaction.expense')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="edit-amount">{t('transaction.amount')} (IDR)</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                placeholder="100000"
              />
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
              <Label htmlFor="edit-category">{t('transaction.category')}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="edit-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {/* Allow transfer category if existing */}
                  {category === 'transfer' && (
                    <SelectItem value="transfer">{t('category.transfer')}</SelectItem>
                  )}
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {t(`category.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Wallet Selection */}
            {wallets.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-wallet">{t('receipt.wallet')}</Label>
                <Select
                  value={targetWalletId}
                  onValueChange={setTargetWalletId}
                >
                  <SelectTrigger id="edit-wallet">
                    <SelectValue placeholder="Select wallet" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        <div className="flex items-center gap-2">
                          <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                          <span>{w.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Merchant / Store Input */}
            <div className="space-y-2">
              <Label htmlFor="edit-merchant" className="flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{t('receipt.merchant')}</span>
              </Label>
              <Input
                id="edit-merchant"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Starbucks, Indomaret..."
              />
            </div>

            {/* Date Selection */}
            <div className="space-y-2">
              <Label htmlFor="edit-date">{t('transaction.date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(newDate) => newDate && setDate(newDate)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">{t('transaction.description')}</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes"
                rows={3}
              />
            </div>
          </form>
        </div>

        <div className="pt-3 shrink-0 mt-auto border-t flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            {t('transaction.cancel')}
          </Button>
          <Button
            type="submit"
            form="edit-tx-form"
            className="flex-1 bg-gradient-primary"
            disabled={updateMutation.isPending || !amount || !category}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span>{t('transaction.updating') || 'Updating...'}</span>
              </>
            ) : (
              <span>{t('transaction.save')}</span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
