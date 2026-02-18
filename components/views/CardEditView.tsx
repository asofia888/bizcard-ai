import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { BusinessCard, ExtractionStatus } from '../../types';
import { ArrowLeftIcon, CheckIcon } from '../Icons';
import { useDialog } from '../Dialog';

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
  const { showToast } = useDialog();
  const [formData, setFormData] = useState<Partial<BusinessCard>>(initialData);

  useEffect(() => {
    setFormData(prev => ({ ...prev, ...initialData }));
  }, [initialData]);

  const handleSave = () => {
    if (!formData.name && !formData.company) {
      showToast('氏名または会社名は必須です。', 'error');
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
      note: formData.note || '',
      imageUri: formData.imageUri || null,
      createdAt: formData.createdAt || Date.now(),
    };

    onSave(newCard);
  };

  const handleChange = (key: keyof BusinessCard, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const fields: { key: keyof BusinessCard; label: string; type?: string }[] = [
    { key: 'name', label: '氏名' },
    { key: 'title', label: '役職' },
    { key: 'company', label: '会社名' },
    { key: 'country', label: '国' },
    { key: 'email', label: 'メールアドレス', type: 'email' },
    { key: 'phone', label: '電話番号', type: 'tel' },
    { key: 'website', label: 'Webサイト', type: 'url' },
    { key: 'address', label: '住所' },
  ];

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeftIcon />
          </button>
          <span className="font-extrabold text-slate-800">名刺の編集</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
        <div className="space-y-4">
          {status === ExtractionStatus.PROCESSING && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl flex items-center gap-3 border border-blue-100">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
              <span className="font-semibold text-sm">AIが名刺を解析中...</span>
            </div>
          )}

          {status === ExtractionStatus.ERROR && (
            <div className="bg-red-50 text-red-800 p-4 rounded-2xl flex items-center gap-3 border border-red-100">
              <span className="text-xl flex-shrink-0">⚠</span>
              <span className="font-medium text-sm">AI解析に失敗しました。手動で入力してください。</span>
            </div>
          )}

          {tempImage && (
            <div className="relative h-56 rounded-2xl overflow-hidden bg-slate-900 shadow-lg">
              <img src={tempImage} alt="Preview" className="w-full h-full object-contain opacity-90" />
              <div className="absolute inset-0 flex items-end justify-center pb-3">
                <p className="text-white text-xs bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                  {status === ExtractionStatus.SUCCESS && (formData as any).rotation
                    ? `自動回転: ${(formData as any).rotation}°`
                    : 'プレビュー'}
                </p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {fields.map((field, i) => (
              <div key={field.key} className={`px-4 py-3 ${i < fields.length - 1 ? 'border-b border-slate-50' : ''}`}>
                <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
                  {field.label}
                </label>
                <input
                  type={field.type || 'text'}
                  className="w-full bg-transparent focus:outline-none text-slate-900 text-sm placeholder-slate-300 focus:placeholder-slate-400 transition-colors"
                  placeholder={`${field.label}を入力`}
                  value={(formData[field.key] as string) || ''}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1.5">
              メモ・備考
            </label>
            <textarea
              className="w-full bg-transparent focus:outline-none text-slate-900 text-sm placeholder-slate-300 resize-none min-h-[80px]"
              placeholder="出会った場所や会話の内容など..."
              value={formData.note || ''}
              onChange={(e) => handleChange('note', e.target.value)}
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-blue-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <CheckIcon className="w-5 h-5" /> 保存する
          </button>
        </div>
      </div>
    </>
  );
};
