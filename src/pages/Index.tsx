import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WalletSelector } from '@/components/WalletSelector';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionList } from '@/components/TransactionList';
import { StatsCards } from '@/components/Dashboard/StatsCards';
import { Charts } from '@/components/Dashboard/Charts';
import { DateRangeFilter } from '@/components/DateRangeFilter';
import { TransferDialog } from '@/components/Dashboard/TransferDialog';
import { BudgetSection } from '@/components/Dashboard/BudgetSection';
import { SavingsGoals } from '@/components/Dashboard/SavingsGoals';
import { QuickAddFAB } from '@/components/QuickAddFAB';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { LogOut, TrendingUp, FileText, Shield, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { subDays, format as formatDate } from 'date-fns';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const Index = () => {
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };
    checkAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate('/auth');
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions', selectedWalletId],
    queryFn: async () => {
      if (!selectedWalletId) return [];
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', selectedWalletId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWalletId,
  });

  const transactions = useMemo(() => {
    return allTransactions.filter(transaction => {
      let dateMatch = true;
      if (startDate) dateMatch = dateMatch && new Date(transaction.transaction_date) >= new Date(startDate);
      if (endDate) dateMatch = dateMatch && new Date(transaction.transaction_date) <= new Date(endDate);
      return dateMatch;
    });
  }, [allTransactions, startDate, endDate]);

  const handleQuickFilter = (days: number) => {
    const end = new Date();
    const start = subDays(end, days);
    setStartDate(formatDate(start, 'yyyy-MM-dd'));
    setEndDate(formatDate(end, 'yyyy-MM-dd'));
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      navigate('/auth');
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
  const netBalance = totalIncome - totalExpense;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b glass">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-primary flex items-center justify-center">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <h1 className="text-base sm:text-xl font-bold hidden sm:block">FinanceTrack</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden md:block">
                <WalletSelector selectedWalletId={selectedWalletId} onSelectWallet={setSelectedWalletId} />
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin')} className="h-8 w-8">
                  <Shield className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => navigate('/reports')} className="h-8 w-8">
                <FileText className="w-4 h-4" />
              </Button>
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-8">
        {/* Mobile Wallet Selector */}
        <div className="md:hidden mb-4">
          <WalletSelector selectedWalletId={selectedWalletId} onSelectWallet={setSelectedWalletId} />
        </div>

        {!selectedWalletId ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 animate-in">
            <div className="text-center max-w-md px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3">{t('wallet.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wallet.noWallets')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Stats Cards */}
            <StatsCards totalIncome={totalIncome} totalExpense={totalExpense} netBalance={netBalance} />

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <TransactionForm walletId={selectedWalletId} />
              <TransferDialog />
            </div>

            {/* Date Filter - Collapsible on mobile */}
            <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
              <Card className="shadow-soft">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base">{t('filter.dateRange')}</CardTitle>
                      <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${filterOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <DateRangeFilter
                      startDate={startDate}
                      endDate={endDate}
                      onStartDateChange={setStartDate}
                      onEndDateChange={setEndDate}
                      onQuickFilter={handleQuickFilter}
                    />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Budget & Savings Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              <BudgetSection transactions={allTransactions} />
              <SavingsGoals />
            </div>

            {/* Charts */}
            {transactions.length > 0 && <Charts transactions={transactions} />}

            {/* Transaction List */}
            {isLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground animate-pulse-soft">
                {t('common.loading')}
              </div>
            ) : (
              <TransactionList transactions={transactions} walletId={selectedWalletId} />
            )}
          </div>
        )}
      </main>

      {/* FAB for mobile quick add */}
      {selectedWalletId && <QuickAddFAB walletId={selectedWalletId} />}
    </div>
  );
};

export default Index;
