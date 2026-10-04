// Login rate limiting, kept in memory (it resets when the server restarts,
// which is acceptable for a single-process trial).
//
// Two independent limits:
//   - per IP address: at most `maxAttemptsPerIp` login attempts per window,
//     whatever the outcome (slows down guessing across many accounts);
//   - per account: after `maxFailuresPerAccount` wrong passwords within one
//     window the account is locked for `lockMinutes` (slows down guessing one
//     password). A successful login clears the count.

export function createLoginLimiter({
	maxAttemptsPerIp = 20,
	windowMinutes = 15,
	maxFailuresPerAccount = 5,
	lockMinutes = 15,
	now = () => Date.now(), // replaceable in tests
} = {}) {
	const windowMs = windowMinutes * 60 * 1000;
	const lockMs = lockMinutes * 60 * 1000;
	const attemptsByIp = new Map(); // ip -> { count, windowStart }
	const failuresByAccount = new Map(); // email -> { count, firstFailureAt, lockedUntil }

	function forget() {
		// Drop expired entries so the maps don't grow forever.
		const time = now();
		for (const [ip, entry] of attemptsByIp) if (time - entry.windowStart >= windowMs) attemptsByIp.delete(ip);
		for (const [email, entry] of failuresByAccount) {
			const lockOver = entry.lockedUntil && time >= entry.lockedUntil;
			const windowOver = !entry.lockedUntil && time - entry.firstFailureAt >= windowMs;
			if (lockOver || windowOver) failuresByAccount.delete(email);
		}
	}

	return {
		// Call before checking the password. Counts the attempt against the IP.
		// Returns the number of seconds to wait, or 0 if the attempt may go ahead.
		check(ip, email) {
			forget();
			const time = now();

			const account = failuresByAccount.get(email);
			if (account?.lockedUntil && time < account.lockedUntil) {
				return Math.ceil((account.lockedUntil - time) / 1000);
			}

			const byIp = attemptsByIp.get(ip) ?? { count: 0, windowStart: time };
			byIp.count += 1;
			attemptsByIp.set(ip, byIp);
			if (byIp.count > maxAttemptsPerIp) {
				return Math.ceil((byIp.windowStart + windowMs - time) / 1000);
			}
			return 0;
		},

		recordFailure(email) {
			const entry = failuresByAccount.get(email) ?? { count: 0, firstFailureAt: now(), lockedUntil: 0 };
			entry.count += 1;
			if (entry.count >= maxFailuresPerAccount) entry.lockedUntil = now() + lockMs;
			failuresByAccount.set(email, entry);
		},

		recordSuccess(email) {
			failuresByAccount.delete(email);
		},
	};
}
