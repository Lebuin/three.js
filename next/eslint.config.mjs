import { FlatCompat } from '@eslint/eslintrc';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import { dirname } from 'path';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default tseslint.config(
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  stylistic.configs.customize({
    semi: true,
  }),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-constant-condition': 'off',
      '@stylistic/arrow-parens': 'off',
      '@stylistic/brace-style': ['error', '1tbs'],
      '@stylistic/indent-binary-ops': 'off',
      '@stylistic/lines-between-class-members': 'off',
      '@stylistic/operator-linebreak': 'off',
      '@stylistic/quotes': ['warn', 'single', { avoidEscape: true }],
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': [
        'error',
        {
          allowConstantLoopConditions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        {
          allowAny: false,
          allowBoolean: true,
          allowNullish: true,
          allowNumber: true,
          allowRegExp: true,
          allowNever: true,
        },
      ],
      curly: ['error', 'all'],
    },
  },
  {
    ignores: ['**/*.mjs', '**/*.mts'],
  },
);
