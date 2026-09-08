import { defineConfig } from 'vitest/config';
import type { UserConfig } from 'vite';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	// Work around a rolldown/oxc bug (rolldown 1.2.7, vite 8.2.2): when
	// `oxc.tsconfig` is left at its default (auto-discovery, i.e.
	// undefined) and Vite's internal tsconfig resolution cache is built
	// with no explicit path (vite always constructs it bare), the native
	// transform throws `TSCONFIG_ERROR: Tsconfig not found` for every
	// file, independent of file location or tsconfig content. Disabling
	// oxc's own tsconfig-aware transform features (unrelated to
	// TypeScript's own tsconfig resolution used by `svelte-check`/`tsc`)
	// avoids the broken code path; oxc only uses tsconfig to pick a
	// handful of transform-affecting compiler options which this project
	// doesn't rely on at transform time.
	// `tsconfig` is deliberately omitted from Vite's public `OxcOptions`
	// type (see `Omit<..., "tsconfig" | ...>` in vite/dist/node/index.d.ts)
	// even though it's a real, supported field on the underlying oxc
	// transform options — hence the cast.
	oxc: { tsconfig: false } as never as UserConfig['oxc'],
	plugins: [
		// Same workaround applied to Vite's dependency-optimizer build (a
		// separate Rolldown build, not covered by `oxc.tsconfig` above): it
		// hits the identical broken auto-tsconfig-discovery path while
		// resolving `node:module` from Rolldown's own injected CJS-interop
		// runtime chunk. Root-level `optimizeDeps.rolldownOptions` doesn't
		// reach this build (vite-plugin-svelte's own `configEnvironment`
		// hook replaces `optimizeDeps.rolldownOptions` per-environment
		// instead of merging with it), so contribute the same option
		// through a plugin hook of our own, which does merge.
		{
			name: 'local:disable-optimizer-tsconfig',
			configEnvironment() {
				return { optimizeDeps: { rolldownOptions: { tsconfig: false } } };
			}
		},
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// Explicit runtime: adapter-vercel refuses to infer one when building
			// under a non-LTS local Node (T3-m1-scaffold erratum, 7 Sep 2026).
			adapter: adapter({ runtime: 'nodejs22.x' })
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
