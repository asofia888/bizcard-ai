import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractCardData } from '../../services/geminiService';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('extractCardData', () => {
  it('sends POST with correct URL, method, and body', async () => {
    const mockData = { name: 'Test', company: 'Corp' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await extractCardData('base64data');

    expect(global.fetch).toHaveBeenCalledWith('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image: 'base64data' }),
    });
  });

  it('returns parsed JSON on success', async () => {
    const mockData = { name: '田中', company: 'テスト社' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await extractCardData('base64data');
    expect(result).toEqual(mockData);
  });

  it('throws with error message from JSON error body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'API key missing' }),
    });

    await expect(extractCardData('base64data')).rejects.toThrow('API key missing');
  });

  it('throws with fallback message when error body is not JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(extractCardData('base64data')).rejects.toThrow('Server error');
  });
});
