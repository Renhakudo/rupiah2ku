import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import {
  Plus,
  Sparkles,
  Loader2,
  Mic,
  MicOff,
  Camera,
  Store,
  CheckCircle,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { parseTransactionWithAI } from '@/services/aiservice';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { ReceiptScanner } from '@/components/ReceiptScanner';
import { ScannedReceiptResult } from '@/services/geminiService';

interface QuickAddFABProps {
  walletId: string;
}

const incomeCategories = ['salary', 'business', 'investment', 'other'];
const expenseCategories = ['food', 'transport', 'shopping', 'bills', 'entertainment', 'other'];

export const QuickAddFAB = ({ walletId }: QuickAddFABProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'form' | 'scanner'>('form');

  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [currentWalletId, setCurrentWalletId] = useState(walletId);

  const [scannedReceipt, setScannedReceipt] = useState<ScannedReceiptResult | null>(null);

  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);

  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

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
    mutationFn: async () => {
      let fullDescription = description.trim();
      if (merchant.trim()) {
        if (!fullDescription.toLowerCase().includes(merchant.trim().toLowerCase())) {
          fullDescription = fullDescription
            ? `[${merchant.trim()}] ${fullDescription}`
            : merchant.trim();
        }
      }

      const { error } = await supabase.from('transactions').insert({
        wallet_id: currentWalletId || walletId,
        type,
        amount: parseFloat(amount),
        category,
        description: fullDescription || null,
        transaction_date: date || format(new Date(), 'yyyy-MM-dd'),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions', currentWalletId || walletId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      setOpen(false);
      resetForm();
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
      if (result.date) {
        setDate(result.date);
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
      setDate(result.transactionDate);
    }
    setScannedReceipt(result);
    setMode('form');
  };

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setCategory('');
    setMerchant('');
    setDescription('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setCurrentWalletId(walletId);
    setScannedReceipt(null);
    setMode('form');
    setAiInput('');
  };

  const handleSheetOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    } else {
      setCurrentWalletId(walletId);
    }
  };

  const categories = type === 'income' ? incomeCategories : expenseCategories;

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-strong bg-gradient-primary hover:shadow-medium transition-all duration-300 hover:scale-105 sm:hidden"
        >
          <Plus className="w-6 h-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90dvh] flex flex-col p-0">
        <SheetHeader className="p-4 sm:p-6 pb-2 shrink-0">
          <SheetTitle>
            {mode === 'scanner' ? t('receipt.title') : t('transaction.add')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 sm:px-6 pb-6 overflow-y-auto flex-1">
          {mode === 'scanner' ? (
            <div className="py-1">
              <ReceiptScanner
                onScanComplete={handleReceiptScanComplete}
                onCancel={() => setMode('form')}
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Review Banner if scanned */}
              {scannedReceipt && (
                <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/20 space-y-2 animate-in fade-in duration-300">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                    <CheckCircle className="w-4 h-4" />
                    <span>{t('receipt.success')}</span>
                  </div>

                  {scannedReceipt.items.length > 0 && (
                    <div className="text-[11px] text-muted-foreground bg-background/80 dark:bg-card/80 p-2 rounded-lg border border-border/50 max-h-24 overflow-y-auto space-y-1">
                      <p className="font-medium text-foreground text-[11px]">{t('receipt.items')}:</p>
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

              {/* AI & Quick Action Box */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <Label className="text-primary font-medium text-xs uppercase tracking-wider">
                      Smart Assistant
                    </Label>
                  </div>
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

              {/* Type Switch */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={type === 'expense' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setType('expense');
                    setCategory('');
                  }}
                >
                  {t('transaction.expense')}
                </Button>
                <Button
                  type="button"
                  variant={type === 'income' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => {
                    setType('income');
                    setCategory('');
                  }}
                >
                  {t('transaction.income')}
                </Button>
              </div>

              {/* Amount */}
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
                />
              </div>

              {/* Wallet Selector if multiple */}
              {wallets && wallets.length > 1 && (
                <div className="space-y-2">
                  <Label>{t('receipt.wallet')}</Label>
                  <Select value={currentWalletId} onValueChange={setCurrentWalletId}>
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

              {/* Merchant */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>{t('receipt.merchant')}</span>
                </Label>
                <Input
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="e.g. Starbucks, Indomaret..."
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label>{t('transaction.category')}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((cat) => (
                    <Button
                      type="button"
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

              {/* Date */}
              <div className="space-y-2">
                <Label>{t('transaction.date')}</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>{t('transaction.description')}</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional notes"
                />
              </div>

              {/* Save Button */}
              <Button
                type="button"
                className="w-full h-12 text-base"
                onClick={() => createTransaction.mutate()}
                disabled={!amount || !category || createTransaction.isPending}
              >
                {createTransaction.isPending ? t('transaction.saving') : t('transaction.save')}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
