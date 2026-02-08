import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier'
import importPlugin from 'eslint-plugin-import'
import prettierPlugin from 'eslint-plugin-prettier'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config({ ignores: ['dist', 'node_modules'] }, eslintConfigPrettier, {
  files: ['**/*.ts'],
  extends: [js.configs.recommended, ...tseslint.configs.recommended],
  languageOptions: {
    ecmaVersion: 2020,
    globals: { ...globals.node, ...globals.jest },
    parserOptions: {
      projectService: true,
      tsconfigRootDir: import.meta.dirname,
    },
  },
  plugins: {
    import: importPlugin,
    prettier: prettierPlugin,
  },
  settings: {
    'import/resolver': {
      typescript: true,
      node: true,
    },
  },
  rules: {
    ...importPlugin.flatConfigs.recommended.rules,
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'prettier/prettier': 'error',
    'import/order': [
      'warn',
      {
        groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
  },
})
