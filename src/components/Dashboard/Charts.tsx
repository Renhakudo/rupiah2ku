import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, PieChart as PieIcon, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface ChartsProps {
  transactions: any[];
  isAllWallets?: boolean;
}

// Compact number formatter for chart axes (e.g. 10.000.000 -> 10 Jt, 500.000 -> 500 Rb)
const formatCompactNumber = (value: number): string => {
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, '')} Mld`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')} Jt`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(0)} Rb`;
  }
  return value.toLocaleString('id-ID');
};

// Curated vibrant color palette for categories
const CATEGORY_COLORS: Record<string, string> = {
  food: '#f59e0b',          // Amber / Orange
  transport: '#0ea5e9',     // Sky Blue
  shopping: '#8b5cf6',      // Purple
  bills: '#ef4444',         // Red
  entertainment: '#ec4899', // Pink
  salary: '#10b981',        // Emerald Green
  business: '#84cc16',      // Lime Green
  investment: '#06b6d4',    // Cyan
  transfer: '#6366f1',      // Indigo
  other: '#64748b',         // Slate Gray
};

const FALLBACK_COLORS = [
  '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899',
  '#06b6d4', '#ef4444', '#84cc16', '#6366f1', '#64748b',
];

// Sleek Custom Tooltip for Bar & Line Charts
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1.5 animate-in fade-in-50 duration-150 z-50">
        {label && <p className="font-semibold text-foreground border-b border-border/50 pb-1">{label}</p>}
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className="text-muted-foreground">{entry.name}:</span>
            </div>
            <span className="font-bold text-foreground tabular-nums">
              {formatCurrency(parseFloat(entry.value))}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const Charts = ({ transactions, isAllWallets = false }: ChartsProps) => {
  const { t } = useLanguage();
  const [cashflowView, setCashflowView] = useState<'monthly' | 'daily'>('monthly');
  const [categoryFilter, setCategoryFilter] = useState<'expense' | 'income'>('expense');

  // When viewing All Wallets, exclude internal transfers so charts reflect actual external cashflow
  const activeTransactions = useMemo(() => {
    return isAllWallets
      ? transactions.filter((t) => t.category !== 'transfer')
      : transactions;
  }, [transactions, isAllWallets]);

  // Income vs Expense data
  const incomeVsExpense = useMemo(() => {
    const incomeTotal = activeTransactions
      .filter((t) => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    const expenseTotal = activeTransactions
      .filter((t) => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

    return [
      {
        name: t('transaction.income'),
        type: 'income',
        amount: incomeTotal,
        fill: 'hsl(var(--success, 142 76% 36%))',
      },
      {
        name: t('transaction.expense'),
        type: 'expense',
        amount: expenseTotal,
        fill: 'hsl(var(--destructive, 0 84% 60%))',
      },
    ];
  }, [activeTransactions, t]);

  // Category Breakdown data (filtered by Expense vs Income for meaningful proportions)
  const categoryBreakdown = useMemo(() => {
    const filtered = activeTransactions.filter((tx) => tx.type === categoryFilter);
    const dataMap: Record<string, { category: string; name: string; value: number }> = {};

    for (const tx of filtered) {
      const cat = tx.category || 'other';
      if (!dataMap[cat]) {
        dataMap[cat] = {
          category: cat,
          name: t(`category.${cat}`) || cat,
          value: 0,
        };
      }
      dataMap[cat].value += parseFloat(tx.amount || 0);
    }

    return Object.values(dataMap).sort((a, b) => b.value - a.value);
  }, [activeTransactions, categoryFilter, t]);

  const totalCategoryAmount = useMemo(() => {
    return categoryBreakdown.reduce((sum, item) => sum + item.value, 0);
  }, [categoryBreakdown]);

  // Cashflow data - sorted chronologically
  const cashflowData = useMemo(() => {
    if (cashflowView === 'monthly') {
      const monthlyMap: Record<string, { date: string; label: string; income: number; expense: number }> = {};

      for (const tx of activeTransactions) {
        const d = new Date(tx.transaction_date);
        if (isNaN(d.getTime())) continue;

        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });

        if (!monthlyMap[monthKey]) {
          monthlyMap[monthKey] = { date: monthKey, label: monthLabel, income: 0, expense: 0 };
        }
        const amt = parseFloat(tx.amount || 0);
        if (tx.type === 'income') {
          monthlyMap[monthKey].income += amt;
        } else {
          monthlyMap[monthKey].expense += amt;
        }
      }

      return Object.values(monthlyMap).sort((a, b) => a.date.localeCompare(b.date));
    } else {
      // Daily view
      const dailyMap: Record<string, { date: string; label: string; income: number; expense: number }> = {};

      for (const tx of activeTransactions) {
        const d = new Date(tx.transaction_date);
        if (isNaN(d.getTime())) continue;

        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayLabel = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });

        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { date: dateKey, label: dayLabel, income: 0, expense: 0 };
        }
        const amt = parseFloat(tx.amount || 0);
        if (tx.type === 'income') {
          dailyMap[dateKey].income += amt;
        } else {
          dailyMap[dateKey].expense += amt;
        }
      }

      return Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    }
  }, [activeTransactions, cashflowView]);

  // Custom Tooltip for Donut PieChart
  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percent = totalCategoryAmount > 0 ? ((data.value / totalCategoryAmount) * 100).toFixed(1) : '0';
      return (
        <div className="rounded-xl border border-border/80 bg-card/95 p-3 shadow-xl backdrop-blur-md text-xs space-y-1 animate-in fade-in-50 duration-150 z-50">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: data.payload.fill }} />
            <p className="font-bold text-foreground">{data.name}</p>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1">
            <span className="text-muted-foreground">Total:</span>
            <span className="font-bold text-foreground tabular-nums">{formatCurrency(data.value)}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">Porsi:</span>
            <span className="font-semibold text-primary tabular-nums">{percent}%</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 1. Income vs Expense Bar Chart */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">{t('chart.incomeVsExpense')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={incomeVsExpense}
                margin={{ top: 20, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={formatCompactNumber}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="amount" radius={[8, 8, 0, 0]} maxBarSize={55}>
                  {incomeVsExpense.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* 2. Category Breakdown Donut Chart (Zero Overlapping Text) */}
      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base sm:text-lg">{t('chart.categoryBreakdown')}</CardTitle>
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg text-xs">
              <Button
                variant={categoryFilter === 'expense' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter('expense')}
                className="h-7 px-2.5 text-xs rounded-md"
              >
                <ArrowDownCircle className="w-3.5 h-3.5 mr-1" />
                <span>{t('chart.expenses')}</span>
              </Button>
              <Button
                variant={categoryFilter === 'income' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCategoryFilter('income')}
                className="h-7 px-2.5 text-xs rounded-md"
              >
                <ArrowUpCircle className="w-3.5 h-3.5 mr-1" />
                <span>{t('chart.income')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {categoryBreakdown.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center p-4">
              <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
                <PieIcon className="w-6 h-6 text-muted-foreground/60" />
              </div>
              <p className="text-xs text-muted-foreground">{t('chart.noData')}</p>
            </div>
          ) : (
            <div className="h-[260px] flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Donut Chart with Center Total Label */}
              <div className="w-full sm:w-1/2 h-[170px] sm:h-full relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CustomPieTooltip />} />
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={categoryBreakdown.length > 1 ? 3 : 0}
                      cornerRadius={4}
                      dataKey="value"
                    >
                      {categoryBreakdown.map((entry, index) => {
                        const color =
                          CATEGORY_COLORS[entry.category] ||
                          FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={color}
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        );
                      })}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge inside Donut */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                    Total
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-foreground tabular-nums">
                    {formatCompactNumber(totalCategoryAmount)}
                  </span>
                </div>
              </div>

              {/* Categorized Legend List with Color Indicators and Percentages */}
              <div className="w-full sm:w-1/2 max-h-[160px] sm:max-h-[220px] overflow-y-auto space-y-1.5 pr-1">
                {categoryBreakdown.map((entry, index) => {
                  const color =
                    CATEGORY_COLORS[entry.category] ||
                    FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                  const percent =
                    totalCategoryAmount > 0
                      ? ((entry.value / totalCategoryAmount) * 100).toFixed(1)
                      : '0';

                  return (
                    <div
                      key={entry.category}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-accent/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate font-medium text-foreground text-[11px] sm:text-xs">
                          {entry.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground tabular-nums text-[10px]">
                          {percent}%
                        </span>
                        <span className="font-semibold text-foreground tabular-nums text-[11px] sm:text-xs">
                          {formatCompactNumber(entry.value)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Cashflow Trend Line Chart */}
      <Card className="shadow-soft md:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">{t('chart.cashflow')}</CardTitle>
            <div className="flex gap-1.5 bg-muted/60 p-0.5 rounded-lg">
              <Button
                variant={cashflowView === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCashflowView('monthly')}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                <CalendarDays className="w-3.5 h-3.5 mr-1" />
                <span>{t('chart.monthly')}</span>
              </Button>
              <Button
                variant={cashflowView === 'daily' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setCashflowView('daily')}
                className="h-7 text-xs px-2.5 rounded-md"
              >
                <Calendar className="w-3.5 h-3.5 mr-1" />
                <span>{t('chart.daily')}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cashflowData.length === 0 ? (
            <div className="h-[260px] flex flex-col items-center justify-center text-center p-4">
              <p className="text-xs text-muted-foreground">{t('chart.noData')}</p>
            </div>
          ) : (
            <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={cashflowData}
                  margin={{
                    top: 15,
                    right: 20,
                    left: 0,
                    bottom: cashflowView === 'daily' ? 35 : 10,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    angle={cashflowView === 'daily' ? -35 : 0}
                    textAnchor={cashflowView === 'daily' ? 'end' : 'middle'}
                    height={cashflowView === 'daily' ? 50 : 28}
                    interval="preserveStartEnd"
                    minTickGap={25}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={formatCompactNumber}
                    width={52}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
                    iconType="circle"
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="hsl(var(--success, 142 76% 36%))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'hsl(var(--success, 142 76% 36%))' }}
                    activeDot={{ r: 6 }}
                    name={t('transaction.income')}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    stroke="hsl(var(--destructive, 0 84% 60%))"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'hsl(var(--destructive, 0 84% 60%))' }}
                    activeDot={{ r: 6 }}
                    name={t('transaction.expense')}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};