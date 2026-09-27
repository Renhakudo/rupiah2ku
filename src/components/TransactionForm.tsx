import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  Plus,
  Calendar as CalendarIcon,
  Sparkles,
  Loader2,
  Mic,
  MicOff,
  Camera,
  Store,
  CheckCircle,
  Wallet,
  Receipt,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { parseTransactionWithAI } from '@/services/aiservice';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { ReceiptScanner } from '@/components/ReceiptScanner';
import { ScannedReceiptResult } from '@/services/geminiService';

interface TransactionFormProps {
  walletId: string;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const TransactionForm = ({ walletId }: TransactionFormProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'form' | 'scanner'>('form');

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [currentWalletId, setCurrentWalletId] = useState(walletId);

  const [scannedReceipt, setScannedReceipt] = useState<ScannedReceiptResult | null>(null);

  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);

  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  // Fetch wallets for the wallet selector
  const { data: wallets } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createTransaction = useMutation({
    mutationFn: async (transactionData: any) => {
      const { error } = await supabase
        .from('transactions')
        .insert(transactionData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', currentWalletId || walletId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
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
      toast({ title: t('common.success'), description: 'AI Autocomplete applied! Review and save.' });
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
    onError: (err) => toast({ title: 'Microphone Error', description: err, variant: 'destructive' }),
    lang: 'id-ID',
  });

  const handleReceiptScanComplete = (result: ScannedReceiptResult) => {
    setType(result.type);
    if (result.totalAmount) {
      setAmount(result.totalAmount.toString());
    }
    if (result.category) {
      setCategory(result.category);
    }
    if (result.merchant) {
      setMerchant(result.merchant);
    }
    if (result.description) {
      setDescription(result.description);
    }
    if (result.transactionDate) {
      const parsedDate = new Date(result.transactionDate);
      if (!isNaN(parsedDate.getTime())) {
        setDate(parsedDate);
      }
    }

    setScannedReceipt(result);
    // Switch to review/edit form view
    setMode('form');
  };

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setMerchant('');
    setDescription('');
    setDate(new Date());
    setCurrentWalletId(walletId);
    setScannedReceipt(null);
    setMode('form');
    setAiInput('');
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    } else {
      setCurrentWalletId(walletId);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let fullDescription = description.trim();
    if (merchant.trim()) {
      if (!fullDescription.toLowerCase().includes(merchant.trim().toLowerCase())) {
        fullDescription = fullDescription
          ? `[${merchant.trim()}] ${fullDescription}`
          : merchant.trim();
      }
    }

    createTransaction.mutate({
      wallet_id: currentWalletId || walletId,
      type,
      amount: parseFloat(amount),
      category,
      description: fullDescription || null,
      transaction_date: format(date, 'yyyy-MM-dd'),
    });
  };

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary">
          <Plus className="w-4 h-4 mr-2" />
          {t('transaction.add')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {mode === 'scanner' ? t('receipt.title') : t('transaction.add')}
          </DialogTitle>
          <DialogDescription>
            {mode === 'scanner'
              ? t('receipt.instructions')
              : 'Add a new income or expense transaction'}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6 py-1">
          {mode === 'scanner' ? (
            /* Receipt Scanner View */
            <div className="py-1">
              <ReceiptScanner
                onScanComplete={handleReceiptScanComplete}
                onCancel={() => setMode('form')}
              />
            </div>
          ) : (
            /* Regular & Review Form View */
            <div className="space-y-4">
              {/* Review Banner if came from receipt scan */}
              {scannedReceipt && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('receipt.success')}</span>
                  </div>

                  {scannedReceipt.items.length > 0 && (
                    <div className="text-[11px] text-muted-foreground bg-background/80 dark:bg-card/80 p-2 rounded-lg border border-border/50 max-h-24 overflow-y-auto space-y-1">
                      <p className="font-medium text-foreground text-[11px]">
                        {t('receipt.items')}:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {scannedReceipt.items.map((it, idx) => (
                          <li key={idx}>
                            {it.quantity ? `${it.quantity}x ` : ''}
                            {it.name}
                            {it.price ? ` - Rp ${it.price.toLocaleString('id-ID')}` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Action Input Options: Scan Receipt & AI Magic */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <Label className="text-primary font-medium text-xs uppercase tracking-wider">
                      Smart Assistant
                    </Label>
                  </div>

                  {/* Button to open AI Receipt Scanner */}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setMode('scanner')}
                    className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10 flex items-center gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{t('receipt.scanReceipt')}</span>
                  </Button>
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
                      variant={isListening ? 'destructive' : 'secondary'}
                      onClick={isListening ? stopListening : startListening}
                      className={`shrink-0 ${isListening ? 'animate-pulse' : ''}`}
                      title={t('ai.listen')}
                    >
                      {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button
                    size="icon"
                    onClick={() => handleAiParse()}
                    disabled={isAiParsing || !aiInput.trim()}
                    className="shrink-0 bg-primary hover:bg-primary/90"
                  >
                    {isAiParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Form Fields for Review / Edit */}
              <form id="tx-form" onSubmit={handleSubmit} className="space-y-4 pb-2">
                {/* Type Selection */}
                <div className="space-y-2">
                  <Label htmlFor="type">{t('transaction.type')}</Label>
                  <Select
                    value={type}
                    onValueChange={(value: any) => {
                      setType(value);
                      setCategory('');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="income">{t('transaction.income')}</SelectItem>
                      <SelectItem value="expense">{t('transaction.expense')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Amount Input */}
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

                {/* Category Selection */}
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

                {/* Wallet Selection */}
                {wallets && wallets.length > 1 && (
                  <div className="space-y-2">
                    <Label htmlFor="wallet">{t('receipt.wallet')}</Label>
                    <Select
                      value={currentWalletId}
                      onValueChange={setCurrentWalletId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select wallet" />
                      </SelectTrigger>
                      <SelectContent>
                        {wallets.map((w) => (
                          <SelectItem key={w.id} value={w.id}>
                            <div className="flex items-center gap-2">
                              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>{w.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Merchant / Store Input */}
                <div className="space-y-2">
                  <Label htmlFor="merchant" className="flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{t('receipt.merchant')}</span>
                  </Label>
                  <Input
                    id="merchant"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="e.g. Starbucks, Indomaret, PLN..."
                  />
                </div>

                {/* Date Selection */}
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

                {/* Description Input */}
                <div className="space-y-2">
                  <Label htmlFor="description">{t('transaction.description')}</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional notes or item details"
                    rows={3}
                  />
                </div>
              </form>
            </div>
          )}
        </div>

        {mode === 'form' && (
          <div className="pt-3 shrink-0 mt-auto border-t">
            <Button
              type="submit"
              form="tx-form"
              className="w-full"
              disabled={createTransaction.isPending || !amount || !category}
            >
              {createTransaction.isPending ? t('transaction.saving') : t('transaction.save')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};