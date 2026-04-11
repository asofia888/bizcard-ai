const BRAND_GRADIENTS = [
  { from: 'from-brand-500', to: 'to-brand-700' },
  { from: 'from-brand-400', to: 'to-brand-600' },
  { from: 'from-brand-600', to: 'to-brand-800' },
  { from: 'from-brand-300', to: 'to-brand-500' },
  { from: 'from-brand-500', to: 'to-brand-800' },
  { from: 'from-brand-400', to: 'to-brand-700' },
];

function nameHash(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

/** カードリスト用: { from, to } を返す */
export function cardGradient(name: string) {
  return BRAND_GRADIENTS[nameHash(name) % BRAND_GRADIENTS.length];
}

/** 詳細ビュー用: "from-xxx to-xxx" 文字列を返す */
export function avatarGradient(name: string): string {
  const g = BRAND_GRADIENTS[nameHash(name) % BRAND_GRADIENTS.length];
  return `${g.from} ${g.to}`;
}
