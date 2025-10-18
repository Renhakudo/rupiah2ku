import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays } from 'lucide-react';

interface ChartsProps {
  transactions: any[];
}

export const Charts = ({ transactions }: ChartsProps) => {
  const { t } = useLanguage();
  const [cashflowView, setCashflowView] = useState<'monthly' | 'daily'>('monthly');

  // Income vs Expense data
  const incomeVsExpense = [
    {
      name: t('transaction.income'),
      amount: transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
    },
    {
      name: t('transaction.expense'),
      amount: transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0),
    },
  ];

  // Category breakdown
  const categoryData = transactions.reduce((acc: any, transaction) => {
    const category = transaction.category;
    if (!acc[category]) {
      acc[category] = { name: t(`category.${category}`), value: 0 };
    }
    acc[category].value += parseFloat(transaction.amount);
    return acc;
  }, {});
  const categoryBreakdown = Object.values(categoryData);

  // Cashflow data - sorted oldest to newest
  const getCashflowData = () => {
    if (cashflowView === 'monthly') {
      const monthlyData = transactions.reduce((acc: any, transaction) => {
        const date = new Date(transaction.transaction_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = date.toLocaleString('default', { month: 'short', year: 'numeric' });
        
        if (!acc[monthKey]) {
          acc[monthKey] = { date: monthKey, label: monthLabel, income: 0, expense: 0 };
        }
        if (transaction.type === 'income') {
          acc[monthKey].income += parseFloat(transaction.amount);
        } else {
          acc[monthKey].expense += parseFloat(transaction.amount);
        }
        return acc;
      }, {});
      
      return Object.values(monthlyData)
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
    } else {
      // Daily view
      const dailyData = transactions.reduce((acc: any, transaction) => {
        const date = new Date(transaction.transaction_date).toISOString().split('T')[0];
        const label = new Date(transaction.transaction_date).toLocaleDateString('default', { month: 'short', day: 'numeric' });
        
        if (!acc[date]) {
          acc[date] = { date, label, income: 0, expense: 0 };
        }
        if (transaction.type === 'income') {
          acc[date].income += parseFloat(transaction.amount);
        } else {
          acc[date].expense += parseFloat(transaction.amount);
        }
        return acc;
      }, {});
      
      return Object.values(dailyData)
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
    }
  };

  const cashflowData = getCashflowData();

  const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">{t('chart.incomeVsExpense')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={incomeVsExpense}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Bar dataKey="amount" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">{t('chart.categoryBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryBreakdown}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft md:col-span-2">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg">{t('chart.cashflow')}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant={cashflowView === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCashflowView('monthly')}
                className="flex items-center gap-1"
              >
                <CalendarDays className="w-4 h-4" />
                <span className="hidden sm:inline">{t('chart.monthly')}</span>
              </Button>
              <Button
                variant={cashflowView === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCashflowView('daily')}
                className="flex items-center gap-1"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">{t('chart.daily')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashflowData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis 
                dataKey="label" 
                className="text-xs"
                angle={cashflowView === 'daily' ? -45 : 0}
                textAnchor={cashflowView === 'daily' ? 'end' : 'middle'}
                height={cashflowView === 'daily' ? 70 : 30}
              />
              <YAxis className="text-xs" />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="income" 
                stroke="hsl(var(--success))" 
                strokeWidth={2}
                name={t('transaction.income')}
              />
              <Line 
                type="monotone" 
                dataKey="expense" 
                stroke="hsl(var(--destructive))" 
                strokeWidth={2}
                name={t('transaction.expense')}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};