import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';
import { Trash2, TrendingUp, TrendingDown, Search } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionListProps {
  transactions: any[];
  walletId: string;
}

export const TransactionList = ({ transactions, walletId }: TransactionListProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', walletId] });
      setDeleteId(null);
      toast({ title: t('common.success'), description: 'Transaction deleted successfully!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const filtered = transactions.filter(tx => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      tx.category?.toLowerCase().includes(q) ||
      tx.description?.toLowerCase().includes(q) ||
      t(`category.${tx.category}`).toLowerCase().includes(q) ||
      tx.amount?.toString().includes(q)
    );
  });

  if (transactions.length === 0) {
    return (
      <Card className="shadow-soft animate-in">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">{t('dashboard.noTransactions')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-soft animate-in">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">{t('dashboard.transactions')} ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('transaction.search')}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 px-3 sm:px-6">
          {filtered.map((transaction) => (
            <div
              key={transaction.id}
              className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-all duration-200 group"
            >
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                transaction.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'
              }`}>
                {transaction.type === 'income' ? (
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                ) : (
                  <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium truncate">{t(`category.${transaction.category}`)}</p>
                  <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0 h-4 hidden sm:inline-flex">
                    {t(`transaction.${transaction.type}`)}
                  </Badge>
                </div>
                {transaction.description && (
                  <p className="text-xs text-muted-foreground truncate">{transaction.description}</p>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {format(new Date(transaction.transaction_date), 'PP')}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <p className={`font-semibold text-sm sm:text-base tabular-nums ${
                  transaction.type === 'income' ? 'text-success' : 'text-destructive'
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(parseFloat(transaction.amount))}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(transaction.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this transaction? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('transaction.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteTransaction.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground"
            >
              {t('transaction.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
