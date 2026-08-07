import { redirect } from '@sveltejs/kit';
import { getLiveChannels } from '$lib/server/iptv';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.userSession) {
		throw redirect(303, '/login');
	}

	const channels = await getLiveChannels(locals.userSession);
	return { channels };
};
