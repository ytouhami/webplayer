import { error, json } from '@sveltejs/kit';
import { getChannelEpg } from '$lib/server/iptv';
import type { RequestHandler } from './$types';

const CHANNEL_ID = /^\d+$/;

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.userSession) throw error(401, 'Not authenticated');

	const { id } = params;
	if (!id || !CHANNEL_ID.test(id)) throw error(400, 'Invalid channel id');

	const listings = await getChannelEpg(locals.userSession, Number(id));
	return json({ listings });
};
