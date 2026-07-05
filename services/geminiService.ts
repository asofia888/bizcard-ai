import { compressImageDataUri } from '../utils/imageUtils';
import type { BusinessCard } from '../types';

const API_TIMEOUT = 30_000; // 30秒

// AI解析APIのアクセストークン（サーバーの APP_ACCESS_TOKEN と一致させる）の保存先
export const ACCESS_TOKEN_STORAGE_KEY = 'bizcard_access_token';

/** AI解析結果: 名刺のテキストフィールド + 画像を正立させる回転角 */
export type ExtractedCardData = Partial<
  Pick<BusinessCard, 'name' | 'title' | 'company' | 'country' | 'email' | 'phone' | 'website' | 'address' | 'note'>
> & { rotation?: number };

const EXTRACT_STRING_FIELDS = [
  'name', 'title', 'company', 'country', 'email', 'phone', 'website', 'address', 'note',
] as const;

/**
 * サーバー応答を検証し、既知のフィールドを正しい型の場合のみ採用する。
 * サーバー側で responseSchema を指定しているが、AI応答の揺れや想定外のフィールドが
 * そのままフォーム state に流れ込まないようクライアント側でも防御する。
 */
export function sanitizeExtractResult(raw: unknown): ExtractedCardData {
  const result: ExtractedCardData = {};
  if (typeof raw !== 'object' || raw === null) return result;
  const obj = raw as Record<string, unknown>;
  for (const key of EXTRACT_STRING_FIELDS) {
    const v = obj[key];
    if (typeof v === 'string') result[key] = v;
  }
  if (typeof obj.rotation === 'number' && Number.isFinite(obj.rotation)) {
    result.rotation = obj.rotation;
  }
  return result;
}

export const extractCardData = async (base64Image: string): Promise<ExtractedCardData> => {
  if (!navigator.onLine) {
    throw new Error('オフラインです。ネットワーク接続を確認してください。');
  }

  // サーバ側 body 上限 (Express/Vercel 共に 25MB) より十分小さく抑え、
  // ネットワーク帯域と Gemini の応答時間を改善する。
  const payload = await compressImageDataUri(base64Image);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-App-Token': localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '',
      },
      body: JSON.stringify({ base64Image: payload }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      // サーバー側で日本語化済みのメッセージはそのまま使う
      if (err?.error && !err.error.startsWith('{')) throw new Error(err.error);
      if (response.status === 401) throw new Error('アクセストークンが未設定か正しくありません。設定画面で入力してください。');
      if (response.status === 413) throw new Error('画像サイズが大きすぎます。もう一度撮影してください。');
      if (response.status === 429) throw new Error('AI解析の利用上限に達しました。しばらく時間をおいてから再度お試しください。');
      if (response.status === 504 || response.status === 524) throw new Error('AI解析がタイムアウトしました。もう一度お試しください。');
      if (response.status === 503) throw new Error('AIが混雑しています。30秒ほど待ってから再試行してください。');
      if (response.status >= 500) throw new Error(`AIサーバーで一時的なエラーが発生しました（${response.status}）。しばらく待って再試行してください。`);
      throw new Error(`通信エラー（${response.status}）。もう一度お試しください。`);
    }

    return sanitizeExtractResult(await response.json());
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('AI解析がタイムアウトしました。もう一度お試しください。', { cause: e });
    }
    if (!navigator.onLine) {
      throw new Error('オフラインです。ネットワーク接続を確認してください。', { cause: e });
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
};
