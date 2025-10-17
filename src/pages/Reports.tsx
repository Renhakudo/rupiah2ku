import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatCurrency } from '@/lib/currency';
import { LogOut, TrendingUp, Download, FileSpreadsheet, FileText, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Input } from '@/components/ui/input';

const Reports = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  
  const [selectedWalletId, setSelectedWalletId] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const { data: wallets = [] } = useQuery({
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

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['all-transactions'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const walletIds = wallets.map(w => w.id);
      if (walletIds.length === 0) return [];

      const { data, error } = await supabase
        .from('transactions')
        .select('*, wallets(name)')
        .in('wallet_id', walletIds)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: wallets.length > 0,
  });

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(transaction => {
      const walletMatch = selectedWalletId === 'all' || transaction.wallet_id === selectedWalletId;
      const categoryMatch = selectedCategory === 'all' || transaction.category === selectedCategory;
      const typeMatch = selectedType === 'all' || transaction.type === selectedType;
      
      let dateMatch = true;
      if (startDate) {
        dateMatch = dateMatch && new Date(transaction.transaction_date) >= new Date(startDate);
      }
      if (endDate) {
        dateMatch = dateMatch && new Date(transaction.transaction_date) <= new Date(endDate);
      }

      return walletMatch && categoryMatch && typeMatch && dateMatch;
    });
  }, [allTransactions, selectedWalletId, selectedCategory, selectedType, startDate, endDate]);

  const categories = useMemo(() => {
    const cats = new Set(allTransactions.map(t => t.category));
    return Array.from(cats);
  }, [allTransactions]);

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalExpense = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

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

  const downloadExcel = () => {
    const data = filteredTransactions.map(t => ({
      Date: format(new Date(t.transaction_date), 'yyyy-MM-dd'),
      Wallet: (t.wallets as any)?.name || 'N/A',
      Type: t.type,
      Category: t.category,
      Amount: parseFloat(t.amount.toString()),
      Description: t.description || '',
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `finance-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    toast({
      title: t('common.success'),
      description: 'Excel report downloaded successfully!',
    });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Finance Report', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 30);
    doc.text(`Total Income: ${formatCurrency(totalIncome)}`, 14, 37);
    doc.text(`Total Expense: ${formatCurrency(totalExpense)}`, 14, 44);
    doc.text(`Net Balance: ${formatCurrency(totalIncome - totalExpense)}`, 14, 51);

    const tableData = filteredTransactions.map(t => [
      format(new Date(t.transaction_date), 'yyyy-MM-dd'),
      (t.wallets as any)?.name || 'N/A',
      t.type,
      t.category,
      formatCurrency(parseFloat(t.amount.toString())),
      t.description || '',
    ]);

    autoTable(doc, {
      head: [['Date', 'Wallet', 'Type', 'Category', 'Amount', 'Description']],
      body: tableData,
      startY: 58,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`finance-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);

    toast({
      title: t('common.success'),
      description: 'PDF report downloaded successfully!',
    });
  };

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
              <Button variant="outline" size="icon" onClick={() => navigate('/')}>
                <Home className="w-4 h-4" />
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
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-3xl font-bold">Reports</h2>
          </div>

          {/* Filters */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Wallet</Label>
                  <Select value={selectedWalletId} onValueChange={setSelectedWalletId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Wallets</SelectItem>
                      {wallets.map((wallet) => (
                        <SelectItem key={wallet.id} value={wallet.id}>
                          {wallet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {t(`category.${cat}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-success">
                  {formatCurrency(totalIncome)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expense
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-destructive">
                  {formatCurrency(totalExpense)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${totalIncome - totalExpense >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(totalIncome - totalExpense)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Download Buttons */}
          <div className="flex gap-4">
            <Button onClick={downloadExcel} className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Download Excel
            </Button>
            <Button onClick={downloadPDF} variant="outline" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Download PDF
            </Button>
          </div>

          {/* Transactions Table */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Transactions ({filteredTransactions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Wallet</th>
                      <th className="text-left p-3 font-medium">Type</th>
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-left p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b hover:bg-accent/50 transition-smooth">
                        <td className="p-3 text-sm">
                          {format(new Date(transaction.transaction_date), 'PP')}
                        </td>
                        <td className="p-3 text-sm">{(transaction.wallets as any)?.name || 'N/A'}</td>
                        <td className="p-3 text-sm capitalize">{transaction.type}</td>
                        <td className="p-3 text-sm">{t(`category.${transaction.category}`)}</td>
                        <td className={`p-3 text-sm font-semibold ${
                          transaction.type === 'income' ? 'text-success' : 'text-destructive'
                        }`}>
                          {transaction.type === 'income' ? '+' : '-'}
                          {formatCurrency(parseFloat(transaction.amount.toString()))}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {transaction.description || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredTransactions.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Reports;
