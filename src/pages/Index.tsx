import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { WalletSelector } from '@/components/WalletSelector';
import { TransactionForm } from '@/components/TransactionForm';
import { TransactionList } from '@/components/TransactionList';
import { StatsCards } from '@/components/Dashboard/StatsCards';
import { Charts } from '@/components/Dashboard/Charts';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { LogOut, TrendingUp, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: transactions = [], isLoading } = useQuery({
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

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
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
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">FinanceTrack</h1>
            </div>
            <div className="flex items-center gap-3">
              <WalletSelector
                selectedWalletId={selectedWalletId}
                onSelectWallet={setSelectedWalletId}
              />
              <Button variant="outline" size="icon" onClick={() => navigate('/reports')}>
                <FileText className="w-4 h-4" />
              </Button>
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="outline" size="icon" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!selectedWalletId ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-center max-w-md">
              <h2 className="text-2xl font-bold mb-4">{t('wallet.title')}</h2>
              <p className="text-muted-foreground mb-8">
                {t('wallet.noWallets')}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Stats Cards */}
            <StatsCards
              totalIncome={totalIncome}
              totalExpense={totalExpense}
              netBalance={netBalance}
            />

            {/* Action Bar */}
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t('dashboard.title')}</h2>
              <TransactionForm walletId={selectedWalletId} />
            </div>

            {/* Charts */}
            {transactions.length > 0 && (
              <Charts transactions={transactions} />
            )}

            {/* Transaction List */}
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('common.loading')}
              </div>
            ) : (
              <TransactionList transactions={transactions} walletId={selectedWalletId} />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;