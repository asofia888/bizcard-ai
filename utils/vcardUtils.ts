import { BusinessCard } from '../types';

/** vCard の特殊文字をエスケープする */
function escape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * BusinessCard を vCard 3.0 形式 (.vcf) としてダウンロードする
 */
export function exportVCard(card: BusinessCard): void {
  const fullName = card.name || card.company || '名前なし';

  // 姓と名をスペースで分割（日本語: "山田 太郎" → family="山田", given="太郎"）
  const nameParts = fullName.split(/\s+/);
  const familyName = escape(nameParts[0] ?? '');
  const givenName  = escape(nameParts.slice(1).join(' '));

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escape(fullName)}`,
    `N:${familyName};${givenName};;;`,
  ];

  if (card.company) lines.push(`ORG:${escape(card.company)}`);
  if (card.title)   lines.push(`TITLE:${escape(card.title)}`);
  if (card.phone)   lines.push(`TEL;TYPE=WORK,VOICE:${escape(card.phone)}`);
  if (card.email)   lines.push(`EMAIL;TYPE=INTERNET,WORK:${escape(card.email)}`);
  if (card.website) {
    const url = card.website.startsWith('http') ? card.website : `https://${card.website}`;
    lines.push(`URL:${escape(url)}`);
  }
  if (card.address) lines.push(`ADR;TYPE=WORK:;;${escape(card.address)};;;;`);
  if (card.note)    lines.push(`NOTE:${escape(card.note)}`);

  lines.push('END:VCARD');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // ファイル名: 氏名または会社名（特殊文字を除去）
  const safeName = fullName.replace(/[^\w\s\u3040-\u30FF\u4E00-\u9FFF-]/g, '').trim().replace(/\s+/g, '_');
  link.download = `${safeName || 'contact'}.vcf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
