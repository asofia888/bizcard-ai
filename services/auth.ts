import { timingSafeEqual } from 'node:crypto';

/**
 * 個人利用前提の簡易アクセス制御。
 * サーバー環境変数 APP_ACCESS_TOKEN とリクエストヘッダー X-App-Token の一致を検証する。
 * APP_ACCESS_TOKEN 未設定時は拒否（設定忘れでエンドポイントが無防備になるのを防ぐ）。
 */
export type AuthResult = { ok: true } | { ok: false; status: number; error: string };

export function verifyAccessToken(headerValue: unknown): AuthResult {
  const expected = process.env.APP_ACCESS_TOKEN;
  if (!expected) {
    return {
      ok: false,
      status: 500,
      error: 'APP_ACCESS_TOKEN is not configured on the server.',
    };
  }

  const actual = typeof headerValue === 'string' ? headerValue : '';
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  // timingSafeEqual は長さ不一致で例外を投げるため先に比較する（長さの一致自体は秘密情報ではない）
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      status: 401,
      error: 'アクセストークンが正しくありません。設定画面で確認してください。',
    };
  }

  return { ok: true };
}
