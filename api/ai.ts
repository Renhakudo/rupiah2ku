import OpenAI from 'openai';

export const config = {
  maxDuration: 30,
};

export const maxDuration = 30;

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

    const apiKey =
      (req.headers['x-groq-api-key'] as string) ||
      process.env.GROQ_API_KEY ||
      process.env.VITE_GROQ_API_KEY;

    if (!apiKey || !apiKey.trim()) {
      return sendJson(res, 200, {
        fallback: true,
        message: 'Groq API Key belum dikonfigurasi, gunakan parser heuristik lokal.',
      });
    }

    const baseURL =
      process.env.GROQ_BASE_URL ||
      process.env.VITE_GROQ_BASE_URL ||
      'https://api.groq.com/openai/v1';

    const model =
      process.env.GROQ_MODEL ||
      process.env.VITE_GROQ_MODEL ||
      'meta-llama/llama-prompt-guard-2-22m';

    const client = new OpenAI({
      apiKey: apiKey.trim(),
      baseURL,
    });

    if (action === 'prompt-guard' || model.includes('prompt-guard')) {
      const response = await client.chat.completions.create({
        model,
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
      });
    }

    // Generative LLM Extraction
    const systemPrompt = `
Kamu adalah asisten keuangan pintar. Ekstrak data transaksi dari kalimat input bahasa Indonesia.
Tanggal hari ini adalah: ${currentDate || new Date().toISOString().slice(0, 10)}.
Jika input menyatakan "kemarin", "tadi", "hari ini", kurangi/sesuaikan dari tanggal tersebut ke dalam format YYYY-MM-DD.

Kategori yang diperbolehkan hanya: [salary, business, investment, food, transport, shopping, bills, entertainment, other].
Pilih kategori yang PALING TEPAT. Jika sama sekali tidak ada yang cocok, gunakan "other".

Format Output harus strictly JSON:
{
  "type": "expense" atau "income",
  "amount": angka murni (tanpa titik/koma, contoh: 50000),
  "category": "salah satu kategori di atas",
  "description": "catatan singkat",
  "date": "YYYY-MM-DD"
}
`;

    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      temperature: 0.1,
    });

    const rawJson = response.choices[0]?.message?.content;
    if (rawJson) {
      const parsed = JSON.parse(rawJson);
      return sendJson(res, 200, {
        success: true,
        result: parsed,
      });
    }

    return sendJson(res, 200, { fallback: true });
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
