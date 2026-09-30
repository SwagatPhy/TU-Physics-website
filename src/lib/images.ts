// Research-area images in /public/Research-areas are full-size originals
// (several MB each). Pages use the resized copies in /Research-areas/web/,
// which share the original's base name but are always .jpg.
// To add a new image: drop the original in public/Research-areas/ and a
// ~900px-wide JPEG with the same base name in public/Research-areas/web/.
export function researchImage(filename: string): string {
	const baseName = filename.replace(/\.[^.]+$/, '');
	return `/Research-areas/web/${baseName}.jpg`;
}
