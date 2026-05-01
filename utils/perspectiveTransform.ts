export interface Point {
  x: number;
  y: number;
}

export interface Corners {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

const CARD_ASPECT = 91 / 55;
const MAX_OUTPUT_DIMENSION = 2000;

function solve8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxAbs = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > maxAbs) {
        maxAbs = Math.abs(A[k][i]);
        maxRow = k;
      }
    }
    [A[i], A[maxRow]] = [A[maxRow], A[i]];
    [b[i], b[maxRow]] = [b[maxRow], b[i]];

    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }

  const x = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * x[j];
    }
    x[i] = sum / A[i][i];
  }
  return x;
}

function computePerspectiveMatrix(src: Point[], dst: Point[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const s = src[i];
    const d = dst[i];
    A.push([s.x, s.y, 1, 0, 0, 0, -s.x * d.x, -s.y * d.x]);
    A.push([0, 0, 0, s.x, s.y, 1, -s.x * d.y, -s.y * d.y]);
    b.push(d.x);
    b.push(d.y);
  }
  return solve8x8(A, b);
}

export function isValidCorners(c: unknown): c is Corners {
  if (!c || typeof c !== 'object') return false;
  const corners = c as Record<string, unknown>;
  for (const key of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
    const p = corners[key] as { x?: unknown; y?: unknown } | undefined;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return false;
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return false;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  }
  return true;
}

export async function perspectiveCorrect(
  imageDataUri: string,
  cornersNormalized: Corners,
  jpegQuality = 0.9
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const srcW = img.width;
        const srcH = img.height;

        const srcCorners: Point[] = [
          { x: cornersNormalized.topLeft.x * srcW,     y: cornersNormalized.topLeft.y * srcH },
          { x: cornersNormalized.topRight.x * srcW,    y: cornersNormalized.topRight.y * srcH },
          { x: cornersNormalized.bottomRight.x * srcW, y: cornersNormalized.bottomRight.y * srcH },
          { x: cornersNormalized.bottomLeft.x * srcW,  y: cornersNormalized.bottomLeft.y * srcH },
        ];

        const widthTop    = Math.hypot(srcCorners[1].x - srcCorners[0].x, srcCorners[1].y - srcCorners[0].y);
        const widthBot    = Math.hypot(srcCorners[2].x - srcCorners[3].x, srcCorners[2].y - srcCorners[3].y);
        const heightLeft  = Math.hypot(srcCorners[3].x - srcCorners[0].x, srcCorners[3].y - srcCorners[0].y);
        const heightRight = Math.hypot(srcCorners[2].x - srcCorners[1].x, srcCorners[2].y - srcCorners[1].y);

        const detectedW = Math.max(widthTop, widthBot);
        const detectedH = Math.max(heightLeft, heightRight);

        let outW: number;
        let outH: number;
        if (detectedW / detectedH > CARD_ASPECT) {
          outW = Math.round(detectedW);
          outH = Math.round(detectedW / CARD_ASPECT);
        } else {
          outH = Math.round(detectedH);
          outW = Math.round(detectedH * CARD_ASPECT);
        }

        if (outW > MAX_OUTPUT_DIMENSION || outH > MAX_OUTPUT_DIMENSION) {
          const scale = MAX_OUTPUT_DIMENSION / Math.max(outW, outH);
          outW = Math.round(outW * scale);
          outH = Math.round(outH * scale);
        }

        const dstCorners: Point[] = [
          { x: 0,    y: 0 },
          { x: outW, y: 0 },
          { x: outW, y: outH },
          { x: 0,    y: outH },
        ];
        const m = computePerspectiveMatrix(dstCorners, srcCorners);

        const srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW;
        srcCanvas.height = srcH;
        const srcCtx = srcCanvas.getContext('2d');
        if (!srcCtx) return reject(new Error('Canvas context unavailable'));
        srcCtx.drawImage(img, 0, 0);
        const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

        const dstCanvas = document.createElement('canvas');
        dstCanvas.width = outW;
        dstCanvas.height = outH;
        const dstCtx = dstCanvas.getContext('2d');
        if (!dstCtx) return reject(new Error('Canvas context unavailable'));
        const dstImageData = dstCtx.createImageData(outW, outH);
        const dstData = dstImageData.data;

        const a = m[0], b_ = m[1], c = m[2];
        const d_ = m[3], e = m[4], f = m[5];
        const g = m[6], h = m[7];

        for (let y = 0; y < outH; y++) {
          for (let x = 0; x < outW; x++) {
            const w = g * x + h * y + 1;
            const sx = (a * x + b_ * y + c) / w;
            const sy = (d_ * x + e * y + f) / w;
            const idx = (y * outW + x) * 4;

            if (sx < 0 || sx >= srcW - 1 || sy < 0 || sy >= srcH - 1) {
              dstData[idx]     = 255;
              dstData[idx + 1] = 255;
              dstData[idx + 2] = 255;
              dstData[idx + 3] = 255;
              continue;
            }

            const x0 = Math.floor(sx);
            const y0 = Math.floor(sy);
            const dx = sx - x0;
            const dy = sy - y0;
            const i00 = (y0 * srcW + x0) * 4;
            const i10 = i00 + 4;
            const i01 = i00 + srcW * 4;
            const i11 = i01 + 4;

            const w00 = (1 - dx) * (1 - dy);
            const w10 = dx * (1 - dy);
            const w01 = (1 - dx) * dy;
            const w11 = dx * dy;

            dstData[idx]     = srcData[i00]     * w00 + srcData[i10]     * w10 + srcData[i01]     * w01 + srcData[i11]     * w11;
            dstData[idx + 1] = srcData[i00 + 1] * w00 + srcData[i10 + 1] * w10 + srcData[i01 + 1] * w01 + srcData[i11 + 1] * w11;
            dstData[idx + 2] = srcData[i00 + 2] * w00 + srcData[i10 + 2] * w10 + srcData[i01 + 2] * w01 + srcData[i11 + 2] * w11;
            dstData[idx + 3] = 255;
          }
        }

        dstCtx.putImageData(dstImageData, 0, 0);
        resolve(dstCanvas.toDataURL('image/jpeg', jpegQuality));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for perspective correction'));
    img.src = imageDataUri;
  });
}
