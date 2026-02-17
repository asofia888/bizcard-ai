import React from 'react';
import { BusinessCard } from '../../types';
import { 
  ArrowLeftIcon, TrashIcon, PhoneIcon, MailIcon, GlobeIcon, MapPinIcon, FileTextIcon
} from '../Icons';

interface CardDetailViewProps {
  card: BusinessCard;
  onBack: () => void;
  onEdit: (card: BusinessCard) => void;
  onDelete: (id: string) => void;
}

export const CardDetailView: React.FC<CardDetailViewProps> = ({ card, onBack, onEdit, onDelete }) => {
  return (
    <>
      <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full"
            >
              <ArrowLeftIcon />
            </button>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => onEdit(card)} className="text-blue-600 font-medium text-sm px-3 py-1 rounded hover:bg-blue-50">
              編集
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
        <div className="space-y-6">
            {/* Digital Card Preview */}
            <div className="bg-white rounded-2xl shadow-lg border border-slate-100 overflow-hidden relative">
              <div className="h-32 bg-gradient-to-br from-blue-600 to-indigo-800 relative overflow-hidden">
                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white to-transparent"></div>
              </div>
              <div className="px-6 pb-8 pt-0 relative flex flex-col items-center">
                 <div className="w-24 h-24 bg-white rounded-full border-4 border-white -mt-12 shadow-md flex items-center justify-center overflow-hidden relative z-10 bg-slate-100">
                    {card.imageUri ? (
                        <img src={card.imageUri} className="w-full h-full object-cover" alt="Card" />
                    ) : (
                       <span className="text-4xl font-bold text-slate-700">{card.name.charAt(0)}</span>
                    )}
                 </div>
                 <div className="mt-4 text-center">
                    <h2 className="text-2xl font-bold text-slate-900">{card.name}</h2>
                    <p className="text-blue-600 font-bold font-sm mt-1">{card.company}</p>
                    <div className="flex justify-center gap-2 mt-2">
                        {card.country && (
                           <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                             {card.country}
                           </span>
                        )}
                        {card.title && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                            {card.title}
                          </span>
                        )}
                    </div>
                 </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-4 gap-4">
               {[
                 { icon: <PhoneIcon />, label: '電話', action: () => window.open(`tel:${card.phone}`), disabled: !card.phone },
                 { icon: <MailIcon />, label: 'メール', action: () => window.open(`mailto:${card.email}`), disabled: !card.email },
                 { icon: <GlobeIcon />, label: 'Web', action: () => window.open(card.website.startsWith('http') ? card.website : `https://${card.website}`, '_blank'), disabled: !card.website },
                 { icon: <MapPinIcon />, label: '地図', action: () => window.open(`https://maps.google.com/?q=${card.address}`, '_blank'), disabled: !card.address },
               ].map((btn, i) => (
                 <button key={i} onClick={btn.action} disabled={btn.disabled} className={`flex flex-col items-center gap-2 group ${btn.disabled ? 'opacity-40 pointer-events-none' : ''}`}>
                   <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                     {btn.icon}
                   </div>
                   <span className="text-xs font-medium text-slate-600">{btn.label}</span>
                 </button>
               ))}
            </div>

            {/* Details List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2">
                {[
                  { label: 'メール', val: card.email, icon: <MailIcon className="w-4 h-4" /> },
                  { label: '電話番号', val: card.phone, icon: <PhoneIcon className="w-4 h-4" /> },
                  { label: '住所', val: card.address, icon: <MapPinIcon className="w-4 h-4" /> },
                  { label: '国', val: card.country, icon: <GlobeIcon className="w-4 h-4" /> },
                  { label: 'Webサイト', val: card.website, icon: <GlobeIcon className="w-4 h-4" /> },
                ].map((item, i) => (
                  <div key={i} className={`p-4 flex items-center gap-4 ${i !== 4 ? 'border-b border-slate-50' : ''}`}>
                    <div className="text-slate-400">{item.icon}</div>
                    <div className="flex-1 min-w-0">
                       <p className="text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">{item.label}</p>
                       <p className="text-slate-800 break-words">{item.val || '—'}</p>
                    </div>
                  </div>
                ))}
            </div>

            {/* Note Section */}
            {card.note && (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                 <div className="flex items-center gap-2 mb-2">
                    <FileTextIcon className="w-4 h-4 text-slate-400" />
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">メモ</h3>
                 </div>
                 <p className="text-slate-700 text-sm whitespace-pre-wrap leading-relaxed">{card.note}</p>
              </div>
            )}
            
            <button 
              onClick={() => onDelete(card.id)}
              className="w-full py-4 text-red-500 font-medium hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <TrashIcon className="w-5 h-5"/> 連絡先を削除
            </button>
        </div>
      </div>
    </>
  );
};