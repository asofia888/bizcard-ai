import { useState, useEffect, useRef, useContext } from 'react';
import { BusinessCard } from '../types';
import { saveImage, getAllImages, deleteImage } from '../utils/imageDB';
import { DialogContext } from '../components/Dialog';

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

/** localStorage からカードメタデータを読み込む（imageUri は null で返る） */
function loadMetadata(): BusinessCard[] {
  try {
    const saved = localStorage.getItem('bizcard_data');
    return saved ? JSON.parse(saved) : INITIAL_CARDS;
  } catch {
    return INITIAL_CARDS;
  }
}

/** localStorage にメタデータのみ保存（imageUri は除外） */
function saveMetadata(cards: BusinessCard[], key = 'bizcard_data'): void {
  const metadata = cards.map(c => ({ ...c, imageUri: null }));
  localStorage.setItem(key, JSON.stringify(metadata));
}

export const useBusinessCards = () => {
  // DialogContext がない環境（テスト等）でも動作するようにフォールバックを用意
  const dialogCtx = useContext(DialogContext);
  const showToast = dialogCtx?.showToast ?? ((msg: string) => alert(msg));
  const showConfirm =
    dialogCtx?.showConfirm ?? ((msg: string) => Promise.resolve(window.confirm(msg)));

  // 初期値はメタデータのみ（imageUri: null）。画像は後で IndexedDB から注入する。
  const [cards, setCards] = useState<BusinessCard[]>(loadMetadata);

  const [lastBackupTime, setLastBackupTime] = useState<number | null>(() => {
    try {
      const time = localStorage.getItem('bizcard_last_backup_time');
      return time ? parseInt(time, 10) : null;
    } catch {
      return null;
    }
  });

  // IndexedDB からの画像ロード完了後のみ永続化を実行するフラグ
  const initializedRef = useRef(false);

  // マウント時: 旧フォーマット（localStorage に base64 画像）を IndexedDB へ移行し、
  // 全画像を IndexedDB から読み込んでカード状態にマージする
  useEffect(() => {
    const init = async () => {
      try {
        const metadata = loadMetadata();

        // 旧フォーマットの移行: imageUri が base64 データなら IndexedDB へ移動
        const toMigrate = metadata.filter(
          c => c.imageUri && typeof c.imageUri === 'string' && c.imageUri.startsWith('data:')
        );
        if (toMigrate.length > 0) {
          await Promise.all(
            toMigrate.map(c => saveImage(c.id, c.imageUri as string))
          );
        }

        // IndexedDB から全画像を取得してメタデータにマージ
        const images = await getAllImages();
        const cardsWithImages = metadata.map(c => ({
          ...c,
          imageUri: images[c.id] ?? null,
        }));

        initializedRef.current = true;
        setCards(cardsWithImages);
      } catch (e) {
        console.error('Failed to initialize cards with images:', e);
        initializedRef.current = true;
      }
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 永続化 & 自動バックアップ
  // IndexedDB ロード完了前は実行しない（initializedRef で制御）
  useEffect(() => {
    if (!initializedRef.current) return;

    try {
      saveMetadata(cards);
    } catch (e) {
      console.error('Failed to save cards:', e);
    }

    const checkAutoBackup = () => {
      const now = Date.now();
      const ONE_DAY = 24 * 60 * 60 * 1000;
      if (!lastBackupTime || now - lastBackupTime > ONE_DAY) {
        try {
          saveMetadata(cards, 'bizcard_backup');
          localStorage.setItem('bizcard_last_backup_time', now.toString());
          setLastBackupTime(now);
        } catch (e) {
          console.error('Failed to auto-backup:', e);
        }
      }
    };

    const timer = setTimeout(checkAutoBackup, 2000);
    return () => clearTimeout(timer);
  }, [cards, lastBackupTime]);

  const addCard = (card: BusinessCard) => {
    if (card.imageUri) {
      saveImage(card.id, card.imageUri).catch(e =>
        console.error('Failed to save image to IndexedDB:', e)
      );
    }
    setCards(prev => [card, ...prev]);
  };

  const updateCard = (updatedCard: BusinessCard) => {
    if (updatedCard.imageUri) {
      saveImage(updatedCard.id, updatedCard.imageUri).catch(e =>
        console.error('Failed to save image to IndexedDB:', e)
      );
    }
    setCards(prev => prev.map(c => c.id === updatedCard.id ? updatedCard : c));
  };

  const deleteCard = async (id: string): Promise<boolean> => {
    const confirmed = await showConfirm('この名刺を削除してもよろしいですか？', '削除する');
    if (confirmed) {
      deleteImage(id).catch(e =>
        console.error('Failed to delete image from IndexedDB:', e)
      );
      setCards(prev => prev.filter(c => c.id !== id));
      return true;
    }
    return false;
  };

  const createBackup = () => {
    try {
      const now = Date.now();
      saveMetadata(cards, 'bizcard_backup');
      localStorage.setItem('bizcard_last_backup_time', now.toString());
      setLastBackupTime(now);
      showToast('バックアップを作成しました。', 'success');
    } catch (e) {
      console.error('Failed to create backup:', e);
      showToast('バックアップの作成に失敗しました。ストレージの空き容量を確認してください。', 'error');
    }
  };

  const restoreBackup = async () => {
    let backupRaw: string | null;
    try {
      backupRaw = localStorage.getItem('bizcard_backup');
    } catch {
      showToast('バックアップデータの読み込みに失敗しました。', 'error');
      return;
    }
    if (!backupRaw) {
      showToast('バックアップデータが見つかりません。', 'info');
      return;
    }
    const confirmed = await showConfirm(
      '現在のデータを上書きしてバックアップから復元しますか？この操作は取り消せません。',
      '復元する'
    );
    if (!confirmed) return;

    try {
      const parsed: BusinessCard[] = JSON.parse(backupRaw);

      // 旧フォーマットのバックアップ対応: base64 画像があれば IndexedDB へ移行
      const toMigrate = parsed.filter(
        c => c.imageUri && typeof c.imageUri === 'string' && c.imageUri.startsWith('data:')
      );
      if (toMigrate.length > 0) {
        await Promise.all(
          toMigrate.map(c => saveImage(c.id, c.imageUri as string))
        );
      }

      // IndexedDB から最新の画像をマージ
      const images = await getAllImages();
      const cardsWithImages = parsed.map(c => ({
        ...c,
        imageUri: images[c.id] ?? null,
      }));

      setCards(cardsWithImages);
      showToast('復元が完了しました。', 'success');
    } catch {
      showToast('データの復元に失敗しました。', 'error');
    }
  };

  const exportCSV = () => {
    if (cards.length === 0) {
      showToast('エクスポートするデータがありません。', 'info');
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

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bizcards_${new Date().toISOString().slice(0, 10)}.csv`);
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
    exportCSV,
  };
};
