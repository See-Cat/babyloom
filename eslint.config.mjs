import tseslint from '@typescript-eslint/parser';
import babyloom from './eslint-rules/index.js';

export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'lib/db/migrations/**',
      'eslint-rules/**',
      'test-data/**',
      'test-results/**',
      'playwright-report/**'
    ]
  },
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true }
      }
    },
    plugins: {
      babyloom
    },
    rules: {
      'babyloom/api-route-must-assert': 'error',
      'babyloom/no-raw-color': 'error',
      'babyloom/parent-chain-join': 'error'
    }
  }
];
