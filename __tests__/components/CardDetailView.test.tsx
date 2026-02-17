import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardDetailView } from '../../components/views/CardDetailView';
import { BusinessCard } from '../../types';

const fullCard: BusinessCard = {
  id: '1',
  name: '田中 太郎',
  title: 'エンジニア',
  company: 'テスト株式会社',
  country: '日本',
  email: 'tanaka@test.com',
  phone: '090-1234-5678',
  website: 'https://test.com',
  address: '東京都渋谷区1-2-3',
  note: 'テストメモ',
  imageUri: null,
  createdAt: Date.now(),
};

const emptyContactCard: BusinessCard = {
  ...fullCard,
  phone: '',
  email: '',
  website: '',
  address: '',
};

const noPhoneCard: BusinessCard = {
  ...fullCard,
  phone: '',
};

const noEmailCard: BusinessCard = {
  ...fullCard,
  email: '',
};

const defaultProps = {
  onBack: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
};

// Helper: find the action button (in the grid) by its label text
function getActionButton(label: string): HTMLButtonElement {
  // Action buttons have a span with the label and are inside a grid
  const allMatches = screen.getAllByText(label);
  // The action button's label is inside a <span> with class "text-xs font-medium"
  const actionSpan = allMatches.find(
    el => el.tagName === 'SPAN' && el.className.includes('font-medium')
  );
  return actionSpan!.closest('button')!;
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(window, 'open').mockImplementation(() => null);
});

describe('CardDetailView', () => {
  it('disables phone button and applies opacity-40 when phone is empty', () => {
    render(<CardDetailView card={noPhoneCard} {...defaultProps} />);

    const phoneButton = getActionButton('電話');
    expect(phoneButton).toBeDisabled();
    expect(phoneButton.className).toContain('opacity-40');
  });

  it('disables email button when email is empty', () => {
    render(<CardDetailView card={noEmailCard} {...defaultProps} />);

    const emailButton = getActionButton('メール');
    expect(emailButton).toBeDisabled();
  });

  it('enables all action buttons when all fields are present', () => {
    render(<CardDetailView card={fullCard} {...defaultProps} />);

    const phoneButton = getActionButton('電話');
    const emailButton = getActionButton('メール');
    const webButton = getActionButton('Web');
    const mapButton = getActionButton('地図');

    expect(phoneButton).not.toBeDisabled();
    expect(emailButton).not.toBeDisabled();
    expect(webButton).not.toBeDisabled();
    expect(mapButton).not.toBeDisabled();
  });

  it('does not call window.open when disabled button is clicked', () => {
    render(<CardDetailView card={emptyContactCard} {...defaultProps} />);

    const phoneButton = getActionButton('電話');
    fireEvent.click(phoneButton);

    expect(window.open).not.toHaveBeenCalled();
  });
});
