// Rules for files that office staff upload through the CMS (/admin).
// Used in three places so they can't drift apart:
//   - src/content.config.ts         (a notice/file entry must point at an allowed file type)
//   - scripts/check-uploads.js      (runs before every build: type, size and name checks)
//   - public/admin/config.yml       (same rules written out for the CMS form — keep in sync by hand)

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export const UPLOAD_FOLDERS = {
	// Notices are mainly PDFs; images are allowed for poster-style notices.
	notices: { folder: 'public/Notices-files', extensions: ['pdf', 'jpg', 'jpeg', 'png'] },
	// General documents: forms, circulars, guidelines.
	files: { folder: 'public/Resources-files', extensions: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'zip'] },
};

// Safe file names: letters, digits, dot, dash and underscore only, no leading dot.
export const SAFE_FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

// True when `path` ends in one of `extensions` (case-insensitive).
export function hasAllowedExtension(path, extensions) {
	const extension = path.split('.').pop()?.toLowerCase() ?? '';
	return extensions.includes(extension);
}

// Site URL for a stored attachment path. The CMS stores "/Notices-files/x.pdf";
// hand-written entries may omit the leading slash ("Notices-files/x.pdf").
export function publicUrl(path) {
	return `/${path.replace(/^\/+/, '')}`;
}

// Short label for a file link, e.g. "PDF", "DOCX".
export function fileTypeLabel(path) {
	return (path.split('.').pop() ?? '').toUpperCase();
}
