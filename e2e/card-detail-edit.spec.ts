import { test, expect } from '@playwright/test';
import { resetAppState, seedCards } from './helpers';

test.describe('カード詳細画面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await resetAppState(page);
    await seedCards(page);
    await page.reload();
    // カード一覧から山田太郎を選択
    await page.getByText('山田 太郎').click();
  });

  test('詳細情報が正しく表示される', async ({ page }) => {
    await expect(page.getByText('山田 太郎')).toBeVisible();
    await expect(page.getByText('代表取締役')).toBeVisible();
    await expect(page.getByText('株式会社テックイノベーション')).toBeVisible();
    await expect(page.getByText('taro@example.com')).toBeVisible();
    await expect(page.getByText('03-1234-5678')).toBeVisible();
    await expect(page.getByText('東京都渋谷区1-2-3')).toBeVisible();
  });

  test('メモが表示される', async ({ page }) => {
    await expect(page.getByText('展示会で交換')).toBeVisible();
  });

  test('タグが表示される', async ({ page }) => {
    await expect(page.getByText('展示会')).toBeVisible();
    await expect(page.getByText('重要')).toBeVisible();
  });

  test('戻るボタンで一覧に戻る', async ({ page }) => {
    await page.getByLabel('戻る').click();
    await expect(page.getByText('佐藤 花子')).toBeVisible(); // 一覧画面に戻った
  });

  test('vCardエクスポートでファイルがダウンロードされる', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await page.getByText('連絡先に保存 (.vcf)').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.vcf$/);
  });

  test('削除ボタンでカードが削除される', async ({ page }) => {
    await page.getByText('連絡先を削除').click();

    // 確認ダイアログ
    await expect(page.getByText('この名刺を削除してもよろしいですか？')).toBeVisible();
    await page.getByText('削除する').click();

    // 一覧に戻り、削除されたカードが消えている
    await expect(page.getByText('佐藤 花子')).toBeVisible();
    await expect(page.getByText('山田 太郎')).not.toBeVisible();
  });
});

test.describe('カード編集画面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await resetAppState(page);
    await seedCards(page);
    await page.reload();
    // 詳細画面→編集画面
    await page.getByText('山田 太郎').click();
    await page.getByLabel('編集').click();
  });

  test('既存データがフォームに反映される', async ({ page }) => {
    await expect(page.getByPlaceholder('氏名を入力')).toHaveValue('山田 太郎');
    await expect(page.getByPlaceholder('会社名を入力')).toHaveValue('株式会社テックイノベーション');
    await expect(page.getByPlaceholder('メールアドレスを入力')).toHaveValue('taro@example.com');
    await expect(page.getByPlaceholder('電話番号を入力')).toHaveValue('03-1234-5678');
  });

  test('フォームを編集して保存できる', async ({ page }) => {
    const nameInput = page.getByPlaceholder('氏名を入力');
    await nameInput.fill('山田 次郎');

    const companyInput = page.getByPlaceholder('会社名を入力');
    await companyInput.fill('株式会社ニューテック');

    await page.getByText('保存する').click();

    // 一覧画面に戻り、変更が反映されている
    await expect(page.getByText('山田 次郎')).toBeVisible();
    await expect(page.getByText('株式会社ニューテック')).toBeVisible();
  });

  test('氏名と会社名が両方空の場合は保存できない', async ({ page }) => {
    await page.getByPlaceholder('氏名を入力').fill('');
    await page.getByPlaceholder('会社名を入力').fill('');

    await page.getByText('保存する').click();

    // エラートーストが表示される
    await expect(page.getByText('氏名または会社名を入力してください')).toBeVisible();
  });

  test('戻るボタンで詳細画面に戻る（変更を保存せず）', async ({ page }) => {
    await page.getByPlaceholder('氏名を入力').fill('変更テスト');
    await page.getByLabel('戻る').click();

    // 詳細画面に戻り、元のデータが表示される
    await expect(page.getByText('山田 太郎')).toBeVisible();
  });

  test('タグを追加できる', async ({ page }) => {
    const tagInput = page.getByPlaceholder('タグを追加 (Enterで確定)').or(
      page.locator('input[placeholder=""]').last()
    );
    // タグ入力は既存タグがある場合placeholderが空になるので、タグセクション内のinputを探す
    const tagSection = page.locator('text=タグ').locator('..');
    const input = tagSection.locator('input');
    await input.fill('新規タグ');
    await input.press('Enter');

    await expect(page.getByText('新規タグ')).toBeVisible();
  });
});
