import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CameraCapture } from './components/CameraCapture';
import { extractCardData } from './services/geminiService';
import { rotateImage } from './utils/imageUtils';
import { useBusinessCards } from './hooks/useBusinessCards';
import { BusinessCard, ViewState, ExtractionStatus } from './types';
import { DialogProvider } from './components/Dialog';

// Views
import { CardListView } from './components/views/CardListView';
import { CardDetailView } from './components/views/CardDetailView';
import { CardEditView } from './components/views/CardEditView';
import { SettingsView } from './components/views/SettingsView';

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
  const [selectedCard, setSelectedCard] = useState<BusinessCard | null>(null);
  const [tempImage, setTempImage] = useState<string | null>(null);
  const [status, setStatus] = useState<ExtractionStatus>(ExtractionStatus.IDLE);
  const [editInitialData, setEditInitialData] = useState<Partial<BusinessCard>>({});

  // --- Handlers ---

  const handleCapture = async (imageData: string) => {
    setTempImage(imageData);
    setStatus(ExtractionStatus.PROCESSING);
    
    // Prepare initial data for Edit View
    setEditInitialData({
      id: uuidv4(),
      imageUri: imageData,
      createdAt: Date.now()
    });
    
    setView('EDIT');

    try {
      const extracted = await extractCardData(imageData);
      if (extracted) {
        let finalImage = imageData;
        
        // Auto-rotation logic
        if (extracted.rotation && extracted.rotation !== 0) {
           try {
             finalImage = await rotateImage(imageData, extracted.rotation);
             setTempImage(finalImage);
           } catch (e) {
             console.error("Rotation failed", e);
           }
        }

        setEditInitialData(prev => ({ 
          ...prev, 
          ...extracted, 
          imageUri: finalImage 
        }));
        setStatus(ExtractionStatus.SUCCESS);
      } else {
        setStatus(ExtractionStatus.ERROR);
      }
    } catch (e) {
      console.error(e);
      setStatus(ExtractionStatus.ERROR);
    }
  };

  const handleSaveFromEdit = (card: BusinessCard) => {
    if (selectedCard && selectedCard.id === card.id) {
       updateCard(card);
    } else {
       addCard(card);
    }
    setView('LIST');
    setSelectedCard(null);
    setTempImage(null);
    setStatus(ExtractionStatus.IDLE);
  };

  const handleCancelEdit = () => {
    if (selectedCard) {
        setView('DETAIL');
    } else {
        setView('LIST');
    }
    setTempImage(null);
    setStatus(ExtractionStatus.IDLE);
  }

  const handleDelete = async (id: string) => {
      const deleted = await deleteCard(id);
      if (deleted) {
          setView('LIST');
          setSelectedCard(null);
      }
  };

  const openDetail = (card: BusinessCard) => {
    setSelectedCard(card);
    setView('DETAIL');
  };

  const startEdit = (card: BusinessCard) => {
    setSelectedCard(card);
    setEditInitialData(card);
    setTempImage(card.imageUri);
    setStatus(ExtractionStatus.IDLE);
    setView('EDIT');
  };

  // --- Render ---

  return (
    <DialogProvider>
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans max-w-md mx-auto shadow-2xl overflow-hidden relative">
      
      {view === 'LIST' && (
        <CardListView 
            cards={cards} 
            onSelectCard={openDetail}
            onAddCard={() => setView('CAMERA')}
            onOpenSettings={() => setView('SETTINGS')}
        />
      )}

      {view === 'CAMERA' && (
        <CameraCapture 
          onCapture={handleCapture} 
          onClose={() => setView('LIST')} 
        />
      )}

      {view === 'DETAIL' && selectedCard && (
        <CardDetailView 
            card={selectedCard}
            onBack={() => setView('LIST')}
            onEdit={startEdit}
            onDelete={handleDelete}
        />
      )}

      {view === 'EDIT' && (
        <CardEditView 
            initialData={editInitialData}
            status={status}
            tempImage={tempImage}
            onSave={handleSaveFromEdit}
            onCancel={handleCancelEdit}
        />
      )}

      {view === 'SETTINGS' && (
        <SettingsView 
            cardCount={cards.length}
            lastBackupTime={lastBackupTime}
            onBackup={createBackup}
            onRestore={restoreBackup}
            onExportCSV={exportCSV}
            onBack={() => setView('LIST')}
        />
      )}

    </div>
    </DialogProvider>
  );
}