import { describe, it, expect } from 'vitest';
import { emptyEconomy } from '../src/economy';
import {
  purchaseTheme,
  readableAccent,
  contrast,
  accentInk,
  cleanThemePurchase,
} from '../src/themes';
const id = '12345678-1234-1234-1234-123456789abc';
describe('Theme Studio transactions', () => {
  it('unlocks atomically and an interrupted retry cannot charge twice', () => {
    const s = { ...emptyEconomy(), balance: 1200 },
      a = purchaseTheme([], s, id, 'unlock', {});
    expect(a.balance).toBe(200);
    expect(a.studioUnlocked).toBe(true);
    expect(purchaseTheme([], a, id, 'unlock', {})).toEqual(a);
    expect(s.balance).toBe(1200);
    expect(() =>
      purchaseTheme([], a, id, 'colors', { primary: '#123456', secondary: '#654321' }),
    ).toThrow();
  });
  it('charges each paid application and rejects insufficient balance without mutation', () => {
    const s = { ...emptyEconomy(), balance: 100, studioUnlocked: true },
      payload = { primary: '#123456', secondary: '#654321' },
      a = purchaseTheme([], s, id, 'colors', payload),
      b = purchaseTheme([], a, id.replace('abc', 'abd'), 'colors', payload);
    expect(b.balance).toBe(0);
    expect(() => purchaseTheme([], b, id.replace('abc', 'abe'), 'colors', payload)).toThrow(
      'Not enough',
    );
    expect(b.balance).toBe(0);
  });
  it('restores defaults free even after corrections leave a negative balance', () => {
    const s = { ...emptyEconomy(), balance: -100, theme: { primary: '#123456' } };
    const a = purchaseTheme([], s, id, 'default', {});
    expect(a.balance).toBe(-100);
    expect(a.theme).toEqual({});
  });
  it('maintains readable accent and button contrast for both appearances', () => {
    for (const color of ['#ffffff', '#000000', '#ffff00', '#ff00ff', '#0077ff', '#38dd90'])
      for (const dark of [false, true]) {
        const accent = readableAccent(color, dark);
        expect(contrast(accent, dark ? '#162c23' : '#fffef9')).toBeGreaterThanOrEqual(4.5);
        expect(contrast(accent, accentInk(accent))).toBeGreaterThanOrEqual(4.5);
      }
  });
  it('accepts a bounded mixer and refuses external paths or arbitrary colors', () => {
    expect(cleanThemePurchase('animated', { effects: ['stars', 'clouds'] })).toEqual({
      effects: ['clouds', 'stars'],
    });
    for (const payload of [{ effects: ['script'] }, { effects: ['stars', 'stars'] }])
      expect(() => cleanThemePurchase('animated', payload)).toThrow();
    expect(() => cleanThemePurchase('wallpaper', { fileId: '../../secret' })).toThrow();
    expect(() =>
      cleanThemePurchase('colors', { primary: 'url(test)', secondary: '#000000' }),
    ).toThrow();
  });
});
