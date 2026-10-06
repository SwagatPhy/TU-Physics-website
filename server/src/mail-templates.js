// Email wording, from Notes-manager TU (content-notes/portal.md). Emails not
// written yet are [PLACEHOLDER]; only names, links and the expiry time are
// filled in by code.

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
		subject: 'Portal account already exists',
		text: `Hello ${name},

An account with this email already exists.

Log in here: ${loginLink}
Reset password: ${resetLink}

If you didn't create this account, contact [PLACEHOLDER: department office].

Best regards,
Department of Physics
[PLACEHOLDER: Contact]`,
	};
}

// A student signed up with a roll number that already belongs to an account.
// Sent to the address on the form (the page itself shows the usual answer).
export function rollNumberTakenEmail({ name }) {
	return {
		subject: "We couldn't complete your sign-up",
		text: `Hello ${name},

We couldn't create your account. Your roll number may already be registered.

Please contact [PLACEHOLDER: department office] for help.

Best regards,
Department of Physics
[PLACEHOLDER: Contact]`,
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
		subject: 'Your portal account is approved',
		text: `Hello ${name},

Your account has been approved! Log in here:

${loginLink}

Best regards,
Department of Physics
[PLACEHOLDER: Contact]`,
	};
}

// An admin did not approve a sign-up.
export function notApprovedEmail({ name }) {
	return {
		subject: 'About your portal sign-up',
		text: `Hello ${name},

Your sign-up was not approved at this time.

Contact [PLACEHOLDER: department office] if you have questions.

Best regards,
Department of Physics
[PLACEHOLDER: Contact]`,
	};
}
