import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Camera,
  Upload,
  Sparkles,
  Loader2,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Key,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import {
  processReceiptImage,
  scanReceiptWithGemini,
  getGeminiApiKey,
  setGeminiApiKey,
  ScannedReceiptResult,
} from '@/services/geminiService';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';

interface ReceiptScannerProps {
  onScanComplete: (result: ScannedReceiptResult) => void;
  onCancel: () => void;
}

export const ReceiptScanner: React.FC<ReceiptScannerProps> = ({ onScanComplete, onCancel }) => {
  const { t } = useLanguage();
  const { toast } = useToast();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [fileName, setFileName] = useState<string>('');

  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [apiKey, setApiKey] = useState(getGeminiApiKey());
  const [showKeyPrompt, setShowKeyPrompt] = useState(!getGeminiApiKey());
  const [keySavedToast, setKeySavedToast] = useState(false);

  const handleFileChange = async (file: File) => {
    setErrorMessage(null);
    setIsProcessingImage(true);
    try {
      const processed = await processReceiptImage(file);
      setPreviewUrl(processed.previewUrl);
      setBase64Data(processed.base64Data);
      setMimeType(processed.mimeType);
      setFileName(file.name);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal memproses gambar struk.');
      toast({
        title: t('common.error'),
        description: err.message || 'Format gambar tidak valid.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessingImage(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSaveApiKey = () => {
    if (!apiKey.trim()) return;
    setGeminiApiKey(apiKey.trim());
    setShowKeyPrompt(false);
    setKeySavedToast(true);
    setTimeout(() => setKeySavedToast(false), 3000);
    toast({
      title: t('common.success'),
      description: t('receipt.apiKeySaved'),
    });
  };

  const handleExecuteScan = async () => {
    if (!base64Data) {
      setErrorMessage('Pilih atau ambil foto struk terlebih dahulu.');
      return;
    }

    const currentKey = getGeminiApiKey();
    if (!currentKey) {
      setShowKeyPrompt(true);
      setErrorMessage('Gemini API Key dibutuhkan untuk memindai struk.');
      return;
    }

    setIsScanning(true);
    setErrorMessage(null);

    try {
      const result = await scanReceiptWithGemini(base64Data, mimeType);

      // Clean preview from memory immediately after scanning (do not persist receipt image)
      setPreviewUrl(null);
      setBase64Data(null);

      toast({
        title: t('common.success'),
        description: t('receipt.success'),
      });

      onScanComplete(result);
    } catch (err: any) {
      setErrorMessage(err.message || t('receipt.errorFailed'));
      toast({
        title: t('common.error'),
        description: err.message || 'Gagal memindai struk.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  const resetSelection = () => {
    setPreviewUrl(null);
    setBase64Data(null);
    setFileName('');
    setErrorMessage(null);
  };

  return (
    <div className="space-y-4">
      {/* Header bar with Back button */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isScanning}
            className="h-8 px-2 -ml-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="text-xs sm:text-sm">{t('receipt.backToForm')}</span>
          </Button>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-full">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Gemini 2.5 Flash</span>
        </div>
      </div>

      {/* Hidden File Inputs */}
      {/* Camera Capture for mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />
      {/* General File Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />

      {/* API Key Banner / Config if needed */}
      {showKeyPrompt && (
        <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium text-xs">
            <Key className="w-4 h-4" />
            <span>{t('receipt.configureApiKey')}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Masukkan Google Gemini API Key Anda untuk mengaktifkan pemindai struk (disimpan di browser Anda atau bisa diatur di file <code className="bg-muted px-1 rounded">.env</code> sebagai <code className="bg-muted px-1 rounded">VITE_GEMINI_API_KEY</code>).
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={t('receipt.apiKeyPlaceholder')}
              className="h-8 text-xs bg-background"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleSaveApiKey}
              disabled={!apiKey.trim()}
              className="h-8 text-xs shrink-0"
            >
              Simpan
            </Button>
          </div>
        </div>
      )}

      {keySavedToast && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4" />
          <span>{t('receipt.apiKeySaved')}</span>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <Alert variant="destructive" className="py-2.5">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Main Scanner Body */}
      {!previewUrl ? (
        // State 1: Choose Camera or Upload
        <div className="space-y-4">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-primary/25 hover:border-primary/50 dark:border-primary/20 dark:hover:border-primary/40 rounded-2xl p-6 sm:p-8 text-center transition-all bg-gradient-to-b from-primary/[0.02] to-primary/[0.06] flex flex-col items-center justify-center gap-3 cursor-pointer group"
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-sm">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <p className="font-semibold text-sm sm:text-base text-foreground">
                {t('receipt.title')}
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                {t('receipt.instructions')}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground/80 mt-1">
              JPG, PNG, WEBP (Maks 15MB)
            </p>
          </div>

          {/* Action Buttons: Take Photo & Upload */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => cameraInputRef.current?.click()}
              disabled={isProcessingImage}
              className="h-12 border-primary/20 hover:bg-primary/5 hover:border-primary/40 flex items-center justify-center gap-2 font-medium text-xs sm:text-sm active:scale-[0.98] transition-transform"
            >
              <Camera className="w-4 h-4 text-primary" />
              <span>{t('receipt.takePhoto')}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingImage}
              className="h-12 border-primary/20 hover:bg-primary/5 hover:border-primary/40 flex items-center justify-center gap-2 font-medium text-xs sm:text-sm active:scale-[0.98] transition-transform"
            >
              <Upload className="w-4 h-4 text-primary" />
              <span>{t('receipt.uploadImage')}</span>
            </Button>
          </div>

          {/* Inline key configuration link */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => setShowKeyPrompt(!showKeyPrompt)}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline inline-flex items-center gap-1"
            >
              <Key className="w-3 h-3" />
              <span>{showKeyPrompt ? 'Tutup Pengaturan API Key' : 'Atur Gemini API Key'}</span>
            </button>
          </div>
        </div>
      ) : (
        // State 2: Preview & Scanning
        <div className="space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-border bg-black/5 dark:bg-black/40 flex items-center justify-center max-h-72 shadow-inner">
            <img
              src={previewUrl}
              alt="Receipt preview"
              className="w-full h-auto max-h-72 object-contain rounded-xl select-none"
            />

            {/* Scanning Laser Animation Overlay */}
            {isScanning && (
              <div className="absolute inset-0 bg-primary/10 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none overflow-hidden">
                {/* Laser line moving top to bottom */}
                <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_#10b981] animate-bounce" />
                <div className="bg-background/90 dark:bg-card/90 border border-primary/30 rounded-xl p-4 shadow-lg flex flex-col items-center gap-2 text-center max-w-xs mx-4">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                  <p className="font-semibold text-xs sm:text-sm text-foreground">
                    {t('receipt.scanning')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t('receipt.scanningSub')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Row: Retake and Scan */}
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={resetSelection}
              disabled={isScanning}
              className="flex-1 text-xs sm:text-sm h-11"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {t('receipt.changeImage')}
            </Button>

            <Button
              type="button"
              onClick={handleExecuteScan}
              disabled={isScanning || isProcessingImage}
              className="flex-1 bg-gradient-primary hover:opacity-95 text-xs sm:text-sm font-semibold h-11 shadow-md"
            >
              {isScanning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  <span>Memindai...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  <span>{t('receipt.scanButton')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
