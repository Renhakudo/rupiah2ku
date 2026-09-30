export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  maxDuration: 60,
};

export const maxDuration = 60;

async function parseJsonBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body;
    }
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf-8'));
      } catch {
        return {};
      }
    }
  }

  if (req.readableEnded) {
    return {};
  }

  return new Promise((resolve) => {
    const chunks: any[] = [];
    const timeout = setTimeout(() => resolve({}), 4000);

    req.on('data', (chunk: any) => chunks.push(chunk));
    req.on('end', () => {
      clearTimeout(timeout);
      if (chunks.length === 0) return resolve({});
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(text));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      clearTimeout(timeout);
      resolve({});
    });
  });
}

function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
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

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await parseJsonBody(req);
    const { base64Data, mimeType = 'image/jpeg' } = body || {};

    if (!base64Data) {
      return sendJson(res, 400, { error: 'Gambar struk (base64Data) harus disertakan.' });
    }

    // 1. Prioritize user-provided BYOK key from header if provided
    // 2. Fall back to secure server environment variable
    const apiKey =
      (req.headers['x-gemini-api-key'] as string) ||
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return sendJson(res, 400, {
        code: 'GEMINI_API_KEY_REQUIRED',
        error: 'Gemini API Key belum dikonfigurasi di server maupun di pengaturan pengguna.',
      });
    }

    const defaultModel =
      process.env.GEMINI_MODEL ||
      process.env.VITE_GEMINI_MODEL ||
      'gemini-2.5-flash';
    const model = body.model || defaultModel;

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

    let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
    let response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok && response.status === 404) {
      const fallbackModels = ['gemini-2.0-flash', 'gemini-flash-latest', 'gemini-1.5-flash', 'gemini-2.5-flash'];
      for (const fallbackModel of fallbackModels) {
        if (fallbackModel === model) continue;
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/${fallbackModel}:generateContent?key=${apiKey.trim()}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        if (fallbackRes.ok) {
          response = fallbackRes;
          break;
        }
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMsg = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      return sendJson(res, response.status >= 400 && response.status < 500 ? response.status : 500, {
        error: `Gemini Error: ${errorMsg}`,
      });
    }

    const jsonResponse = await response.json();
    const candidate = jsonResponse?.candidates?.[0];
    const textContent = candidate?.content?.parts?.[0]?.text;

    if (!textContent) {
      return sendJson(res, 502, {
        error: 'Gemini tidak memberikan jawaban yang valid atau gambar tidak dapat diidentifikasi.',
      });
    }

    let parsed: any;
    try {
      const cleaned = textContent.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return sendJson(res, 502, {
        error: 'Gagal memproses format data hasil analisis Gemini.',
      });
    }

    let category = parsed.category?.toLowerCase() || 'other';
    if (!ALLOWED_CATEGORIES.includes(category)) {
      category = 'other';
    }

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

    let description = parsed.description || '';
    if (!description && items.length > 0) {
      description = items
        .map((i: any) => `${i.quantity ? `${i.quantity}x ` : ''}${i.name}`)
        .join(', ');
    }

    return sendJson(res, 200, {
      merchant: parsed.merchant || null,
      totalAmount: typeof parsed.total_amount === 'number' ? parsed.total_amount : null,
      transactionDate: parsed.transaction_date || null,
      category,
      type: parsed.type === 'income' ? 'income' : 'expense',
      currency: parsed.currency || 'IDR',
      items,
      description: description.trim(),
    });
  } catch (err: any) {
    return sendJson(res, 500, {
      error: `Server Error: ${err.message || 'Gagal memproses struk'}`,
    });
  }
}
