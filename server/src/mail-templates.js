// Email wording. The text is [PLACEHOLDER] until Notes-manager TU supplies it
// (content-notes/portal.md); only names, links and the expiry time are filled
// in by code.

// After sign-up: verify the email address and choose a password.
export function registrationEmail({ name, link, minutes }) {
	return {
		subject: '[PLACEHOLDER — registration email subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — registration email body: confirm your email and choose a password]

${link}

[PLACEHOLDER — the link works once and expires in ${minutes} minutes]
[PLACEHOLDER — "if you didn't ask for this, ignore this email"]`,
	};
}

// Someone signed up with an address that already has an account. Goes only to
// that address, so the person on the sign-up form learns nothing.
export function alreadyRegisteredEmail({ name, loginLink, resetLink }) {
	return {
		subject: '[PLACEHOLDER — "you already have an account" subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — someone (probably you) tried to sign up with this email, but it already has an account]

[PLACEHOLDER — log in here:] ${loginLink}
[PLACEHOLDER — forgot your password? reset it here:] ${resetLink}

[PLACEHOLDER — "if this wasn't you, ignore this email"]`,
	};
}

// A student signed up with a roll number that already belongs to an account.
// Sent to the address on the form (the page itself shows the usual answer).
export function rollNumberTakenEmail({ name }) {
	return {
		subject: '[PLACEHOLDER — "we couldn\'t complete your sign-up" subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — we couldn't start your sign-up with the details given; please contact the department office]`,
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

// An admin approved a sign-up.
export function approvedEmail({ name, loginLink }) {
	return {
		subject: '[PLACEHOLDER — "your account is approved" subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — your portal account has been approved; you can now log in]

${loginLink}`,
	};
}

// An admin did not approve a sign-up.
export function notApprovedEmail({ name }) {
	return {
		subject: '[PLACEHOLDER — "your sign-up was not approved" subject]',
		text: `[PLACEHOLDER — greeting] ${name}

[PLACEHOLDER — your sign-up was not approved; contact the department office if you think this is a mistake]`,
	};
}
