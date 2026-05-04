import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useBusinessCards } from '../../hooks/useBusinessCards';
import { BusinessCard } from '../../types';

const origConfirm = window.confirm;
const origAlert = window.alert;
const origCreateElement = document.createElement.bind(document);

const mockClick = vi.fn();
const mockSetAttribute = vi.fn();

function makeCard(overrides: Partial<BusinessCard> = {}): BusinessCard {
  return {
    id: 'test-' + Math.random().toString(36).slice(2),
    name: 'テスト 太郎',
    title: 'エンジニア',
    company: 'テスト株式会社',
    country: '日本',
    email: 'test@test.com',
    phone: '090-0000-0000',
    website: 'test.com',
    address: '東京都',
    note: '',
    tags: ['テスト'],
    imageUri: null,
    imageUriBack: null,
    thumbUri: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();

  window.confirm = vi.fn().mockReturnValue(false);
  window.alert = vi.fn();

  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  global.URL.revokeObjectURL = vi.fn();

  mockClick.mockReset();
  mockSetAttribute.mockReset();

  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'a') {
      return {
        href: '',
        click: mockClick,
        setAttribute: mockSetAttribute,
      } as any;
    }
    return origCreateElement(tag);
  });
  vi.spyOn(document.body, 'appendChild').mockImplementation((node: any) => node);
  vi.spyOn(document.body, 'removeChild').mockImplementation((node: any) => node);
});

afterEach(() => {
  window.confirm = origConfirm;
  window.alert = origAlert;
});

describe('useBusinessCards', () => {
  // --- 初期化 ---
  it('loads initial cards when localStorage is empty', () => {
    const { result } = renderHook(() => useBusinessCards());
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].name).toBe('山田 太郎');
  });

  it('falls back to initial cards when localStorage is corrupted', () => {
    localStorage.setItem('bizcard_data', '{broken json!!!');
    const { result } = renderHook(() => useBusinessCards());
    expect(result.current.cards).toHaveLength(1);
    expect(result.current.cards[0].name).toBe('山田 太郎');
  });

  it('normalizes old data without imageUriBack field', () => {
    const oldCard = { id: '1', name: 'Old', title: '', company: 'Co', country: '', email: '', phone: '', website: '', address: '', note: '', tags: [], imageUri: null, createdAt: Date.now() };
    localStorage.setItem('bizcard_data', JSON.stringify([oldCard]));
    const { result } = renderHook(() => useBusinessCards());
    expect(result.current.cards[0]).toHaveProperty('imageUriBack', null);
  });

  // --- addCard ---
  it('adds a card to the beginning of the list', () => {
    const { result } = renderHook(() => useBusinessCards());
    const newCard = makeCard({ name: '新規 カード' });

    act(() => {
      result.current.addCard(newCard);
    });

    expect(result.current.cards[0].name).toBe('新規 カード');
    expect(result.current.cards).toHaveLength(2); // initial + new
  });

  it('persists added card to localStorage', async () => {
    const { result } = renderHook(() => useBusinessCards());

    // Wait for IndexedDB initialization to complete
    await waitFor(() => {
      expect(result.current.cards).toBeDefined();
    });

    const newCard = makeCard({ id: 'persist-test' });

    act(() => {
      result.current.addCard(newCard);
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('bizcard_data')!);
      expect(stored.some((c: any) => c.id === 'persist-test')).toBe(true);
    });
  });

  // --- updateCard ---
  it('updates an existing card', () => {
    const card = makeCard({ id: 'update-test', name: '変更前' });
    localStorage.setItem('bizcard_data', JSON.stringify([card]));

    const { result } = renderHook(() => useBusinessCards());

    act(() => {
      result.current.updateCard({ ...card, name: '変更後' });
    });

    expect(result.current.cards.find(c => c.id === 'update-test')?.name).toBe('変更後');
  });

  it('persists updated card to localStorage', async () => {
    const card = makeCard({ id: 'update-persist', name: '変更前' });
    localStorage.setItem('bizcard_data', JSON.stringify([card]));

    const { result } = renderHook(() => useBusinessCards());

    // Wait for IndexedDB initialization to complete
    await waitFor(() => {
      expect(result.current.cards).toBeDefined();
    });

    act(() => {
      result.current.updateCard({ ...card, name: '変更後' });
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('bizcard_data')!);
      expect(stored.find((c: any) => c.id === 'update-persist')?.name).toBe('変更後');
    });
  });

  // --- deleteCard ---
  it('deletes a card when user confirms', async () => {
    const card = makeCard({ id: 'delete-test' });
    localStorage.setItem('bizcard_data', JSON.stringify([card]));
    (window.confirm as any).mockReturnValue(true);

    const { result } = renderHook(() => useBusinessCards());

    let deleted: boolean = false;
    await act(async () => {
      deleted = await result.current.deleteCard('delete-test');
    });

    expect(deleted).toBe(true);
    expect(result.current.cards.find(c => c.id === 'delete-test')).toBeUndefined();
  });

  it('does not delete when user cancels confirm', async () => {
    const card = makeCard({ id: 'no-delete' });
    localStorage.setItem('bizcard_data', JSON.stringify([card]));
    (window.confirm as any).mockReturnValue(false);

    const { result } = renderHook(() => useBusinessCards());

    let deleted: boolean = false;
    await act(async () => {
      deleted = await result.current.deleteCard('no-delete');
    });

    expect(deleted).toBe(false);
    expect(result.current.cards.find(c => c.id === 'no-delete')).toBeDefined();
  });

  // --- CSV export ---
  it('wraps all CSV fields in double quotes (CSV injection prevention)', () => {
    let csvContent = '';
    const OrigBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends OrigBlob {
      constructor(parts: any[], options?: any) {
        super(parts, options);
        if (parts.length > 1 && typeof parts[1] === 'string') {
          csvContent = parts[1];
        }
      }
    } as any;

    const { result } = renderHook(() => useBusinessCards());
    act(() => {
      result.current.exportCSV();
    });

    globalThis.Blob = OrigBlob;

    const lines = csvContent.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    const dataRow = lines[1];
    const fields = dataRow.match(/"[^"]*(?:""[^"]*)*"/g) || [];
    expect(fields.length).toBe(12);
  });

  it('escapes double quotes by doubling them in CSV export', () => {
    const cardWithQuotes = makeCard({
      id: 'quote-test',
      name: '田中 "太郎"',
      company: 'テスト"会社"',
      note: 'メモ with "quotes"',
    });
    localStorage.setItem('bizcard_data', JSON.stringify([cardWithQuotes]));

    let csvContent = '';
    const OrigBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends OrigBlob {
      constructor(parts: any[], options?: any) {
        super(parts, options);
        if (parts.length > 1 && typeof parts[1] === 'string') {
          csvContent = parts[1];
        }
      }
    } as any;

    const { result } = renderHook(() => useBusinessCards());
    act(() => {
      result.current.exportCSV();
    });

    globalThis.Blob = OrigBlob;

    expect(csvContent).toContain('"田中 ""太郎"""');
    expect(csvContent).toContain('"テスト""会社"""');
    expect(csvContent).toContain('"メモ with ""quotes"""');
  });

  it('shows alert only when exporting CSV with 0 cards', () => {
    localStorage.setItem('bizcard_data', JSON.stringify([]));
    const { result } = renderHook(() => useBusinessCards());

    act(() => {
      result.current.exportCSV();
    });

    expect(window.alert).toHaveBeenCalledWith('エクスポートするデータがありません。');
    expect(mockClick).not.toHaveBeenCalled();
  });

  it('includes tags in CSV export', () => {
    const card = makeCard({ tags: ['VIP', '展示会'] });
    localStorage.setItem('bizcard_data', JSON.stringify([card]));

    let csvContent = '';
    const OrigBlob = globalThis.Blob;
    globalThis.Blob = class MockBlob extends OrigBlob {
      constructor(parts: any[], options?: any) {
        super(parts, options);
        if (parts.length > 1 && typeof parts[1] === 'string') {
          csvContent = parts[1];
        }
      }
    } as any;

    const { result } = renderHook(() => useBusinessCards());
    act(() => {
      result.current.exportCSV();
    });

    globalThis.Blob = OrigBlob;

    expect(csvContent).toContain('VIP');
    expect(csvContent).toContain('展示会');
  });
});
