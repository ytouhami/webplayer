import { error } from '@sveltejs/kit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

const CONTENT_TYPES: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
	svg: 'image/svg+xml'
};

export const GET: RequestHandler = async ({ params }) => {
	const { filename } = params;

	if (!filename || !SAFE_FILENAME.test(filename)) {
		throw error(400, 'Invalid filename');
	}

	const ext = filename.split('.').pop()!.toLowerCase();
	const contentType = CONTENT_TYPES[ext];
	if (!contentType) {
		throw error(400, 'Unsupported file type');
	}

	const uploadsDir = path.resolve(env.UPLOADS_DIR ?? './uploads');
	const filePath = path.join(uploadsDir, filename);

	try {
		const data = await readFile(filePath);
		return new Response(new Uint8Array(data), {
			headers: {
				'content-type': contentType,
				'cache-control': 'public, max-age=31536000, immutable'
			}
		});
	} catch {
		throw error(404, 'File not found');
	}
};
