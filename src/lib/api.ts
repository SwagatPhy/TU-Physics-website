// Talking to the portal API (server/), which is served under /dphy/api/.
// In development `astro dev` forwards /dphy/api/ to the API (see astro.config.mjs).
//
// api('login', { method: 'POST', body: {...} }) resolves to one of:
//   { ok: true,  status, data }                    success
//   { ok: false, status, error, retryAfterSeconds } the API said no (error is a code)
//   { ok: false, status: 0, error: 'unavailable' } the API couldn't be reached at all
// It never throws, so pages only need to check `ok` and `error`.

import { withBase } from './url';

const API_ROOT = withBase('/api'); // "/dphy/api/"

export interface ApiResult<T = any> {
	ok: boolean;
	status: number;
	data?: T;
	error?: string;
	retryAfterSeconds?: number;
}

export async function api<T = any>(
	path: string,
	{ method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<ApiResult<T>> {
	let response: Response;
	try {
		response = await fetch(API_ROOT + path, {
			method,
			credentials: 'same-origin',
			// The API only accepts changes sent as JSON (its protection against cross-site forms).
			headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
			body: body === undefined ? (method === 'GET' ? undefined : '{}') : JSON.stringify(body),
		});
	} catch {
		return { ok: false, status: 0, error: 'unavailable' };
	}

	if (response.status === 204) return { ok: true, status: 204 }; // success with no body (logout)

	// No JSON back (e.g. the static host's own 404 page when no API is installed,
	// or a proxy error page) means the portal isn't there.
	const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
	const data = isJson ? await response.json().catch(() => null) : null;
	if (!isJson || response.status === 502 || response.status === 503 || response.status === 504) {
		return { ok: false, status: response.status, error: 'unavailable' };
	}
	if (!response.ok) {
		return { ok: false, status: response.status, error: data?.error ?? 'server_error', retryAfterSeconds: data?.retryAfterSeconds };
	}
	return { ok: true, status: response.status, data };
}

// Where a note's file is downloaded from (the API checks who may download it).
export function fileDownloadUrl(resourceId: number): string {
	return `${API_ROOT}files/${resourceId}`;
}

// The portal page addresses, for links and redirects.
export const portalPages = {
	login: withBase('/login'),
	register: withBase('/register'),
	forgotPassword: withBase('/forgot-password'),
	changePassword: withBase('/change-password'),
	portal: withBase('/portal'),
	faculty: withBase('/faculty'),
	approvals: withBase('/admin/approvals'),
	offerings: withBase('/admin/offerings'),
};
