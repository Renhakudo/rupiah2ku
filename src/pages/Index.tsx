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
import { LogOut, TrendingUp, FileText, Shield, ChevronDown, Layers, Wallet } from 'lucide-react';
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

  // Fetch wallets strictly isolated for the authenticated user
  const { data: wallets = [], isLoading: isWalletsLoading } = useQuery({
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

  // UX Improvement: Automatically select default wallet or restore from localStorage upon login
  useEffect(() => {
    if (wallets.length > 0 && !selectedWalletId) {
      const saved = localStorage.getItem('rupiah2ku_selected_wallet');
      if (saved && (saved === 'all' || wallets.some((w) => w.id === saved))) {
        setSelectedWalletId(saved);
      } else {
        // Default to first wallet so dashboard is immediately active and informative
        setSelectedWalletId(wallets[0].id);
      }
    }
  }, [wallets, selectedWalletId]);

  const handleSelectWallet = (id: string) => {
    setSelectedWalletId(id);
    if (id) {
      localStorage.setItem('rupiah2ku_selected_wallet', id);
    }
  };

  const isAllWallets = selectedWalletId === 'all';

  const walletIdsKey = wallets.map((w) => w.id).join(',');

  // Fetch transactions strictly isolated for the authenticated user's wallet(s)
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions', selectedWalletId, walletIdsKey],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      if (!selectedWalletId) return [];

      let query = supabase.from('transactions').select('*, wallets(id, name, user_id)');

      if (isAllWallets) {
        const walletIds = wallets.map((w) => w.id);
        if (walletIds.length === 0) return [];
        query = query.in('wallet_id', walletIds);
      } else {
        query = query.eq('wallet_id', selectedWalletId);
      }

      const { data, error } = await query.order('transaction_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedWalletId && (!isAllWallets || wallets.length > 0),
  });

  const transactions = useMemo(() => {
    return allTransactions.filter((transaction) => {
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
      localStorage.removeItem('rupiah2ku_selected_wallet');
      navigate('/auth');
    }
  };

  // Ensure All Wallets calculation does NOT count internal transfers as double income/expense
  const totalIncome = transactions
    .filter((t) => t.type === 'income' && (!isAllWallets || t.category !== 'transfer'))
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalExpense = transactions
    .filter((t) => t.type === 'expense' && (!isAllWallets || t.category !== 'transfer'))
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const netBalance = totalIncome - totalExpense;

  // Active wallet name for header
  const activeWalletName = useMemo(() => {
    if (isAllWallets) return t('wallet.allWallets') || 'All Wallets';
    const current = wallets.find((w) => w.id === selectedWalletId);
    return current ? current.name : '';
  }, [isAllWallets, wallets, selectedWalletId, t]);

  const defaultActionWalletId = isAllWallets ? (wallets[0]?.id || '') : (selectedWalletId || '');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b glass">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <img
                src="/pwa-192x192.png"
                alt="FinanceTrack"
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl object-contain shadow-xs border border-primary/20 bg-card p-0.5"
              />
              <h1 className="text-base sm:text-xl font-bold hidden sm:block">FinanceTrack</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <div className="hidden md:block">
                <WalletSelector selectedWalletId={selectedWalletId} onSelectWallet={handleSelectWallet} />
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
          <WalletSelector selectedWalletId={selectedWalletId} onSelectWallet={handleSelectWallet} />
        </div>

        {wallets.length === 0 && !isWalletsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 sm:py-20 animate-in">
            <div className="text-center max-w-md px-4">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center p-2.5 shadow-sm">
                <img src="/pwa-192x192.png" alt="FinanceTrack" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold mb-3">{t('wallet.title')}</h2>
              <p className="text-sm text-muted-foreground">{t('wallet.noWallets')}</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* View Header Badge if in All Wallets */}
            {isAllWallets && (
              <div className="flex items-center gap-2 text-xs text-primary font-medium bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-xl w-fit">
                <Layers className="w-3.5 h-3.5" />
                <span>{t('wallet.allWalletsDesc') || 'Viewing combined summary of all your wallets'}</span>
              </div>
            )}

            {/* Stats Cards */}
            <StatsCards totalIncome={totalIncome} totalExpense={totalExpense} netBalance={netBalance} />

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <TransactionForm walletId={defaultActionWalletId} />
              <TransferDialog defaultSourceWalletId={selectedWalletId !== 'all' ? selectedWalletId : undefined} />
            </div>

            {/* Date Filter - Collapsible on mobile */}
            <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
              <Card className="shadow-soft">
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-accent/30 transition-colors rounded-t-lg pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm sm:text-base">{t('filter.dateRange')}</CardTitle>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
                          filterOpen ? 'rotate-180' : ''
                        }`}
                      />
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

            {/* Charts - Pass isAllWallets so internal transfers don't distort graphs */}
            {transactions.length > 0 && <Charts transactions={transactions} isAllWallets={isAllWallets} />}

            {/* Transaction List */}
            {isLoading ? (
              <div className="text-center py-8 text-sm text-muted-foreground animate-pulse-soft">
                {t('common.loading')}
              </div>
            ) : (
              <TransactionList transactions={transactions} walletId={selectedWalletId || ''} />
            )}
          </div>
        )}
      </main>

      {/* FAB for mobile quick add */}
      {defaultActionWalletId && <QuickAddFAB walletId={defaultActionWalletId} />}
    </div>
  );
};

export default Index;
