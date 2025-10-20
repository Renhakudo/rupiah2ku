import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="shadow-soft hover:shadow-medium transition-smooth bg-gradient-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('dashboard.netBalance')}</CardTitle>
          <Wallet className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(netBalance)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            Total balance across wallet
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-medium transition-smooth bg-gradient-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('dashboard.totalIncome')}</CardTitle>
          <TrendingUp className="w-4 h-4 text-success" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-success">{formatCurrency(totalIncome)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            All income transactions
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft hover:shadow-medium transition-smooth bg-gradient-card">
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-sm font-medium">{t('dashboard.totalExpense')}</CardTitle>
          <TrendingDown className="w-4 h-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{formatCurrency(totalExpense)}</div>
          <p className="text-xs text-muted-foreground mt-1">
            All expense transactions
          </p>
        </CardContent>
      </Card>
    </div>
  );
};