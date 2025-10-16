import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';

interface ChartsProps {
  transactions: any[];
}

export const Charts = ({ transactions }: ChartsProps) => {
  const { t } = useLanguage();

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

  // Monthly cashflow
  const monthlyData = transactions.reduce((acc: any, transaction) => {
    const month = new Date(transaction.transaction_date).toLocaleString('default', { month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, income: 0, expense: 0 };
    }
    if (transaction.type === 'income') {
      acc[month].income += parseFloat(transaction.amount);
    } else {
      acc[month].expense += parseFloat(transaction.amount);
    }
    return acc;
  }, {});
  const cashflowData = Object.values(monthlyData);

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
              <XAxis dataKey="name" />
              <YAxis />
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
          <CardTitle className="text-lg">{t('chart.cashflow')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={cashflowData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
              <XAxis dataKey="month" />
              <YAxis />
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