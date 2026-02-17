import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BusinessCard, ExtractionStatus } from '../../types';
import { ArrowLeftIcon, CheckIcon } from '../Icons';

interface CardEditViewProps {
  initialData: Partial<BusinessCard>;
  status: ExtractionStatus;
  tempImage: string | null;
  onSave: (card: BusinessCard) => void;
  onCancel: () => void;
}

export const CardEditView: React.FC<CardEditViewProps> = ({ 
  initialData, 
  status, 
  tempImage, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState<Partial<BusinessCard>>(initialData);

  const handleSave = () => {
    if (!formData.name && !formData.company) {
      alert("氏名または会社名は必須です。");
      return;
    }

    const newCard: BusinessCard = {
      id: formData.id || uuidv4(),
      name: formData.name || '',
      title: formData.title || '',
      company: formData.company || '',
      country: formData.country || '',
      email: formData.email || '',
      phone: formData.phone || '',
      website: formData.website || '',
      address: formData.address || '',
      note: formData.note || '', // Added note
      imageUri: formData.imageUri || null,
      createdAt: formData.createdAt || Date.now(),
    };

    onSave(newCard);
  };

  const handleChange = (key: keyof BusinessCard, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const fields: { key: keyof BusinessCard; label: string }[] = [
    { key: 'name', label: '氏名' },
    { key: 'title', label: '役職' },
    { key: 'company', label: '会社名' },
    { key: 'country', label: '国' },
    { key: 'email', label: 'メールアドレス' },
    { key: 'phone', label: '電話番号' },
    { key: 'website', label: 'Webサイト' },
    { key: 'address', label: '住所' },
  ];

  return (
    <>
      <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={onCancel}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"
            >
              <ArrowLeftIcon />
            </button>
            <span className="font-bold text-slate-800">名刺の編集</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
        <div className="space-y-6">
             {status === ExtractionStatus.PROCESSING && (
               <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-center gap-3 animate-pulse">
                 <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                 <span className="font-medium text-sm">AIが名刺を解析中...</span>
               </div>
             )}
             
             {tempImage && (
               <div className="relative h-48 rounded-xl overflow-hidden bg-slate-900 group">
                  <img src={tempImage} alt="Preview" className="w-full h-full object-contain opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center">
                      <p className="text-white text-xs bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                        {status === ExtractionStatus.SUCCESS && (formData as any).rotation ? `自動回転: ${(formData as any).rotation}°` : 'プレビュー'}
                      </p>
                  </div>
               </div>
             )}

             <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
                {fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{field.label}</label>
                    <input 
                      type="text"
                      className="w-full p-3 bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-slate-900"
                      value={(formData[field.key] as string) || ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  </div>
                ))}
                
                {/* Note Field (Textarea) */}
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">メモ・備考</label>
                    <textarea 
                      className="w-full p-3 bg-slate-50 rounded-xl border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all outline-none text-slate-900 min-h-[100px] resize-none"
                      placeholder="出会った場所や会話の内容など..."
                      value={formData.note || ''}
                      onChange={(e) => handleChange('note', e.target.value)}
                    />
                </div>
             </div>

             <div className="pt-4">
               <button 
                onClick={handleSave}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
               >
                 <CheckIcon className="w-5 h-5" /> 保存
               </button>
             </div>
        </div>
      </div>
    </>
  );
};