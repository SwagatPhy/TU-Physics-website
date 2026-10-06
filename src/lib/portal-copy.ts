// Every piece of text shown on the portal pages (login, register, forgot
// password, change password, student portal, faculty dashboard, approvals)
// lives here, so the wording can be replaced in one place. It comes from
// Notes-manager TU (content-notes/portal.md); text not supplied yet is a
// [PLACEHOLDER] describing what goes there.
//
// The API answers with short error codes; `errorMessage()` turns a code into text.
// "{n}" in a string is replaced with a number by the page.

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
		title: 'Create your account',
		intro: "Welcome to the Department of Physics portal. Sign up and we'll approve your account.",
		kindLegend: 'I am a...',
		kindStudent: 'Student',
		kindMember: 'Faculty, research scholar or staff member',
		name: 'Full name',
		email: 'Email address',
		rollNumber: 'Roll number',
		rollNumberHint: 'Format: e.g. PHP22017 (PhD), PHM24123 (MSc) or PHI23005 (Integrated BSc-MSc)',
		phone: 'Phone number',
		phoneHint: 'Format: [PLACEHOLDER]; department use only',
		requestSubmit: 'Sign up',
		completeIntro: 'Email confirmed. Now choose your password.',
		password: '[PLACEHOLDER — new password field label]',
		confirmPassword: '[PLACEHOLDER — confirm password field label]',
		passwordRule: '[PLACEHOLDER — password rule: 10 to 200 characters]',
		completeSubmit: '[PLACEHOLDER — create account button]',
		donePending: 'Account created! The department will review your sign-up and email you once approved.',
		doneApproved: 'Account created and approved. You can now log in.',
		loginLink: '[PLACEHOLDER — go to login link]',
		privacyNotice:
			'The Department of Physics portal stores your name, email, phone number, and roll number (if applicable) to manage course enrollment and communications. We do not share your information with third parties. You can request deletion of your account at any time by contacting [PLACEHOLDER: department office].',
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
		intro: '[PLACEHOLDER — student portal intro: your courses, their class links and notes]',
		signedInAs: '[PLACEHOLDER — "signed in as"]', // followed by the person's name
		logout: '[PLACEHOLDER — log out button]',
		empty: '[PLACEHOLDER — no courses yet: you are not enrolled in any course; who to contact]',
		noLinks: 'No class links or notes yet.',
		noClassLinks: 'No class links yet.',
		noNotes: 'No notes yet.',
		classLinks: 'Class links',
		notes: 'Notes',
		download: 'Download',
		opensInNewTab: '[PLACEHOLDER — "(opens in a new tab)" for screen readers]',
		notLoggedIn: '[PLACEHOLDER — please log in to see your courses]',
		loginLink: '[PLACEHOLDER — go to login link]',
	},

	faculty: {
		title: 'Manage Class Links',
		intro: 'Add and manage links for your courses.',
		// Shown above the courses: logging in controls who sees the page, not who can open a forwarded link.
		forwardReminder: 'Reminder: class and notes links can be shared, so restrict Google Drive and Meet access to specific people.',
		students: 'Students enrolled:', // followed by the number
		noStudents: 'No students enrolled yet.',
		noCourses: 'You have no courses assigned yet. Contact [PLACEHOLDER: department office] to get started.',
		classLinks: 'Class links',
		notes: 'Notes',
		noLinks: 'No links yet.',
		noNotes: 'No notes yet.',
		linkTitle: 'Link title',
		url: 'URL',
		urlHint: 'Must start with https:// or http://',
		noteTitle: 'Note title',
		file: 'Upload a file (PDF, Word, PowerPoint, or text; up to 20 MB)',
		currentFile: 'Current file:', // followed by the file name, when editing
		noteUrl: 'An article or reference (optional)',
		visibleFrom: 'Show to students from',
		visibleFromHint: 'Optional; leave blank to show straight away',
		visibleFromNote: 'Hidden from students until this date:', // followed by the date
		add: 'Add link',
		addNote: 'Add note',
		save: 'Save changes',
		cancel: 'Cancel',
		edit: 'Edit',
		delete: 'Delete',
		download: 'Download',
		confirmDelete: 'Remove this link?',
		confirmDeleteNote: 'Delete this note?',
		confirmReplaceFile: 'Replace this file?',
		added: 'Link added.',
		noteAdded: 'Note added.',
		saved: 'Changes saved.',
		deleted: 'Link deleted.',
		noteDeleted: 'Note deleted.',
		uploading: 'Uploading the file…',
		signedInAs: '[PLACEHOLDER — "signed in as"]',
		logout: '[PLACEHOLDER — log out button]',
		notLoggedIn: '[PLACEHOLDER — please log in to manage your courses]',
		loginLink: '[PLACEHOLDER — go to login link]',
	},

	// Logged in, but the account still waits for an admin (portal and faculty pages).
	pending: {
		title: 'Your sign-up is pending',
		text: "We're reviewing your request. You'll receive an email once approved.",
	},

	admin: {
		title: 'Approve Sign-Ups',
		intro: 'Review and approve pending accounts. You can edit name, roll number and contact number before approving.',
		none: 'No sign-ups waiting for approval.',
		selectAll: 'Select all',
		approveSelected: 'Approve selected',
		rejectSelected: 'Reject selected',
		columns: {
			select: '[PLACEHOLDER — "select" column]',
			name: 'Name',
			rollNumber: 'Roll number',
			programme: 'Programme',
			email: 'Email',
			phone: 'Contact number',
			type: 'Type',
			signedUp: 'Signed up on',
			actions: 'Actions',
		},
		student: 'Student',
		member: 'Department member',
		save: '[PLACEHOLDER — save corrections button]',
		approve: '[PLACEHOLDER — approve button]',
		reject: '[PLACEHOLDER — reject button]',
		confirmReject: 'Reject {n} sign-up(s)?',
		saved: 'Details saved.',
		approved: 'Approved: {n} account(s).',
		rejected: 'Rejected: {n} account(s).',
		nothingSelected: 'Select at least one first.',
		facultyLink: 'Manage course links',
		notAdmin: 'This page is for administrators.',
		notLoggedIn: '[PLACEHOLDER — please log in]',
		loginLink: '[PLACEHOLDER — go to login link]',
		signedInAs: '[PLACEHOLDER — "signed in as"]',
		logout: '[PLACEHOLDER — log out button]',
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
	invalid_title: 'Please enter a link title.',
	invalid_url: 'Please enter a valid web address (https:// or http://).',
	invalid_date: 'Please enter a valid date.',
	course_not_found: 'Course not found.',
	resource_not_found: 'Link not found.',
	not_allowed: "You don't have permission for this.",
	file_or_link_required: 'A note needs a file or a link',
	invalid_file_type:
		'File type not supported. Allowed formats: PDF, Word (.docx), PowerPoint (.pptx), text (.txt, .md, .csv). Macro-enabled and old .doc/.ppt files are not accepted.',
	invalid_file: 'The file could not be read. Try uploading it again.',
	file_too_large: 'File is too large. Maximum size is 20 MB.',
	invalid_name: 'Please enter a valid name.',
	invalid_email: 'Please enter a valid email address.',
	invalid_phone: 'Please enter a valid phone number.',
	invalid_roll_number: 'Please enter a valid roll number.',
	approval_pending: 'Your account is waiting for approval. Check your email for updates.',
	roll_number_taken: 'This roll number is already registered.',
	user_not_found: 'No account found with that email.',
	invalid_kind: 'Please select a valid account type.',
	invalid_decision: '[PLACEHOLDER — something went wrong on our side, please try again]',
};

export function errorMessage(code: string, retryAfterSeconds?: number): string {
	const text = errors[code] ?? errors.server_error;
	const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 60) / 60));
	return text.replace('{minutes}', String(minutes));
}
