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

8. Return empty string "" for any field not found on the card.

9. CARD CORNERS (CRITICAL — read carefully):
   Detect the FOUR PHYSICAL OUTER CORNERS of the business card paper itself —
   the four points where the card's edges meet. NOT the corners of any logo,
   QR code, photo, or text block ON the card.

   Imagine you are tracing the outline of the rectangular paper with a pen.
   The four corners are where you change direction. Those are the points to return.

   Coordinate system:
   - x = horizontal position in the image (0 = left edge, 1 = right edge)
   - y = vertical position in the image (0 = top edge, 1 = bottom edge)
   - Return NORMALIZED values (0.0–1.0) of the original image as captured.

   Orientation:
   - "topLeft" = the corner that, when the card is rotated upright for reading,
      sits at its TOP-LEFT (the corner near the start of the first text line).
   - Then go clockwise: topRight, bottomRight, bottomLeft.

   Sanity check before returning:
   - The four points should roughly enclose the WHOLE visible card paper.
   - Typically the card occupies a large portion of the image, so corner
     coordinates are usually near the image edges (e.g. TL≈(0.05, 0.10),
     BR≈(0.95, 0.85)). Do NOT return tightly-packed coordinates around an
     interior element.
   - If a corner is slightly outside the frame (cropped), EXTRAPOLATE: values
     may go to -0.05 or 1.08 etc.

   Return null for "corners" ONLY if the card is unrecognizably distorted or
   mostly out of frame. Otherwise ALWAYS return the four corners.`,
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
          corners: {
            type: Type.OBJECT,
            nullable: true,
            description: 'Four corners of the card in normalized image coordinates (0..1), oriented so topLeft is the human-readable top-left of the card. Null if corners cannot be determined reliably.',
            properties: {
              topLeft:     { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ['x', 'y'] },
              topRight:    { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ['x', 'y'] },
              bottomRight: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ['x', 'y'] },
              bottomLeft:  { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } }, required: ['x', 'y'] },
            },
            required: ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'],
          },
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
