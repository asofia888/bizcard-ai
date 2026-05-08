import { test, expect } from '@playwright/test';
import { resetAppState, seedCards } from './helpers';

test.describe('設定画面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await resetAppState(page);
    await seedCards(page);
    await page.reload();
    await page.getByLabel('設定').click();
  });

  test('統計情報が表示される', async ({ page }) => {
    // カード枚数が表示される
    await expect(page.getByText('3')).toBeVisible();
    await expect(page.getByText('枚')).toBeVisible();
  });

  test('CSVエクスポートでファイルがダウンロードされる', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('CSVエクスポート').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('バックアップでJSONファイルがダウンロードされる', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('今すぐバックアップ').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/bizcard_backup.*\.json$/);
  });

  test('バックアップから復元できる', async ({ page }) => {
    // 復元用のJSONを作成
    const backupData = JSON.stringify({
      version: 2,
      exportedAt: Date.now(),
      cards: [
        {
          id: 'restored-1',
          name: '復元テスト 太郎',
          title: 'テスト役職',
          company: '復元テスト社',
          country: '日本',
          email: 'restored@test.com',
          phone: '090-0000-0000',
          website: '',
          address: '',
          note: '',
          tags: [],
          imageUri: null,
          imageUriBack: null,
          createdAt: Date.now(),
        },
      ],
    });

    // ファイルアップロードをシミュレート
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('バックアップから復元').click();
    const fileChooser = await fileChooserPromise;

    // テンポラリファイルをバッファとしてセット
    await fileChooser.setFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupData),
    });

    // 確認ダイアログ
    const confirmDialog = page.getByText('現在のデータをすべて上書きして復元しますか？');
    await expect(confirmDialog).toBeVisible();

    // 復元ボタンをクリック（ダイアログ内のボタン）
    await page.getByRole('button', { name: '復元する' }).click();

    // 成功トースト
    await expect(page.getByText('1件の名刺を復元しました。')).toBeVisible();

    // 一覧に戻って復元されたデータを確認
    await page.getByLabel('戻る').click();
    await expect(page.getByText('復元テスト 太郎')).toBeVisible();
    // 元のデータは消えている
    await expect(page.getByText('山田 太郎')).not.toBeVisible();
  });

  test('戻るボタンで一覧に戻る', async ({ page }) => {
    await page.getByLabel('戻る').click();
    await expect(page.getByText('山田 太郎')).toBeVisible();
  });
});
