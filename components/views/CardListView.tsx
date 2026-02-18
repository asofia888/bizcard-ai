import React, { useState, useMemo } from 'react';
import { BusinessCard } from '../../types';
import { CameraIcon, SearchIcon, PlusIcon, SettingsIcon, LogoIcon } from '../Icons';

interface CardListViewProps {
  cards: BusinessCard[];
  onSelectCard: (card: BusinessCard) => void;
  onAddCard: () => void;
  onOpenSettings: () => void;
}

const CARD_GRADIENTS = [
  { from: 'from-violet-600', to: 'to-purple-700', accent: 'bg-white/15' },
  { from: 'from-blue-600',   to: 'to-indigo-700', accent: 'bg-white/15' },
  { from: 'from-emerald-600',to: 'to-teal-700',   accent: 'bg-white/15' },
  { from: 'from-orange-500', to: 'to-amber-600',  accent: 'bg-white/15' },
  { from: 'from-pink-600',   to: 'to-rose-700',   accent: 'bg-white/15' },
  { from: 'from-cyan-600',   to: 'to-sky-700',    accent: 'bg-white/15' },
];

function cardGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];
}

export const CardListView: React.FC<CardListViewProps> = ({
  cards,
  onSelectCard,
  onAddCard,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'NONE' | 'COMPANY' | 'TITLE' | 'COUNTRY'>('NONE');

  const getCleanQuery = (q: string) =>
    q.replace(/^(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+/i, '')
     .replace(/[ .]*(?:様|さん|殿|Mr\.?|Ms\.?|Mrs\.?|Dr\.?)$/i, '')
     .trim();

  const cleanQuery = getCleanQuery(searchQuery);

  const filteredCards = cards.filter(c =>
    c.name.toLowerCase().includes(cleanQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(cleanQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
    (c.country || '').toLowerCase().includes(cleanQuery.toLowerCase())
  );

  const groupedCards = useMemo(() => {
    if (groupBy === 'NONE') return null;
    const groups: Record<string, BusinessCard[]> = {};
    filteredCards.forEach(card => {
      let key = '未分類';
      if (groupBy === 'COMPANY') key = card.company;
      else if (groupBy === 'TITLE') key = card.title;
      else if (groupBy === 'COUNTRY') key = card.country;
      key = key || '未分類';
      if (!groups[key]) groups[key] = [];
      groups[key].push(card);
    });
    return groups;
  }, [filteredCards, groupBy]);

  const sortedGroupKeys = useMemo(() => {
    if (!groupedCards) return [];
    return Object.keys(groupedCards).sort((a, b) => {
      if (a === '未分類') return 1;
      if (b === '未分類') return -1;
      return a.localeCompare(b, 'ja');
    });
  }, [groupedCards]);

  // ── 名刺サイズ(91:55)で表示する CardItem ──
  const CardItem: React.FC<{ card: BusinessCard }> = ({ card }) => {
    const g = cardGradient(card.name || card.company);

    return (
      <div
        onClick={() => onSelectCard(card)}
        className="w-full rounded-2xl overflow-hidden shadow-md border border-slate-200/60 active:scale-[0.97] transition-all cursor-pointer"
        style={{ aspectRatio: '91/55' }}
      >
        {card.imageUri ? (
          /* ── 写真あり: 実際の名刺画像を表示 ── */
          <div className="relative w-full h-full">
            <img
              src={card.imageUri}
              alt={card.name}
              className="w-full h-full object-cover"
            />
            {/* 下部グラデーションオーバーレイで名前を読みやすく */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/55 via-black/20 to-transparent px-3 pt-8 pb-2.5">
              <p className="text-white font-extrabold text-sm leading-tight truncate drop-shadow">
                {card.name}
              </p>
              {card.company && (
                <p className="text-white/80 text-xs leading-tight truncate">{card.company}</p>
              )}
            </div>
          </div>
        ) : (
          /* ── 写真なし: デザイン名刺を生成 ── */
          <div className={`relative w-full h-full bg-gradient-to-br ${g.from} ${g.to} overflow-hidden`}>
            {/* 装飾サークル */}
            <div className={`absolute -top-5 -right-5 w-24 h-24 rounded-full ${g.accent}`} />
            <div className={`absolute -bottom-8 -left-8 w-28 h-28 rounded-full bg-black/15`} />

            {/* 名刺コンテンツ */}
            <div className="absolute inset-0 p-4 flex flex-col justify-between">
              {/* 上部: 会社名 + 氏名 + 役職 */}
              <div>
                {card.company && (
                  <p className="text-white/65 text-[10px] font-bold uppercase tracking-widest truncate mb-0.5">
                    {card.company}
                  </p>
                )}
                <h3 className="text-white font-extrabold text-xl leading-tight truncate">
                  {card.name || card.company || '—'}
                </h3>
                {card.title && (
                  <p className="text-white/75 text-xs mt-0.5 truncate">{card.title}</p>
                )}
              </div>

              {/* 下部: メール・電話 + 国バッジ */}
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  {card.email && (
                    <p className="text-white/60 text-[10px] truncate">{card.email}</p>
                  )}
                  {card.phone && (
                    <p className="text-white/60 text-[10px] truncate">{card.phone}</p>
                  )}
                </div>
                {card.country && (
                  <span className="flex-shrink-0 text-[10px] font-bold bg-white/20 text-white px-2 py-0.5 rounded-md">
                    {card.country}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100 p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 text-blue-600">
              <LogoIcon className="w-full h-full" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
                BizCard AI
              </h1>
              {cards.length > 0 && (
                <p className="text-[10px] text-slate-400 leading-none">{cards.length}枚の名刺</p>
              )}
            </div>
          </div>
          <button
            onClick={onOpenSettings}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="氏名、会社名、国で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 pl-9 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm placeholder-slate-400"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-28 no-scrollbar">
        <div className="space-y-3">
          {/* グループ切替タブ */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['NONE', 'COUNTRY', 'COMPANY', 'TITLE'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setGroupBy(mode)}
                className={`flex-1 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition-all truncate px-1 ${
                  groupBy === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode === 'NONE' ? '全て' : mode === 'COUNTRY' ? '国別' : mode === 'COMPANY' ? '会社別' : '役職別'}
              </button>
            ))}
          </div>

          {filteredCards.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center mt-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-3xl flex items-center justify-center mb-4 shadow-inner">
                <CameraIcon className="w-9 h-9 text-blue-400" />
              </div>
              <p className="font-semibold text-slate-600 mb-1">
                {searchQuery ? '名刺が見つかりません' : 'まだ名刺がありません'}
              </p>
              <p className="text-sm text-slate-400">
                {searchQuery ? '別のキーワードで検索してください' : '＋ボタンで最初の名刺を追加'}
              </p>
            </div>
          ) : groupBy === 'NONE' ? (
            <div className="space-y-4">
              {filteredCards.map(card => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          ) : (
            sortedGroupKeys.map(group => (
              <div key={group}>
                <div className="flex items-center justify-between py-2 px-1 mb-2">
                  <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">{group}</h3>
                  <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {groupedCards![group].length}
                  </span>
                </div>
                <div className="space-y-4">
                  {groupedCards![group].map(card => (
                    <CardItem key={card.id} card={card} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <button
        onClick={onAddCard}
        className="absolute bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white rounded-2xl shadow-xl shadow-blue-300 flex items-center justify-center active:scale-90 transition-all z-30"
      >
        <PlusIcon className="w-7 h-7" />
      </button>
    </>
  );
};
