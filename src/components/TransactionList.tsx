import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
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
import { Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

interface TransactionListProps {
  transactions: any[];
  walletId: string;
}

export const TransactionList = ({ transactions, walletId }: TransactionListProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', walletId] });
      setDeleteId(null);
      toast({
        title: t('common.success'),
        description: 'Transaction deleted successfully!',
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

  if (transactions.length === 0) {
    return (
      <Card className="shadow-soft">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground text-center">{t('dashboard.noTransactions')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>{t('dashboard.transactions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactions.map((transaction) => (
            <div
              key={transaction.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-smooth gap-3"
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                  transaction.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'
                }`}>
                  {transaction.type === 'income' ? (
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                  ) : (
                    <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-medium text-sm sm:text-base truncate">{t(`category.${transaction.category}`)}</p>
                    <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'} className="text-xs">
                      {t(`transaction.${transaction.type}`)}
                    </Badge>
                  </div>
                  {transaction.description && (
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{transaction.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(transaction.transaction_date), 'PPP')}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-3">
                <p className={`font-bold text-base sm:text-lg break-words ${
                  transaction.type === 'income' ? 'text-success' : 'text-destructive'
                }`}>
                  {transaction.type === 'income' ? '+' : '-'}
                  {formatCurrency(parseFloat(transaction.amount))}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteId(transaction.id)}
                  className="text-destructive hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
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