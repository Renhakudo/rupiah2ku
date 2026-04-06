import OpenAI from "openai";

const client = new OpenAI({
  apiKey: import.meta.env.VITE_GROQ_API_KEY,
  baseURL: import.meta.env.VITE_GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  dangerouslyAllowBrowser: true,
});

export interface ParsedTransaction {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category: string;
  description: string;
  date: string; // YYYY-MM-DD
}

export async function parseTransactionWithAI(input: string): Promise<ParsedTransaction> {
  if (!import.meta.env.VITE_GROQ_API_KEY) {
    throw new Error('Groq API Key is not configured in environment variables.');
  }

  const currentDate = new Date().toISOString().split('T')[0];

  const response = await client.chat.completions.create({
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
Kamu adalah asisten keuangan pintar. Ekstrak data transaksi dari kalimat input bahasa Indonesia.
Tanggal hari ini adalah: ${currentDate}.
Jika input menyatakan "kemarin", "tadi", "hari ini", kurangi/sesuaikan dari tanggal tersebut ke dalam format YYYY-MM-DD.

Kategori yang diperbolehkan hanya: [salary, business, investment, food, transport, shopping, bills, entertainment, other].
Pilih kategori yang PALING TEPAT. Jika sama sekali tidak ada yang cocok, gunakan "other".

Format Output harus *strictly* JSON:
{
  "type": "expense" atau "income",
  "amount": angka murni (tanpa titik/koma, contoh: 50000),
  "category": "salah satu kategori di atas",
  "description": "catatan singkat",
  "date": "YYYY-MM-DD"
}
        `,
      },
      {
        role: "user",
        content: input,
      },
    ],
    temperature: 0.1,
  });

  const rawJson = response.choices[0].message.content;
  if (!rawJson) throw new Error("Gagal mendapatkan respons AI.");
  
  try {
    const parsed = JSON.parse(rawJson);
    return parsed as ParsedTransaction;
  } catch (e) {
    throw new Error("AI mengembalikan format JSON yang tidak valid.");
  }
}