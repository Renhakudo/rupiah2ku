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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';
import { Flag, Plus, Trash2, ArrowUpCircle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export const SavingsGoals = () => {
  const [open, setOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: goals = [] } = useQuery({
    queryKey: ['savings-goals'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await (supabase as any).from('savings_goals')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createGoal = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error } = await (supabase as any).from('savings_goals').insert({
        user_id: user.id,
        name,
        target_amount: parseFloat(targetAmount),
        deadline: deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      setOpen(false);
      setName('');
      setTargetAmount('');
      setDeadline('');
      toast({ title: t('common.success'), description: 'Goal created!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deposit = useMutation({
    mutationFn: async ({ goalId, amount }: { goalId: string; amount: number }) => {
      const goal = goals.find((g: any) => g.id === goalId);
      if (!goal) throw new Error('Goal not found');
      const newAmount = parseFloat(goal.current_amount) + amount;
      const { error } = await (supabase as any).from('savings_goals')
        .update({ current_amount: newAmount })
        .eq('id', goalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      setDepositOpen(null);
      setDepositAmount('');
      toast({ title: t('common.success'), description: 'Deposit added!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      toast({ title: t('common.success'), description: 'Goal removed!' });
    },
  });

  return (
    <Card className="shadow-soft hover-lift animate-in">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Flag className="w-5 h-5 text-primary" />
          {t('goals.title')}
        </CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1">
              <Plus className="w-3 h-3" />
              {t('goals.add')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('goals.add')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('goals.name')}</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Emergency Fund" />
              </div>
              <div className="space-y-2">
                <Label>{t('goals.target')}</Label>
                <Input type="number" min="0" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="10000000" />
              </div>
              <div className="space-y-2">
                <Label>{t('goals.deadline')}</Label>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
              </div>
              <Button className="w-full" onClick={() => createGoal.mutate()} disabled={!name || !targetAmount || createGoal.isPending}>
                {createGoal.isPending ? t('goals.saving') : t('goals.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-4">
        {goals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t('goals.nogoals')}</p>
        ) : (
          goals.map((goal: any) => {
            const current = parseFloat(goal.current_amount);
            const target = parseFloat(goal.target_amount);
            const percentage = Math.min((current / target) * 100, 100);
            const isComplete = current >= target;
            return (
              <div key={goal.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isComplete ? (
                      <CheckCircle2 className="w-4 h-4 text-success" />
                    ) : (
                      <Flag className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">{goal.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setDepositOpen(goal.id)}
                    >
                      <ArrowUpCircle className="w-4 h-4 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteGoal.mutate(goal.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <Progress value={percentage} className={`h-2 ${isComplete ? '[&>div]:bg-success' : '[&>div]:bg-primary'}`} />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(current)} / {formatCurrency(target)}</span>
                  <span>{Math.round(percentage)}%</span>
                </div>
                {goal.deadline && (
                  <p className="text-xs text-muted-foreground">
                    {t('goals.deadline')}: {format(new Date(goal.deadline), 'PP')}
                  </p>
                )}
              </div>
            );
          })
        )}

        <Dialog open={!!depositOpen} onOpenChange={() => setDepositOpen(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('goals.deposit')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('goals.depositAmount')}</Label>
                <Input
                  type="number"
                  min="0"
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  placeholder="100000"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => depositOpen && deposit.mutate({ goalId: depositOpen, amount: parseFloat(depositAmount) })}
                disabled={!depositAmount || deposit.isPending}
              >
                {deposit.isPending ? t('goals.saving') : t('goals.deposit')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
