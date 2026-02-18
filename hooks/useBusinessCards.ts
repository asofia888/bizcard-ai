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
    tags: ['展示会', '重要'],
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

  // 画像を含むバックアップJSONファイルをダウンロード
  const createBackup = async () => {
    try {
      const images = await getAllImages();
      const backupData = {
        version: 2,
        exportedAt: Date.now(),
        cards: cards.map(c => ({
          ...c,
          imageUri: images[c.id] ?? null,
        })),
      };
      const blob = new Blob([JSON.stringify(backupData)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bizcard_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const now = Date.now();
      localStorage.setItem('bizcard_last_backup_time', now.toString());
      setLastBackupTime(now);
      showToast('バックアップファイルをダウンロードしました。', 'success');
    } catch (e) {
      console.error('Failed to create backup:', e);
      showToast('バックアップの作成に失敗しました。', 'error');
    }
  };

  // バックアップJSONファイルを選択して復元
  const restoreBackup = async () => {
    const confirmed = await showConfirm(
      '現在のデータを上書きしてバックアップから復元しますか？この操作は取り消せません。',
      '復元する'
    );
    if (!confirmed) return;

    // ファイル選択ダイアログを開く
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => resolve(input.files?.[0] ?? null);
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // v1形式（配列）またはv2形式（{ version, cards }）に対応
      let cardsData: BusinessCard[];
      if (Array.isArray(parsed)) {
        cardsData = parsed; // 旧形式
      } else if (parsed.version >= 2 && Array.isArray(parsed.cards)) {
        cardsData = parsed.cards; // 新形式（画像含む）
      } else {
        throw new Error('Invalid backup format');
      }

      // 画像を IndexedDB に保存
      const imageCards = cardsData.filter(
        c => c.imageUri && typeof c.imageUri === 'string' && c.imageUri.startsWith('data:')
      );
      if (imageCards.length > 0) {
        await Promise.all(imageCards.map(c => saveImage(c.id, c.imageUri as string)));
      }

      // メタデータを localStorage に保存
      saveMetadata(cardsData);

      // IndexedDB から全画像をマージ
      const images = await getAllImages();
      const cardsWithImages = cardsData.map(c => ({
        ...c,
        imageUri: images[c.id] ?? null,
      }));

      setCards(cardsWithImages);
      showToast(`${cardsData.length}件の名刺を復元しました。`, 'success');
    } catch (e) {
      console.error('Restore failed:', e);
      showToast('復元に失敗しました。バックアップファイルを確認してください。', 'error');
    }
  };

  const exportCSV = () => {
    if (cards.length === 0) {
      showToast('エクスポートするデータがありません。', 'info');
      return;
    }

    const escapeCSV = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const headers = ['ID', '氏名', '会社名', '役職', '国', 'メール', '電話番号', 'Webサイト', '住所', 'メモ', 'タグ', '作成日'];
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
      escapeCSV((c.tags || []).join('; ')),
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
