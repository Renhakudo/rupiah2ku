import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

export const config = {
  maxDuration: 30,
};

export const maxDuration = 30;

function getEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...process.env };
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim();
          env[key] = val;
        }
      }
    }
  } catch {
    // ignore
  }
  return env;
}

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
    const { action = 'parse-transaction', input, currentDate } = body || {};

    if (!input || typeof input !== 'string') {
      return sendJson(res, 400, { error: 'Input teks harus disertakan.' });
    }

    const env = getEnv();
    const apiKey =
      (req.headers['x-groq-api-key'] as string) ||
      env.GROQ_API_KEY ||
      env.VITE_GROQ_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return sendJson(res, 200, {
        fallback: true,
        message: 'Groq API Key belum dikonfigurasi, gunakan parser heuristik lokal.',
      });
    }

    const baseURL =
      env.GROQ_BASE_URL ||
      env.VITE_GROQ_BASE_URL ||
      'https://api.groq.com/openai/v1';

    const primaryModel =
      body?.model ||
      env.GROQ_MODEL ||
      env.VITE_GROQ_MODEL ||
      'openai/gpt-oss-120b';

    const fallbackModel =
      body?.fallbackModel ||
      env.GROQ_FALLBACK_MODEL ||
      env.VITE_GROQ_FALLBACK_MODEL ||
      'meta-llama/llama-prompt-guard-2-86m';

    const client = new OpenAI({
      apiKey: apiKey.trim(),
      baseURL,
    });

    if (action === 'prompt-guard') {
      const guardModel = primaryModel.includes('prompt-guard') ? primaryModel : fallbackModel;
      const response = await client.chat.completions.create({
        model: guardModel,
        messages: [{ role: 'user', content: input }],
      });

      const guardScore = parseFloat(response.choices[0]?.message?.content || '0');
      if (!isNaN(guardScore) && guardScore > 0.85) {
        return sendJson(res, 400, {
          error: 'Input terdeteksi tidak aman oleh Prompt Guard.',
          unsafe: true,
        });
      }

      return sendJson(res, 200, {
        safe: true,
        fallback: true,
        modelUsed: guardModel,
      });
    }

    // Dynamic categories extraction
    const rawCategories: any[] = Array.isArray(body?.categories) && body.categories.length > 0
      ? body.categories
      : [
          { slug: 'salary', name: 'Gaji' },
          { slug: 'business', name: 'Bisnis' },
          { slug: 'investment', name: 'Investasi' },
          { slug: 'food', name: 'Makanan & Minuman' },
          { slug: 'transport', name: 'Transportasi' },
          { slug: 'shopping', name: 'Belanja' },
          { slug: 'bills', name: 'Tagihan & Utilitas' },
          { slug: 'entertainment', name: 'Hiburan' },
          { slug: 'other', name: 'Lainnya' },
        ];

    const allowedSlugs: string[] = rawCategories.map((c) =>
      typeof c === 'string' ? c.toLowerCase().trim() : c.slug.toLowerCase().trim()
    );
    if (!allowedSlugs.includes('other')) {
      allowedSlugs.push('other');
    }

    const categoriesDescription = rawCategories
      .map((c) => (typeof c === 'string' ? c : `${c.slug} (${c.name})`))
      .join(', ');

    const normalizeCategory = (cat: any) => {
      if (!cat || typeof cat !== 'string') return 'other';
      const clean = cat.toLowerCase().trim();
      const matched = allowedSlugs.find((s) => s === clean);
      return matched || 'other';
    };

    // Generative LLM Extraction
    const systemPrompt = `
Kamu adalah asisten keuangan pintar. Ekstrak data transaksi dari kalimat input bahasa Indonesia.
Tanggal hari ini adalah: ${currentDate || new Date().toISOString().slice(0, 10)}.
Jika input menyatakan "kemarin", "tadi", "hari ini", kurangi/sesuaikan dari tanggal tersebut ke dalam format YYYY-MM-DD.

Kategori yang diperbolehkan hanya salah satu dari slug berikut:
[${allowedSlugs.join(', ')}]
Daftar kategori beserta maknanya: ${categoriesDescription}.
Pilih slug kategori yang PALING TEPAT dan RELEVAN dengan input kalimat. Jika sama sekali tidak ada yang cocok, gunakan "other".

Format Output harus strictly JSON:
{
  "type": "expense" atau "income",
  "amount": angka murni (tanpa titik/koma, contoh: 50000),
  "category": "salah satu slug kategori yang valid dari daftar di atas",
  "description": "catatan singkat",
  "date": "YYYY-MM-DD"
}
`;

    // 1. Try Primary Model (openai/gpt-oss-120b)
    try {
      if (!primaryModel.includes('prompt-guard')) {
        const response = await client.chat.completions.create({
          model: primaryModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
          temperature: 0.1,
        });

        const rawJson = response.choices[0]?.message?.content?.trim();
        if (rawJson) {
          const cleanJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed && typeof parsed === 'object') {
            parsed.category = normalizeCategory(parsed.category);
            return sendJson(res, 200, {
              success: true,
              result: parsed,
              modelUsed: primaryModel,
            });
          }
        }
      }
    } catch (primaryErr: any) {
      console.warn(`Primary model (${primaryModel}) failed:`, primaryErr?.message || primaryErr);
    }

    // 2. Try Fallback Model (meta-llama/llama-prompt-guard-2-86m or alternative)
    console.info(`Using fallback model: ${fallbackModel}`);
    if (fallbackModel.includes('prompt-guard')) {
      // Guard fallback: check safety and fall back to local heuristic parser safely
      try {
        const guardResponse = await client.chat.completions.create({
          model: fallbackModel,
          messages: [{ role: 'user', content: input }],
        });

        const guardScore = parseFloat(guardResponse.choices[0]?.message?.content || '0');
        if (!isNaN(guardScore) && guardScore > 0.85) {
          return sendJson(res, 400, {
            error: 'Input terdeteksi tidak aman oleh Prompt Guard.',
            unsafe: true,
          });
        }

        return sendJson(res, 200, {
          safe: true,
          fallback: true,
          modelUsed: fallbackModel,
          message: 'Model utama gagal, beralih ke parser heuristik lokal aman.',
        });
      } catch (guardErr: any) {
        console.warn(`Fallback prompt guard (${fallbackModel}) failed:`, guardErr?.message);
        return sendJson(res, 200, {
          fallback: true,
          error: guardErr?.message,
        });
      }
    } else {
      // Generative fallback
      try {
        const fallbackResponse = await client.chat.completions.create({
          model: fallbackModel,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: input },
          ],
          temperature: 0.1,
        });

        const rawJson = fallbackResponse.choices[0]?.message?.content?.trim();
        if (rawJson) {
          const cleanJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (parsed && typeof parsed === 'object') {
            parsed.category = normalizeCategory(parsed.category);
            return sendJson(res, 200, {
              success: true,
              result: parsed,
              modelUsed: fallbackModel,
            });
          }
        }
      } catch (fallbackErr: any) {
        console.warn(`Fallback generative model (${fallbackModel}) failed:`, fallbackErr?.message);
      }

      return sendJson(res, 200, {
        fallback: true,
        message: 'Parsing AI gagal, beralih ke parser heuristik lokal.',
      });
    }
  } catch (err: any) {
    if (err.message?.includes('tidak aman')) {
      return sendJson(res, 400, { error: err.message, unsafe: true });
    }
    return sendJson(res, 200, {
      fallback: true,
      error: err.message,
    });
  }
}
