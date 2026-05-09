import { test, expect } from '@playwright/test';
import { resetAppState, seedCards } from './helpers';

test.describe('カード一覧画面', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await resetAppState(page);
    await seedCards(page);
    await page.reload();
  });

  test('初期表示: シードしたカードが全て表示される', async ({ page }) => {
    await expect(page.getByText('山田 太郎')).toBeVisible();
    await expect(page.getByText('佐藤 花子')).toBeVisible();
    await expect(page.getByText('John Smith')).toBeVisible();
  });

  test('検索: 名前で絞り込みできる', async ({ page }) => {
    const searchInput = page.getByPlaceholder('名前・会社名・タグで検索');
    await searchInput.fill('山田');

    await expect(page.getByText('山田 太郎')).toBeVisible();
    await expect(page.getByText('佐藤 花子')).not.toBeVisible();
    await expect(page.getByText('John Smith')).not.toBeVisible();
  });

  test('検索: 会社名で絞り込みできる', async ({ page }) => {
    const searchInput = page.getByPlaceholder('名前・会社名・タグで検索');
    await searchInput.fill('Global');

    await expect(page.getByText('John Smith')).toBeVisible();
    await expect(page.getByText('佐藤 花子')).toBeVisible(); // 株式会社グローバルソリューション
    await expect(page.getByText('山田 太郎')).not.toBeVisible();
  });

  test('グループ化: 国別にグループ化される', async ({ page }) => {
    await page.getByRole('button', { name: '国別' }).click();

    await expect(page.getByText('日本')).toBeVisible();
    await expect(page.getByText('アメリカ')).toBeVisible();
  });

  test('グループ化: 会社別にグループ化される', async ({ page }) => {
    await page.getByRole('button', { name: '会社別' }).click();

    await expect(page.getByText('株式会社テックイノベーション')).toBeVisible();
    await expect(page.getByText('Global Tech Inc.')).toBeVisible();
  });

  test('ソート: 氏名順に並び替えできる', async ({ page }) => {
    await page.getByRole('combobox').selectOption('name');

    const cards = page.locator('[class*="rounded-2xl"]').filter({ hasText: /太郎|花子|John/ });
    const firstCard = cards.first();
    await expect(firstCard).toContainText('John Smith');
  });

  test('タグフィルタ: タグをクリックで絞り込みできる', async ({ page }) => {
    await page.getByText('海外').click();

    await expect(page.getByText('John Smith')).toBeVisible();
    await expect(page.getByText('山田 太郎')).not.toBeVisible();
  });

  test('カードをクリックすると詳細画面に遷移する', async ({ page }) => {
    await page.getByText('山田 太郎').click();

    await expect(page.getByText('代表取締役')).toBeVisible();
    await expect(page.getByText('株式会社テックイノベーション')).toBeVisible();
    await expect(page.getByText('taro@example.com')).toBeVisible();
  });

  test('設定ボタンから設定画面に遷移する', async ({ page }) => {
    await page.getByLabel('設定').click();

    await expect(page.getByText('設定')).toBeVisible();
    await expect(page.getByText('CSVエクスポート')).toBeVisible();
  });

  test('FABがファイル選択 input を内包している', async ({ page }) => {
    const fab = page.getByLabel('名刺ファイルを追加');
    await expect(fab).toBeVisible();
    await expect(fab.locator('input[type="file"]')).toHaveCount(1);
  });
});
