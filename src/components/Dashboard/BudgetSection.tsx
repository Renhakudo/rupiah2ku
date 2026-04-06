import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
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
import { formatCurrency } from '@/lib/currency';
import { Target, Plus, Trash2 } from 'lucide-react';

interface BudgetSectionProps {
  transactions: any[];
}

const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const BudgetSection = ({ transactions }: BudgetSectionProps) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any).from('budgets')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data || [];
    },
  });

  const createBudget = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase as any).from('budgets').upsert({
        user_id: user.id,
        category,
        amount: parseFloat(amount),
      }, { onConflict: 'user_id,category' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      setOpen(false);
      setCategory('');
      setAmount('');
      toast({ title: t('common.success'), description: 'Budget saved!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('budgets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast({ title: t('common.success'), description: 'Budget removed!' });
    },
  });

  const getSpentByCategory = (cat: string) => {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return transactions
      .filter(tx => tx.type === 'expense' && tx.category === cat && new Date(tx.transaction_date) >= firstOfMonth)
      .reduce((sum, tx) => sum + parseFloat(tx.amount.toString()), 0);
  };

  if (budgets.length === 0 && !open) {
    return (
      <Card className="shadow-soft hover-lift animate-in">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            {t('budget.title')}
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="w-3 h-3" />
                {t('budget.add')}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{t('budget.add')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('budget.category')}</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {expenseCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{t(`category.${cat}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('budget.amount')}</Label>
                  <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500000" />
                </div>
                <Button className="w-full" onClick={() => createBudget.mutate()} disabled={!category || !amount || createBudget.isPending}>
                  {createBudget.isPending ? t('budget.saving') : t('budget.save')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">{t('budget.nobudgets')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft hover-lift animate-in">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          {t('budget.title')}
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <Plus className="w-3 h-3" />
              {t('budget.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('budget.add')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('budget.category')}</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{t(`category.${cat}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('budget.amount')}</Label>
                <Input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500000" />
              </div>
              <Button className="w-full" onClick={() => createBudget.mutate()} disabled={!category || !amount || createBudget.isPending}>
                {createBudget.isPending ? t('budget.saving') : t('budget.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {budgets.map((budget: any) => {
          const spent = getSpentByCategory(budget.category);
          const budgetAmount = parseFloat(budget.amount);
          const percentage = Math.min((spent / budgetAmount) * 100, 100);
          const isOver = spent > budgetAmount;
          return (
            <div key={budget.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t(`category.${budget.category}`)}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${isOver ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {formatCurrency(spent)} / {formatCurrency(budgetAmount)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteBudget.mutate(budget.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
              <Progress
                value={percentage}
                className={`h-2 ${isOver ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'}`}
              />
              <p className={`text-xs ${isOver ? 'text-destructive' : 'text-muted-foreground'}`}>
                {isOver
                  ? `${formatCurrency(spent - budgetAmount)} ${t('budget.over')}`
                  : `${formatCurrency(budgetAmount - spent)} ${t('budget.remaining')}`
                }
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
