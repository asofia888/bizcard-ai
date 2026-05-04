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

// 名刺標準サイズ (91mm × 55mm)。横向き=91/55、縦向き=55/91。
const CARD_ASPECT_LANDSCAPE = 91 / 55;
const CARD_ASPECT_PORTRAIT  = 55 / 91;
const MAX_OUTPUT_DIMENSION = 2000;

// ─── 8x8 線形方程式 (ピボット選択付きガウス消去法) ────────────────────────
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

// 4 点対応からホモグラフィ係数 (h22=1 の 8 自由度) を計算する。
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

// 角がフレームから少しはみ出している場合（推定値）も許容してクランプする
const CORNER_OVERFLOW_TOLERANCE = 0.15;

export function isValidCorners(c: unknown): c is Corners {
  if (!c || typeof c !== 'object') return false;
  const corners = c as Record<string, unknown>;
  for (const key of ['topLeft', 'topRight', 'bottomRight', 'bottomLeft']) {
    const p = corners[key] as { x?: unknown; y?: unknown } | undefined;
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number') return false;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
    const lo = -CORNER_OVERFLOW_TOLERANCE;
    const hi = 1 + CORNER_OVERFLOW_TOLERANCE;
    if (p.x < lo || p.x > hi || p.y < lo || p.y > hi) return false;
  }
  return true;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function normalizeCorners(c: Corners): Corners {
  return {
    topLeft:     { x: clamp01(c.topLeft.x),     y: clamp01(c.topLeft.y) },
    topRight:    { x: clamp01(c.topRight.x),    y: clamp01(c.topRight.y) },
    bottomRight: { x: clamp01(c.bottomRight.x), y: clamp01(c.bottomRight.y) },
    bottomLeft:  { x: clamp01(c.bottomLeft.x),  y: clamp01(c.bottomLeft.y) },
  };
}

// ─── 共通: 出力サイズとホモグラフィ係数を計算する ────────────────────────
interface Transform {
  outW: number;
  outH: number;
  /** 出力ピクセル → ソースピクセルへの 8 要素ホモグラフィ (h22=1 を省略) */
  matrix: number[];
}

function buildTransform(srcW: number, srcH: number, c: Corners): Transform {
  const srcCorners: Point[] = [
    { x: c.topLeft.x     * srcW, y: c.topLeft.y     * srcH },
    { x: c.topRight.x    * srcW, y: c.topRight.y    * srcH },
    { x: c.bottomRight.x * srcW, y: c.bottomRight.y * srcH },
    { x: c.bottomLeft.x  * srcW, y: c.bottomLeft.y  * srcH },
  ];

  const widthTop    = Math.hypot(srcCorners[1].x - srcCorners[0].x, srcCorners[1].y - srcCorners[0].y);
  const widthBot    = Math.hypot(srcCorners[2].x - srcCorners[3].x, srcCorners[2].y - srcCorners[3].y);
  const heightLeft  = Math.hypot(srcCorners[3].x - srcCorners[0].x, srcCorners[3].y - srcCorners[0].y);
  const heightRight = Math.hypot(srcCorners[2].x - srcCorners[1].x, srcCorners[2].y - srcCorners[1].y);

  const detectedW = Math.max(widthTop, widthBot);
  const detectedH = Math.max(heightLeft, heightRight);

  const targetAspect = detectedW >= detectedH ? CARD_ASPECT_LANDSCAPE : CARD_ASPECT_PORTRAIT;

  let outW: number;
  let outH: number;
  if (detectedW / detectedH > targetAspect) {
    outW = Math.round(detectedW);
    outH = Math.round(detectedW / targetAspect);
  } else {
    outH = Math.round(detectedH);
    outW = Math.round(detectedH * targetAspect);
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
  const matrix = computePerspectiveMatrix(dstCorners, srcCorners);

  return { outW, outH, matrix };
}

// ─── 公開 API: WebGL → CPU の順でフォールバック ─────────────────────────
export async function perspectiveCorrect(
  imageDataUri: string,
  cornersNormalized: Corners,
  jpegQuality = 0.9
): Promise<string> {
  try {
    const result = await perspectiveCorrectWebGL(imageDataUri, cornersNormalized, jpegQuality);
    return result;
  } catch (err) {
    console.warn('[BizCard] WebGL 透視補正に失敗。CPU 版にフォールバックします。', err);
    return perspectiveCorrectCPU(imageDataUri, cornersNormalized, jpegQuality);
  }
}

// ─── WebGL 実装: フラグメントシェーダで GPU 上で再サンプリング ──────────
async function perspectiveCorrectWebGL(
  imageDataUri: string,
  cornersNormalized: Corners,
  jpegQuality: number,
): Promise<string> {
  const img = await loadImage(imageDataUri);
  const srcW = img.width;
  const srcH = img.height;
  const { outW, outH, matrix } = buildTransform(srcW, srcH, cornersNormalized);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const gl = canvas.getContext('webgl', {
    preserveDrawingBuffer: true,
    antialias: false,
    premultipliedAlpha: false,
  });
  if (!gl) throw new Error('WebGL is not supported');

  const vsSource = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;
  // 出力 uv → 出力ピクセル座標 → ホモグラフィでソースピクセル座標 → ソース uv → texture2D
  const fsSource = `
    precision highp float;
    uniform sampler2D u_image;
    uniform mat3 u_h;
    uniform vec2 u_outSize;
    uniform vec2 u_srcSize;
    varying vec2 v_uv;
    void main() {
      // toDataURL は y 反転して書き出すので、出力ピクセル座標を y 反転で取り出す
      vec2 outPx = vec2(v_uv.x, 1.0 - v_uv.y) * u_outSize;
      vec3 srcHom = u_h * vec3(outPx, 1.0);
      vec2 srcUV = (srcHom.xy / srcHom.z) / u_srcSize;
      if (srcUV.x < 0.0 || srcUV.x > 1.0 || srcUV.y < 0.0 || srcUV.y > 1.0) {
        gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
      } else {
        gl_FragColor = texture2D(u_image, srcUV);
      }
    }
  `;

  let vs: WebGLShader | null = null;
  let fs: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let buf: WebGLBuffer | null = null;
  let tex: WebGLTexture | null = null;

  try {
    vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
    fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
    program = gl.createProgram();
    if (!program) throw new Error('Failed to create WebGL program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }
    gl.useProgram(program);

    // フルスクリーン三角形 2 枚
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1,  1,
      -1,  1,  1, -1,   1,  1,
    ]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // テクスチャ (画像をそのままアップロード)
    // ※ FLIP_Y は使わない。シェーダ側で image 座標(y=0 が上)を使う前提で
    //   サンプリングするため、画像も image 座標で texture に載せる。
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // ユニフォーム
    gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0);
    gl.uniform2f(gl.getUniformLocation(program, 'u_outSize'), outW, outH);
    gl.uniform2f(gl.getUniformLocation(program, 'u_srcSize'), srcW, srcH);
    // matrix = [a, b, c, d, e, f, g, h]、h22 = 1
    // mat3 は列優先: [a, d, g, b, e, h, c, f, 1]
    gl.uniformMatrix3fv(
      gl.getUniformLocation(program, 'u_h'),
      false,
      new Float32Array([
        matrix[0], matrix[3], matrix[6],
        matrix[1], matrix[4], matrix[7],
        matrix[2], matrix[5], 1,
      ])
    );

    // 描画
    gl.viewport(0, 0, outW, outH);
    gl.clearColor(1, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 出力 (toDataURL が同期的に framebuffer を読み出す)
    const dataURL = canvas.toDataURL('image/jpeg', jpegQuality);
    return dataURL;
  } finally {
    if (tex) gl.deleteTexture(tex);
    if (buf) gl.deleteBuffer(buf);
    if (program) gl.deleteProgram(program);
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile error: ' + log);
  }
  return shader;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for perspective correction'));
    img.src = src;
  });
}

// ─── CPU 実装: WebGL が使えない環境向けのフォールバック ─────────────────
async function perspectiveCorrectCPU(
  imageDataUri: string,
  cornersNormalized: Corners,
  jpegQuality: number,
): Promise<string> {
  const img = await loadImage(imageDataUri);
  const srcW = img.width;
  const srcH = img.height;
  const { outW, outH, matrix: m } = buildTransform(srcW, srcH, cornersNormalized);

  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('Canvas context unavailable');
  srcCtx.drawImage(img, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = outW;
  dstCanvas.height = outH;
  const dstCtx = dstCanvas.getContext('2d');
  if (!dstCtx) throw new Error('Canvas context unavailable');
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
  return dstCanvas.toDataURL('image/jpeg', jpegQuality);
}
