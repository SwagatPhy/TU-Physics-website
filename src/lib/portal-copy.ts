// Every piece of text shown on the portal pages (login, register, forgot
// password, change password) lives here, so the wording can be replaced in one
// place. It comes from Notes-manager TU (content-notes/portal.md); until that
// arrives each string is a [PLACEHOLDER] describing what goes there.
//
// The API answers with short error codes; `errorMessage()` turns a code into text.

export const copy = {
	// Shown on every portal page when the portal API can't be reached
	// (e.g. the static site is online but the portal server isn't).
	unavailableTitle: '[PLACEHOLDER — "portal not available" heading]',
	unavailableText: '[PLACEHOLDER — portal not available: what it means and what to do]',
	noScript: '[PLACEHOLDER — the portal needs JavaScript switched on]',
	loading: '[PLACEHOLDER — loading…]',

	login: {
		title: '[PLACEHOLDER — login page title]',
		intro: '[PLACEHOLDER — login intro: who it is for; accounts come from the department roster]',
		email: '[PLACEHOLDER — email field label]',
		password: '[PLACEHOLDER — password field label]',
		submit: '[PLACEHOLDER — log in button]',
		forgotLink: '[PLACEHOLDER — "forgot your password?" link]',
		registerLink: '[PLACEHOLDER — "new here? create your account" link]',
		signedInAs: '[PLACEHOLDER — "signed in as"]', // followed by the person's name
		logout: '[PLACEHOLDER — log out button]',
		loggedOut: '[PLACEHOLDER — "you have been logged out"]',
		changePasswordLink: '[PLACEHOLDER — "change your password" link]',
	},

	register: {
		title: '[PLACEHOLDER — register page title]',
		intro: '[PLACEHOLDER — register intro: only people on the department roster can register]',
		email: '[PLACEHOLDER — email field label]',
		rollNumber: '[PLACEHOLDER — roll number field label]',
		rollNumberHint: '[PLACEHOLDER — "students only; faculty and staff leave this empty"]',
		requestSubmit: '[PLACEHOLDER — "send me a link" button]',
		completeIntro: '[PLACEHOLDER — choose a password to finish creating your account]',
		password: '[PLACEHOLDER — new password field label]',
		confirmPassword: '[PLACEHOLDER — confirm password field label]',
		passwordRule: '[PLACEHOLDER — password rule: 10 to 200 characters]',
		completeSubmit: '[PLACEHOLDER — create account button]',
		done: '[PLACEHOLDER — account created, you can now log in]',
		loginLink: '[PLACEHOLDER — go to login link]',
	},

	forgotPassword: {
		title: '[PLACEHOLDER — forgot password page title]',
		intro: '[PLACEHOLDER — forgot password intro: we will email a link]',
		email: '[PLACEHOLDER — email field label]',
		requestSubmit: '[PLACEHOLDER — "send me a link" button]',
		completeIntro: '[PLACEHOLDER — choose a new password]',
		password: '[PLACEHOLDER — new password field label]',
		confirmPassword: '[PLACEHOLDER — confirm password field label]',
		passwordRule: '[PLACEHOLDER — password rule: 10 to 200 characters]',
		completeSubmit: '[PLACEHOLDER — set new password button]',
		done: '[PLACEHOLDER — password changed, you can now log in]',
		loginLink: '[PLACEHOLDER — go to login link]',
	},

	changePassword: {
		title: '[PLACEHOLDER — change password page title]',
		firstLoginIntro: '[PLACEHOLDER — first login or reset: please choose a new password]',
		intro: '[PLACEHOLDER — change password intro]',
		currentPassword: '[PLACEHOLDER — current password field label]',
		newPassword: '[PLACEHOLDER — new password field label]',
		confirmPassword: '[PLACEHOLDER — confirm new password field label]',
		passwordRule: '[PLACEHOLDER — password rule: 10 to 200 characters]',
		submit: '[PLACEHOLDER — change password button]',
		done: '[PLACEHOLDER — password changed]',
		notLoggedIn: '[PLACEHOLDER — please log in first]',
		loginLink: '[PLACEHOLDER — go to login link]',
	},

	// Shown after asking for a registration or reset link. Must not say whether the email was found.
	checkYourEmail: '[PLACEHOLDER — "if your details match, we have emailed you a link; it expires in 30 minutes"]',
	passwordsDontMatch: '[PLACEHOLDER — the two new passwords are different]',
};

const errors: Record<string, string> = {
	invalid_credentials: '[PLACEHOLDER — wrong email or password (do not say which)]',
	too_many_attempts: '[PLACEHOLDER — too many attempts, try again in {minutes} minutes]',
	not_logged_in: '[PLACEHOLDER — your session has ended, please log in again]',
	invalid_input: '[PLACEHOLDER — please fill in every field]',
	wrong_current_password: '[PLACEHOLDER — current password is wrong]',
	password_too_short: '[PLACEHOLDER — password must be at least 10 characters]',
	password_too_long: '[PLACEHOLDER — password must be at most 200 characters]',
	password_unchanged: '[PLACEHOLDER — new password must differ from the current one]',
	invalid_or_expired_link: '[PLACEHOLDER — this link has expired or was already used; ask for a new one]',
	server_error: '[PLACEHOLDER — something went wrong on our side, please try again]',
};

export function errorMessage(code: string, retryAfterSeconds?: number): string {
	const text = errors[code] ?? errors.server_error;
	const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
	return text.replace('{minutes}', String(minutes));
}
