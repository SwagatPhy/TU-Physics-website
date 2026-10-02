import { getCollection } from 'astro:content';

// Published notices, pinned ones first, then newest first.
// Drafts are shown while developing (npm run dev) but never in the built site.
export async function getNotices() {
	const notices = await getCollection('notices', ({ data }) => import.meta.env.DEV || !data.draft);
	return notices.sort((a, b) => {
		if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
		return b.data.date.valueOf() - a.data.date.valueOf();
	});
}
