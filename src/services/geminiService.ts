export interface ScannedReceiptResult {
  merchant: string | null;
  totalAmount: number | null;
  transactionDate: string | null; // YYYY-MM-DD
  category: string;
  type: 'expense' | 'income';
  currency: string | null;
  items: Array<{ name: string; quantity: number | null; price: number | null }>;
  description: string;
  rawNotes?: string | null;
}

const ALLOWED_CATEGORIES = [
  'food',
  'transport',
  'shopping',
  'bills',
  'entertainment',
  'salary',
  'business',
  'investment',
  'other',
];

export function getGeminiApiKey(): string {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  const localKey = localStorage.getItem('rupiah2ku_gemini_api_key');
  if (localKey && localKey.trim()) {
    return localKey.trim();
  }
  return '';
}

export function setGeminiApiKey(key: string): void {
  if (key && key.trim()) {
    localStorage.setItem('rupiah2ku_gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('rupiah2ku_gemini_api_key');
  }
}

export function hasGeminiApiKey(): boolean {
  return !!getGeminiApiKey();
}

/**
 * Compress and downscale receipt image in-memory to prevent large payload issues
 * and speed up Gemini processing.
 */
export async function processReceiptImage(
  file: File,
  maxDimension = 1600,
  quality = 0.85
): Promise<{ base64Data: string; mimeType: string; previewUrl: string }> {
  // Validate file type
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
  if (!validTypes.some((t) => file.type.toLowerCase().includes(t.split('/')[1]))) {
    // If browser doesn't identify HEIC mime properly, still allow if extension matches
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext || '')) {
      throw new Error('Format gambar tidak didukung. Gunakan JPG, PNG, atau WEBP.');
    }
  }

  // Max 15MB file size
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Ukuran file terlalu besar. Maksimal 15MB.');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gambar tidak dapat dimuat. Pastikan file tidak rusak.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context tidak tersedia.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const mimeType = 'image/jpeg';
        const dataUrl = canvas.toDataURL(mimeType, quality);
        const base64Data = dataUrl.split(',')[1];
        resolve({
          base64Data,
          mimeType,
          previewUrl: dataUrl,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Scan receipt image using Gemini Multimodal API.
 */
export async function scanReceiptWithGemini(
  base64Data: string,
  mimeType = 'image/jpeg'
): Promise<ScannedReceiptResult> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API Key belum dikonfigurasi. Masukkan API key pada pengaturan atau .env.');
  }

  const model = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const promptText = `
You are an expert AI Receipt Scanner and OCR extractor for personal finance in Indonesia.
Extract structured transaction information from this receipt image.

CRITICAL RULES:
1. If any piece of information is NOT visible, obscured, cut off, or illegible, DO NOT guess or hallucinate. Leave it as null.
2. "merchant": The business, restaurant, or store name on the receipt. If unreadable, null.
3. "total_amount": The final payable total amount as a clean number (e.g., 45000). Remove currency symbols, commas, or dots. If not visible, null.
4. "transaction_date": Date when the transaction occurred, formatted strictly as "YYYY-MM-DD". If missing or unreadable, null.
5. "category": Must be strictly ONE of: ['food', 'transport', 'shopping', 'bills', 'entertainment', 'salary', 'business', 'investment', 'other'].
   - Supermarket, minimarket (Indomaret, Alfamart), clothes, retail -> 'shopping'
   - Restaurants, cafes, food stalls, bakery -> 'food'
   - Fuel, parking, toll, train, flights -> 'transport'
   - Electricity, water, internet, phone credit -> 'bills'
   - Cinema, games, attractions -> 'entertainment'
   - If uncertain or doesn't fit, use 'other'.
6. "type": "expense" (unless it explicitly says refund or income).
7. "currency": e.g. "IDR", "USD", etc.
8. "items": Array of line items purchased, each with { "name": string, "quantity": number or null, "price": number or null }.
9. "description": A short, readable summary of what was bought (e.g., "Makan siang di Solaria" or key items).

Return ONLY valid JSON matching this schema:
{
  "merchant": string or null,
  "total_amount": number or null,
  "transaction_date": string or null,
  "category": string,
  "type": "expense",
  "currency": string or null,
  "items": [
    {
      "name": string,
      "quantity": number or null,
      "price": number or null
    }
  ],
  "description": string or null
}
`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1,
    },
  };

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (err: any) {
    throw new Error(`Gagal terhubung ke Gemini API: ${err.message || 'Periksa koneksi internet.'}`);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;

    // If 404 (e.g. Google migrated gemini-2.5-flash to gemini-3.8-flash / gemini-flash-latest),
    // automatically fallback to the active flash model to ensure seamless operation
    if (response.status === 404) {
      const fallbackModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.0-flash'];
      for (const fallbackModel of fallbackModels) {
        if (fallbackModel === model) continue;
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (fallbackRes.ok) {
          return parseGeminiResponse(await fallbackRes.json());
        }
      }
    }

    throw new Error(`Gemini Error: ${errorMsg}`);
  }

  const jsonResponse = await response.json();
  return parseGeminiResponse(jsonResponse);
}

function parseGeminiResponse(jsonResponse: any): ScannedReceiptResult {
  const candidate = jsonResponse?.candidates?.[0];
  const textContent = candidate?.content?.parts?.[0]?.text;

  if (!textContent) {
    throw new Error('Gemini tidak memberikan jawaban yang valid atau gambar tidak dapat diidentifikasi.');
  }

  let parsed: any;
  try {
    const cleaned = textContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error('Gagal memproses format data hasil analisis Gemini.');
  }

  // Validate and sanitize category
  let category = parsed.category?.toLowerCase() || 'other';
  if (!ALLOWED_CATEGORIES.includes(category)) {
    category = 'other';
  }

  // Extract items list
  const items: Array<{ name: string; quantity: number | null; price: number | null }> = [];
  if (Array.isArray(parsed.items)) {
    for (const item of parsed.items) {
      if (item && typeof item.name === 'string' && item.name.trim()) {
        items.push({
          name: item.name.trim(),
          quantity: typeof item.quantity === 'number' ? item.quantity : null,
          price: typeof item.price === 'number' ? item.price : null,
        });
      }
    }
  }

  // Construct description with item details if available
  let description = parsed.description || '';
  if (!description && items.length > 0) {
    description = items
      .map((i) => `${i.quantity ? `${i.quantity}x ` : ''}${i.name}`)
      .join(', ');
  }

  return {
    merchant: parsed.merchant || null,
    totalAmount: typeof parsed.total_amount === 'number' ? parsed.total_amount : null,
    transactionDate: parsed.transaction_date || null,
    category,
    type: parsed.type === 'income' ? 'income' : 'expense',
    currency: parsed.currency || 'IDR',
    items,
    description: description.trim(),
  };
}
