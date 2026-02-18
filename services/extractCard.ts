import { GoogleGenAI, Type } from '@google/genai';

export class ExtractError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

export async function extractCard(apiKey: string, base64Image: string): Promise<Record<string, unknown>> {
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
    throw new ExtractError('Empty response from Gemini API.', 500);
  }

  try {
    return JSON.parse(text);
  } catch {
    console.error('Gemini returned invalid JSON:', text);
    throw new ExtractError('AIの応答を解析できませんでした。', 502);
  }
}
