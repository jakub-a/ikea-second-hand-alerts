import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function readAppVersion() {
  try {
    const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
    return packageJson.version || '0.0.0';
  } catch (err) {
    return '0.0.0';
  }
}

function readGitShortSha() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch (err) {
    return 'nogit';
  }
}

function createBuildVersion() {
  const baseVersion = readAppVersion();
  const sha = readGitShortSha();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '');
  return `${baseVersion}+${stamp}-${sha}`;
}

const appBuildVersion = process.env.VITE_APP_VERSION || createBuildVersion();

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appBuildVersion)
  },
  server: {
    fs: {
      allow: ['../..']
    },
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8787'
    }
  }
});
