import { useState, useEffect, useRef, useContext } from 'react';
import { BusinessCard } from '../types';
import { saveImage, getImage, getAllImages, getAllKeys, deleteImage } from '../utils/imageDB';
import { generateThumbnail } from '../utils/imageUtils';
import { DialogContext } from '../components/Dialog';

const THUMB_SUFFIX = '_thumb';
const BACK_SUFFIX  = '_back';

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
    tags: [],
    imageUri: null,
    imageUriBack: null,
    thumbUri: null,
    createdAt: Date.now()
  }
];

/** localStorage からカードメタデータを読み込む（画像系フィールドは null で返る） */
function loadMetadata(): BusinessCard[] {
  try {
    const saved = localStorage.getItem('bizcard_data');
    const cards = saved ? JSON.parse(saved) : INITIAL_CARDS;
    if (!Array.isArray(cards)) return INITIAL_CARDS;
    // 旧データ正規化: imageUriBack / thumbUri が無いケースに備える
    return cards.map((c: any) => ({ imageUriBack: null, thumbUri: null, ...c }));
  } catch {
    return INITIAL_CARDS;
  }
}

/**
 * 復元データの1件を検証・正規化する。
 * id を持たない壊れたエントリは null（復元対象外）。
 * 文字列フィールドの型違いは空文字に、欠損した createdAt は現在時刻に補正する。
 */
export function sanitizeCard(raw: unknown): BusinessCard | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.id !== 'string' || !c.id) return null;
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const dataUri = (v: unknown) => (typeof v === 'string' && v.startsWith('data:') ? v : null);
  return {
    id: c.id,
    name: str(c.name),
    title: str(c.title),
    company: str(c.company),
    country: str(c.country),
    email: str(c.email),
    phone: str(c.phone),
    website: str(c.website),
    address: str(c.address),
    note: str(c.note),
    tags: Array.isArray(c.tags) ? c.tags.filter((t): t is string => typeof t === 'string') : [],
    imageUri: dataUri(c.imageUri),
    imageUriBack: dataUri(c.imageUriBack),
    thumbUri: dataUri(c.thumbUri),
    createdAt: typeof c.createdAt === 'number' && Number.isFinite(c.createdAt) ? c.createdAt : Date.now(),
  };
}

/** 復元データ全体を検証し、有効なカードのみを返す（id 重複は先勝ち） */
export function sanitizeCards(raw: unknown[]): BusinessCard[] {
  const seen = new Set<string>();
  const result: BusinessCard[] = [];
  for (const entry of raw) {
    const card = sanitizeCard(entry);
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    result.push(card);
  }
  return result;
}

/** localStorage にメタデータのみ保存（画像データは除外） */
function saveMetadata(cards: BusinessCard[], key = 'bizcard_data'): void {
  const metadata = cards.map(c => ({ ...c, imageUri: null, imageUriBack: null, thumbUri: null }));
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
  // サムネイルのみ IndexedDB から読み込んでカード状態にマージする。
  // フル画像は数MB×枚数分のメモリを食うため、詳細・編集を開いた時に hydrateCard で遅延ロードする。
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

        // キー一覧だけ先に取り、サムネがあるカードのみ値を読み込む
        const keys = new Set(await getAllKeys());
        const thumbs = await Promise.all(
          metadata.map(c =>
            keys.has(c.id + THUMB_SUFFIX) ? getImage(c.id + THUMB_SUFFIX) : Promise.resolve(undefined)
          )
        );
        const leanCards = metadata.map((c, i) => ({
          ...c,
          imageUri: null,
          imageUriBack: null,
          thumbUri: thumbs[i] ?? null,
        }));

        initializedRef.current = true;
        setCards(leanCards);

        // バックフィル: フル画像はあるがサムネ未生成のカードに対し、
        // 1枚ずつフル画像を読み込んでサムネを生成・永続化する（フル画像は state に保持しない）。
        const needsThumb = metadata.filter(c => keys.has(c.id) && !keys.has(c.id + THUMB_SUFFIX));
        if (needsThumb.length > 0) {
          (async () => {
            for (const card of needsThumb) {
              try {
                const full = await getImage(card.id);
                if (!full) continue;
                const thumb = await generateThumbnail(full);
                await saveImage(card.id + THUMB_SUFFIX, thumb);
                setCards(prev => prev.map(c => (c.id === card.id ? { ...c, thumbUri: thumb } : c)));
              } catch (e) {
                console.error('Failed to backfill thumbnail for', card.id, e);
              }
            }
          })();
        }
      } catch (e) {
        console.error('Failed to initialize cards with images:', e);
        initializedRef.current = true;
      }
    };
    init();
  }, []);

  /**
   * 詳細・編集表示用にフル画像（表面・裏面）を IndexedDB から読み込んで返す。
   * リスト状態にはサムネしか持たないため、必要になった時点でロードする。
   */
  const hydrateCard = async (card: BusinessCard): Promise<BusinessCard> => {
    try {
      const [front, back] = await Promise.all([
        getImage(card.id),
        getImage(card.id + BACK_SUFFIX),
      ]);
      return { ...card, imageUri: front ?? card.imageUri, imageUriBack: back ?? card.imageUriBack };
    } catch (e) {
      console.error('Failed to load full images for', card.id, e);
      return card;
    }
  };

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

  // 表面画像が変わったらサムネを再生成し IDB と state に反映する。
  // サムネ完成時点でフル画像を state から降ろす（リスト状態はサムネのみ保持する方針）。
  // 失敗してもアプリは止めない (state に残ったフル画像へフォールバック表示できる)。
  const refreshThumbnail = (id: string, imageUri: string) => {
    generateThumbnail(imageUri)
      .then(thumb => {
        setCards(prev =>
          prev.map(c =>
            c.id === id ? { ...c, thumbUri: thumb, imageUri: null, imageUriBack: null } : c
          )
        );
        return saveImage(id + THUMB_SUFFIX, thumb);
      })
      .catch(e => console.error('Failed to generate/save thumbnail:', e));
  };

  const addCard = (card: BusinessCard) => {
    // 新規カードはサムネ完成までフル画像を一時的に state に残す（リストのプレースホルダー点滅防止）。
    // サムネ完成後に refreshThumbnail がフル画像を state から降ろす。
    const seeded: BusinessCard = { ...card, thumbUri: card.thumbUri ?? null };
    if (card.imageUri) {
      saveImage(card.id, card.imageUri).catch(e =>
        console.error('Failed to save image to IndexedDB:', e)
      );
      refreshThumbnail(card.id, card.imageUri);
    }
    if (card.imageUriBack) {
      saveImage(card.id + BACK_SUFFIX, card.imageUriBack).catch(e =>
        console.error('Failed to save back image to IndexedDB:', e)
      );
    }
    setCards(prev => [seeded, ...prev]);
  };

  const updateCard = (updatedCard: BusinessCard) => {
    if (updatedCard.imageUri) {
      saveImage(updatedCard.id, updatedCard.imageUri).catch(e =>
        console.error('Failed to save image to IndexedDB:', e)
      );
      refreshThumbnail(updatedCard.id, updatedCard.imageUri);
    } else {
      // 画像が消えた → サムネも削除
      deleteImage(updatedCard.id + THUMB_SUFFIX).catch(() => { /* なければ無視 */ });
    }
    if (updatedCard.imageUriBack) {
      saveImage(updatedCard.id + BACK_SUFFIX, updatedCard.imageUriBack).catch(e =>
        console.error('Failed to save back image to IndexedDB:', e)
      );
    }
    // 既存の thumbUri を維持しつつ更新 (新サムネは refreshThumbnail で後ほど上書き)。
    // フル画像は IndexedDB に保存済みなので state には持たない。
    setCards(prev =>
      prev.map(c =>
        c.id === updatedCard.id
          ? { ...updatedCard, imageUri: null, imageUriBack: null, thumbUri: c.thumbUri ?? null }
          : c
      )
    );
  };

  const deleteCard = async (id: string): Promise<boolean> => {
    const confirmed = await showConfirm('この名刺を削除してもよろしいですか？', '削除する');
    if (confirmed) {
      deleteImage(id).catch(e =>
        console.error('Failed to delete image from IndexedDB:', e)
      );
      deleteImage(id + BACK_SUFFIX).catch(() => { /* 裏面がない場合は無視 */ });
      deleteImage(id + THUMB_SUFFIX).catch(() => { /* サムネがない場合は無視 */ });
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
          imageUri:     images[c.id]                ?? null,
          imageUriBack: images[c.id + BACK_SUFFIX]  ?? null,
          // サムネはフル画像から再生成可能なため、バックアップサイズ削減のため除外
          thumbUri:     null,
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
      // ダイアログをキャンセルした場合に Promise が未解決のまま残らないようにする
      input.oncancel = () => resolve(null);
      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // v1形式（配列）またはv2形式（{ version, cards }）に対応
      let rawCards: unknown[];
      if (Array.isArray(parsed)) {
        rawCards = parsed; // 旧形式
      } else if (parsed && parsed.version >= 2 && Array.isArray(parsed.cards)) {
        rawCards = parsed.cards; // 新形式（画像含む）
      } else {
        throw new Error('Invalid backup format');
      }

      // 壊れたエントリ（id 欠損・型違い）を除外し、フィールドを正規化する
      const cardsData = sanitizeCards(rawCards);
      if (cardsData.length === 0) {
        showToast('バックアップに有効な名刺データが含まれていません。', 'error');
        return;
      }
      const skipped = rawCards.length - cardsData.length;

      // 新しい画像を先に保存する（put は同一キーを上書き）。
      // 旧データの削除は全保存が成功した後に行うため、途中で失敗（容量超過等）しても
      // 旧メタデータ + 旧画像は無傷のまま残る。
      const imageCards = cardsData.filter(c => c.imageUri);
      if (imageCards.length > 0) {
        await Promise.all(imageCards.map(c => saveImage(c.id, c.imageUri as string)));
      }
      const backImageCards = cardsData.filter(c => c.imageUriBack);
      if (backImageCards.length > 0) {
        await Promise.all(backImageCards.map(c => saveImage(c.id + BACK_SUFFIX, c.imageUriBack as string)));
      }

      // 復元データに含まれるサムネを優先採用、なければフル画像から再生成して保存
      const thumbResults = await Promise.all(
        imageCards.map(async c => {
          if (c.thumbUri) {
            return { id: c.id, thumb: c.thumbUri };
          }
          try {
            const thumb = await generateThumbnail(c.imageUri as string);
            return { id: c.id, thumb };
          } catch {
            return null;
          }
        })
      );
      await Promise.all(
        thumbResults
          .filter((r): r is { id: string; thumb: string } => r !== null)
          .map(r => saveImage(r.id + THUMB_SUFFIX, r.thumb))
      );

      // 全保存が成功してから、復元データに属さない旧キー（孤児画像）を削除する
      const validKeys = new Set<string>();
      for (const c of cardsData) {
        if (c.imageUri) {
          validKeys.add(c.id);
          validKeys.add(c.id + THUMB_SUFFIX);
        }
        if (c.imageUriBack) validKeys.add(c.id + BACK_SUFFIX);
      }
      const orphanKeys = (await getAllKeys()).filter(k => !validKeys.has(k));
      if (orphanKeys.length > 0) {
        await Promise.all(orphanKeys.map(k => deleteImage(k)));
      }

      // メタデータを localStorage に保存
      saveMetadata(cardsData);

      // state にはサムネのみ反映（フル画像は詳細表示時に遅延ロード）
      const thumbMap = new Map(
        thumbResults
          .filter((r): r is { id: string; thumb: string } => r !== null)
          .map(r => [r.id, r.thumb])
      );
      const leanCards = cardsData.map(c => ({
        ...c,
        imageUri: null,
        imageUriBack: null,
        thumbUri: thumbMap.get(c.id) ?? null,
      }));

      setCards(leanCards);
      showToast(
        skipped > 0
          ? `${cardsData.length}件の名刺を復元しました（壊れていた${skipped}件はスキップ）。`
          : `${cardsData.length}件の名刺を復元しました。`,
        'success'
      );
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

    // 数式インジェクション対策: Excel/Sheets が数式として解釈する先頭文字 (= + - @ タブ CR) には ' を前置する
    const escapeCSV = (val: string) => {
      let v = val || '';
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return `"${v.replace(/"/g, '""')}"`;
    };
    // ISO 8601 (空白区切り・ローカル時刻)。toLocaleString() は環境依存で Excel のパースが不安定なため使わない
    const formatDateTime = (ts: number) => {
      const d = new Date(ts);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
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
      escapeCSV(formatDateTime(c.createdAt)),
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
    URL.revokeObjectURL(url);
  };

  return {
    cards,
    lastBackupTime,
    hydrateCard,
    addCard,
    updateCard,
    deleteCard,
    createBackup,
    restoreBackup,
    exportCSV,
  };
};
