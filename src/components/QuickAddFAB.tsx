import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { Plus, Sparkles, Loader2, Mic, MicOff } from 'lucide-react';
import { useCallback } from 'react';
import { format } from 'date-fns';
import { parseTransactionWithAI } from '@/services/aiservice';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

interface QuickAddFABProps {
  walletId: string;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const QuickAddFAB = ({ walletId }: QuickAddFABProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const createTransaction = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('transactions').insert({
        wallet_id: walletId,
        type,
        amount: parseFloat(amount),
        category,
        description: description || null,
        transaction_date: format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', walletId] });
      setOpen(false);
      setAmount('');
      setCategory('');
      setDescription('');
      toast({ title: t('common.success'), description: 'Transaction added!' });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const handleAiParse = async (overrideInput?: string) => {
    const inputToParse = overrideInput || aiInput;
    if (!inputToParse.trim()) return;
    setIsAiParsing(true);
    try {
      const result = await parseTransactionWithAI(inputToParse);
      setType(result.type as 'income' | 'expense');
      setAmount(result.amount.toString());
      setCategory(result.category);
      setDescription(result.description || '');
      toast({ title: t('common.success'), description: "AI Autocomplete applied! Review and save." });
    } catch (e: any) {
      toast({ title: t('ai.error'), description: e.message, variant: 'destructive' });
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleVoiceResult = useCallback((text: string) => {
    setAiInput(text);
    if (text.trim()) {
      handleAiParse(text);
    }
  }, []);

  const { isListening, isSupported, startListening, stopListening } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (err) => toast({ title: "Microphone Error", description: err, variant: 'destructive' }),
    lang: t('ai.listen') === 'Use Voice' ? 'en-US' : 'id-ID'
  });

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-strong bg-gradient-primary hover:shadow-medium transition-all duration-300 hover:scale-105 sm:hidden"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] flex flex-col p-0">
        <SheetHeader className="p-6 pb-2">
          <SheetTitle>{t('transaction.add')}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-6 pb-6 overflow-y-auto flex-1">
          {/* AI Magic Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <Label className="text-primary font-medium text-xs uppercase tracking-wider">AI Magic Parser</Label>
            </div>
            <div className="flex gap-2">
              <Input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={isListening ? t('ai.listening') : t('ai.placeholder')}
                className="bg-background text-xs sm:text-sm flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAiParse()}
                disabled={isListening}
              />
              {isSupported && (
                <Button
                  size="icon"
                  variant={isListening ? "destructive" : "secondary"}
                  onClick={isListening ? stopListening : startListening}
                  className={`shrink-0 ${isListening ? 'animate-pulse' : ''}`}
                  title={t('ai.listen')}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              )}
              <Button size="icon" onClick={() => handleAiParse()} disabled={isAiParsing || !aiInput.trim()} className="shrink-0 bg-primary hover:bg-primary/90">
                {isAiParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant={type === 'expense' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => { setType('expense'); setCategory(''); }}
            >
              {t('transaction.expense')}
            </Button>
            <Button
              variant={type === 'income' ? 'default' : 'outline'}
              className="flex-1"
              onClick={() => { setType('income'); setCategory(''); }}
            >
              {t('transaction.income')}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t('transaction.amount')} (IDR)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
              className="text-lg h-12"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label>{t('transaction.category')}</Label>
            <div className="grid grid-cols-3 gap-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs"
                  onClick={() => setCategory(cat)}
                >
                  {t(`category.${cat}`)}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('transaction.description')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional note"
            />
          </div>

          <Button
            className="w-full h-12 text-base"
            onClick={() => createTransaction.mutate()}
            disabled={!amount || !category || createTransaction.isPending}
          >
            {createTransaction.isPending ? t('transaction.saving') : t('transaction.save')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
