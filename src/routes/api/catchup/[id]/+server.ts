import { error, json } from '@sveltejs/kit';
import { getChannelCatchup, getLiveChannels } from '$lib/server/iptv';
import type { RequestHandler } from './$types';

const CHANNEL_ID = /^\d+$/;

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.userSession) throw error(401, 'Not authenticated');

	const { id } = params;
	if (!id || !CHANNEL_ID.test(id)) throw error(400, 'Invalid channel id');

	const streamId = Number(id);
	const channels = await getLiveChannels(locals.userSession);
	const channel = channels.find((c) => c.id === streamId);
	if (!channel) {
		console.error(`[catchup-api] channel ${streamId} not found in ${channels.length} loaded channels`);
		throw error(404, 'Channel not found');
	}

	console.log(`[catchup-api] listing programs for channel ${streamId} "${channel.name}" (archiveDays=${channel.archiveDays})`);
	const entries = await getChannelCatchup(locals.userSession, streamId, channel.archiveDays);
	console.log(`[catchup-api] channel ${streamId}: ${entries.length} program(s) in archive window`);
	return json({ entries });
};
