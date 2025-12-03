// eslint.config.js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import rn from 'eslint-plugin-react-native'
import { globalIgnores } from 'eslint/config'

export default tseslint.config([
  // Ignore common outputs
  globalIgnores(['dist', 'build', '.vite', 'coverage', 'node_modules']),

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
      // (eslint-plugin-react-native doesn't ship a flat "extends" preset yet;
      // we add the plugin + rules below.)
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-native': rn,
    },
    rules: {
      // TypeScript niceties
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],

      // Hooks correctness (reactHooks preset already adds these; keep them explicit if you like)
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // React Native on web (tune to taste)
      'react-native/no-raw-text': 'off',        // allow plain <Text> children
      'react-native/no-inline-styles': 'off',   // RN inline styles are common in your code
      'react-native/no-unused-styles': 'warn',
    },
  },
])
