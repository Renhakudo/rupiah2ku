-- Migration: Ensure Admin role has global DELETE capabilities against standard tables.

-- Allow Admin to Delete Transactions (Since Admin panel has Quick Actions to edit/remove invalid transactions globally)
DROP POLICY IF EXISTS "Admins can delete all transactions" ON public.transactions;
CREATE POLICY "Admins can delete all transactions" ON public.transactions FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Additionally allow Admin to update transactions
DROP POLICY IF EXISTS "Admins can update all transactions" ON public.transactions;
CREATE POLICY "Admins can update all transactions" ON public.transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
