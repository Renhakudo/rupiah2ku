import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
import {
  LogOut,
  Home,
  Shield,
  Users,
  Wallet,
  Receipt,
  Activity,
  Search,
  Trash2,
  Tag,
  Plus,
  Pencil,
  CheckCircle2,
  Utensils,
  Car,
  ShoppingBag,
  Film,
  Briefcase,
  TrendingUp,
  Landmark,
  MoreHorizontal,
  HeartPulse,
  GraduationCap,
  Gift,
  Plane,
  Coffee,
  Music,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

const AVAILABLE_ICONS = [
  { value: 'tag', label: 'Tag (Umum)' },
  { value: 'utensils', label: 'Makanan / Kuliner' },
  { value: 'car', label: 'Transportasi / BBM' },
  { value: 'shopping-bag', label: 'Belanja / Retail' },
  { value: 'receipt', label: 'Tagihan & Utilitas' },
  { value: 'film', label: 'Hiburan / Bioskop' },
  { value: 'briefcase', label: 'Gaji / Payroll' },
  { value: 'trending-up', label: 'Bisnis / Usaha' },
  { value: 'landmark', label: 'Investasi / Tabungan' },
  { value: 'heart-pulse', label: 'Kesehatan / Medis' },
  { value: 'graduation-cap', label: 'Pendidikan / Kursus' },
  { value: 'gift', label: 'Hadiah / Amal / Zakat' },
  { value: 'plane', label: 'Liburan / Tiket' },
  { value: 'coffee', label: 'Kafe / Kopi' },
  { value: 'music', label: 'Musik & Kreatif' },
  { value: 'more-horizontal', label: 'Lain-lain' },
];

const renderCategoryIcon = (iconName?: string | null) => {
  const iconProps = { className: 'w-4 h-4' };
  switch (iconName) {
    case 'utensils': return <Utensils {...iconProps} />;
    case 'car': return <Car {...iconProps} />;
    case 'shopping-bag': return <ShoppingBag {...iconProps} />;
    case 'receipt': return <Receipt {...iconProps} />;
    case 'film': return <Film {...iconProps} />;
    case 'briefcase': return <Briefcase {...iconProps} />;
    case 'trending-up': return <TrendingUp {...iconProps} />;
    case 'landmark': return <Landmark {...iconProps} />;
    case 'heart-pulse': return <HeartPulse {...iconProps} />;
    case 'graduation-cap': return <GraduationCap {...iconProps} />;
    case 'gift': return <Gift {...iconProps} />;
    case 'plane': return <Plane {...iconProps} />;
    case 'coffee': return <Coffee {...iconProps} />;
    case 'music': return <Music {...iconProps} />;
    case 'more-horizontal': return <MoreHorizontal {...iconProps} />;
    default: return <Tag {...iconProps} />;
  }
};

const Admin = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Search Filters
  const [searchUser, setSearchUser] = useState('');
  const [searchWallet, setSearchWallet] = useState('');
  const [searchLog, setSearchLog] = useState('');
  const [searchTransaction, setSearchTransaction] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  // Modals
  const [transactionToDelete, setTransactionToDelete] = useState<string | null>(null);
  const [userStatusToToggle, setUserStatusToToggle] = useState<{ id: string; isActive: boolean } | null>(null);
  const [userRoleToToggle, setUserRoleToToggle] = useState<{ id: string; makeAdmin: boolean } | null>(null);

  // Category Modal & Form States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<any | null>(null);
  const [categoryFormName, setCategoryFormName] = useState('');
  const [categoryFormSlug, setCategoryFormSlug] = useState('');
  const [categoryFormType, setCategoryFormType] = useState<'expense' | 'income' | 'both'>('expense');
  const [categoryFormIcon, setCategoryFormIcon] = useState('tag');

  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (error) console.error('Error checking admin status:', error);
      setIsAdmin(!!data);
      setLoading(false);

      if (!data) {
        toast({ title: t('common.error'), description: 'Access denied. Admin privileges required.', variant: 'destructive' });
        navigate('/');
      }
    };
    checkAdminStatus();
  }, [navigate, toast, t]);

  const { data: dbStats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_admin_system_stats');
      if (error) {
         return { total_users: 0, active_users: 0, total_transactions: 0, total_wallets: 0 };
      }
      return data;
    },
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('user_roles').select('*')
      ]);
      return (profiles || []).map((profile: any) => ({
        ...profile,
        user_roles: (roles || []).filter((r: any) => r.user_id === profile.id)
      }));
    },
    enabled: isAdmin,
  });

  const { data: allWallets = [] } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('wallets').select('*, profiles(full_name)').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: activityLogs = [] } = useQuery({
    queryKey: ['admin-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(200);
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ['admin-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, wallets(name, profiles(full_name))')
        .order('transaction_date', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('type', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        await supabase.from('user_roles').insert({ user_id: userId, role: 'admin' });
      } else {
        await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      }
    },
    onSuccess: () => {
      setUserRoleToToggle(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: t('common.success'), description: 'Role updated successfully' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setUserStatusToToggle(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
      toast({ title: t('common.success'), description: 'Account status updated' });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setTransactionToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['admin-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-logs'] });
      toast({ title: t('common.success'), description: 'Transaction deleted globally.' });
    }
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const cleanName = categoryFormName.trim();
      const cleanSlug = categoryFormSlug.trim().toLowerCase();
      if (!cleanName || !cleanSlug) throw new Error('Nama dan Slug kategori wajib diisi.');

      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: cleanName,
            slug: cleanSlug,
            type: categoryFormType,
            icon: categoryFormIcon,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('categories')
          .insert([{
            name: cleanName,
            slug: cleanSlug,
            type: categoryFormType,
            icon: categoryFormIcon,
            is_default: false,
          }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setIsCategoryModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: t('common.success'),
        description: editingCategory
          ? 'Kategori berhasil diperbarui!'
          : 'Kategori baru berhasil ditambahkan! AI parser & scanner struk langsung mengenali kategori ini.',
      });
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err.message || 'Gagal menyimpan kategori',
        variant: 'destructive',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCategoryToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({
        title: t('common.success'),
        description: 'Kategori berhasil dihapus.',
      });
    },
    onError: (err: any) => {
      toast({
        title: t('common.error'),
        description: err.message || 'Gagal menghapus kategori',
        variant: 'destructive',
      });
    },
  });

  const handleOpenAddCategory = () => {
    setEditingCategory(null);
    setCategoryFormName('');
    setCategoryFormSlug('');
    setCategoryFormType('expense');
    setCategoryFormIcon('tag');
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCategoryFormName(cat.name);
    setCategoryFormSlug(cat.slug);
    setCategoryFormType(cat.type);
    setCategoryFormIcon(cat.icon || 'tag');
    setIsCategoryModalOpen(true);
  };

  const handleCategoryNameChange = (val: string) => {
    setCategoryFormName(val);
    if (!editingCategory) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setCategoryFormSlug(generatedSlug);
    }
  };

  const filteredUsers = users.filter((u: any) => 
    u.full_name?.toLowerCase().includes(searchUser.toLowerCase()) || 
    u.id.includes(searchUser) || 
    u.email?.toLowerCase().includes(searchUser.toLowerCase()) // assuming email if joined on auth later, or display only full name
  );

  const filteredWallets = allWallets.filter((w: any) => 
    w.name.toLowerCase().includes(searchWallet.toLowerCase()) || 
    w.profiles?.full_name?.toLowerCase().includes(searchWallet.toLowerCase())
  );

  const filteredLogs = activityLogs.filter((log: any) => 
    log.action_type.toLowerCase().includes(searchLog.toLowerCase()) || 
    log.entity_type.toLowerCase().includes(searchLog.toLowerCase()) || 
    log.profiles?.full_name?.toLowerCase().includes(searchLog.toLowerCase())
  );

  const filteredTransactions = allTransactions.filter((tx: any) => 
    tx.category?.toLowerCase().includes(searchTransaction.toLowerCase()) || 
    tx.wallets?.name?.toLowerCase().includes(searchTransaction.toLowerCase()) || 
    tx.wallets?.profiles?.full_name?.toLowerCase().includes(searchTransaction.toLowerCase())
  );

  const filteredCategories = categories.filter((cat: any) =>
    cat.name?.toLowerCase().includes(searchCategory.toLowerCase()) ||
    cat.slug?.toLowerCase().includes(searchCategory.toLowerCase()) ||
    cat.type?.toLowerCase().includes(searchCategory.toLowerCase())
  );

  // Compute analytics
  const userActivityData = React.useMemo(() => {
    if (!activityLogs.length) return [];
    const counts: Record<string, number> = {};
    activityLogs.forEach((log: any) => {
      const date = format(new Date(log.created_at), 'MMM dd');
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts).reverse().map(([date, count]) => ({ date, count }));
  }, [activityLogs]);

  const txTrendData = React.useMemo(() => {
    if (!allTransactions.length) return [];
    const counts: Record<string, number> = {};
    allTransactions.forEach((tx: any) => {
      const date = format(new Date(tx.transaction_date), 'MMM dd');
      counts[date] = (counts[date] || 0) + 1;
    });
    return Object.entries(counts).reverse().map(([date, count]) => ({ date, count }));
  }, [allTransactions]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center p-4">{t('common.loading')}</div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img
                src="/pwa-192x192.png"
                alt="FinanceTrack"
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain shadow-xs border border-primary/20 bg-card p-0.5"
              />
              <h1 className="text-lg sm:text-2xl font-bold">{t('admin.title')}</h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="icon" onClick={() => navigate('/')} className="h-8 w-8 sm:h-10 sm:w-10"><Home className="w-3 h-3 sm:w-4 sm:h-4" /></Button>
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="outline" size="icon" onClick={handleLogout} className="h-8 w-8 sm:h-10 sm:w-10"><LogOut className="w-3 h-3 sm:w-4 sm:h-4" /></Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{t('admin.totalUsers')}</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-3xl font-bold">{dbStats?.total_users || users.length}</div><p className="text-xs text-muted-foreground mt-1">{dbStats?.active_users || users.filter((u: any) => u.is_active !== false).length} {t('admin.statusActive').toLowerCase()}</p></CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{t('admin.totalWallets')}</CardTitle><Wallet className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-3xl font-bold">{dbStats?.total_wallets || allWallets.length}</div></CardContent>
          </Card>
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">{t('admin.totalTransactions')}</CardTitle><Receipt className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent><div className="text-3xl font-bold">{dbStats?.total_transactions || allTransactions.length}</div></CardContent>
          </Card>
          <Card className="shadow-soft bg-primary/5 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium">Logged Actions</CardTitle><Activity className="h-4 w-4 text-primary" /></CardHeader>
            <CardContent><div className="text-3xl font-bold text-primary">{activityLogs.length}</div><p className="text-xs text-muted-foreground mt-1">Stored audit events</p></CardContent>
          </Card>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="w-full sm:w-auto flex flex-wrap h-auto overflow-x-auto justify-start border bg-transparent p-1 gap-2">
            <TabsTrigger value="overview" className="data-[state=active]:bg-primary/10">{t('admin.overview')}</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary/10">{t('admin.users')}</TabsTrigger>
            <TabsTrigger value="categories" className="data-[state=active]:bg-primary/10 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Kategori
            </TabsTrigger>
            <TabsTrigger value="transactions" className="data-[state=active]:bg-primary/10">{t('admin.transactions')}</TabsTrigger>
            <TabsTrigger value="logs" className="data-[state=active]:bg-primary/10">Activity Logs</TabsTrigger>
            <TabsTrigger value="wallets" className="data-[state=active]:bg-primary/10">{t('admin.wallets')}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <Card className="shadow-soft border-border/50">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> {t('admin.analyticsUsers')}</CardTitle>
                   <CardDescription>Daily engagement extracted from smart audit logs</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <ChartContainer config={{ count: { label: t('admin.userActivityLegend'), color: "hsl(var(--primary))" } }} className="h-[250px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={userActivityData}>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                         <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} interval="preserveStartEnd" minTickGap={20} />
                         <YAxis hide />
                         <ChartTooltip content={<ChartTooltipContent />} />
                         <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
                       </BarChart>
                     </ResponsiveContainer>
                   </ChartContainer>
                 </CardContent>
               </Card>

               <Card className="shadow-soft border-border/50">
                 <CardHeader>
                   <CardTitle className="flex items-center gap-2"><Receipt className="w-4 h-4 text-primary" /> {t('admin.analyticsTx')}</CardTitle>
                   <CardDescription>Volume of transactions mapped over time</CardDescription>
                 </CardHeader>
                 <CardContent>
                   <ChartContainer config={{ count: { label: t('admin.transactionTrendLegend'), color: "hsl(var(--primary))" } }} className="h-[250px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       <AreaChart data={txTrendData}>
                         <defs>
                           <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="var(--color-count)" stopOpacity={0.3} />
                             <stop offset="95%" stopColor="var(--color-count)" stopOpacity={0} />
                           </linearGradient>
                         </defs>
                         <CartesianGrid strokeDasharray="3 3" vertical={false} />
                         <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={10} fontSize={12} interval="preserveStartEnd" minTickGap={20} />
                         <YAxis hide />
                         <ChartTooltip content={<ChartTooltipContent />} />
                         <Area type="monotone" dataKey="count" stroke="var(--color-count)" fill="url(#fillCount)" strokeWidth={2} />
                       </AreaChart>
                     </ResponsiveContainer>
                   </ChartContainer>
                 </CardContent>
               </Card>
             </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.users')}</CardTitle>
                  <CardDescription>Suspend accounts or promote administrators.</CardDescription>
                </div>
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t('admin.searchUsers')} value={searchUser} onChange={(e) => setSearchUser(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="p-3 font-medium">{t('admin.user')}</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">{t('admin.role')}</th>
                        <th className="p-3 font-medium">{t('admin.joined')}</th>
                        <th className="p-3 font-medium">{t('admin.security')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('admin.noData')}</td></tr> : filteredUsers.map((user: any) => {
                        const isAdm = user.user_roles.some((r: any) => r.role === 'admin');
                        const isSelf = user.id === (queryClient.getQueryData(['session']) as any)?.user?.id;
                        return (
                          <tr key={user.id} className="border-b hover:bg-accent/50 transition duration-150">
                            <td className="p-3"><div className="font-semibold truncate max-w-[150px]">{user.full_name || 'Anonymous'}</div><div className="text-xs text-muted-foreground font-mono">{user.id.substring(0, 8)}...</div></td>
                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-medium tracking-wide ${user.is_active !== false ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{user.is_active !== false ? t('admin.statusActive') : t('admin.statusSuspended')}</span></td>
                            <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-medium tracking-wide ${isAdm ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{isAdm ? 'Admin' : 'Member'}</span></td>
                            <td className="p-3 text-muted-foreground">{format(new Date(user.created_at), 'MMM dd, yyyy')}</td>
                            <td className="p-3 flex items-center gap-2">
                              <Button size="sm" variant={isAdm ? 'outline' : 'default'} onClick={() => setUserRoleToToggle({ id: user.id, makeAdmin: !isAdm })} disabled={isSelf}>
                                {isAdm ? t('admin.demote') : t('admin.promote')}
                              </Button>
                              <Button size="sm" variant={user.is_active !== false ? 'destructive' : 'secondary'} onClick={() => setUserStatusToToggle({ id: user.id, isActive: user.is_active === false })} disabled={isSelf}>
                                {user.is_active !== false ? t('admin.suspend') : t('admin.reactivate')}
                              </Button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="categories" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-primary" />
                    Manajemen Kategori
                  </CardTitle>
                  <CardDescription>
                    Kelola kategori transaksi. AI parser (suara/ketikan) dan scanner struk secara otomatis mendeteksi semua kategori ini.
                  </CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Cari kategori / slug..."
                      value={searchCategory}
                      onChange={(e) => setSearchCategory(e.target.value)}
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <Button onClick={handleOpenAddCategory} size="sm" className="gap-1.5 bg-gradient-primary">
                    <Plus className="w-4 h-4" />
                    Tambah Kategori
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Stats Chips */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="p-3 rounded-lg border bg-card/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Kategori</p>
                      <p className="text-xl font-bold">{categories.length}</p>
                    </div>
                    <Tag className="w-5 h-5 text-primary/60" />
                  </div>
                  <div className="p-3 rounded-lg border bg-card/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Kategori Pengeluaran</p>
                      <p className="text-xl font-bold text-destructive">
                        {categories.filter((c: any) => c.type === 'expense' || c.type === 'both').length}
                      </p>
                    </div>
                    <Receipt className="w-5 h-5 text-destructive/60" />
                  </div>
                  <div className="p-3 rounded-lg border bg-card/60 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Kategori Pemasukan</p>
                      <p className="text-xl font-bold text-success">
                        {categories.filter((c: any) => c.type === 'income' || c.type === 'both').length}
                      </p>
                    </div>
                    <TrendingUp className="w-5 h-5 text-success/60" />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b z-10">
                      <tr className="text-left text-muted-foreground">
                        <th className="p-3 font-medium">Kategori</th>
                        <th className="p-3 font-medium">Slug (Kode AI)</th>
                        <th className="p-3 font-medium">Tipe</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-muted-foreground">
                            {searchCategory ? 'Tidak ada kategori yang cocok' : 'Belum ada kategori'}
                          </td>
                        </tr>
                      ) : (
                        filteredCategories.map((cat: any) => (
                          <tr key={cat.id} className="border-b hover:bg-muted/50 transition">
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                                  {renderCategoryIcon(cat.icon)}
                                </div>
                                <span className="font-semibold text-foreground">{cat.name}</span>
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="secondary" className="font-mono text-xs font-normal">
                                {cat.slug}
                              </Badge>
                            </td>
                            <td className="p-3">
                              {cat.type === 'income' ? (
                                <Badge className="bg-success/15 text-success hover:bg-success/20 border-success/30 font-normal">
                                  Pemasukan
                                </Badge>
                              ) : cat.type === 'expense' ? (
                                <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/20 border-destructive/30 font-normal">
                                  Pengeluaran
                                </Badge>
                              ) : (
                                <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-primary/30 font-normal">
                                  Keduanya
                                </Badge>
                              )}
                            </td>
                            <td className="p-3">
                              {cat.is_default ? (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/80">
                                  Default Sistem
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-primary border-primary/30 bg-primary/5">
                                  Kustom Admin
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => handleOpenEditCategory(cat)}
                                  title="Edit Kategori"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setCategoryToDelete(cat)}
                                  title="Hapus Kategori"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.transactions')}</CardTitle>
                  <CardDescription>Global ledger reflecting all processed platform transfers securely.</CardDescription>
                </div>
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t('admin.searchTransactions')} value={searchTransaction} onChange={(e) => setSearchTransaction(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b z-10">
                      <tr className="text-left text-muted-foreground">
                        <th className="p-3 font-medium">Date</th>
                        <th className="p-3 font-medium">{t('admin.owner')}</th>
                        <th className="p-3 font-medium">Wallet</th>
                        <th className="p-3 font-medium">Category / Type</th>
                        <th className="p-3 font-medium">Amount</th>
                        <th className="p-3 font-medium text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.length === 0 ? <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t('admin.noData')}</td></tr> : filteredTransactions.map((tx: any) => (
                        <tr key={tx.id} className="border-b hover:bg-muted/50 transition">
                          <td className="p-3 whitespace-nowrap text-muted-foreground">{format(new Date(tx.transaction_date), 'MMM dd, yy')}</td>
                          <td className="p-3 font-medium truncate max-w-[150px]">{tx.wallets?.profiles?.full_name || 'System'}</td>
                          <td className="p-3 text-muted-foreground">{tx.wallets?.name || 'N/A'}</td>
                          <td className="p-3"><span className={`px-2 py-0.5 rounded text-xs ${tx.type === 'income' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive'}`}>{tx.category}</span></td>
                          <td className={`p-3 font-bold font-mono tracking-tight ${tx.type === 'income' ? 'text-success' : 'text-destructive'}`}>{tx.type === 'income' ? '+' : '-'}Rp{tx.amount.toLocaleString('id-ID')}</td>
                          <td className="p-3 text-right">
                             <Button size="icon" variant="ghost" onClick={() => setTransactionToDelete(tx.id)} className="hover:text-destructive w-8 h-8">
                               <Trash2 className="w-4 h-4" />
                             </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Smart Audit Trail</CardTitle>
                  <CardDescription>Database-level logging of every transaction and administrative change.</CardDescription>
                </div>
                <div className="relative w-full sm:w-[350px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t('admin.searchLogs')} value={searchLog} onChange={(e) => setSearchLog(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b z-10">
                      <tr className="text-left text-muted-foreground">
                        <th className="p-3 font-medium">{t('admin.timestamp')}</th>
                        <th className="p-3 font-medium">{t('admin.user')}</th>
                        <th className="p-3 font-medium">{t('admin.action')}</th>
                        <th className="p-3 font-medium">{t('admin.entity')}</th>
                        <th className="p-3 font-medium">{t('admin.details')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t('admin.noData')}</td></tr> : filteredLogs.map((log: any) => (
                        <tr key={log.id} className="border-b hover:bg-muted/50 transition">
                          <td className="p-3 text-xs whitespace-nowrap text-muted-foreground">{format(new Date(log.created_at), 'MMM dd HH:mm')}</td>
                          <td className="p-3 font-medium truncate max-w-[150px]">{log.profiles?.full_name || 'System'}</td>
                          <td className="p-3"><span className="text-xs font-mono bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5">{log.action_type}</span></td>
                          <td className="p-3 text-xs">{log.entity_type}</td>
                          <td className="p-3 text-xs text-muted-foreground truncate max-w-[250px]">{JSON.stringify(log.details)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="wallets" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>{t('admin.wallets')}</CardTitle>
                  <CardDescription>All wallets natively managed by the backend engine.</CardDescription>
                </div>
                <div className="relative w-full sm:w-[300px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder={t('admin.searchWallets')} value={searchWallet} onChange={(e) => setSearchWallet(e.target.value)} className="pl-9" />
                </div>
              </CardHeader>
              <CardContent>
                 <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card border-b z-10">
                      <tr className="text-left text-muted-foreground">
                        <th className="p-3 font-medium">Wallet Name</th>
                        <th className="p-3 font-medium">{t('admin.owner')}</th>
                        <th className="p-3 font-medium">{t('admin.description')}</th>
                        <th className="p-3 font-medium">{t('admin.registered')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWallets.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">{t('admin.noData')}</td></tr> : filteredWallets.map((wallet: any) => (
                        <tr key={wallet.id} className="border-b hover:bg-muted/50 transition">
                          <td className="p-3 font-bold truncate max-w-[150px]">{wallet.name}</td>
                          <td className="p-3 text-muted-foreground">{wallet.profiles?.full_name || 'N/A'}</td>
                          <td className="p-3 text-muted-foreground truncate max-w-[200px]">{wallet.description || '--'}</td>
                          <td className="p-3 text-muted-foreground">{format(new Date(wallet.created_at), 'PPP')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Global Dialogs */}
        <AlertDialog open={!!transactionToDelete} onOpenChange={() => setTransactionToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('admin.deletePrompt')}</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this transaction from the global ledger? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => transactionToDelete && deleteTransactionMutation.mutate(transactionToDelete)} className="bg-destructive text-destructive-foreground">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!userStatusToToggle} onOpenChange={() => setUserStatusToToggle(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Account Status Change</AlertDialogTitle>
              <AlertDialogDescription>
                {userStatusToToggle?.isActive 
                  ? "Are you sure you want to suspend this user? They will lose platform access immediately." 
                  : "Are you sure you want to reactivate this suspended user?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => userStatusToToggle && toggleActiveMutation.mutate(userStatusToToggle)} className={userStatusToToggle?.isActive ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!userRoleToToggle} onOpenChange={() => setUserRoleToToggle(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
              <AlertDialogDescription>
                {userRoleToToggle?.makeAdmin
                  ? "Promote this user to Admin? They will have full access to User Management and the Global Ledger."
                  : "Demote this Admin? They will lose all dashboard privileges."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => userRoleToToggle && toggleAdminMutation.mutate({ userId: userRoleToToggle.id, makeAdmin: userRoleToToggle.makeAdmin })}>
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Category Add/Edit Modal */}
        <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-primary" />
                {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
              </DialogTitle>
              <DialogDescription>
                {editingCategory
                  ? 'Perbarui data kategori. Perubahan akan langsung disinkronkan ke AI parser dan scanner struk.'
                  : 'Kategori baru akan langsung dapat digunakan di form transaksi, scanner struk gambar, dan AI parser suara/ketikan.'}
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveCategoryMutation.mutate();
              }}
              className="space-y-4 py-2"
            >
              <div className="space-y-2">
                <Label htmlFor="cat-name">Nama Kategori</Label>
                <Input
                  id="cat-name"
                  placeholder="Contoh: Kesehatan, Pendidikan, Zakat..."
                  value={categoryFormName}
                  onChange={(e) => handleCategoryNameChange(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cat-slug">Slug / Kode Unik AI</Label>
                  <span className="text-[11px] text-muted-foreground">Huruf kecil, tanpa spasi</span>
                </div>
                <Input
                  id="cat-slug"
                  placeholder="contoh: health, education, charity..."
                  value={categoryFormSlug}
                  onChange={(e) => setCategoryFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  required
                  disabled={editingCategory?.is_default}
                />
                {editingCategory?.is_default && (
                  <p className="text-[11px] text-muted-foreground">
                    Slug kategori default sistem tidak dapat diubah demi menjaga integritas data historis.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-type">Tipe Transaksi</Label>
                <Select
                  value={categoryFormType}
                  onValueChange={(val: any) => setCategoryFormType(val)}
                >
                  <SelectTrigger id="cat-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expense">Pengeluaran (Expense)</SelectItem>
                    <SelectItem value="income">Pemasukan (Income)</SelectItem>
                    <SelectItem value="both">Keduanya (Pemasukan & Pengeluaran)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cat-icon">Pilihan Ikon</Label>
                <Select
                  value={categoryFormIcon}
                  onValueChange={setCategoryFormIcon}
                >
                  <SelectTrigger id="cat-icon">
                    <div className="flex items-center gap-2">
                      {renderCategoryIcon(categoryFormIcon)}
                      <SelectValue />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ICONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        <div className="flex items-center gap-2">
                          {renderCategoryIcon(item.value)}
                          <span>{item.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCategoryModalOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={saveCategoryMutation.isPending || !categoryFormName || !categoryFormSlug}
                  className="bg-gradient-primary gap-1.5"
                >
                  {saveCategoryMutation.isPending ? 'Menyimpan...' : 'Simpan Kategori'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Category AlertDialog */}
        <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Kategori?</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus kategori <strong>{categoryToDelete?.name}</strong> (<code>{categoryToDelete?.slug}</code>)?
                {categoryToDelete?.is_default && (
                  <span className="block mt-2 text-destructive font-medium">
                    Perhatian: Ini adalah kategori default sistem. Transaksi lama dengan kategori ini mungkin akan ditampilkan sebagai kategori lain.
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => categoryToDelete && deleteCategoryMutation.mutate(categoryToDelete.id)}
                className="bg-destructive text-destructive-foreground"
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </div>
  );
};

export default Admin;
