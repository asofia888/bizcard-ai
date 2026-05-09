export const MAX_DIMENSION = 2000;
export const JPEG_QUALITY = 0.88;
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

/**
 * <input type="file"> で選択された 1 ファイルを data URI に変換する。
 * PDF なら 1 ページ目を JPEG 化、それ以外は画像として読み込む。
 */
export const pickFileToDataUri = async (file: File): Promise<string> => {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  return isPdf ? pdfToImage(file) : fileToDataUri(file);
};

/**
 * <input type="file"> 全般で使うファイル種別フィルタ。
 * iOS Safari は accept に image/* を含めると OS アクションシート
 * (写真ライブラリ / 写真を撮る / ファイル) を必ず出してしまう。
 * 拡張子のみで指定すると Files アプリ直行になり、Files から写真も選べる。
 */
export const FILE_PICKER_ACCEPT =
  '.pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.gif';

import { useEffect, useState } from 'react';

// 画像 (data URI / URL) の自然サイズから「W/H」のアスペクト比を返す。
// 名刺プレビューの縦横自動切り替えに使う。
export function useImageAspect(src: string | null | undefined): number | undefined {
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!src) { setAspect(undefined); return; }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      if (img.width > 0 && img.height > 0) setAspect(img.width / img.height);
    };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return aspect;
}

/**
 * PDF ファイルの 1 ページ目を JPEG (data URI) に変換する。
 * pdf.js を遅延ロードしてバンドルサイズへの影響を抑える。
 */
export const pdfToImage = async (file: File): Promise<string> => {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('ファイルサイズが大きすぎます（上限: 20MB）。');
  }
  // 遅延ロード: PDF を選んだ人だけが pdf.js を取得する
  const pdfjs: any = await import('pdfjs-dist');
  // Vite 用に worker をモジュールとして解決
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  if (pdf.numPages < 1) throw new Error('PDFにページがありません。');
  const page = await pdf.getPage(1);

  // viewport の自然サイズを取得し、長辺が MAX_DIMENSION になるようスケールを決定
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(4, MAX_DIMENSION / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context を取得できません。');

  // 背景を白で塗ってから描画（透明PDFでJPEG化したときに黒くならないように）
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

/**
 * 画像ファイルを最大寸法 MAX_DIMENSION の JPEG (data URI) に変換する。
 * iOS の書類スキャン保存ファイルなど、任意の画像/HEIC を取り込める。
 */
export const fileToDataUri = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error('ファイルサイズが大きすぎます（上限: 20MB）。'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      const original = reader.result as string;
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', JPEG_QUALITY));
        } else {
          resolve(original);
        }
      };
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
      img.src = original;
    };
    reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました。'));
    reader.readAsDataURL(file);
  });
};

/**
 * リスト描画用の小さいサムネ画像を生成する (デフォルト最大 200px)。
 * 200px JPEG はおよそ 5〜15KB 程度に収まる。
 */
export async function generateThumbnail(
  dataUri: string,
  maxDim: number = 200,
  quality: number = 0.72,
): Promise<string> {
  const img = await loadHtmlImage(dataUri);
  return reencodeJpeg(img, maxDim, quality);
}

/**
 * data URI のおおよそのバイト数を返す (base64 部分のみ計上)。
 */
function approxByteSize(dataUri: string): number {
  const comma = dataUri.indexOf(',');
  const base64 = comma >= 0 ? dataUri.slice(comma + 1) : dataUri;
  // base64 は 4 文字で 3 バイトを表現、末尾の '=' パディングは無視で十分な近似
  return Math.floor((base64.length * 3) / 4);
}

function reencodeJpeg(img: HTMLImageElement, maxDim: number, quality: number): string {
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/jpeg', quality);
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = src;
  });
}

/**
 * AI 解析 API 送信用に画像 data URI を圧縮する。
 * - 既に targetBytes 以下ならそのまま返す
 * - 超えていれば maxDim と JPEG 品質を段階的に下げて再エンコードする
 *
 * Express body limit (25MB) と Vercel limit (25MB) の両方で十分マージンを取るため、
 * デフォルトは 6MB を目標にする。
 */
export async function compressImageDataUri(
  dataUri: string,
  targetBytes: number = 6 * 1024 * 1024,
): Promise<string> {
  if (approxByteSize(dataUri) <= targetBytes) return dataUri;

  let img: HTMLImageElement;
  try {
    img = await loadHtmlImage(dataUri);
  } catch {
    // 圧縮できない場合は元のままで送る (上位でサーバ側 413 を捕捉)
    return dataUri;
  }

  const candidates: Array<[number, number]> = [
    [2000, 0.7],
    [1800, 0.6],
    [1500, 0.55],
    [1200, 0.5],
    [1000, 0.4],
  ];

  for (const [maxDim, quality] of candidates) {
    try {
      const out = reencodeJpeg(img, maxDim, quality);
      if (approxByteSize(out) <= targetBytes) return out;
    } catch {
      // canvas エラー等は次の段階へ
    }
  }

  // 最終手段: 最も小さく、品質も最低に
  try {
    return reencodeJpeg(img, 800, 0.35);
  } catch {
    return dataUri;
  }
}

export const rotateImage = (base64Str: string, degrees: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (degrees === 0) {
      resolve(base64Str);
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject('No context');

      const rad = (degrees * Math.PI) / 180;
      const sin = Math.abs(Math.sin(rad));
      const cos = Math.abs(Math.cos(rad));

      // Calculate new dimensions
      canvas.width = img.width * cos + img.height * sin;
      canvas.height = img.width * sin + img.height * cos;

      // Fill with white background (optional, cleaner for cards)
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Move origin to center
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = reject;
    img.src = base64Str;
  });
};