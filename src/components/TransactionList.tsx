import { useState, useMemo } from 'react';
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
import { Trash2, Pencil, TrendingUp, TrendingDown, Search, ArrowLeftRight, Calendar } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { id as idLocale, enUS } from 'date-fns/locale';
import { EditTransactionDialog } from '@/components/EditTransactionDialog';

interface TransactionListProps {
  transactions: any[];
  walletId: string;
}

interface TransactionGroup {
  dateKey: string;
  dateObj: Date;
  relativeLabel: string;
  dayName: string;
  formattedDate: string;
  dailyIncome: number;
  dailyExpense: number;
  transactions: any[];
}

const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  if (dateStr.includes('T')) return new Date(dateStr);
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    return new Date(y, m - 1, d, 12, 0, 0);
  }
  return new Date(dateStr);
};

export const TransactionList = ({ transactions, walletId }: TransactionListProps) => {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  const deleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setDeleteId(null);
      toast({ title: t('common.success'), description: 'Transaction deleted successfully!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        tx.category?.toLowerCase().includes(q) ||
        tx.description?.toLowerCase().includes(q) ||
        t(`category.${tx.category}`).toLowerCase().includes(q) ||
        tx.amount?.toString().includes(q) ||
        tx.wallets?.name?.toLowerCase().includes(q)
      );
    });
  }, [transactions, search, t]);

  const groupedTransactions = useMemo<TransactionGroup[]>(() => {
    const locale = language === 'id' ? idLocale : enUS;

    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(a.transaction_date).getTime();
      const timeB = new Date(b.transaction_date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      const crA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const crB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return crB - crA;
    });

    const groupsMap = new Map<string, TransactionGroup>();

    for (const tx of sorted) {
      const d = parseLocalDate(tx.transaction_date);
      const dateKey = format(d, 'yyyy-MM-dd');

      if (!groupsMap.has(dateKey)) {
        let relativeLabel = '';
        if (isToday(d)) {
          relativeLabel = t('date.today');
        } else if (isYesterday(d)) {
          relativeLabel = t('date.yesterday');
        }

        groupsMap.set(dateKey, {
          dateKey,
          dateObj: d,
          relativeLabel,
          dayName: format(d, 'EEEE', { locale }),
          formattedDate: format(d, 'd MMM yyyy', { locale }),
          dailyIncome: 0,
          dailyExpense: 0,
          transactions: [],
        });
      }

      const group = groupsMap.get(dateKey)!;
      group.transactions.push(tx);

      const amt = parseFloat(tx.amount || 0);
      if (tx.type === 'income') {
        group.dailyIncome += amt;
      } else if (tx.type === 'expense') {
        group.dailyExpense += amt;
      }
    }

    return Array.from(groupsMap.values());
  }, [filtered, language, t]);

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
            <CardTitle className="text-base sm:text-lg">
              {t('dashboard.transactions')} ({filtered.length})
            </CardTitle>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('transaction.search')}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-3 sm:px-6 pb-6">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              {t('transaction.noResults')}
            </div>
          ) : (
            groupedTransactions.map((group, groupIdx) => (
              <div key={group.dateKey} className="space-y-2">
                {/* Clean Date Separator */}
                <div
                  className={`flex items-center gap-2 sm:gap-3 ${
                    groupIdx === 0 ? 'pt-0.5' : 'pt-4'
                  } pb-1`}
                >
                  {/* Date Badge / Pill */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/60 dark:bg-accent/40 border border-border/60 text-xs font-medium text-foreground shadow-2xs backdrop-blur-xs flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold">
                      {group.relativeLabel || group.dayName}
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      {group.relativeLabel
                        ? `• ${group.dayName}, ${group.formattedDate}`
                        : `• ${group.formattedDate}`}
                    </span>
                  </div>

                  {/* Horizontal Divider Line */}
                  <div className="h-px bg-border/60 flex-1 min-w-[16px]" />

                  {/* Daily Total Summary */}
                  {(group.dailyExpense > 0 || group.dailyIncome > 0) && (
                    <div className="flex items-center gap-1.5 text-[11px] font-medium tabular-nums flex-shrink-0">
                      {group.dailyExpense > 0 && (
                        <span className="text-destructive/90 bg-destructive/10 dark:bg-destructive/15 px-2 py-0.5 rounded-full border border-destructive/20 text-[10px] sm:text-[11px]">
                          -{formatCurrency(group.dailyExpense)}
                        </span>
                      )}
                      {group.dailyIncome > 0 && (
                        <span className="text-success/90 bg-success/10 dark:bg-success/15 px-2 py-0.5 rounded-full border border-success/20 text-[10px] sm:text-[11px]">
                          +{formatCurrency(group.dailyIncome)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Transaction Items in this Date Group */}
                <div className="space-y-2">
                  {group.transactions.map((transaction) => {
                    const isTransfer = transaction.category === 'transfer';
                    const isIncome = transaction.type === 'income';

                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-all duration-200 group hover:shadow-xs"
                      >
                        <div
                          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0 flex items-center justify-center ${
                            isTransfer
                              ? 'bg-primary/10 text-primary'
                              : isIncome
                              ? 'bg-success/10 text-success'
                              : 'bg-destructive/10 text-destructive'
                          }`}
                        >
                          {isTransfer ? (
                            <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : isIncome ? (
                            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                          ) : (
                            <TrendingDown className="w-4 h-4 sm:w-5 sm:h-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="text-sm font-medium truncate">
                              {isTransfer ? t('category.transfer') : t(`category.${transaction.category}`)}
                            </p>
                            <Badge
                              variant={isIncome ? 'default' : 'secondary'}
                              className="text-[10px] px-1.5 py-0 h-4 hidden sm:inline-flex"
                            >
                              {t(`transaction.${transaction.type}`)}
                            </Badge>
                            {/* Wallet Badge in All Wallets mode */}
                            {walletId === 'all' && transaction.wallets?.name && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-primary/20 text-primary font-normal hidden xs:inline-flex"
                              >
                                {transaction.wallets.name}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                            {transaction.description && (
                              <span className="truncate max-w-[200px] sm:max-w-md">{transaction.description}</span>
                            )}
                            {transaction.description && transaction.created_at && (
                              <span className="text-muted-foreground/40">•</span>
                            )}
                            {transaction.created_at ? (
                              <span className="text-[10px] font-mono text-muted-foreground/70">
                                {format(new Date(transaction.created_at), 'HH:mm')}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                          <p
                            className={`font-semibold text-sm sm:text-base tabular-nums ${
                              isTransfer
                                ? isIncome
                                ? 'text-primary'
                                : 'text-muted-foreground'
                                : isIncome
                                ? 'text-success'
                                : 'text-destructive'
                            }`}
                          >
                            {isIncome ? '+' : '-'}
                            {formatCurrency(parseFloat(transaction.amount))}
                          </p>

                          {/* Edit/Pencil Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditingTransaction(transaction)}
                            className="h-8 w-8 text-muted-foreground hover:text-primary opacity-80 group-hover:opacity-100 transition-opacity"
                            title={t('transaction.edit')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          {/* Delete Button */}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(transaction.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-80 group-hover:opacity-100 transition-opacity"
                            title={t('transaction.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <EditTransactionDialog
        transaction={editingTransaction}
        open={!!editingTransaction}
        onOpenChange={(isOpen) => !isOpen && setEditingTransaction(null)}
      />

      {/* Delete Confirmation Alert */}
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
