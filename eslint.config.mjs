import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.next/**',
      '**/out/**',
      '**/next-env.d.ts',
      'docs/**',
      'packages/mydata-xml/src/generated/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  ...nextVitals.map((config) => ({
    ...config,
    files: ['apps/demo/**/*.{ts,tsx}'],
    settings: { ...config.settings, next: { rootDir: 'apps/demo' } },
  })),
);
