import { Page } from '@playwright/test';

/**
 * アプリ起動前に localStorage へ名刺データをシードする。
 *
 * addInitScript はページのスクリプト実行前に走るため、起動済みアプリの
 * 自動保存 (初期化完了時の saveMetadata) とレースしない。
 * 以前の「goto → localStorage 書き込み → reload」方式は、旧ページのアプリが
 * シード後に初期サンプルカードで上書きする競合があり CI で不安定だった。
 *
 * Playwright はテストごとに新しいブラウザコンテキストを作るため、
 * localStorage / IndexedDB の明示的なクリアは不要。
 *
 * 呼び出し側は `await seedCards(page)` の後に `await page.goto('/')` すること。
 */
export async function seedCards(page: Page) {
  const cards = [
    {
      id: 'card-1',
      name: '山田 太郎',
      title: '代表取締役',
      company: '株式会社テックイノベーション',
      country: '日本',
      email: 'taro@example.com',
      phone: '03-1234-5678',
      website: 'www.example.com',
      address: '東京都渋谷区1-2-3',
      note: '展示会で交換',
      tags: ['展示会', '重要'],
      imageUri: null,
      imageUriBack: null,
      createdAt: Date.now() - 2000,
    },
    {
      id: 'card-2',
      name: '佐藤 花子',
      title: 'マーケティング部長',
      company: '株式会社グローバルソリューション',
      country: 'アメリカ',
      email: 'hanako@example.com',
      phone: '080-9876-5432',
      website: '',
      address: '大阪府大阪市1-1-1',
      note: '',
      tags: ['営業'],
      imageUri: null,
      imageUriBack: null,
      createdAt: Date.now() - 1000,
    },
    {
      id: 'card-3',
      name: 'John Smith',
      title: 'CEO',
      company: 'Global Tech Inc.',
      country: 'アメリカ',
      email: 'john@globaltech.com',
      phone: '+1-555-0100',
      website: 'globaltech.com',
      address: 'New York, NY',
      note: '',
      tags: ['海外'],
      imageUri: null,
      imageUriBack: null,
      createdAt: Date.now(),
    },
  ];

  await page.addInitScript((data) => {
    localStorage.setItem('bizcard_data', JSON.stringify(data));
  }, cards);
}
