import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBusinessCards } from '../../hooks/useBusinessCards';

const origConfirm = window.confirm;
const origAlert = window.alert;
const origCreateElement = document.createElement.bind(document);
const origAppendChild = document.body.appendChild.bind(document.body);
const origRemoveChild = document.body.removeChild.bind(document.body);

const mockClick = vi.fn();
const mockSetAttribute = vi.fn();

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();

  // happy-dom may not have confirm/alert, assign directly
  window.confirm = vi.fn().mockReturnValue(false);
  window.alert = vi.fn();

  // Mock Blob/URL for CSV export
  global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock');
  global.URL.revokeObjectURL = vi.fn();

  mockClick.mockReset();
  mockSetAttribute.mockReset();

  // Use saved original to avoid recursive spy
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

    // Each data field in the CSV row should be wrapped in double quotes
    const lines = csvContent.split('\n');
    expect(lines.length).toBeGreaterThan(1);
    const dataRow = lines[1];
    const fields = dataRow.match(/"[^"]*(?:""[^"]*)*"/g) || [];
    // 11 fields: ID, name, company, title, country, email, phone, website, address, note, createdAt
    expect(fields.length).toBe(11);
  });

  it('escapes double quotes by doubling them in CSV export', () => {
    const cardWithQuotes = {
      id: 'test-id',
      name: '田中 "太郎"',
      title: 'CEO',
      company: 'テスト"会社"',
      country: '日本',
      email: 'test@test.com',
      phone: '090-1234-5678',
      website: 'test.com',
      address: '東京都',
      note: 'メモ with "quotes"',
      imageUri: null,
      createdAt: Date.now(),
    };
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
});
