import React, { useState, useRef } from 'react';
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

export default function App() {
  const { 
    cards, 
    lastBackupTime, 
    addCard, 
    updateCard, 
    deleteCard, 
    createBackup, 
    restoreBackup,
    exportCSV
  } = useBusinessCards();

  const [view, setView] = useState<ViewState>('LIST');
  const prevViewRef = useRef<ViewState>('LIST');

  // view 変更をラップして方向を自動追跡
  const navigateTo = (next: ViewState) => {
    prevViewRef.current = view;
    setView(next);
  };

  // 遷移方向: 深さが増える→forward、減る→back、同じ→fade
  const direction =
    VIEW_DEPTH[view] > VIEW_DEPTH[prevViewRef.current]
      ? 'forward' as const
      : VIEW_DEPTH[view] < VIEW_DEPTH[prevViewRef.current]
        ? 'back' as const
        : 'fade' as const;
  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [tempImageBack, setTempImageBack] = useState<string | null>(null);
  // 取り込み中の画像が表面か裏面か。ADJUST 後の振り分けに使う。
  const [addMode, setAddMode] = useState<'FRONT' | 'BACK'>('FRONT');
  const [adjustImage, setAdjustImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [extractError, setExtractError] = useState<string>('');
  const [editInitialData, setEditInitialData] = useState<Partial<BusinessCard>>({});

  // --- Handlers ---

  // ファイル取り込み直後: 表面/裏面どちらも先に4隅調整画面へ
  const handleCapture = (imageData: string) => {
    setAdjustImage(imageData);
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
    setAdjustImage(null);
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
    setAdjustImage(null);
    if (addMode === 'BACK') {
      finalizeBackCapture(source);
    } else {
      await processFrontCapture(source);
    }
  };

  // やり直し: 取り込み元 (リスト or 編集) に戻る
  const handleAdjustCancel = () => {
    setAdjustImage(null);
    if (addMode === 'BACK') {
      setAddMode('FRONT');
      navigateTo('EDIT');
    } else {
      navigateTo('LIST');
    }
  };

  const finalizeBackCapture = (imageData: string) => {
    setAddMode('FRONT');
    setTempImageBack(imageData);
    setEditInitialData(prev => ({ ...prev, imageUriBack: imageData }));
    navigateTo('EDIT');
  };

  const processFrontCapture = async (imageData: string) => {
    setTempImage(imageData);
    setStatus(ExtractionStatus.PROCESSING);
    setExtractError('');

    setEditInitialData({
      id: uuidv4(),
      imageUri: imageData,
      createdAt: Date.now(),
    });

    navigateTo('EDIT');

    try {
      const extracted = await extractCardData(imageData);
      if (extracted) {
        let finalImage = imageData;

        // 透視補正をスキップしたケース等のため、回転は引き続きフォールバックとして適用
        if (extracted.rotation && extracted.rotation !== 0) {
          try {
            finalImage = await rotateImage(imageData, extracted.rotation);
            setTempImage(finalImage);
          } catch (e) {
            console.error('Rotation failed', e);
          }
        }

        setEditInitialData(prev => ({
          ...prev,
          ...extracted,
          imageUri: finalImage,
        }));
        setStatus(ExtractionStatus.SUCCESS);
      } else {
        setStatus(ExtractionStatus.ERROR);
        setExtractError('AI解析に失敗しました。手動で入力してください。');
      }
    } catch (e: any) {
      console.error(e);
      setStatus(ExtractionStatus.ERROR);
      setExtractError(e.message || 'AI解析に失敗しました。手動で入力してください。');
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
    setTempImage(null);
    setTempImageBack(null);
    setStatus(ExtractionStatus.IDLE);
  };

  const handleCancelEdit = () => {
    if (selectedCard) {
        navigateTo('DETAIL');
    } else {
        navigateTo('LIST');
    }
    setTempImage(null);
    setTempImageBack(null);
    setStatus(ExtractionStatus.IDLE);
  }

  const handleDelete = async (id: string) => {
      const deleted = await deleteCard(id);
      if (deleted) {
          navigateTo('LIST');
          setSelectedCard(null);
      }
  };

  const openDetail = (card: BusinessCard) => {
    setSelectedCard(card);
    navigateTo('DETAIL');
  };

  const startEdit = (card: BusinessCard) => {
    setSelectedCard(card);
    setEditInitialData(card);
    setTempImage(card.imageUri);
    setTempImageBack(card.imageUriBack);
    setStatus(ExtractionStatus.IDLE);
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
                onAddFromFile={(imageData) => { setAddMode('FRONT'); handleCapture(imageData); }}
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
                onAddBackFromFile={(imageData) => { setAddMode('BACK'); handleCapture(imageData); }}
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