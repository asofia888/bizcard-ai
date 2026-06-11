import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardListView } from '../../components/views/CardListView';
import { BusinessCard } from '../../types';

function makeCard(overrides: Partial<BusinessCard>): BusinessCard {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    name: '',
    title: '',
    company: '',
    country: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    note: '',
    tags: [],
    imageUri: null,
    imageUriBack: null,
    thumbUri: null,
    createdAt: Date.now(),
    ...overrides,
  };
}

const yamada = makeCard({
  name: '山田 太郎',
  company: '株式会社テック',
  email: 'taro@example.com',
  note: '展示会で交換した',
});

const sato = makeCard({
  name: '佐藤 花子',
  company: 'グローバル商事',
  email: 'hanako@global.co.jp',
  note: '',
});

const defaultProps = {
  cards: [yamada, sato],
  onSelectCard: vi.fn(),
  onAddFromFile: vi.fn(),
  onOpenSettings: vi.fn(),
};

function search(query: string) {
  fireEvent.change(screen.getByPlaceholderText(/検索/), { target: { value: query } });
}

describe('CardListView 検索', () => {
  it('氏名で絞り込める', () => {
    render(<CardListView {...defaultProps} />);
    search('山田');
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.queryByText('佐藤 花子')).not.toBeInTheDocument();
  });

  it('メモの内容で絞り込める', () => {
    render(<CardListView {...defaultProps} />);
    search('展示会');
    expect(screen.getByText('山田 太郎')).toBeInTheDocument();
    expect(screen.queryByText('佐藤 花子')).not.toBeInTheDocument();
  });

  it('メールアドレスで絞り込める', () => {
    render(<CardListView {...defaultProps} />);
    search('hanako@');
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
    expect(screen.queryByText('山田 太郎')).not.toBeInTheDocument();
  });

  it('メールのドメインで絞り込める (大文字小文字を無視)', () => {
    render(<CardListView {...defaultProps} />);
    search('GLOBAL.CO.JP');
    expect(screen.getByText('佐藤 花子')).toBeInTheDocument();
    expect(screen.queryByText('山田 太郎')).not.toBeInTheDocument();
  });

  it('該当なしの場合は空状態メッセージを表示する', () => {
    render(<CardListView {...defaultProps} />);
    search('存在しないワード');
    expect(screen.getByText('名刺が見つかりません')).toBeInTheDocument();
  });
});
