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


export function getGeminiApiKey(): string {
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
  maxDimension = 1280,
  quality = 0.8
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
 * Scan receipt image using Gemini Multimodal API via secure backend endpoint.
 */
export async function scanReceiptWithGemini(
  base64Data: string,
  mimeType = 'image/jpeg'
): Promise<ScannedReceiptResult> {
  const userKey = getGeminiApiKey();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userKey) {
    headers['x-gemini-api-key'] = userKey;
  }

  let response: Response;
  try {
    response = await fetch('/api/gemini', {
      method: 'POST',
      headers,
      body: JSON.stringify({ base64Data, mimeType }),
    });
  } catch (err: any) {
    throw new Error(`Gagal terhubung ke scanner API: ${err.message || 'Periksa koneksi internet.'}`);
  }

  const rawText = await response.text().catch(() => '');
  let result: any = null;
  if (rawText) {
    try {
      result = JSON.parse(rawText);
    } catch {
      // Non-JSON response (e.g. Vercel HTML error page)
    }
  }

  if (!response.ok) {
    let errorMsg = result?.error;
    if (!errorMsg) {
      if (response.status === 413 || rawText.includes('FUNCTION_PAYLOAD_TOO_LARGE')) {
        errorMsg = 'Ukuran gambar struk terlalu besar untuk diproses server Vercel.';
      } else if (response.status === 504 || rawText.includes('FUNCTION_INVOCATION_TIMEOUT')) {
        errorMsg = 'Pemindaian struk memakan waktu terlalu lama (timeout di server). Coba gunakan foto yang lebih fokus.';
      } else if (response.status === 500) {
        errorMsg = `Server Vercel mengembalikan Status 500. Pastikan project sudah di-redeploy setelah menambahkan GEMINI_API_KEY.`;
      } else {
        errorMsg = `Gagal memindai struk (Status ${response.status})`;
      }
    }

    const error = new Error(errorMsg);
    if (result?.code === 'GEMINI_API_KEY_REQUIRED' || (response.status === 400 && errorMsg.includes('API Key'))) {
      (error as any).code = 'GEMINI_API_KEY_REQUIRED';
    }
    throw error;
  }

  return result as ScannedReceiptResult;
}

