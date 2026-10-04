// Small helpers shared by the portal pages' scripts (see PortalPanel.astro).

import { api } from './api';
import { copy, errorMessage } from './portal-copy';

const panel = () => document.querySelector<HTMLElement>('[data-portal]')!;

// Shows the element with data-state="name" and hides the other states.
export function showState(name: string) {
	panel()
		.querySelectorAll<HTMLElement>('[data-state]')
		.forEach((element) => (element.hidden = element.dataset.state !== name));
}

// Shows a message above the forms (errors get an amber edge). Pass '' to hide it.
export function showMessage(text: string, { error = false } = {}) {
	const message = panel().querySelector<HTMLElement>('[data-message]')!;
	message.textContent = text; // always plain text, never HTML
	message.classList.toggle('portal-message--error', error);
	message.hidden = !text;
}

export function showError(result: { error?: string; retryAfterSeconds?: number }) {
	showMessage(errorMessage(result.error ?? 'server_error', result.retryAfterSeconds), { error: true });
}

// Checks the portal API is reachable. If not, shows the "not available" state
// and returns false, and the page script should stop there.
export async function portalIsAvailable(): Promise<boolean> {
	const health = await api('health');
	if (health.ok) return true;
	showState('unavailable');
	return false;
}

// Runs an async form handler with the submit button disabled, so a slow
// request can't be sent twice.
export function onSubmit(form: HTMLFormElement, handler: (values: Record<string, string>) => Promise<void>) {
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
		if (button) button.disabled = true;
		showMessage('');
		try {
			const values = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
			await handler(values);
		} finally {
			if (button) button.disabled = false;
		}
	});
}

// The one-time token from a link like /register/#token=abc. The hash is then
// removed from the address bar so it isn't left in history or copied by accident.
export function takeTokenFromUrl(): string | null {
	const token = new URLSearchParams(location.hash.slice(1)).get('token');
	if (token) history.replaceState(null, '', location.pathname + location.search);
	return token;
}

// Pages with emailed links (register, forgot password) call this. `onToken`
// runs with the token from the address, or null if there is none — on load,
// and again if a link is opened while the page is already showing (only the
// part after # changes then, so the page doesn't reload by itself).
export function watchForToken(onToken: (token: string | null) => void) {
	onToken(takeTokenFromUrl());
	window.addEventListener('hashchange', () => {
		const token = takeTokenFromUrl();
		if (token) onToken(token);
	});
}

export function passwordsMatch(password: string, confirm: string): boolean {
	if (password === confirm) return true;
	showMessage(copy.passwordsDontMatch, { error: true });
	return false;
}
