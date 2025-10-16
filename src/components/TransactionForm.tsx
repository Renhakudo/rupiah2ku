import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TransactionFormProps {
  walletId: string;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const TransactionForm = ({ walletId }: TransactionFormProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const createTransaction = useMutation({
    mutationFn: async (transactionData: any) => {
      const { error } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', walletId] });
      setOpen(false);
      resetForm();
      toast({
        title: t('common.success'),
        description: 'Transaction added successfully!',
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

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(new Date());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createTransaction.mutate({
      wallet_id: walletId,
      type,
      amount: parseFloat(amount),
      category,
      description,
      transaction_date: format(date, 'yyyy-MM-dd'),
    });
  };

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          {t('transaction.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('transaction.add')}</DialogTitle>
          <DialogDescription>Add a new income or expense transaction</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">{t('transaction.type')}</Label>
            <Select value={type} onValueChange={(value: any) => { setType(value); setCategory(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t('transaction.income')}</SelectItem>
                <SelectItem value="expense">{t('transaction.expense')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t('transaction.amount')} (IDR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="100000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t('transaction.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`category.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{t('transaction.date')}</Label>
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

          <div className="space-y-2">
            <Label htmlFor="description">{t('transaction.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          <Button type="submit" className="w-full" disabled={createTransaction.isPending || !category}>
            {createTransaction.isPending ? t('transaction.saving') : t('transaction.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};