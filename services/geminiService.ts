import { compressImageDataUri } from '../utils/imageUtils';

const API_TIMEOUT = 30_000; // 30秒

export const extractCardData = async (base64Image: string): Promise<any> => {
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image: payload }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      // サーバー側で日本語化済みのメッセージはそのまま使う
      if (err?.error && !err.error.startsWith('{')) throw new Error(err.error);
      if (response.status === 413) throw new Error('画像サイズが大きすぎます。もう一度撮影してください。');
      if (response.status === 429) throw new Error('AI解析の利用上限に達しました。しばらく時間をおいてから再度お試しください。');
      if (response.status === 504 || response.status === 524) throw new Error('AI解析がタイムアウトしました。もう一度お試しください。');
      if (response.status === 503) throw new Error('AIが混雑しています。30秒ほど待ってから再試行してください。');
      if (response.status >= 500) throw new Error(`AIサーバーで一時的なエラーが発生しました（${response.status}）。しばらく待って再試行してください。`);
      throw new Error(`通信エラー（${response.status}）。もう一度お試しください。`);
    }

    return response.json();
  } catch (e: any) {
    if (e.name === 'AbortError') {
      throw new Error('AI解析がタイムアウトしました。もう一度お試しください。');
    }
    if (!navigator.onLine) {
      throw new Error('オフラインです。ネットワーク接続を確認してください。');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
};
