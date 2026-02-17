import React, { useState, useMemo } from 'react';
import { BusinessCard } from '../../types';
import { CameraIcon, SearchIcon, PlusIcon, SettingsIcon, LogoIcon } from '../Icons';

interface CardListViewProps {
  cards: BusinessCard[];
  onSelectCard: (card: BusinessCard) => void;
  onAddCard: () => void;
  onOpenSettings: () => void;
}

export const CardListView: React.FC<CardListViewProps> = ({ 
  cards, 
  onSelectCard, 
  onAddCard,
  onOpenSettings
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<'NONE' | 'COMPANY' | 'TITLE' | 'COUNTRY'>('NONE');

  // Filter logic
  const getCleanQuery = (q: string) => {
    return q.replace(/^(?:Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s+/i, '')
            .replace(/[ .]*(?:様|さん|殿|Mr\.?|Ms\.?|Mrs\.?|Dr\.?)$/i, '')
            .trim();
  }
  
  const cleanQuery = getCleanQuery(searchQuery);

  const filteredCards = cards.filter(c => 
    c.name.toLowerCase().includes(cleanQuery.toLowerCase()) ||
    c.company.toLowerCase().includes(cleanQuery.toLowerCase()) ||
    c.title.toLowerCase().includes(cleanQuery.toLowerCase()) ||
    (c.country || '').toLowerCase().includes(cleanQuery.toLowerCase())
  );

  // Grouping Logic
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
      className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 active:scale-[0.98] transition-transform cursor-pointer flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg relative overflow-hidden">
        {card.imageUri ? (
          <img src={card.imageUri} alt="" className="w-full h-full object-cover" />
        ) : (
          card.name.charAt(0).toUpperCase()
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-slate-900 truncate text-sm flex items-center gap-2">
            {card.name}
            {card.country && <span className="text-[10px] font-normal bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">{card.country}</span>}
        </h3>
        <p className="text-xs text-slate-500 truncate">{card.title}</p>
        <p className="text-xs text-blue-600 font-medium truncate">{card.company}</p>
      </div>
    </div>
  );

  return (
    <>
      <header className="bg-white shadow-sm p-4 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-2">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 text-blue-600">
               <LogoIcon className="w-full h-full" />
             </div>
             <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              BizCard AI
            </h1>
           </div>
          <button 
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <SettingsIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="relative mt-2">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="検索 (氏名, 会社, 国...)" 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 pb-24 no-scrollbar">
         <div className="space-y-4">
             {/* Group Toggles */}
             <div className="flex bg-slate-200 p-1 rounded-xl mb-4">
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
              <div className="flex flex-col items-center justify-center h-64 text-slate-400 text-center">
                <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4">
                  <CameraIcon className="w-8 h-8 opacity-50"/>
                </div>
                <p>名刺が見つかりません。</p>
                <p className="text-sm mt-2">+ ボタンで最初の名刺を追加してください。</p>
              </div>
            ) : groupBy === 'NONE' ? (
              <div className="space-y-3">
                {filteredCards.map(card => (
                  <CardItem key={card.id} card={card} />
                ))}
              </div>
            ) : (
              sortedGroupKeys.map(group => (
                <div key={group} className="mb-4">
                   <h3 className="sticky top-0 bg-slate-50/95 backdrop-blur-sm py-2 px-1 text-xs font-bold text-slate-500 uppercase tracking-wider z-10 flex justify-between items-center border-b border-slate-200 mb-2">
                      {group}
                      <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{groupedCards![group].length}</span>
                   </h3>
                   <div className="space-y-3">
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
        className="absolute bottom-6 right-6 w-14 h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-full shadow-xl shadow-slate-300 flex items-center justify-center active:scale-90 transition-transform z-30"
      >
        <PlusIcon className="w-6 h-6" />
      </button>
    </>
  );
};