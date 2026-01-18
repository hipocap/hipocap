import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unusedImports from 'eslint-plugin-unused-imports';

const compat = new FlatCompat({
  baseDirectory: process.cwd(),
});

export default [
  ...compat.extends('next/core-web-vitals'),
  prettierConfig,
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  {
    plugins: {
      'unused-imports': unusedImports,
      'simple-import-sort': simpleImportSort,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      indent: 'off',
      'eol-last': ['error', 'always'],
      'max-len': 'off',
      semi: ['error', 'always'],
      'no-trailing-spaces': 'off',
      'arrow-body-style': 'off',
      'no-duplicate-imports': ['error'],
      'unused-imports/no-unused-imports': 'off',
      'simple-import-sort/imports': 'off',
      'simple-import-sort/exports': 'off',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-page-custom-font': 'off',
      '@next/next/no-img-element': 'off',
      'react-hooks/exhaustive-deps': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]; 