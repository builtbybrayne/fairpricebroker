import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		// The e2e suite signs in as arbitrary addresses; open the preview gate.
		env: { PREVIEW_SIGNIN_ALLOWLIST: '*' }
	},
	testMatch: '**/*.e2e.{ts,js}'
});
