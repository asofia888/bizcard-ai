const API_TIMEOUT = 30_000; // 30秒

export const extractCardData = async (base64Image: string): Promise<any> => {
  if (!navigator.onLine) {
    throw new Error('オフラインです。ネットワーク接続を確認してください。');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Image }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      if (err?.error) throw new Error(err.error);
      if (response.status === 413) throw new Error('画像サイズが大きすぎます。もう一度撮影してください。');
      if (response.status === 504 || response.status === 524) throw new Error('AI解析がタイムアウトしました。もう一度お試しください。');
      if (response.status >= 500) throw new Error(`サーバーエラー（${response.status}）。しばらく待って再試行してください。`);
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
