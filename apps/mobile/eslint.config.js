// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
    // TypeScript resolves the workspace alias; the import plugin cannot safely
    // case-scan the sandboxed parent directory in this monorepo environment.
    rules: { 'import/no-unresolved': 'off' },
  }
]);
