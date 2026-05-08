import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractCardData } from '../../services/geminiService';

const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine');

function mockOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockOnLine(true);
});

afterEach(() => {
  if (originalOnLine) {
    Object.defineProperty(navigator, 'onLine', originalOnLine);
  }
});

describe('extractCardData', () => {
  it('sends POST with correct URL, method, body, and signal', async () => {
    const mockData = { name: 'Test', company: 'Corp' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await extractCardData('base64data');

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/extract',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: 'base64data' }),
        signal: expect.any(AbortSignal),
      })
    );
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

  it('throws offline error when navigator.onLine is false before fetch', async () => {
    mockOnLine(false);

    await expect(extractCardData('base64data')).rejects.toThrow('オフライン');
    expect(global.fetch).toBeUndefined;
  });

  it('throws timeout error when fetch is aborted', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      const error = new DOMException('The operation was aborted.', 'AbortError');
      return Promise.reject(error);
    });

    await expect(extractCardData('base64data')).rejects.toThrow('タイムアウト');
  });

  it('re-checks online status on non-abort fetch error', async () => {
    global.fetch = vi.fn().mockImplementation(() => {
      // Simulate going offline during fetch
      mockOnLine(false);
      return Promise.reject(new TypeError('Failed to fetch'));
    });

    await expect(extractCardData('base64data')).rejects.toThrow('オフライン');
  });
});
