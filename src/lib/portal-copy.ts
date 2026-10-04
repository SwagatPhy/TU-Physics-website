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

	portal: {
		title: '[PLACEHOLDER — student portal page title]',
		intro: '[PLACEHOLDER — student portal intro: your courses and their class and notes links]',
		signedInAs: '[PLACEHOLDER — "signed in as"]', // followed by the person's name
		logout: '[PLACEHOLDER — log out button]',
		empty: '[PLACEHOLDER — no courses yet: you are not enrolled in any course; who to contact]',
		noLinks: '[PLACEHOLDER — no links for this course yet]',
		kinds: {
			class_link: '[PLACEHOLDER — "class link" label]',
			notes: '[PLACEHOLDER — "notes" label]',
			other: '[PLACEHOLDER — "other" label]',
		} as Record<string, string>,
		opensInNewTab: '[PLACEHOLDER — "(opens in a new tab)" for screen readers]',
		notLoggedIn: '[PLACEHOLDER — please log in to see your courses]',
		loginLink: '[PLACEHOLDER — go to login link]',
	},

	faculty: {
		title: '[PLACEHOLDER — faculty dashboard page title]',
		intro: '[PLACEHOLDER — faculty dashboard intro: add and update class and notes links for your courses]',
		// Shown above the courses: logging in controls who sees the page, not who can open a forwarded link.
		forwardReminder: '[PLACEHOLDER — reminder: students can forward links; restrict Drive/Meet links to specific people]',
		students: '[PLACEHOLDER — "students enrolled"]', // follows the number
		noCourses: '[PLACEHOLDER — you have no courses assigned yet; who to contact]',
		noLinks: '[PLACEHOLDER — no links yet for this course]',
		kindLabel: '[PLACEHOLDER — link type field label]',
		linkTitle: '[PLACEHOLDER — link title field label]',
		url: '[PLACEHOLDER — link address (URL) field label]',
		urlHint: '[PLACEHOLDER — must start with https:// or http://]',
		visibleFrom: '[PLACEHOLDER — "show to students from" date field label]',
		visibleFromHint: '[PLACEHOLDER — optional; leave empty to show straight away]',
		visibleFromNote: '[PLACEHOLDER — "hidden from students until"]', // followed by the date
		add: '[PLACEHOLDER — add link button]',
		save: '[PLACEHOLDER — save changes button]',
		cancel: '[PLACEHOLDER — cancel editing button]',
		edit: '[PLACEHOLDER — edit button]',
		delete: '[PLACEHOLDER — delete button]',
		confirmDelete: '[PLACEHOLDER — "delete this link? students will no longer see it"]',
		added: '[PLACEHOLDER — link added]',
		saved: '[PLACEHOLDER — changes saved]',
		deleted: '[PLACEHOLDER — link deleted]',
		signedInAs: '[PLACEHOLDER — "signed in as"]',
		logout: '[PLACEHOLDER — log out button]',
		notLoggedIn: '[PLACEHOLDER — please log in to manage your courses]',
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
	invalid_kind: '[PLACEHOLDER — choose a link type]',
	invalid_title: '[PLACEHOLDER — give the link a title (up to 200 characters)]',
	invalid_url: '[PLACEHOLDER — the link must be a full web address starting with https:// or http://]',
	invalid_date: '[PLACEHOLDER — the date is not valid]',
	course_not_found: '[PLACEHOLDER — this course is not one of yours, or no longer active]',
	resource_not_found: '[PLACEHOLDER — this link no longer exists; reload the page]',
	not_allowed: '[PLACEHOLDER — you do not have access to this page]',
};

export function errorMessage(code: string, retryAfterSeconds?: number): string {
	const text = errors[code] ?? errors.server_error;
	const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
	return text.replace('{minutes}', String(minutes));
}
