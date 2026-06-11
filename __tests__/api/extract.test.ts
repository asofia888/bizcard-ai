import { describe, it, expect, vi, beforeEach } from 'vitest';

const TEST_TOKEN = 'test-access-token';

// Minimal Express-like req/res helpers
function createReq(body?: any, headers?: Record<string, string>) {
  return {
    body: body ?? {},
    headers: headers ?? { 'x-app-token': TEST_TOKEN },
  } as any;
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
let mockExtractCard: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();

  mockExtractCard = vi.fn();

  // Mock the shared extractCard module
  vi.doMock('../../services/extractCard', () => ({
    extractCard: mockExtractCard,
    ExtractError: class ExtractError extends Error {
      statusCode: number;
      constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
      }
    },
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

  // Set GEMINI_API_KEY / APP_ACCESS_TOKEN by default (individual tests can override)
  process.env.GEMINI_API_KEY = 'test-key';
  process.env.APP_ACCESS_TOKEN = TEST_TOKEN;

  await import('../../server/index.ts');
  handler = capturedHandlers['POST /api/extract'];
});

describe('POST /api/extract', () => {
  it('returns 500 when APP_ACCESS_TOKEN is not configured on the server', async () => {
    delete process.env.APP_ACCESS_TOKEN;
    const req = createReq({ base64Image: 'abc' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('APP_ACCESS_TOKEN');
  });

  it('returns 401 when x-app-token header is missing', async () => {
    const req = createReq({ base64Image: 'abc' }, {});
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('アクセストークン');
  });

  it('returns 401 when x-app-token header is wrong', async () => {
    const req = createReq({ base64Image: 'abc' }, { 'x-app-token': 'wrong-token' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('アクセストークン');
  });

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
    mockExtractCard.mockResolvedValue(mockData);

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(mockData);
  });

  it('returns 500 when extractCard throws ExtractError with empty response', async () => {
    const { ExtractError } = await import('../../services/extractCard');
    mockExtractCard.mockRejectedValue(new ExtractError('Empty response from Gemini API.', 500));

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('Empty response');
  });

  it('returns 502 when extractCard throws ExtractError with invalid JSON', async () => {
    const { ExtractError } = await import('../../services/extractCard');
    mockExtractCard.mockRejectedValue(new ExtractError('AIの応答を解析できませんでした。', 502));

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(502);
    expect(res.body.error).toContain('AIの応答を解析できませんでした');
  });

  it('returns 500 with error message when extractCard throws generic error', async () => {
    mockExtractCard.mockRejectedValue(new Error('API quota exceeded'));

    const req = createReq({ base64Image: 'validbase64data' });
    const res = createRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('API quota exceeded');
  });
});
