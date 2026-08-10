import { getAppSettings } from '$lib/server/settings';
import type { RequestHandler } from './$types';

// Same default brand mark shown on login/setup pages when no logo is
// configured — used here too so an install before any admin logo upload
// still gets a real icon instead of a browser-generated placeholder.
function defaultIconDataUrl(accentColor: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1.5" y="1.5" width="61" height="61" rx="18" fill="#0C0F14" stroke="${accentColor}" stroke-opacity="0.35" stroke-width="1.5"/><rect x="13" y="36" width="7" height="12" rx="3" fill="${accentColor}"/><rect x="24" y="28" width="7" height="20" rx="3" fill="${accentColor}"/><rect x="35" y="20" width="7" height="28" rx="3" fill="${accentColor}"/><rect x="46" y="12" width="7" height="36" rx="3" fill="${accentColor}"/></svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function mimeFromDataUrl(dataUrl: string): string {
	return /^data:([^;]+);/.exec(dataUrl)?.[1] ?? 'image/png';
}

export const GET: RequestHandler = async () => {
	const settings = await getAppSettings();
	const iconSrc = settings.logoUrl ?? defaultIconDataUrl(settings.accentColor);
	const iconType = settings.logoUrl ? mimeFromDataUrl(settings.logoUrl) : 'image/svg+xml';

	// We don't decode the uploaded logo server-side to measure its actual
	// pixel dimensions (no image-processing dependency for that), so this
	// declares the two sizes browsers commonly look for when choosing/
	// scaling an install icon rather than a measured one — a single source
	// image gets scaled to fit either way.
	const manifest = {
		name: settings.appName,
		short_name: settings.appName.slice(0, 12),
		start_url: '/live',
		scope: '/',
		display: 'standalone',
		background_color: '#0a0d12',
		theme_color: settings.accentColor,
		icons: [
			{ src: iconSrc, sizes: '192x192', type: iconType },
			{ src: iconSrc, sizes: '512x512', type: iconType }
		]
	};

	return new Response(JSON.stringify(manifest), {
		headers: {
			'content-type': 'application/manifest+json',
			'cache-control': 'no-store'
		}
	});
};
