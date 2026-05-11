import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Calendar as CalendarIcon, Sparkles, Loader2, Mic, MicOff } from 'lucide-react';
import { useCallback } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseTransactionWithAI } from '@/services/aiservice';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

interface TransactionFormProps {
  walletId: string;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const TransactionForm = ({ walletId }: TransactionFormProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const createTransaction = useMutation({
    mutationFn: async (transactionData: any) => {
      const { error } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', walletId] });
      setOpen(false);
      resetForm();
      toast({
        title: t('common.success'),
        description: 'Transaction added successfully!',
      });
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive',
      });
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
      if (result.date) {
        setDate(new Date(result.date));
      }
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
    lang: 'id-ID'
  });

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setDescription('');
    setDate(new Date());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    createTransaction.mutate({
      wallet_id: walletId,
      type,
      amount: parseFloat(amount),
      category,
      description,
      transaction_date: format(date, 'yyyy-MM-dd'),
    });
  };

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          {t('transaction.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('transaction.add')}</DialogTitle>
          <DialogDescription>Add a new income or expense transaction</DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6 py-1">
          {/* AI Magic Box */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 space-y-3">
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

          <form id="tx-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
          <div className="space-y-2">
            <Label htmlFor="type">{t('transaction.type')}</Label>
            <Select value={type} onValueChange={(value: any) => { setType(value); setCategory(''); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">{t('transaction.income')}</SelectItem>
                <SelectItem value="expense">{t('transaction.expense')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">{t('transaction.amount')} (IDR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="100000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">{t('transaction.category')}</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`category.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">{t('transaction.date')}</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(newDate) => newDate && setDate(newDate)}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t('transaction.description')}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
            />
          </div>

          </form>
        </div>
        <div className="pt-3 shrink-0 mt-auto border-t">
          <Button type="submit" form="tx-form" className="w-full" disabled={createTransaction.isPending || !category}>
            {createTransaction.isPending ? t('transaction.saving') : t('transaction.save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};