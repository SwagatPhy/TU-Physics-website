// YAML parses unzoned frontmatter dates as UTC. A locally-zoned formatter
// then shifts the displayed date by the build machine's offset (a bare
// `2026-10-14` can render as the 13th anywhere west of Greenwich). Always
// format through this helper, never a bare toLocaleDateString.
export function formatDate(date: Date): string {
	return new Intl.DateTimeFormat('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	}).format(date);
}
