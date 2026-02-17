import { useState, useEffect } from 'react';
import { BusinessCard } from '../types';

const INITIAL_CARDS: BusinessCard[] = [
  {
    id: '1',
    name: '山田 太郎',
    title: '代表取締役',
    company: '株式会社テックイノベーション',
    country: '日本',
    email: 'taro.yamada@tech-innovation.co.jp',
    phone: '03-1234-5678',
    website: 'www.tech-innovation.co.jp',
    address: '東京都渋谷区道玄坂1-2-3',
    note: '2024年の展示会で名刺交換。DX推進担当。',
    imageUri: null,
    createdAt: Date.now()
  }
];

export const useBusinessCards = () => {
  const [cards, setCards] = useState<BusinessCard[]>(() => {
    try {
      const saved = localStorage.getItem('bizcard_data');
      return saved ? JSON.parse(saved) : INITIAL_CARDS;
    } catch {
      return INITIAL_CARDS;
    }
  });

  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() => {
    const time = localStorage.getItem('bizcard_last_backup_time');
    return time ? parseInt(time, 10) : null;
  });

  // Persistence and Auto-backup
  useEffect(() => {
    localStorage.setItem('bizcard_data', JSON.stringify(cards));
    
    const checkAutoBackup = () => {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      
      if (!lastBackupTime || (now - lastBackupTime > ONE_DAY)) {
        console.log("Performing auto-backup...");
        localStorage.setItem('bizcard_backup', JSON.stringify(cards));
        localStorage.setItem('bizcard_last_backup_time', now.toString());
        setLastBackupTime(now);
      }
    };
    
    const timer = setTimeout(checkAutoBackup, 2000);
    return () => clearTimeout(timer);
  }, [cards, lastBackupTime]);

  const addCard = (card: BusinessCard) => {
    setCards([card, ...cards]);
  };

  const updateCard = (updatedCard: BusinessCard) => {
    setCards(cards.map(c => c.id === updatedCard.id ? updatedCard : c));
  };

  const deleteCard = (id: string) => {
    if (confirm("この名刺を削除してもよろしいですか？")) {
      setCards(cards.filter(c => c.id !== id));
      return true;
    }
    return false;
  };

  const createBackup = () => {
    const now = Date.now();
    localStorage.setItem('bizcard_backup', JSON.stringify(cards));
    localStorage.setItem('bizcard_last_backup_time', now.toString());
    setLastBackupTime(now);
    alert('バックアップを作成しました。');
  };

  const restoreBackup = () => {
    const backupData = localStorage.getItem('bizcard_backup');
    if (!backupData) {
      alert('バックアップデータが見つかりません。');
      return;
    }
    if (confirm('現在のデータを上書きしてバックアップから復元しますか？この操作は取り消せません。')) {
      try {
        const parsed = JSON.parse(backupData);
        setCards(parsed);
        alert('復元が完了しました。');
      } catch (e) {
        alert('データの復元に失敗しました。');
      }
    }
  };

  const exportCSV = () => {
    if (cards.length === 0) {
      alert("エクスポートするデータがありません。");
      return;
    }

    const escapeCSV = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const headers = ['ID', '氏名', '会社名', '役職', '国', 'メール', '電話番号', 'Webサイト', '住所', 'メモ', '作成日'];
    const rows = cards.map(c => [
      escapeCSV(c.id),
      escapeCSV(c.name),
      escapeCSV(c.company),
      escapeCSV(c.title),
      escapeCSV(c.country),
      escapeCSV(c.email),
      escapeCSV(c.phone),
      escapeCSV(c.website),
      escapeCSV(c.address),
      escapeCSV(c.note),
      escapeCSV(new Date(c.createdAt).toLocaleString()),
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Add BOM for Excel compatibility with UTF-8
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bizcards_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return {
    cards,
    lastBackupTime,
    addCard,
    updateCard,
    deleteCard,
    createBackup,
    restoreBackup,
    exportCSV
  };
};