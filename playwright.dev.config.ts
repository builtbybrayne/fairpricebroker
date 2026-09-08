import { defineConfig } from '@playwright/test';
// Standalone runs against the already-running dev server (no build/preview).
export default defineConfig({
	testMatch: '**/*.e2e.{ts,js}',
	use: { baseURL: 'http://localhost:5173' },
	timeout: 60_000
});
