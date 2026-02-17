import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractCard, ExtractError } from '../services/extractCard';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 3001;

// --- Gemini API endpoint ---
app.post('/api/extract', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
    return;
  }

  const { base64Image } = req.body;
  if (!base64Image || typeof base64Image !== 'string') {
    res.status(400).json({ error: 'base64Image is required.' });
    return;
  }

  try {
    const parsed = await extractCard(apiKey, base64Image);
    res.json(parsed);
  } catch (error: any) {
    console.error('Gemini API Error:', error);
    const status = error instanceof ExtractError ? error.statusCode : 500;
    res.status(status).json({ error: error.message || 'Gemini API call failed.' });
  }
});

// --- Static files (production) ---
const distPath = path.resolve(__dirname, '..', 'dist');
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
