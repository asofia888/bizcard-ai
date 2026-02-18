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

const AVATAR_GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-indigo-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-amber-600',
  'from-pink-500 to-rose-600',
  'from-cyan-500 to-sky-600',
];

function avatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

export const CardDetailView: React.FC<CardDetailViewProps> = ({ card, onBack, onEdit, onDelete }) => {
  const gradient = avatarGradient(card.name || card.company);

  const actionButtons = [
    {
      icon: <PhoneIcon />, label: '電話',
      action: () => window.open(`tel:${card.phone}`),
      disabled: !card.phone,
      bg: 'bg-emerald-100 text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white',
    },
    {
      icon: <MailIcon />, label: 'メール',
      action: () => window.open(`mailto:${card.email}`),
      disabled: !card.email,
      bg: 'bg-blue-100 text-blue-600 group-hover:bg-blue-500 group-hover:text-white',
    },
    {
      icon: <GlobeIcon />, label: 'Web',
      action: () => window.open(card.website.startsWith('http') ? card.website : `https://${card.website}`, '_blank'),
      disabled: !card.website,
      bg: 'bg-violet-100 text-violet-600 group-hover:bg-violet-500 group-hover:text-white',
    },
    {
      icon: <MapPinIcon />, label: '地図',
      action: () => window.open(`https://maps.google.com/?q=${card.address}`, '_blank'),
      disabled: !card.address,
      bg: 'bg-orange-100 text-orange-600 group-hover:bg-orange-500 group-hover:text-white',
    },
  ];

  const infoItems = [
    { label: 'メール', val: card.email, icon: <MailIcon className="w-4 h-4" />, iconBg: 'bg-blue-50 text-blue-500' },
    { label: '電話番号', val: card.phone, icon: <PhoneIcon className="w-4 h-4" />, iconBg: 'bg-emerald-50 text-emerald-500' },
    { label: '住所', val: card.address, icon: <MapPinIcon className="w-4 h-4" />, iconBg: 'bg-orange-50 text-orange-500' },
    { label: '国', val: card.country, icon: <GlobeIcon className="w-4 h-4" />, iconBg: 'bg-violet-50 text-violet-500' },
    { label: 'Webサイト', val: card.website, icon: <GlobeIcon className="w-4 h-4" />, iconBg: 'bg-sky-50 text-sky-500' },
  ];

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center">
          <button
            onClick={onBack}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ArrowLeftIcon />
          </button>
          <button
            onClick={() => onEdit(card)}
            className="text-blue-600 font-bold text-sm bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-colors"
          >
            編集
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
        <div className="space-y-4">
          {/* ── Hero ── */}
          <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
            {card.imageUri ? (
              /* 名刺画像を名刺比率(91:55)で表示 */
              <div className="p-3 bg-slate-100">
                <div
                  className="w-full rounded-xl overflow-hidden shadow-md"
                  style={{ aspectRatio: '91/55' }}
                >
                  <img
                    src={card.imageUri}
                    className="w-full h-full object-cover"
                    alt="名刺"
                  />
                </div>
              </div>
            ) : (
              /* 画像なし: グラデーションヘッダー + イニシャルアバター */
              <div className={`h-40 bg-gradient-to-br ${gradient} relative overflow-hidden`}>
                <div className="absolute -top-4 -right-4 w-32 h-32 bg-white/10 rounded-full" />
                <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-black/10 rounded-full" />
              </div>
            )}

            <div className={`px-6 pb-6 flex flex-col items-center ${card.imageUri ? 'pt-4' : 'pt-0 relative'}`}>
              {!card.imageUri && (
                <div className="w-24 h-24 rounded-2xl border-4 border-white -mt-12 shadow-lg overflow-hidden z-10 relative">
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-4xl font-extrabold text-white">
                      {(card.name || card.company).charAt(0)}
                    </span>
                  </div>
                </div>
              )}
              <div className={`${card.imageUri ? '' : 'mt-3'} text-center`}>
                <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{card.name || '—'}</h2>
                <p className="text-blue-600 font-bold text-sm mt-1">{card.company}</p>
                <div className="flex justify-center gap-2 mt-2 flex-wrap">
                  {card.title && (
                    <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg font-medium">{card.title}</span>
                  )}
                  {card.country && (
                    <span className="text-xs font-semibold bg-blue-50 text-blue-500 px-2.5 py-1 rounded-lg">{card.country}</span>
                  )}
                </div>
                {(card.tags || []).length > 0 && (
                  <div className="flex justify-center flex-wrap gap-1.5 mt-3">
                    {card.tags.map(tag => (
                      <span key={tag} className="text-xs font-semibold bg-indigo-50 text-indigo-500 px-2.5 py-1 rounded-lg">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="grid grid-cols-4 gap-3">
            {actionButtons.map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                disabled={btn.disabled}
                className={`flex flex-col items-center gap-2 group ${btn.disabled ? 'opacity-30 pointer-events-none' : ''}`}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all shadow-sm ${btn.bg}`}>
                  {btn.icon}
                </div>
                <span className="text-xs font-semibold text-slate-500">{btn.label}</span>
              </button>
            ))}
          </div>

          {/* ── Info List ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {infoItems.map((item, i) => (
              <div
                key={i}
                className={`px-4 py-3.5 flex items-center gap-3.5 ${i < infoItems.length - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${item.iconBg}`}>
                  {item.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-0.5">{item.label}</p>
                  <p className="text-slate-800 text-sm break-words font-medium">{item.val || '—'}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Note ── */}
          {card.note && (
            <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileTextIcon className="w-4 h-4 text-amber-500" />
                <h3 className="text-xs font-extrabold text-amber-600 uppercase tracking-wider">メモ</h3>
              </div>
              <p className="text-amber-900 text-sm whitespace-pre-wrap leading-relaxed">{card.note}</p>
            </div>
          )}

          <button
            onClick={() => onDelete(card.id)}
            className="w-full py-4 text-red-500 font-bold hover:bg-red-50 rounded-2xl transition-colors flex items-center justify-center gap-2 border border-red-100"
          >
            <TrashIcon className="w-5 h-5" /> 連絡先を削除
          </button>
        </div>
      </div>
    </>
  );
};
