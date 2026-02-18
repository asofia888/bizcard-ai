import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

class ExtractError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

async function extractCard(apiKey: string, base64Image: string): Promise<Record<string, unknown>> {
  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: cleanBase64,
          },
        },
        {
          text: `Analyze this business card image and extract the following information.
この名刺画像を解析し、情報を抽出してください。
วิเคราะห์นามบัตรนี้และดึงข้อมูลต่อไปนี้

[Rules / 解析要件 / กฎ]
1. The card may be in Japanese, English, Thai, Chinese, or any other language. Extract text AS-IS — do NOT translate.
   名刺は日本語・英語・タイ語・中国語など多言語に対応。翻訳せず原文のまま抽出してください。

2. THAI cards (ภาษาไทย):
   - Names appear in Thai script and/or romanized English. Extract both if present (Thai script first).
   - Phone numbers: local format 0X-XXXX-XXXX or international +66-X-XXXX-XXXX.
   - Country = "Thailand" or "ประเทศไทย". Domain .th → Thailand.

3. ENGLISH cards:
   - Names follow "First Last", "Last, First", or include honorifics (Mr./Ms./Dr.).
   - Extract the full name as printed without abbreviation.

4. JAPANESE cards (日本語):
   - Names may be in kanji/hiragana/katakana with furigana above; extract the main name.
   - Phone: 0X-XXXX-XXXX or +81-X-XXXX-XXXX. Domain .co.jp / .jp → Japan.

5. Detect COUNTRY from: phone prefix (+66=Thailand, +81=Japan, +1=USA/Canada, +86=China, +44=UK),
   domain (.th, .co.th=Thailand; .co.jp, .jp=Japan; .cn=China; .au=Australia),
   or the language/script of the card text.

6. If the image is rotated or tilted, estimate the CLOCKWISE rotation angle needed to make text upright
   (e.g. 0, 90, 180, 270, or fine adjustments like 5, -5).

7. Extract handwritten notes or uncategorized details into "note".

8. Return empty string "" for any field not found on the card.`,
        },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'Full Name (氏名)' },
          title: { type: Type.STRING, description: 'Job Title (役職)' },
          company: { type: Type.STRING, description: 'Company Name (会社名)' },
          country: { type: Type.STRING, description: 'Country detected from address/phone (国)' },
          email: { type: Type.STRING, description: 'Email Address' },
          phone: { type: Type.STRING, description: 'Phone Number' },
          website: { type: Type.STRING, description: 'Website URL' },
          address: { type: Type.STRING, description: 'Address (住所)' },
          note: { type: Type.STRING, description: 'Handwritten notes or extra information (手書きメモや備考)' },
          rotation: { type: Type.INTEGER, description: 'Rotation angle in degrees to make text upright (e.g. 90, 180). 0 if upright.' },
        },
        required: ['name', 'company'],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new ExtractError('Empty response from Gemini API.', 500);
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error('Gemini returned invalid JSON:', text);
    throw new ExtractError('AIの応答を解析できませんでした。', 502);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
  }

  const { base64Image } = req.body;
  if (!base64Image || typeof base64Image !== 'string') {
    return res.status(400).json({ error: 'base64Image is required.' });
  }

  try {
    const parsed = await extractCard(apiKey, base64Image);
    return res.status(200).json(parsed);
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const status = error instanceof ExtractError ? error.statusCode : 500;
    return res.status(status).json({ error: error.message || 'Gemini API call failed.' });
  }
}
