import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
it('keeps foreign-key character sets compatible on shared-hosting database defaults', () => {
  const sql = readFileSync(new URL('../backend/sql/install.sql', import.meta.url), 'utf8');
  const engines = sql.match(/ENGINE=InnoDB[^;]*;/g) || [];
  expect(engines.length).toBeGreaterThan(10);
  for (const clause of engines)
    expect(clause).toContain('DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
  expect(sql.replace(/--[^\n]*/g, '')).not.toMatch(/\bCREATE\s+DATABASE\b/i);
});
