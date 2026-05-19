import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import tseslint from '@typescript-eslint/parser';

const rule = require('../../eslint-rules/no-raw-color');

const tester = new RuleTester({
  languageOptions: {
    parser: tseslint as any,
    ecmaVersion: 2022,
    sourceType: 'module',
    parserOptions: {
      ecmaFeatures: { jsx: true }
    }
  }
});

describe('babyloom/no-raw-color', () => {
  it('requires tokenized colors in app and component source', () => {
    tester.run('no-raw-color', rule as any, {
      valid: [
        {
          filename: '/repo/app/login/page.tsx',
          code: `export function Login(){ return <div className="bg-[var(--color-bg)] text-[var(--color-fg)]" />; }`
        },
        {
          filename: '/repo/components/ui/Button.tsx',
          code: `const style = { color: 'var(--color-accent)' };`
        },
        {
          filename: '/repo/scripts/example.ts',
          code: `const fixture = '#f8f8f0';`
        },
        {
          filename: '/repo/tests/unit/example.test.ts',
          code: `const fixture = '#ffcc00';`
        }
      ],
      invalid: [
        {
          filename: '/repo/app/login/page.tsx',
          code: `const color = '#ffcc00';`,
          errors: [{ messageId: 'rawColor' }]
        },
        {
          filename: '/repo/components/ui/Card.tsx',
          code: `const shadow = '0 4px 10px rgba(107, 92, 67, 0.42)';`,
          errors: [{ messageId: 'rawColor' }]
        },
        {
          filename: '/repo/components/ui/Tag.tsx',
          code: 'const color = `rgb(25, 200, 185)`;',
          errors: [{ messageId: 'rawColor' }]
        },
        {
          filename: '/repo/app/page.tsx',
          code: `export function Page(){ return <div style={{ background: '#fff' }} />; }`,
          errors: [{ messageId: 'rawColor' }]
        }
      ]
    });
  });
});
