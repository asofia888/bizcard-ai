import React, { useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { v4 as uuidv4 } from 'uuid';
import { CameraCapture } from './components/CameraCapture';
import { extractCardData } from './services/geminiService';
import { rotateImage } from './utils/imageUtils';
import { perspectiveCorrect, isValidCorners, normalizeCorners } from './utils/perspectiveTransform';
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

// ビューの深さ: 数値が大きいほど「奥」。遷移方向の自動判定に使う
const VIEW_DEPTH: Record<ViewState, number> = {
  LIST: 0,
  SETTINGS: 1,
  DETAIL: 1,
  EDIT: 2,
  CAMERA: 3,
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

  // 遷移方向: 深さが増える→forward、減る→back、CAMERA→fade
  const direction = view === 'CAMERA'
    ? 'fade' as const
    : VIEW_DEPTH[view] > VIEW_DEPTH[prevViewRef.current]
      ? 'forward' as const
      : VIEW_DEPTH[view] < VIEW_DEPTH[prevViewRef.current]
        ? 'back' as const
        : 'fade' as const;
  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [tempImageBack, setTempImageBack] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<'FRONT' | 'BACK'>('FRONT');
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [extractError, setExtractError] = useState<string>('');
  const [editInitialData, setEditInitialData] = useState<Partial<BusinessCard>>({});

  // --- Handlers ---

  const handleCaptureBack = (imageData: string) => {
    setCameraMode('FRONT');
    setTempImageBack(imageData);
    setEditInitialData(prev => ({ ...prev, imageUriBack: imageData }));
    navigateTo('EDIT');
  };

  const handleCapture = async (imageData: string) => {
    setTempImage(imageData);
    setStatus(ExtractionStatus.PROCESSING);
    setExtractError('');

    // Prepare initial data for Edit View
    setEditInitialData({
      id: uuidv4(),
      imageUri: imageData,
      createdAt: Date.now()
    });

    navigateTo('EDIT');

    try {
      const extracted = await extractCardData(imageData);
      if (extracted) {
        let finalImage = imageData;
        let perspectiveApplied = false;

        // 4隅が信頼できる範囲で返ってきた場合は透視補正で長方形に整形
        console.log('[BizCard] Gemini corners:', extracted.corners);
        if (isValidCorners(extracted.corners)) {
          try {
            const clamped = normalizeCorners(extracted.corners);
            finalImage = await perspectiveCorrect(imageData, clamped);
            setTempImage(finalImage);
            perspectiveApplied = true;
            console.log('[BizCard] Perspective correction applied');
          } catch (e) {
            console.error('[BizCard] Perspective correction failed', e);
          }
        } else {
          console.log('[BizCard] Skipped correction: corners invalid or null');
        }

        // 透視補正で向きも揃うため、フォールバック時のみ回転を適用
        if (!perspectiveApplied && extracted.rotation && extracted.rotation !== 0) {
           try {
             finalImage = await rotateImage(imageData, extracted.rotation);
             setTempImage(finalImage);
           } catch (e) {
             console.error("Rotation failed", e);
           }
        }

        // 保存するカードデータには corners を含めない（一時的な処理用情報）
        const { corners: _corners, ...cardData } = extracted;
        setEditInitialData(prev => ({
          ...prev,
          ...cardData,
          imageUri: finalImage
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
                onAddCard={() => navigateTo('CAMERA')}
                onOpenSettings={() => navigateTo('SETTINGS')}
            />
          </PageTransition>
        )}

        {view === 'CAMERA' && (
          <PageTransition key="CAMERA" direction="fade">
            <CameraCapture
              onCapture={cameraMode === 'BACK' ? handleCaptureBack : handleCapture}
              onClose={() => {
                setCameraMode('FRONT');
                navigateTo(cameraMode === 'BACK' ? 'EDIT' : 'LIST');
              }}
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
                onScanBack={() => { setCameraMode('BACK'); navigateTo('CAMERA'); }}
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