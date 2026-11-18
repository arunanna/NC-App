const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/**', 'artifacts/**', '.expo/**', 'node_modules/**', 'android/**', 'ios/**'] },
  { files: ['app.config.js'], languageOptions: { globals: { __dirname: 'readonly' } } },
  { files: ['tests/**/*.js'], languageOptions: { globals: { fetch: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly' } } },
]);
