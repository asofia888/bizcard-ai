import { describe, it, expect } from 'vitest';
import { cardGradient, avatarGradient } from '../../utils/gradients';

describe('cardGradient', () => {
  it('returns an object with from and to properties', () => {
    const result = cardGradient('テスト');
    expect(result).toHaveProperty('from');
    expect(result).toHaveProperty('to');
    expect(result.from).toMatch(/^from-brand-/);
    expect(result.to).toMatch(/^to-brand-/);
  });

  it('returns consistent result for the same name', () => {
    const a = cardGradient('山田 太郎');
    const b = cardGradient('山田 太郎');
    expect(a).toEqual(b);
  });

  it('returns different results for different names (probabilistic)', () => {
    const names = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', '田中', '山田', '佐藤', '鈴木', '高橋'];
    const results = new Set(names.map(n => JSON.stringify(cardGradient(n))));
    // With 10 names and 6 gradients, we should get at least 2 different results
    expect(results.size).toBeGreaterThanOrEqual(2);
  });

  it('handles empty string without error', () => {
    const result = cardGradient('');
    expect(result).toHaveProperty('from');
    expect(result).toHaveProperty('to');
  });
});

describe('avatarGradient', () => {
  it('returns a space-separated "from-xxx to-xxx" string', () => {
    const result = avatarGradient('テスト');
    expect(result).toMatch(/^from-brand-\d+ to-brand-\d+$/);
  });

  it('returns consistent result for the same name', () => {
    expect(avatarGradient('Alice')).toBe(avatarGradient('Alice'));
  });

  it('matches cardGradient output for the same name', () => {
    const name = '山田 太郎';
    const card = cardGradient(name);
    const avatar = avatarGradient(name);
    expect(avatar).toBe(`${card.from} ${card.to}`);
  });
});
