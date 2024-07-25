import js from '@eslint/js';
import pluginReact from 'eslint-plugin-react';
import pluginReactHooks from 'eslint-plugin-react-hooks';
import pluginPrettier from 'eslint-config-prettier';
import pluginTypescriptEslint from 'typescript-eslint';
import globals from 'globals';

export default [
  js.configs.recommended,
  pluginReact.configs.flat.recommended,
  pluginPrettier,
  ...pluginTypescriptEslint.configs.recommended,
  // Hack around react-hooks not supporting eslint 9
  {
    plugins: {
      'react-hooks': pluginReactHooks,
    },
    rules: pluginReactHooks.configs.recommended.rules,
  },
  {
    ignores: ['dist', 'node_modules'],
    languageOptions: {
      parser: pluginTypescriptEslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      'import/extensions': ['.js', '.jsx', '.ts', '.tsx'],
      react: {
        version: '18.3.1',
      },
    },
  },
  {
    files: ['*.spec.*', '*.bspec*', '*.json', '*.config.*'],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  {
    files: ['*.json'],
    rules: {
      'typescript-eslint/no-loss-of-precision': 'off',
    },
  },
];
