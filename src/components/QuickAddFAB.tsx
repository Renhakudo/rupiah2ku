import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';

interface QuickAddFABProps {
  walletId: string;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const QuickAddFAB = ({ walletId }: QuickAddFABProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const createTransaction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('transactions').insert({
        wallet_id: walletId,
        type,
        amount: parseFloat(amount),
        category,
        description: description || null,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', walletId] });
      setOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      toast({ title: t('common.success'), description: 'Transaction added!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-strong bg-gradient-primary hover:shadow-medium transition-all duration-300 hover:scale-105 sm:hidden"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader>
          <SheetTitle>{t('transaction.add')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 pt-4 pb-6">
          <div className="flex gap-2">
            <Button
              variant={type === 'expense' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => { setType('expense'); setCategory(''); }}
            >
              {t('transaction.expense')}
            </Button>
            <Button
              variant={type === 'income' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => { setType('income'); setCategory(''); }}
            >
              {t('transaction.income')}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t('transaction.amount')} (IDR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
              className="text-lg h-12"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t('transaction.category')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setCategory(cat)}
                >
                  {t(`category.${cat}`)}
                </Button>
              ))}
            </div>
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
            className="w-full h-12 text-base"
            onClick={() => createTransaction.mutate()}
            disabled={!amount || !category || createTransaction.isPending}
          >
            {createTransaction.isPending ? t('transaction.saving') : t('transaction.save')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
