import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';

interface StatsCardsProps {
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
}

export const StatsCards = ({ totalIncome, totalExpense, netBalance }: StatsCardsProps) => {
  const { t } = useLanguage();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
      <Card className="shadow-soft hover-lift animate-in stagger-1 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-primary" />
        <CardContent className="pt-5 pb-4 px-4 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t('dashboard.netBalance')}</p>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tracking-tight break-all">{formatCurrency(netBalance)}</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover-lift animate-in stagger-2 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-success" />
        <CardContent className="pt-5 pb-4 px-4 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t('dashboard.totalIncome')}</p>
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-success break-all">{formatCurrency(totalIncome)}</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover-lift animate-in stagger-3 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-destructive" />
        <CardContent className="pt-5 pb-4 px-4 sm:px-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{t('dashboard.totalExpense')}</p>
            <div className="w-8 h-8 rounded-full bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-destructive" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-bold tracking-tight text-destructive break-all">{formatCurrency(totalExpense)}</p>
        </CardContent>
      </Card>
    </div>
  );
};
