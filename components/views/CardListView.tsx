import React, { useState, useMemo } from 'react';
import { BusinessCard } from '../../types';
import { CameraIcon, SearchIcon, PlusIcon, SettingsIcon, LogoIcon } from '../Icons';

interface CardListViewProps {
  cards: BusinessCard[];
  onSelectCard: (card: BusinessCard) => void;
  onAddCard: () => void;
  onOpenSettings: () => void;
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

  const CardItem: React.FC<{ card: BusinessCard }> = ({ card }) => (
    <div
      onClick={() => onSelectCard(card)}
      className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100/80 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-3.5 hover:shadow-md hover:border-slate-200"
    >
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${avatarGradient(card.name || card.company)} flex-shrink-0 flex items-center justify-center text-white font-extrabold text-lg overflow-hidden shadow-sm`}>
        {card.imageUri ? (
          <img src={card.imageUri} alt="" className="w-full h-full object-cover" />
        ) : (
          (card.name || card.company).charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <h3 className="font-bold text-slate-900 truncate text-sm leading-tight">{card.name || '—'}</h3>
          {card.country && (
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">{card.country}</span>
          )}
        </div>
        <p className="text-xs text-blue-600 font-semibold truncate leading-tight">{card.company}</p>
        {card.title && <p className="text-xs text-slate-400 truncate leading-tight mt-0.5">{card.title}</p>}
      </div>
      <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
      </svg>
    </div>
  );

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
          {/* Group Toggle */}
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
            <div className="space-y-2.5">
              {filteredCards.map(card => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          ) : (
            sortedGroupKeys.map(group => (
              <div key={group} className="mb-2">
                <div className="flex items-center justify-between py-2 px-1 mb-2">
                  <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-widest">{group}</h3>
                  <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-bold">
                    {groupedCards![group].length}
                  </span>
                </div>
                <div className="space-y-2.5">
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
