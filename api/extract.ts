import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

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

  const ai = new GoogleGenAI({ apiKey });
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: cleanBase64,
            },
          },
          {
            text: `この名刺画像を解析し、以下の情報を抽出してください。

【解析要件】
1. 多言語対応（日本語、英語、中国語、タイ語など）。翻訳せず原文のまま抽出してください。
2. 住所や電話番号、ドメイン情報から「国（Country）」を推測してください（例: 日本, USA, China）。
3. 画像が回転している、または傾いている場合、文字を水平に正立させるために必要な「回転角度（時計回りの度数）」を推定してください（例: 0, 90, 180, 270, または 5, -5 などの微調整）。
4. 名刺に手書きのメモや、項目に当てはまらない特記事項がある場合は「note」に抽出してください。

項目が見つからない場合は空文字を返してください。`,
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
      return res.status(500).json({ error: 'Empty response from Gemini API.' });
    }
    return res.status(200).json(JSON.parse(text));
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: error.message || 'Gemini API call failed.' });
  }
}
