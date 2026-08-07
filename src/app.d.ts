// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { UserSession } from '$lib/server/session';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			isAdmin: boolean;
			userSession: UserSession | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
