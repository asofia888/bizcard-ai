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
      const err = await response.json().catch(() => ({ error: 'Server error' }));
      throw new Error(err.error || `Server responded with ${response.status}`);
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
