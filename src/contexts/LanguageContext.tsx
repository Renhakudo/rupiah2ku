import { createContext, useContext, useState, ReactNode } from 'react';

type Language = 'en' | 'id';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Auth
    'auth.signIn': 'Sign In',
    'auth.signUp': 'Sign Up',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.haveAccount': 'Already have an account?',
    'auth.noAccount': "Don't have an account?",
    'auth.signingIn': 'Signing in...',
    'auth.signingUp': 'Creating account...',
    'auth.logout': 'Logout',
    
    // Dashboard
    'dashboard.title': 'Dashboard',
    'dashboard.netBalance': 'Net Balance',
    'dashboard.totalIncome': 'Total Income',
    'dashboard.totalExpense': 'Total Expense',
    'dashboard.transactions': 'Transactions',
    'dashboard.noTransactions': 'No transactions yet',
    
    // Wallets
    'wallet.title': 'Wallets',
    'wallet.create': 'Create Wallet',
    'wallet.name': 'Wallet Name',
    'wallet.description': 'Description',
    'wallet.select': 'Select Wallet',
    'wallet.creating': 'Creating...',
    'wallet.noWallets': 'No wallets yet. Create one to get started!',
    
    // Transactions
    'transaction.add': 'Add Transaction',
    'transaction.edit': 'Edit Transaction',
    'transaction.type': 'Type',
    'transaction.income': 'Income',
    'transaction.expense': 'Expense',
    'transaction.amount': 'Amount',
    'transaction.category': 'Category',
    'transaction.description': 'Description',
    'transaction.date': 'Date',
    'transaction.saving': 'Saving...',
    'transaction.save': 'Save',
    'transaction.delete': 'Delete',
    'transaction.cancel': 'Cancel',
    
    // Categories
    'category.salary': 'Salary',
    'category.business': 'Business',
    'category.investment': 'Investment',
    'category.other': 'Other',
    'category.food': 'Food',
    'category.transport': 'Transport',
    'category.shopping': 'Shopping',
    'category.bills': 'Bills',
    'category.entertainment': 'Entertainment',
    
    // Charts
    'chart.incomeVsExpense': 'Income vs Expense',
    'chart.cashflow': 'Cashflow Trend',
    'chart.categoryBreakdown': 'Category Breakdown',
    'chart.monthlyGrowth': 'Monthly Growth Rate',
    'chart.walletComparison': 'Wallet Comparison',
    
    // Filters
    'filter.dateRange': 'Date Range',
    'filter.category': 'Category',
    'filter.all': 'All',
    
    // Common
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.darkMode': 'Dark Mode',
    'common.lightMode': 'Light Mode',
  },
  id: {
    // Auth
    'auth.signIn': 'Masuk',
    'auth.signUp': 'Daftar',
    'auth.email': 'Email',
    'auth.password': 'Kata Sandi',
    'auth.fullName': 'Nama Lengkap',
    'auth.haveAccount': 'Sudah punya akun?',
    'auth.noAccount': 'Belum punya akun?',
    'auth.signingIn': 'Masuk...',
    'auth.signingUp': 'Membuat akun...',
    'auth.logout': 'Keluar',
    
    // Dashboard
    'dashboard.title': 'Dasbor',
    'dashboard.netBalance': 'Saldo Bersih',
    'dashboard.totalIncome': 'Total Pendapatan',
    'dashboard.totalExpense': 'Total Pengeluaran',
    'dashboard.transactions': 'Transaksi',
    'dashboard.noTransactions': 'Belum ada transaksi',
    
    // Wallets
    'wallet.title': 'Dompet',
    'wallet.create': 'Buat Dompet',
    'wallet.name': 'Nama Dompet',
    'wallet.description': 'Deskripsi',
    'wallet.select': 'Pilih Dompet',
    'wallet.creating': 'Membuat...',
    'wallet.noWallets': 'Belum ada dompet. Buat satu untuk memulai!',
    
    // Transactions
    'transaction.add': 'Tambah Transaksi',
    'transaction.edit': 'Edit Transaksi',
    'transaction.type': 'Tipe',
    'transaction.income': 'Pendapatan',
    'transaction.expense': 'Pengeluaran',
    'transaction.amount': 'Jumlah',
    'transaction.category': 'Kategori',
    'transaction.description': 'Deskripsi',
    'transaction.date': 'Tanggal',
    'transaction.saving': 'Menyimpan...',
    'transaction.save': 'Simpan',
    'transaction.delete': 'Hapus',
    'transaction.cancel': 'Batal',
    
    // Categories
    'category.salary': 'Gaji',
    'category.business': 'Bisnis',
    'category.investment': 'Investasi',
    'category.other': 'Lainnya',
    'category.food': 'Makanan',
    'category.transport': 'Transportasi',
    'category.shopping': 'Belanja',
    'category.bills': 'Tagihan',
    'category.entertainment': 'Hiburan',
    
    // Charts
    'chart.incomeVsExpense': 'Pendapatan vs Pengeluaran',
    'chart.cashflow': 'Tren Arus Kas',
    'chart.categoryBreakdown': 'Rincian Kategori',
    'chart.monthlyGrowth': 'Tingkat Pertumbuhan Bulanan',
    'chart.walletComparison': 'Perbandingan Dompet',
    
    // Filters
    'filter.dateRange': 'Rentang Tanggal',
    'filter.category': 'Kategori',
    'filter.all': 'Semua',
    
    // Common
    'common.loading': 'Memuat...',
    'common.error': 'Kesalahan',
    'common.success': 'Berhasil',
    'common.darkMode': 'Mode Gelap',
    'common.lightMode': 'Mode Terang',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['en']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
};