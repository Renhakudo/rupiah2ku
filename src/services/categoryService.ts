import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  name: string;
  slug: string;
  type: 'expense' | 'income' | 'both';
  icon?: string | null;
  color?: string | null;
  is_default?: boolean | null;
  created_at?: string;
  updated_at?: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Gaji', slug: 'salary', type: 'income', icon: 'briefcase', is_default: true },
  { id: '2', name: 'Bisnis', slug: 'business', type: 'income', icon: 'trending-up', is_default: true },
  { id: '3', name: 'Investasi', slug: 'investment', type: 'income', icon: 'landmark', is_default: true },
  { id: '4', name: 'Makanan & Minuman', slug: 'food', type: 'expense', icon: 'utensils', is_default: true },
  { id: '5', name: 'Transportasi', slug: 'transport', type: 'expense', icon: 'car', is_default: true },
  { id: '6', name: 'Belanja', slug: 'shopping', type: 'expense', icon: 'shopping-bag', is_default: true },
  { id: '7', name: 'Tagihan & Utilitas', slug: 'bills', type: 'expense', icon: 'receipt', is_default: true },
  { id: '8', name: 'Hiburan', slug: 'entertainment', type: 'expense', icon: 'film', is_default: true },
  { id: '9', name: 'Lainnya', slug: 'other', type: 'both', icon: 'more-horizontal', is_default: true },
];

export async function fetchCategories(): Promise<Category[]> {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.warn('Failed to fetch categories from database, using defaults:', error.message);
      return DEFAULT_CATEGORIES;
    }

    if (!data || data.length === 0) {
      return DEFAULT_CATEGORIES;
    }

    return data as Category[];
  } catch (err: any) {
    console.warn('Error fetching categories:', err?.message);
    return DEFAULT_CATEGORIES;
  }
}

export function useCategories() {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  const categories = query.data || DEFAULT_CATEGORIES;

  const incomeCategories = categories.filter(
    (c) => c.type === 'income' || c.type === 'both'
  );

  const expenseCategories = categories.filter(
    (c) => c.type === 'expense' || c.type === 'both'
  );

  const categorySlugs = categories.map((c) => c.slug);
  const incomeCategorySlugs = incomeCategories.map((c) => c.slug);
  const expenseCategorySlugs = expenseCategories.map((c) => c.slug);

  const getCategoryBySlug = (slug: string): Category | undefined => {
    return categories.find((c) => c.slug.toLowerCase() === slug.toLowerCase());
  };

  const getCategoryLabel = (slug: string, fallbackTranslated?: string): string => {
    const found = getCategoryBySlug(slug);
    if (found) return found.name;
    return fallbackTranslated || slug;
  };

  return {
    ...query,
    categories,
    incomeCategories,
    expenseCategories,
    categorySlugs,
    incomeCategorySlugs,
    expenseCategorySlugs,
    getCategoryBySlug,
    getCategoryLabel,
  };
}

export function useCategoryMutations() {
  const queryClient = useQueryClient();

  const createCategory = useMutation({
    mutationFn: async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('categories')
        .insert([{
          name: category.name.trim(),
          slug: category.slug.trim().toLowerCase(),
          type: category.type,
          icon: category.icon || 'tag',
          color: category.color || null,
          is_default: false,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Category> & { id: string }) => {
      const payload: any = { updated_at: new Date().toISOString() };
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.slug !== undefined) payload.slug = updates.slug.trim().toLowerCase();
      if (updates.type !== undefined) payload.type = updates.type;
      if (updates.icon !== undefined) payload.icon = updates.icon;
      if (updates.color !== undefined) payload.color = updates.color;

      const { data, error } = await supabase
        .from('categories')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  return {
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
