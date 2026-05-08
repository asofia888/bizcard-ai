import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardEditView } from '../../components/views/CardEditView';
import { ExtractionStatus } from '../../types';
import { DialogProvider } from '../../components/Dialog';

const defaultProps = {
  initialData: { id: '1', name: '', company: '' },
  status: ExtractionStatus.IDLE,
  tempImage: null,
  tempImageBack: null,
  onSave: vi.fn(),
  onCancel: vi.fn(),
  onScanBack: vi.fn(),
};

function renderWithDialog(ui: React.ReactElement) {
  return render(<DialogProvider>{ui}</DialogProvider>);
}

describe('CardEditView', () => {
  it('shows processing indicator when status is PROCESSING', () => {
    renderWithDialog(<CardEditView {...defaultProps} status={ExtractionStatus.PROCESSING} />);
    expect(screen.getByText('AIが名刺を解析中...')).toBeDefined();
  });

  it('shows default error message when status is ERROR without errorMessage', () => {
    renderWithDialog(<CardEditView {...defaultProps} status={ExtractionStatus.ERROR} />);
    expect(screen.getByText('AI解析に失敗しました。手動で入力してください。')).toBeDefined();
  });

  it('shows custom error message when errorMessage is provided', () => {
    renderWithDialog(
      <CardEditView {...defaultProps} status={ExtractionStatus.ERROR} errorMessage="オフラインです。ネットワーク接続を確認してください。" />
    );
    expect(screen.getByText('オフラインです。ネットワーク接続を確認してください。')).toBeDefined();
  });

  it('shows timeout error message', () => {
    renderWithDialog(
      <CardEditView {...defaultProps} status={ExtractionStatus.ERROR} errorMessage="AI解析がタイムアウトしました。もう一度お試しください。" />
    );
    expect(screen.getByText('AI解析がタイムアウトしました。もう一度お試しください。')).toBeDefined();
  });

  it('does not show error or processing indicator when status is IDLE', () => {
    renderWithDialog(<CardEditView {...defaultProps} status={ExtractionStatus.IDLE} />);
    expect(screen.queryByText('AIが名刺を解析中...')).toBeNull();
    expect(screen.queryByText(/AI解析に失敗/)).toBeNull();
  });

  it('does not show error or processing indicator when status is SUCCESS', () => {
    renderWithDialog(<CardEditView {...defaultProps} status={ExtractionStatus.SUCCESS} />);
    expect(screen.queryByText('AIが名刺を解析中...')).toBeNull();
    expect(screen.queryByText(/AI解析に失敗/)).toBeNull();
  });

  it('renders all form fields', () => {
    renderWithDialog(<CardEditView {...defaultProps} />);

    expect(screen.getByPlaceholderText('氏名を入力')).toBeDefined();
    expect(screen.getByPlaceholderText('会社名を入力')).toBeDefined();
    expect(screen.getByPlaceholderText('メールアドレスを入力')).toBeDefined();
    expect(screen.getByPlaceholderText('電話番号を入力')).toBeDefined();
  });

  it('shows back button with aria-label', () => {
    renderWithDialog(<CardEditView {...defaultProps} />);
    expect(screen.getByLabelText('戻る')).toBeDefined();
  });

  it('shows scan back button when no back image', () => {
    renderWithDialog(<CardEditView {...defaultProps} />);
    expect(screen.getByText('裏面を撮影する（任意）')).toBeDefined();
  });
});
