import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useLanguage } from '@/contexts/LanguageContext';
import { LogOut, Home, Shield, Users, Wallet, Receipt, UserPlus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { MobileNav } from '@/components/MobileNav';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const Admin = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

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
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      return (profiles || []).map((profile: any) => {
        const authUser = (authUsers || []).find((u: any) => u.id === profile.id);
        return {
          ...profile,
          email: authUser?.email || 'N/A',
          user_roles: (roles || []).filter((role: any) => role.user_id === profile.id)
        };
      });
    },
    enabled: isAdmin,
  });

  const { data: allWallets = [] } = useQuery({
    queryKey: ['admin-wallets'],
    queryFn: async () => {
      const { data: { users: authUsers }, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) throw authError;

      const { data, error } = await supabase
        .from('wallets')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get transactions for balance calculation
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('wallet_id, amount, type');
      
      if (txError) throw txError;

      return (data || []).map((wallet: any) => {
        const authUser = (authUsers || []).find((u: any) => u.id === wallet.user_id);
        
        // Calculate balance
        const walletTransactions = (transactions || []).filter((tx: any) => tx.wallet_id === wallet.id);
        const balance = walletTransactions.reduce((sum: number, tx: any) => {
          return sum + (tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount));
        }, 0);

        return {
          ...wallet,
          email: authUser?.email || 'N/A',
          balance
        };
      });
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

  const addUserMutation = useMutation({
    mutationFn: async ({ email, password, name }: { email: string; password: string; name: string }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          }
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setIsAddUserOpen(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      toast({
        title: t('common.success'),
        description: 'User added successfully',
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

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user.id === userId) {
        throw new Error('Cannot delete your own account');
      }
      
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setDeleteUserId(null);
      toast({
        title: t('common.success'),
        description: 'User deleted successfully',
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
        <div className="container mx-auto px-3 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MobileNav isAdmin={true} />
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-primary flex items-center justify-center">
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <h1 className="text-base sm:text-2xl font-bold">{t('admin.title')}</h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate('/')} className="hidden md:flex h-9 w-9">
                <Home className="w-4 h-4" />
              </Button>
              <ThemeToggle />
              <LanguageToggle />
              <Button variant="outline" size="icon" onClick={handleLogout} className="h-8 w-8 sm:h-9 sm:w-9">
                <LogOut className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-full overflow-x-hidden">
        <div className="space-y-4 sm:space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-6">
            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('admin.totalUsers')}
                </CardTitle>
                <Users className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl sm:text-2xl font-bold break-words">{users.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {adminCount} admins
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('admin.totalWallets')}
                </CardTitle>
                <Wallet className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl sm:text-2xl font-bold break-words">{allWallets.length}</p>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {t('admin.totalTransactions')}
                </CardTitle>
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-xl sm:text-2xl font-bold break-words">{allTransactions.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* User Management */}
          <Card className="shadow-soft">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <CardTitle className="text-lg sm:text-xl">{t('admin.users')}</CardTitle>
                <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full sm:w-auto">
                      <UserPlus className="w-4 h-4 mr-2" />
                      Add User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New User</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="John Doe"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="user@example.com"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={newUserPassword}
                          onChange={(e) => setNewUserPassword(e.target.value)}
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          if (newUserEmail && newUserPassword && newUserName) {
                            addUserMutation.mutate({
                              email: newUserEmail,
                              password: newUserPassword,
                              name: newUserName
                            });
                          }
                        }}
                        disabled={addUserMutation.isPending || !newUserEmail || !newUserPassword || !newUserName}
                      >
                        {addUserMutation.isPending ? 'Adding...' : 'Add User'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">User ID</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">Full Name</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden md:table-cell">Email</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">{t('admin.role')}</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden lg:table-cell">{t('admin.createdAt')}</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => {
                      const userIsAdmin = Array.isArray(user.user_roles) && user.user_roles.some((r: any) => r.role === 'admin');
                      return (
                        <tr key={user.id} className="border-b hover:bg-accent/50 transition-smooth">
                          <td className="p-2 sm:p-3 text-xs sm:text-sm">
                            <div className="max-w-[100px] truncate font-mono text-[10px] sm:text-xs">{user.id.slice(0, 8)}...</div>
                          </td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm">
                            <div className="max-w-[120px] sm:max-w-none truncate">{user.full_name || 'N/A'}</div>
                          </td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm hidden md:table-cell">
                            <div className="max-w-[150px] truncate">{user.email}</div>
                          </td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm">
                            <span className={`px-2 py-1 rounded text-xs ${
                              userIsAdmin ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {userIsAdmin ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="p-2 sm:p-3 text-xs sm:text-sm hidden lg:table-cell">
                            {format(new Date(user.created_at), 'PP')}
                          </td>
                          <td className="p-2 sm:p-3">
                            <div className="flex gap-1 sm:gap-2">
                              <Button
                                size="sm"
                                variant={userIsAdmin ? 'destructive' : 'default'}
                                onClick={() => toggleAdminMutation.mutate({
                                  userId: user.id,
                                  makeAdmin: !userIsAdmin
                                })}
                                disabled={toggleAdminMutation.isPending}
                                className="text-xs px-2 sm:px-3"
                              >
                                <span className="hidden sm:inline">{userIsAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}</span>
                                <span className="sm:hidden">{userIsAdmin ? 'Remove' : 'Promote'}</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDeleteUserId(user.id)}
                                disabled={deleteUserMutation.isPending}
                                className="text-xs px-2 sm:px-3"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
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
              <CardTitle className="text-lg sm:text-xl">{t('admin.wallets')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-2 sm:mx-0">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">{t('wallet.name')}</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm">Owner Email</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden md:table-cell">Type</th>
                      <th className="text-right p-2 sm:p-3 font-medium text-xs sm:text-sm">Balance</th>
                      <th className="text-left p-2 sm:p-3 font-medium text-xs sm:text-sm hidden lg:table-cell">{t('admin.createdAt')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allWallets.map((wallet: any) => (
                      <tr key={wallet.id} className="border-b hover:bg-accent/50 transition-smooth">
                        <td className="p-2 sm:p-3 text-xs sm:text-sm">
                          <div className="max-w-[120px] sm:max-w-none truncate font-medium">{wallet.name}</div>
                          {wallet.description && (
                            <div className="text-[10px] text-muted-foreground max-w-[150px] truncate">{wallet.description}</div>
                          )}
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm">
                          <div className="max-w-[150px] truncate">{wallet.email}</div>
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm hidden md:table-cell">
                          <span className="px-2 py-1 rounded text-xs bg-muted text-muted-foreground">
                            {wallet.currency}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm text-right">
                          <span className={`font-semibold ${
                            wallet.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                          }`}>
                            {new Intl.NumberFormat('id-ID', {
                              style: 'currency',
                              currency: wallet.currency,
                              minimumFractionDigits: 0,
                            }).format(wallet.balance)}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm hidden lg:table-cell">
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

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this user? This action cannot be undone and will delete all associated wallets and transactions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteUserId) {
                  deleteUserMutation.mutate(deleteUserId);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
