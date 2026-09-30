export interface ParsedTransaction {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
}

export interface ParsedTransfer {
  amount: number;
  toWalletId?: string;
  toWalletName?: string;
  fromWalletId?: string;
  description: string;
  date: string; // YYYY-MM-DD
}

/**
 * Format Date as YYYY-MM-DD in local time to avoid UTC day-shift bugs
 */
export const formatLocalDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Convert Indonesian number words to digits (single word lookup)
 */
function wordToDigit(word: string): number {
  if (!word) return 0;
  const num = parseInt(word, 10);
  if (!isNaN(num)) return num;

  const map: Record<string, number> = {
    'nol': 0, 'kosong': 0,
    'satu': 1, 'se': 1,
    'dua': 2,
    'tiga': 3,
    'empat': 4,
    'lima': 5,
    'enam': 6,
    'tujuh': 7,
    'delapan': 8,
    'sembilan': 9,
    'sepuluh': 10,
    'sebelas': 11,
    'seratus': 100,
    'seribu': 1000,
    'sejuta': 1000000,
    'setengah': 0.5,
  };
  return map[word.toLowerCase()] ?? 0;
}

/**
 * Converts a sequence of Indonesian words (e.g. "dua juta lima ratus ribu") into a number
 */
function wordsBlockToNumber(block: string): number {
  const words = block.toLowerCase().split(/[\s-]+/).filter((w) => w && w !== 'rupiah');
  if (words.length === 0) return 0;

  let total = 0;
  let currentGroup = 0;
  let currentVal = 0;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];

    if (w === 'juta') {
      if (currentVal > 0) currentGroup += currentVal;
      if (currentGroup === 0) currentGroup = 1;
      total += currentGroup * 1000000;
      currentGroup = 0;
      currentVal = 0;
    } else if (w === 'miliar' || w === 'milyar') {
      if (currentVal > 0) currentGroup += currentVal;
      if (currentGroup === 0) currentGroup = 1;
      total += currentGroup * 1000000000;
      currentGroup = 0;
      currentVal = 0;
    } else if (w === 'ribu') {
      if (currentVal > 0) currentGroup += currentVal;
      if (currentGroup === 0) currentGroup = 1;
      total += currentGroup * 1000;
      currentGroup = 0;
      currentVal = 0;
    } else if (w === 'ratus') {
      const mult = currentVal > 0 ? currentVal : 1;
      currentGroup += mult * 100;
      currentVal = 0;
    } else if (w === 'puluh') {
      const mult = currentVal > 0 ? currentVal : 1;
      currentGroup += mult * 10;
      currentVal = 0;
    } else if (w === 'belas') {
      const add = currentVal > 0 ? currentVal : 0;
      currentGroup += 10 + add;
      currentVal = 0;
    } else {
      const digit = wordToDigit(w);
      if (digit > 0 || w === 'nol' || w === '0') {
        if (digit >= 100) {
          currentGroup += digit;
        } else {
          currentVal += digit;
        }
      }
    }
  }

  currentGroup += currentVal;
  total += currentGroup;
  return total;
}

/**
 * Extracts and calculates spoken Indonesian numbers like "dua juta", "tiga puluh lima ribu"
 */
function extractIndonesianNumberWords(text: string): number {
  const normalized = text
    .replace(/\bsebelas\b/gi, '11')
    .replace(/\bsepuluh\b/gi, '10')
    .replace(/\bseratus\b/gi, '100')
    .replace(/\bseribu\b/gi, '1000')
    .replace(/\bsejuta\b/gi, '1000000');

  const validTokens = [
    'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
    '10', '11', '100', '1000', '1000000',
    'belas', 'puluh', 'ratus', 'ribu', 'juta', 'miliar', 'milyar',
    'koma', 'setengah', 'rupiah',
    '\\d+'
  ];

  const pattern = new RegExp(`(?:(?:${validTokens.join('|')})[\\s-]*)+`, 'gi');
  const matches = normalized.match(pattern);
  if (!matches) return 0;

  let maxResult = 0;
  for (const block of matches) {
    const trimmed = block.trim();
    if (!trimmed || trimmed === 'rupiah') continue;
    const val = wordsBlockToNumber(trimmed);
    if (val > maxResult) {
      maxResult = val;
    }
  }
  return maxResult;
}

/**
 * Robust Indonesian number extractor from natural speech or text.
 * Supports:
 * - Spoken phrases: "dua juta rupiah", "dua ribu", "lima puluh ribu"
 * - Shorthand: "2,5 juta", "2jt", "500k", "50rb"
 * - Standard formatting: "Rp 2.000.000", "2000000", "2000"
 */
export function parseIndonesianNumberFromText(rawText: string): number {
  if (!rawText) return 0;
  const text = rawText.toLowerCase().replace(/rp\.?/gi, ' ').trim();

  // 1. Direct digit matches with million suffix (e.g. "2,5 juta", "2jt", "2 million")
  const matchDigitJt = text.match(/(\d+(?:[.,]\d+)?)\s*(?:(?:juta|million)\b|jt(?![a-zA-Z]))/i);
  if (matchDigitJt) {
    const num = parseFloat(matchDigitJt[1].replace(',', '.'));
    return Math.round(num * 1000000);
  }

  // 2. Direct digit matches with billion suffix
  const matchDigitMiliar = text.match(/(\d+(?:[.,]\d+)?)\s*(?:miliar|milyar|billion)\b/i);
  if (matchDigitMiliar) {
    const num = parseFloat(matchDigitMiliar[1].replace(',', '.'));
    return Math.round(num * 1000000000);
  }

  // 3. Direct digit matches with thousand suffix (e.g. "50rb", "50k", "50 ribu")
  // Note: negative lookahead ensures "50000 ke" doesn't treat the preposition "ke" as thousand suffix "k"
  const matchDigitK = text.match(/(\d+(?:[.,]\d+)?)\s*(?:(?:rb|ribu|thousand)\b|k(?![a-zA-Z]))/i);
  if (matchDigitK) {
    const num = parseFloat(matchDigitK[1].replace(',', '.'));
    return Math.round(num * 1000);
  }

  // 4. Formatted digits with thousand separators (e.g. "2.000.000" or "2,000,000")
  const matchFullDigits = text.match(/(\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?\b)/);
  if (matchFullDigits) {
    const cleaned = matchFullDigits[1].replace(/[.,]/g, '');
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 5. Special Indonesian fractions: "setengah juta", "satu setengah juta", "dua setengah juta"
  const matchSetengahJt = text.match(/(?:(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|\d+)\s+)?setengah\s+juta/i);
  if (matchSetengahJt) {
    const baseWord = matchSetengahJt[1];
    let base = 0;
    if (baseWord) base = wordToDigit(baseWord);
    return Math.round((base + 0.5) * 1000000);
  }

  // 6. Decimal spoken numbers: "dua koma lima juta"
  const matchKomaJt = text.match(/(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan)\s+koma\s+(satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|\d+)\s+juta/i);
  if (matchKomaJt) {
    const integerPart = wordToDigit(matchKomaJt[1]);
    const decimalPart = wordToDigit(matchKomaJt[2]);
    return Math.round((integerPart + decimalPart / 10) * 1000000);
  }

  // 7. Spoken words extraction: "dua juta", "tiga puluh ribu", "seratus ribu"
  const parsedWords = extractIndonesianNumberWords(text);
  if (parsedWords > 0) {
    return parsedWords;
  }

  // 8. Plain digits (e.g. "2000000", "2000")
  const matchPlainDigits = text.match(/\b\d{3,}\b/);
  if (matchPlainDigits) {
    const val = parseInt(matchPlainDigits[0], 10);
    if (!isNaN(val)) return val;
  }

  return 0;
}

/**
 * Parses natural language relative dates in Indonesian
 */
export function parseRelativeDate(text: string, defaultDate: string): string {
  const lower = text.toLowerCase();
  const d = new Date();

  // "kemarin lusa" -> today - 2 days
  if (lower.includes('kemarin lusa')) {
    d.setDate(d.getDate() - 2);
    return formatLocalDate(d);
  }
  // "kemarin" or "semalam" -> today - 1 day
  if (lower.includes('kemarin') || lower.includes('semalam')) {
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }
  // "lusa" -> today + 2 days
  if (lower.includes('lusa')) {
    d.setDate(d.getDate() + 2);
    return formatLocalDate(d);
  }
  // "besok" or "esok" -> today + 1 day
  if (lower.includes('besok') || lower.includes('esok')) {
    d.setDate(d.getDate() + 1);
    return formatLocalDate(d);
  }

  // "X hari yang lalu"
  const matchDaysAgo = lower.match(/(\d+)\s+hari\s+(?:yang\s+)?lalu/);
  if (matchDaysAgo) {
    const days = parseInt(matchDaysAgo[1], 10);
    if (!isNaN(days)) {
      d.setDate(d.getDate() - days);
      return formatLocalDate(d);
    }
  }

  // "tadi", "hari ini", "sekarang" -> today
  if (lower.includes('tadi') || lower.includes('hari ini') || lower.includes('sekarang')) {
    return defaultDate;
  }

  return defaultDate;
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * High-accuracy Indonesian Transaction Parser (Heuristic + Semantic Engine)
 */
export function parseTransactionHeuristic(input: string, currentDate: string): ParsedTransaction {
  const lower = input.toLowerCase().trim();

  // 1. Date parsing
  const date = parseRelativeDate(lower, currentDate);

  // 2. Amount parsing
  const amount = parseIndonesianNumberFromText(input);

  // 3. Category & Type parsing
  const incomeCategoryKeywords = {
    salary: /gaji|gajian|salary|payroll|upah|honor|thr|pesangon|bonus/i,
    investment: /invest|dividen|deviden|saham|reksadana|kripto|crypto|bunga|deposito|yield|trading/i,
    business: /jual|jualan|penjualan|dagang|bisnis|omset|omzet|toko|laku|komisi|proyek|orderan/i,
  };

  const expenseCategoryKeywords = {
    food: /makan|minum|kopi|ngopi|coffee|cafe|kafe|sarapan|makan\s+siang|maksi|makan\s+malam|snack|jajan|cemilan|bakso|mie|ayam|bebek|sate|soto|burger|pizza|resto|restoran|warung|warteg|warkop|angkringan|boba|es\s+teh|jus|go-food|gofood|shopeefood|grabfood|nasi|nasgor|gorengan/i,
    transport: /bensin|pertamax|pertalite|solar|bbm|shell|spbu|ojol|gojek|goride|gocar|grab|grabbike|grabcar|maxim|indrive|angkot|bus|transjakarta|tj|kereta|krl|mrt|lrt|flight|pesawat|tiket\s+pesawat|travel|tol|parkir|servis|ganti\s+oli|tambal\s+ban|cuci\s+motor|cuci\s+mobil/i,
    entertainment: /nonton|bioskop|cinema|xxi|cgv|cinepolis|film|game|topup|top\s+up|diamond|mobile\s+legends|genshin|steam|playstation|ps|netflix|spotify|disney|karaoke|konser|liburan|staycation|hotel|wisata|rekreasi|jalan-jalan|holiday/i,
    bills: /listrik|pln|token|air|pdam|wifi|indihome|biznet|firstmedia|myrepublic|pulsa|paket\s+data|kuota|iuran|bpjs|pbb|retribusi|pajak|sewa|uang\s+sewa|kos|kost|kontrakan|tagihan|cicilan|kredit|langganan/i,
    shopping: /beli|belanja|baju|pakaian|celana|sepatu|sandal|tas|jaket|skincare|makeup|kosmetik|sabun|shampoo|tokopedia|shopee|lazada|tiktok\s+shop|blibli|supermarket|minimarket|indomaret|alfamart|alfamidi|superindo|transmart/i,
  };

  const incomeTriggers = [
    'dapat gaji', 'dapet gaji', 'gajian', 'gaji cair', 'terima gaji',
    'pemasukan', 'dapat uang', 'dapet uang', 'dapat duit', 'dapet duit',
    'dapat transfer', 'terima uang', 'terima transfer', 'dapat kiriman',
    'bonus', 'hasil jual', 'penjualan', 'dividen', 'deviden', 'untung',
    'profit', 'cashback', 'thr', 'dapat komisi', 'dapet komisi', 'klaim'
  ];

  const expenseTriggers = [
    'beli', 'membeli', 'bayar', 'membayar', 'habis beli', 'jajan', 'keluar uang',
    'top up', 'topup', 'pesan', 'order', 'sewa', 'isi bensin', 'belanja', 'makan', 'minum'
  ];

  const hasIncomeTrigger = incomeTriggers.some((kw) => lower.includes(kw));
  const hasExpenseTrigger = expenseTriggers.some((kw) => lower.includes(kw));

  let category = 'other';
  let type: 'expense' | 'income' = 'expense';

  // Determine Type & Category
  if (
    hasIncomeTrigger ||
    (!hasExpenseTrigger &&
      (incomeCategoryKeywords.salary.test(lower) ||
        incomeCategoryKeywords.business.test(lower) ||
        incomeCategoryKeywords.investment.test(lower)))
  ) {
    type = 'income';
    if (incomeCategoryKeywords.salary.test(lower)) category = 'salary';
    else if (incomeCategoryKeywords.investment.test(lower)) category = 'investment';
    else if (incomeCategoryKeywords.business.test(lower)) category = 'business';
    else category = 'other';
  } else {
    type = 'expense';
    if (expenseCategoryKeywords.transport.test(lower)) category = 'transport';
    else if (expenseCategoryKeywords.food.test(lower)) category = 'food';
    else if (expenseCategoryKeywords.entertainment.test(lower)) category = 'entertainment';
    else if (expenseCategoryKeywords.bills.test(lower)) category = 'bills';
    else if (expenseCategoryKeywords.shopping.test(lower)) category = 'shopping';
    else category = 'other';
  }

  return {
    type,
    amount,
    category,
    description: input.trim(),
    date,
  };
}

/**
 * Transfer Heuristic & Natural Language Matcher
 * Parses destination wallet, amount, date, and description for inter-wallet transfers.
 */
export function parseTransferHeuristic(
  input: string,
  availableWallets: Array<{ id: string; name: string }>,
  currentWalletId?: string,
  currentDate: string = formatLocalDate(new Date())
): ParsedTransfer {
  const lower = input.toLowerCase().trim();

  // 1. Date
  const date = parseRelativeDate(lower, currentDate);

  // 2. Amount
  const amount = parseIndonesianNumberFromText(input);

  // 3. Destination wallet matching
  let matchedWallet: { id: string; name: string } | null = null;
  let highestScore = 0;

  for (const w of availableWallets) {
    const wNameLower = w.name.toLowerCase().trim();
    const wCoreName = wNameLower
      .replace(/^(?:dompet|wallet|rekening|bank)\s+/i, '')
      .trim();

    let score = 0;

    // Pattern 1: Explicit destination phrases like "ke dompet BSI pribadi", "ke BSI"
    const prepRegex = new RegExp(`(?:ke|menuju|tujuan|arah)\\s+(?:dompet\\s+|wallet\\s+|rekening\\s+|bank\\s+)?${escapeRegExp(wNameLower)}`, 'i');
    const prepCoreRegex = new RegExp(`(?:ke|menuju|tujuan|arah)\\s+(?:dompet\\s+|wallet\\s+|rekening\\s+|bank\\s+)?${escapeRegExp(wCoreName)}`, 'i');

    if (prepRegex.test(lower)) {
      score += 150;
    } else if (prepCoreRegex.test(lower)) {
      score += 130;
    } else if (new RegExp(`\\b${escapeRegExp(wNameLower)}\\b`, 'i').test(lower)) {
      score += 100;
    } else if (new RegExp(`\\b${escapeRegExp(wCoreName)}\\b`, 'i').test(lower)) {
      score += 80;
    } else {
      // Sub-token match (e.g. "BSI", "admin", "mandiri", "bca")
      const tokens = wCoreName.split(/\s+/).filter((t) => t.length >= 3);
      for (const tok of tokens) {
        if (new RegExp(`\\b${escapeRegExp(tok)}\\b`, 'i').test(lower)) {
          score += 50;
        } else if (lower.includes(tok)) {
          score += 30;
        }
      }
    }

    // Favor destination wallet different from current source wallet
    if (currentWalletId && w.id === currentWalletId) {
      score -= 40;
    }

    if (score > highestScore) {
      highestScore = score;
      matchedWallet = w;
    }
  }

  // 4. Description extraction
  let description = '';
  // Check for notes keywords like "buat ...", "untuk ...", "catatan ..."
  const descMatch = input.match(/(?:buat|untuk|catatan|keterangan|keperluan)\s+(.+?)(?:\s+(?:kemarin|tadi|besok|lusa))?$/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    // If not specified, remove command and amount artifacts
    let clean = input
      .replace(/^(?:tolong\s+)?(?:transfer|tf|kirim|pindahin|pindahkan)\s+/i, '')
      .replace(/(?:kemarin\s+lusa|kemarin|semalam|tadi\s+pagi|tadi\s+siang|tadi\s+malam|tadi|besok|lusa)/gi, '')
      .trim();
    if (matchedWallet) {
      clean = clean
        .replace(new RegExp(`(?:ke|menuju|tujuan|arah)?\\s*(?:dompet\\s+|wallet\\s+|rekening\\s+|bank\\s+)?${escapeRegExp(matchedWallet.name)}`, 'gi'), '')
        .trim();
    }
    clean = clean.replace(/(?:rp\.?\s*)?[\d.,]+(?:\s*(?:jt|juta|rb|ribu|k))?/gi, '').trim();
    clean = clean.replace(/\b(?:satu|dua|tiga|empat|lima|enam|tujuh|delapan|sembilan|sepuluh|sebelas|belas|puluh|ratus|ribu|juta|setengah|rupiah)\b/gi, '').trim();
    clean = clean.replace(/^[,\s-]+|[,\s-]+$/g, '').trim();

    if (clean.length > 2) {
      description = clean;
    } else if (matchedWallet) {
      description = `Transfer ke ${matchedWallet.name}`;
    } else {
      description = 'Transfer antar dompet';
    }
  }

  return {
    amount,
    toWalletId: matchedWallet ? matchedWallet.id : undefined,
    toWalletName: matchedWallet ? matchedWallet.name : undefined,
    fromWalletId: currentWalletId,
    description,
    date,
  };
}

/**
 * Standard AI Transaction Parser.
 * Calls secure backend /api/ai with intelligent offline heuristic fallback.
 */
export async function parseTransactionWithAI(input: string): Promise<ParsedTransaction> {
  const currentDate = formatLocalDate(new Date());

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parse-transaction', input, currentDate }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.result) {
        const parsed = data.result;
        // Double check amount with our Indonesian number parser if LLM missed it
        if (!parsed.amount || isNaN(parsed.amount)) {
          parsed.amount = parseIndonesianNumberFromText(input);
        }
        return parsed as ParsedTransaction;
      }
    } else {
      const errData = await response.json().catch(() => null);
      if (errData?.unsafe) {
        throw new Error(errData.error || 'Input terdeteksi tidak aman oleh Prompt Guard.');
      }
    }
  } catch (err: any) {
    if (err.message?.includes('tidak aman')) throw err;
    console.warn('AI API parse failed or not configured, using heuristic fallback:', err.message);
  }

  return parseTransactionHeuristic(input, currentDate);
}

/**
 * AI Voice / Natural Language Transfer Parser.
 * Reuses existing AI / Prompt Guard infrastructure via secure backend and maps output for inter-wallet transfers.
 */
export async function parseTransferWithAI(
  input: string,
  availableWallets: Array<{ id: string; name: string }>,
  currentWalletId?: string
): Promise<ParsedTransfer> {
  const currentDate = formatLocalDate(new Date());

  try {
    const response = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prompt-guard', input }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      if (errData?.unsafe) {
        throw new Error(errData.error || 'Input terdeteksi tidak aman oleh Prompt Guard.');
      }
    }
  } catch (e: any) {
    if (e.message?.includes('tidak aman')) throw e;
    console.warn('Groq Prompt Guard check bypassed for transfer:', e.message);
  }

  return parseTransferHeuristic(input, availableWallets, currentWalletId, currentDate);
}