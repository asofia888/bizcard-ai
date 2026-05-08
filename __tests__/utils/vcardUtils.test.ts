import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportVCard } from '../../utils/vcardUtils';
import { BusinessCard } from '../../types';

const mockClick = vi.fn();
let lastDownload = '';
let lastBlobParts: string[] = [];

beforeEach(() => {
  vi.restoreAllMocks();
  mockClick.mockReset();
  lastDownload = '';
  lastBlobParts = [];

  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  global.URL.revokeObjectURL = vi.fn();

  vi.spyOn(document, 'createElement').mockImplementation(() => {
    const el: any = { href: '', download: '', click: mockClick };
    Object.defineProperty(el, 'download', {
      get() { return lastDownload; },
      set(v: string) { lastDownload = v; },
    });
    return el;
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation((node: any) => node);
  vi.spyOn(document.body, 'removeChild').mockImplementation((node: any) => node);

  // Intercept Blob constructor to capture content
  const OrigBlob = globalThis.Blob;
  vi.stubGlobal('Blob', class extends OrigBlob {
    constructor(parts: any[], options?: any) {
      super(parts, options);
      lastBlobParts = parts.map(String);
    }
  });
});

function makeCard(overrides: Partial<BusinessCard> = {}): BusinessCard {
  return {
    id: '1',
    name: '山田 太郎',
    title: 'エンジニア',
    company: 'テスト株式会社',
    country: '日本',
    email: 'yamada@test.com',
    phone: '090-1234-5678',
    website: 'https://test.com',
    address: '東京都渋谷区1-2-3',
    note: 'テストメモ',
    tags: [],
    imageUri: null,
    imageUriBack: null,
    thumbUri: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

function blobContent(): string {
  return lastBlobParts.join('');
}

describe('exportVCard', () => {
  it('generates valid vCard 3.0 format with all fields', () => {
    exportVCard(makeCard());
    const content = blobContent();

    expect(content).toContain('BEGIN:VCARD');
    expect(content).toContain('VERSION:3.0');
    expect(content).toContain('FN:山田 太郎');
    expect(content).toContain('N:山田;太郎;;;');
    expect(content).toContain('ORG:テスト株式会社');
    expect(content).toContain('TITLE:エンジニア');
    expect(content).toContain('TEL;TYPE=WORK,VOICE:090-1234-5678');
    expect(content).toContain('EMAIL;TYPE=INTERNET,WORK:yamada@test.com');
    expect(content).toContain('URL:https://test.com');
    expect(content).toContain('NOTE:テストメモ');
    expect(content).toContain('END:VCARD');
  });

  it('omits empty optional fields', () => {
    exportVCard(makeCard({ title: '', phone: '', email: '', website: '', address: '', note: '' }));
    const content = blobContent();

    expect(content).not.toContain('TITLE:');
    expect(content).not.toContain('TEL');
    expect(content).not.toContain('EMAIL');
    expect(content).not.toContain('URL:');
    expect(content).not.toContain('ADR');
    expect(content).not.toContain('NOTE:');
  });

  it('escapes special characters (semicolon, comma, backslash)', () => {
    exportVCard(makeCard({ name: 'A;B,C\\D', company: 'X;Y' }));
    const content = blobContent();

    expect(content).toContain('FN:A\\;B\\,C\\\\D');
    expect(content).toContain('ORG:X\\;Y');
  });

  it('adds https:// prefix to website without http', () => {
    exportVCard(makeCard({ website: 'example.com' }));
    expect(blobContent()).toContain('URL:https://example.com');
  });

  it('uses company name when name is empty', () => {
    exportVCard(makeCard({ name: '', company: 'テスト社' }));
    expect(blobContent()).toContain('FN:テスト社');
  });

  it('triggers download with .vcf file', () => {
    exportVCard(makeCard());

    expect(mockClick).toHaveBeenCalled();
    expect(lastDownload).toMatch(/\.vcf$/);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');
  });

  it('creates safe filename from name', () => {
    exportVCard(makeCard({ name: '田中 太郎' }));
    expect(lastDownload).toBe('田中_太郎.vcf');
  });
});
