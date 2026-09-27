import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { parseTransferWithAI } from '@/services/aiservice';
import { ArrowLeftRight, Mic, MicOff, Sparkles, Loader2, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TransferDialogProps {
  defaultSourceWalletId?: string;
}

export const TransferDialog = ({ defaultSourceWalletId }: TransferDialogProps) => {
  const [open, setOpen] = useState(false);
  const [fromWalletId, setFromWalletId] = useState('');
  const [toWalletId, setToWalletId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);

  const { toast } = useToast();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const { data: wallets = [] } = useQuery({
    queryKey: ['wallets'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Keep source wallet in sync with user's selected wallet
  useEffect(() => {
    if (defaultSourceWalletId && wallets.some((w) => w.id === defaultSourceWalletId)) {
      setFromWalletId(defaultSourceWalletId);
    } else if (wallets.length > 0 && !fromWalletId) {
      setFromWalletId(wallets[0].id);
    }
  }, [defaultSourceWalletId, wallets, fromWalletId]);

  const resetForm = () => {
    if (defaultSourceWalletId && wallets.some((w) => w.id === defaultSourceWalletId)) {
      setFromWalletId(defaultSourceWalletId);
    } else if (wallets.length > 0) {
      setFromWalletId(wallets[0].id);
    } else {
      setFromWalletId('');
    }
    setToWalletId('');
    setAmount('');
    setDescription('');
    setDate(new Date());
    setAiInput('');
    setIsAiParsing(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      resetForm();
    } else {
      if (defaultSourceWalletId && wallets.some((w) => w.id === defaultSourceWalletId)) {
        setFromWalletId(defaultSourceWalletId);
      } else if (wallets.length > 0 && !fromWalletId) {
        setFromWalletId(wallets[0].id);
      }
    }
  };

  const handleAiParse = async (overrideInput?: string) => {
    const textToParse = overrideInput || aiInput;
    if (!textToParse.trim()) return;

    setIsAiParsing(true);
    try {
      const result = await parseTransferWithAI(textToParse, wallets, fromWalletId);

      if (result.amount > 0) {
        setAmount(result.amount.toString());
      }
      if (result.toWalletId) {
        setToWalletId(result.toWalletId);
        // Ensure source wallet is valid and distinct from destination wallet
        setFromWalletId((currentFrom) => {
          if (currentFrom === result.toWalletId || !currentFrom) {
            const alternate = wallets.find((w) => w.id !== result.toWalletId);
            return alternate ? alternate.id : currentFrom;
          }
          return currentFrom;
        });
      }
      if (result.description) {
        setDescription(result.description);
      }
      if (result.date) {
        const parsedDate = new Date(result.date);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
        }
      }

      toast({
        title: t('common.success'),
        description: `${t('transfer.title')} autocompleted! Silakan tinjau dan konfirmasi.`,
      });
    } catch (e: any) {
      toast({
        title: t('ai.error'),
        description: e.message || 'Gagal memproses suara transfer.',
        variant: 'destructive',
      });
    } finally {
      setIsAiParsing(false);
    }
  };

  const handleVoiceResult = useCallback((text: string) => {
    setAiInput(text);
    if (text.trim()) {
      handleAiParse(text);
    }
  }, [wallets, fromWalletId]);

  const { isListening, isSupported, startListening, stopListening } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (err) => toast({ title: 'Microphone Error', description: err, variant: 'destructive' }),
    lang: 'id-ID',
  });

  const transfer = useMutation({
    mutationFn: async () => {
      const transferDate = format(date, 'yyyy-MM-dd');
      const transferAmount = parseFloat(amount);
      const desc = description.trim() || `Transfer antar dompet`;

      // Leg 1: Expense from source wallet
      const { error: e1 } = await supabase.from('transactions').insert({
        wallet_id: fromWalletId,
        type: 'expense' as const,
        amount: transferAmount,
        category: 'transfer',
        description: `[Transfer Out] ${desc}`,
        transaction_date: transferDate,
      });
      if (e1) throw e1;

      // Leg 2: Income to destination wallet
      const { error: e2 } = await supabase.from('transactions').insert({
        wallet_id: toWalletId,
        type: 'income' as const,
        amount: transferAmount,
        category: 'transfer',
        description: `[Transfer In] ${desc}`,
        transaction_date: transferDate,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      queryClient.invalidateQueries({ queryKey: ['all-transactions'] });
      setOpen(false);
      resetForm();
      toast({ title: t('common.success'), description: t('transfer.success') });
    },
    onError: (error: any) => {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    },
  });

  const canSubmit =
    fromWalletId &&
    toWalletId &&
    fromWalletId !== toWalletId &&
    parseFloat(amount) > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeftRight className="w-4 h-4" />
          <span className="hidden sm:inline">{t('transfer.button')}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <span>{t('transfer.title')}</span>
          </DialogTitle>
          <DialogDescription>{t('transfer.reviewDesc')}</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-4 px-4 sm:-mx-6 sm:px-6 py-1 space-y-4">
          {/* Smart Assistant Voice / Text Input Box (Reuse Existing Pattern) */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                <Label className="text-primary font-semibold text-xs tracking-wider uppercase">
                  Voice / AI Transfer
                </Label>
              </div>
              <span className="text-[11px] text-muted-foreground">Speech-to-Text</span>
            </div>

            <div className="flex gap-2">
              <Input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={isListening ? t('ai.listening') : t('ai.transferPlaceholder')}
                className="bg-background text-xs sm:text-sm flex-1"
                onKeyDown={(e) => e.key === 'Enter' && handleAiParse()}
                disabled={isListening}
              />
              {isSupported && (
                <Button
                  type="button"
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
                type="button"
                size="icon"
                onClick={() => handleAiParse()}
                disabled={isAiParsing || !aiInput.trim()}
                className="shrink-0 bg-primary hover:bg-primary/90"
                title={t('ai.parse')}
              >
                {isAiParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Contoh: <span className="italic">"Transfer dua juta ke dompet BSI pribadi kemarin"</span>
            </p>
          </div>

          {/* Form Fields: User Review & Edit */}
          <div className="space-y-3.5 pb-2">
            {/* Wallet Selection: From -> To */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('transfer.from')}</Label>
                <Select value={fromWalletId} onValueChange={setFromWalletId}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets
                      .filter((w) => w.id !== toWalletId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('transfer.to')}</Label>
                <Select value={toWalletId} onValueChange={setToWalletId}>
                  <SelectTrigger className="text-xs sm:text-sm">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {wallets
                      .filter((w) => w.id !== fromWalletId)
                      .map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          {w.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('transfer.amount')}</Label>
              <Input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="2000000"
                className="text-sm font-semibold"
              />
            </div>

            {/* Date Picker */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('transfer.date')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal text-xs sm:text-sm h-10',
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

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('transaction.description')}</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Catatan transfer (opsional)"
                className="text-xs sm:text-sm"
              />
            </div>
          </div>
        </div>

        <div className="pt-3 shrink-0 mt-auto border-t">
          <Button
            className="w-full bg-primary hover:bg-primary/90 flex items-center justify-center gap-2"
            onClick={() => transfer.mutate()}
            disabled={!canSubmit || transfer.isPending}
          >
            {transfer.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t('transfer.transferring')}</span>
              </>
            ) : (
              <>
                <span>{t('transfer.submit')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
