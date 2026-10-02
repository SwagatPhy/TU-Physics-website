#!/usr/bin/env node
/**
 * Checks the folders that office staff upload into through the CMS
 * (public/Notices-files and public/Resources-files) before every build:
 *   - only the allowed file types
 *   - no file larger than 10 MB
 *   - safe file names (letters, digits, . _ - only)
 *
 * The CMS form already applies the same rules; this is the safety net for
 * files added any other way. Runs automatically via `npm run build`
 * ("prebuild" in package.json). Rules live in src/lib/uploads.js.
 */
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, SAFE_FILE_NAME, hasAllowedExtension } from '../src/lib/uploads.js';

const problems = [];

for (const { folder, extensions } of Object.values(UPLOAD_FOLDERS)) {
	if (!existsSync(folder)) continue;

	for (const name of readdirSync(folder)) {
		if (name === '.gitkeep' || name === '.DS_Store') continue;
		const path = join(folder, name);
		if (statSync(path).isDirectory()) {
			problems.push(`${path}: folders are not allowed here`);
			continue;
		}
		if (!hasAllowedExtension(name, extensions)) {
			problems.push(`${path}: file type not allowed (allowed: ${extensions.join(', ')})`);
		}
		if (!SAFE_FILE_NAME.test(name)) {
			problems.push(`${path}: unsafe file name (use letters, digits, dot, dash or underscore)`);
		}
		const size = statSync(path).size;
		if (size > MAX_UPLOAD_BYTES) {
			problems.push(`${path}: ${(size / 1024 / 1024).toFixed(1)} MB is over the 10 MB limit`);
		}
	}
}

if (problems.length > 0) {
	console.error('Upload check failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
	process.exit(1);
}
console.log('Upload check passed.');
