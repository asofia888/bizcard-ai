import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal Express-like req/res helpers
function createReq(body?: any) {
  return { body: body ?? {} } as any;
}

function createRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

let handler: (req: any, res: any) => Promise<void>;
let mockGenerateContent: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();

  mockGenerateContent = vi.fn();

  // Mock @google/genai with function constructor (not arrow)
  vi.doMock('@google/genai', () => ({
    GoogleGenAI: function () {
      return { models: { generateContent: mockGenerateContent } };
    },
    Type: { OBJECT: 'OBJECT', STRING: 'STRING', INTEGER: 'INTEGER' },
  }));

  // Mock express to capture the route handler
  const capturedHandlers: Record<string, any> = {};
  const mockApp = {
    use: vi.fn(),
    post: vi.fn((path: string, fn: any) => {
      capturedHandlers[`POST ${path}`] = fn;
    }),
    get: vi.fn(),
    listen: vi.fn(),
  };

  vi.doMock('express', () => {
    const expressFn: any = function () { return mockApp; };
    expressFn.json = () => vi.fn();
    expressFn.static = () => vi.fn();
    return { default: expressFn };
  });

  // Set GEMINI_API_KEY by default (individual tests can override)
  process.env.GEMINI_API_KEY = 'test-key';

  await import('../../server/index.ts');
  handler = capturedHandlers['POST /api/extract'];
});

describe('POST /api/extract', () => {
  it('returns 500 when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;
    const req = createReq({ base64Image: 'abc' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('GEMINI_API_KEY');
  });

  it('returns 400 when body has no base64Image', async () => {
    const req = createReq({});
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('base64Image');
  });

  it('returns 400 when base64Image is not a string', async () => {
    const req = createReq({ base64Image: 12345 });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toContain('base64Image');
  });

  it('returns 200 with parsed JSON on success', async () => {
    const mockData = { name: '田中太郎', company: 'テスト株式会社' };
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify(mockData),
    });

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockData);
  });

  it('returns 500 when Gemini returns empty response', async () => {
    mockGenerateContent.mockResolvedValue({ text: '' });

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Empty response');
  });

  it('returns 500 when Gemini returns null text', async () => {
    mockGenerateContent.mockResolvedValue({ text: null });

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Empty response');
  });

  it('returns 500 with error message when Gemini throws', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API quota exceeded'));

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('API quota exceeded');
  });
});
