import type { VercelRequest, VercelResponse } from '@vercel/node';
import { extractCard, ExtractError } from '../services/extractCard';

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
