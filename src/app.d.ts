// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Request-scoped client (anon key + this request's cookies). */
			supabase: SupabaseClient;
			/** Session validated via getUser(); never trust getSession() alone. */
			safeGetSession(): Promise<{ session: Session | null; user: User | null }>;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
