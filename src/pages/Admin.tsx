import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { LogOut, TrendingUp, Home, Shield, Users, Wallet, Receipt } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const Admin = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } else {
        setIsAdmin(!!data);
      }
      
      setLoading(false);

      if (!data) {
        toast({
          title: t('common.error'),
          description: 'Access denied. Admin privileges required.',
          variant: 'destructive',
        });
        navigate('/');
      }
    };

    checkAdminStatus();
  }, [navigate, toast, t]);

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      return (profiles || []).map(profile => ({
        ...profile,
        user_roles: (roles || []).filter(role => role.user_id === profile.id)
      }));
    },
    enabled: isAdmin,
  });

  const { data: allWallets = [] } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
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
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, makeAdmin }: { userId: string; makeAdmin: boolean }) => {
      if (makeAdmin) {
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: t('common.success'),
        description: 'User role updated successfully',
      });
    },
    onError: (error) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
    },
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const adminCount = users.filter(u => Array.isArray(u.user_roles) && u.user_roles.some((r: any) => r.role === 'admin')).length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-foreground" />
              </div>
              <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
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
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.totalUsers')}
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {adminCount} admins
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.totalWallets')}
                </CardTitle>
                <Wallet className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{allWallets.length}</p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {t('admin.totalTransactions')}
                </CardTitle>
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{allTransactions.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* User Management */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>{t('admin.users')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">{t('admin.email')}</th>
                      <th className="text-left p-3 font-medium">{t('admin.role')}</th>
                      <th className="text-left p-3 font-medium">{t('admin.createdAt')}</th>
                      <th className="text-left p-3 font-medium">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const userIsAdmin = Array.isArray(user.user_roles) && user.user_roles.some((r: any) => r.role === 'admin');
                      return (
                        <tr key={user.id} className="border-b hover:bg-accent/50 transition-smooth">
                          <td className="p-3 text-sm">{user.id}</td>
                          <td className="p-3 text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              userIsAdmin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {userIsAdmin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="p-3 text-sm">
                            {format(new Date(user.created_at), 'PP')}
                          </td>
                          <td className="p-3">
                            <Button
                              size="sm"
                              variant={userIsAdmin ? 'destructive' : 'default'}
                              onClick={() => toggleAdminMutation.mutate({
                                userId: user.id,
                                makeAdmin: !userIsAdmin
                              })}
                              disabled={toggleAdminMutation.isPending}
                            >
                              {userIsAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* All Wallets */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>{t('admin.wallets')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">{t('wallet.name')}</th>
                      <th className="text-left p-3 font-medium">{t('admin.owner')}</th>
                      <th className="text-left p-3 font-medium">{t('wallet.description')}</th>
                      <th className="text-left p-3 font-medium">{t('admin.createdAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWallets.map((wallet) => (
                      <tr key={wallet.id} className="border-b hover:bg-accent/50 transition-smooth">
                        <td className="p-3 text-sm font-medium">{wallet.name}</td>
                        <td className="p-3 text-sm">{(wallet.profiles as any)?.full_name || 'N/A'}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {wallet.description || '-'}
                        </td>
                        <td className="p-3 text-sm">
                          {format(new Date(wallet.created_at), 'PP')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
