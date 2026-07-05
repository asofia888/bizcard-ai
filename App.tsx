import React, { useState, useReducer } from 'react';
import { AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { extractCardData } from './services/geminiService';
import { rotateImage } from './utils/imageUtils';
import { perspectiveCorrect, normalizeCorners } from './utils/perspectiveTransform';
import type { Corners } from './utils/perspectiveTransform';
import { useBusinessCards } from './hooks/useBusinessCards';
import { BusinessCard, ViewState, ExtractionStatus } from './types';
import { DialogProvider } from './components/Dialog';
import { PageTransition } from './components/PageTransition';
import { ErrorBoundary } from './components/ErrorBoundary';

// Views
import { CardListView } from './components/views/CardListView';
import { CardDetailView } from './components/views/CardDetailView';
import { CardEditView } from './components/views/CardEditView';
import { SettingsView } from './components/views/SettingsView';
import { CornerAdjustView } from './components/views/CornerAdjustView';

// ビューの深さ: 数値が大きいほど「奥」。遷移方向の自動判定に使う
const VIEW_DEPTH: Record<ViewState, number> = {
  LIST: 0,
  SETTINGS: 1,
  DETAIL: 1,
  ADJUST: 2,
  EDIT: 3,
};

// ── 取り込みフロー (ファイル選択 → 4隅調整 → AI解析 → 編集) の状態 ──
// 個別 useState だと遷移の組み合わせ漏れが起きやすいため、1つの reducer で一貫管理する
interface CaptureState {
  addMode: 'FRONT' | 'BACK';        // 取り込み中の画像が表面か裏面か。ADJUST 後の振り分けに使う
  adjustImage: string | null;       // 4隅調整画面に渡す元画像
  tempImage: string | null;         // 編集画面の表面プレビュー
  tempImageBack: string | null;     // 編集画面の裏面プレビュー
  status: ExtractionStatus;
  extractError: string;
  editInitialData: Partial<BusinessCard>;
}

type CaptureAction =
  | { type: 'START_ADJUST'; image: string; mode: 'FRONT' | 'BACK' }
  | { type: 'ADJUST_CANCEL' }
  | { type: 'BACK_CAPTURED'; image: string }
  | { type: 'FRONT_PROCESSING'; image: string; id: string; createdAt: number }
  | { type: 'EXTRACT_SUCCESS'; data: Partial<BusinessCard>; image: string }
  | { type: 'EXTRACT_ERROR'; message: string }
  | { type: 'START_EDIT'; card: BusinessCard }
  | { type: 'RESET' };

const initialCaptureState: CaptureState = {
  addMode: 'FRONT',
  adjustImage: null,
  tempImage: null,
  tempImageBack: null,
  status: ExtractionStatus.IDLE,
  extractError: '',
  editInitialData: {},
};

function captureReducer(state: CaptureState, action: CaptureAction): CaptureState {
  switch (action.type) {
    case 'START_ADJUST':
      return { ...state, addMode: action.mode, adjustImage: action.image };
    case 'ADJUST_CANCEL':
      return { ...state, adjustImage: null, addMode: 'FRONT' };
    case 'BACK_CAPTURED':
      return {
        ...state,
        addMode: 'FRONT',
        adjustImage: null,
        tempImageBack: action.image,
        editInitialData: { ...state.editInitialData, imageUriBack: action.image },
      };
    case 'FRONT_PROCESSING':
      return {
        ...state,
        adjustImage: null,
        tempImage: action.image,
        status: ExtractionStatus.PROCESSING,
        extractError: '',
        editInitialData: { id: action.id, imageUri: action.image, createdAt: action.createdAt },
      };
    case 'EXTRACT_SUCCESS':
      return {
        ...state,
        tempImage: action.image,
        status: ExtractionStatus.SUCCESS,
        editInitialData: { ...state.editInitialData, ...action.data, imageUri: action.image },
      };
    case 'EXTRACT_ERROR':
      return { ...state, status: ExtractionStatus.ERROR, extractError: action.message };
    case 'START_EDIT':
      return {
        ...initialCaptureState,
        tempImage: action.card.imageUri,
        tempImageBack: action.card.imageUriBack,
        editInitialData: action.card,
      };
    case 'RESET':
      return initialCaptureState;
  }
}

export default function App() {
  const {
    cards,
    lastBackupTime,
    hydrateCard,
    addCard,
    updateCard,
    deleteCard,
    createBackup,
    restoreBackup,
    exportCSV
  } = useBusinessCards();

  const [view, setView] = useState<ViewState>('LIST');
  // 遷移方向: 深さが増える→forward、減る→back、同じ→fade
  const [direction, setDirection] = useState<'forward' | 'back' | 'fade'>('fade');

  // view 変更をラップして方向を自動追跡（レンダー中の ref 参照を避けるため state で持つ）
  const navigateTo = (next: ViewState) => {
    setDirection(
      VIEW_DEPTH[next] > VIEW_DEPTH[view]
        ? 'forward'
        : VIEW_DEPTH[next] < VIEW_DEPTH[view]
          ? 'back'
          : 'fade'
    );
    setView(next);
  };

  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null);
  const [capture, dispatch] = useReducer(captureReducer, initialCaptureState);
  const { addMode, adjustImage, tempImage, tempImageBack, status, extractError, editInitialData } = capture;

  // --- Handlers ---

  // ファイル取り込み直後: 表面/裏面どちらも先に4隅調整画面へ
  const handleCapture = (imageData: string, mode: 'FRONT' | 'BACK') => {
    dispatch({ type: 'START_ADJUST', image: imageData, mode });
    navigateTo('ADJUST');
  };

  // 4隅調整 → 透視補正後の画像で次の処理に進む
  const handleAdjustApply = async (corners: Corners) => {
    const source = adjustImage;
    if (!source) return;
    let corrected = source;
    try {
      corrected = await perspectiveCorrect(source, normalizeCorners(corners));
    } catch (e) {
      console.error('[BizCard] Perspective correction failed', e);
    }
    if (addMode === 'BACK') {
      finalizeBackCapture(corrected);
    } else {
      await processFrontCapture(corrected);
    }
  };

  // スキップ: 元画像のまま次の処理に進む
  const handleAdjustSkip = async () => {
    const source = adjustImage;
    if (!source) return;
    if (addMode === 'BACK') {
      finalizeBackCapture(source);
    } else {
      await processFrontCapture(source);
    }
  };

  // やり直し: 取り込み元 (リスト or 編集) に戻る
  const handleAdjustCancel = () => {
    const wasBack = addMode === 'BACK';
    dispatch({ type: 'ADJUST_CANCEL' });
    navigateTo(wasBack ? 'EDIT' : 'LIST');
  };

  const finalizeBackCapture = (imageData: string) => {
    dispatch({ type: 'BACK_CAPTURED', image: imageData });
    navigateTo('EDIT');
  };

  const processFrontCapture = async (imageData: string) => {
    dispatch({ type: 'FRONT_PROCESSING', image: imageData, id: uuidv4(), createdAt: Date.now() });
    navigateTo('EDIT');

    try {
      const extracted = await extractCardData(imageData);
      if (extracted) {
        let finalImage = imageData;

        // 透視補正をスキップしたケース等のため、回転は引き続きフォールバックとして適用
        if (extracted.rotation && extracted.rotation !== 0) {
          try {
            finalImage = await rotateImage(imageData, extracted.rotation);
          } catch (e) {
            console.error('Rotation failed', e);
          }
        }

        dispatch({ type: 'EXTRACT_SUCCESS', data: extracted, image: finalImage });
      } else {
        dispatch({ type: 'EXTRACT_ERROR', message: 'AI解析に失敗しました。手動で入力してください。' });
      }
    } catch (e: any) {
      console.error(e);
      dispatch({ type: 'EXTRACT_ERROR', message: e.message || 'AI解析に失敗しました。手動で入力してください。' });
    }
  };

  const handleSaveFromEdit = (card: BusinessCard) => {
    if (selectedCard && selectedCard.id === card.id) {
       updateCard(card);
    } else {
       addCard(card);
    }
    navigateTo('LIST');
    setSelectedCard(null);
    dispatch({ type: 'RESET' });
  };

  const handleCancelEdit = () => {
    if (selectedCard) {
        navigateTo('DETAIL');
    } else {
        navigateTo('LIST');
    }
    dispatch({ type: 'RESET' });
  }

  const handleDelete = async (id: string) => {
      const deleted = await deleteCard(id);
      if (deleted) {
          navigateTo('LIST');
          setSelectedCard(null);
      }
  };

  // リスト状態はサムネのみ保持しているため、詳細を開く時にフル画像を遅延ロードする
  const openDetail = async (card: BusinessCard) => {
    setSelectedCard(await hydrateCard(card));
    navigateTo('DETAIL');
  };

  const startEdit = (card: BusinessCard) => {
    setSelectedCard(card);
    dispatch({ type: 'START_EDIT', card });
    navigateTo('EDIT');
  };

  // --- Render ---

  return (
    <ErrorBoundary>
    <DialogProvider>
    <div className="h-dvh bg-slate-50 flex flex-col font-sans max-w-md mx-auto shadow-2xl overflow-hidden relative">

      <AnimatePresence mode="wait" initial={false}>
        {view === 'LIST' && (
          <PageTransition key="LIST" direction={direction}>
            <CardListView
                cards={cards}
                onSelectCard={openDetail}
                onAddFromFile={(imageData) => handleCapture(imageData, 'FRONT')}
                onOpenSettings={() => navigateTo('SETTINGS')}
            />
          </PageTransition>
        )}

        {view === 'ADJUST' && adjustImage && (
          <PageTransition key="ADJUST" direction="fade">
            <CornerAdjustView
              imageDataUri={adjustImage}
              onApply={handleAdjustApply}
              onSkip={handleAdjustSkip}
              onCancel={handleAdjustCancel}
            />
          </PageTransition>
        )}

        {view === 'DETAIL' && selectedCard && (
          <PageTransition key="DETAIL" direction={direction}>
            <CardDetailView
                card={selectedCard}
                onBack={() => navigateTo('LIST')}
                onEdit={startEdit}
                onDelete={handleDelete}
            />
          </PageTransition>
        )}

        {view === 'EDIT' && (
          <PageTransition key="EDIT" direction={direction}>
            <CardEditView
                initialData={editInitialData}
                status={status}
                errorMessage={extractError}
                tempImage={tempImage}
                tempImageBack={tempImageBack}
                onSave={handleSaveFromEdit}
                onCancel={handleCancelEdit}
                onAddBackFromFile={(imageData) => handleCapture(imageData, 'BACK')}
            />
          </PageTransition>
        )}

        {view === 'SETTINGS' && (
          <PageTransition key="SETTINGS" direction={direction}>
            <SettingsView
                cardCount={cards.length}
                lastBackupTime={lastBackupTime}
                onBackup={createBackup}
                onRestore={restoreBackup}
                onExportCSV={exportCSV}
                onBack={() => navigateTo('LIST')}
            />
          </PageTransition>
        )}
      </AnimatePresence>

    </div>
    </DialogProvider>
    </ErrorBoundary>
  );
}