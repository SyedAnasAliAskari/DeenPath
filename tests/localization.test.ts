import { it, expect } from 'vitest';
import { localizationCoverage, translator } from '../src/i18n';
import { extra } from '../src/locales-extra';
it('covers every base UI key in Urdu and Arabic', () => {
  expect(localizationCoverage()).toEqual({ ur: [], ar: [] });
});
it('provides all new settings and test messages offline in three languages', () => {
  for (const key of Object.keys(extra))
    for (const lang of ['en', 'ur', 'ar'] as const)
      expect(translator(lang)(key as keyof typeof extra)).toBeTruthy();
});
