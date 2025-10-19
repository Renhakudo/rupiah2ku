-- Add RLS policies for admins to view all wallets
CREATE POLICY "Admins can view all wallets"
  ON public.wallets
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policies for admins to view all transactions
CREATE POLICY "Admins can view all transactions"
  ON public.transactions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policies for admins to delete users (cascade will handle related data)
CREATE POLICY "Admins can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));