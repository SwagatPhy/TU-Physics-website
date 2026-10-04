// Email wording. The text is [PLACEHOLDER] until Notes-manager TU supplies it
// (content-notes/portal.md); only the link and expiry time are filled in by code.

export function registrationEmail({ name, link, minutes }) {
	return {
		subject: '[PLACEHOLDER — registration email subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — registration email body: what this link does]

${link}

[PLACEHOLDER — the link works once and expires in ${minutes} minutes]
[PLACEHOLDER — "if you didn't ask for this, ignore this email"]`,
	};
}

export function passwordResetEmail({ name, link, minutes }) {
	return {
		subject: '[PLACEHOLDER — password reset email subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — password reset email body]

${link}

[PLACEHOLDER — the link works once and expires in ${minutes} minutes]
[PLACEHOLDER — "if you didn't ask for this, ignore this email; your password is unchanged"]`,
	};
}
