import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { createLinkToken, useLinkToken } from '../src/tokens.js';
import { addUser } from './helpers.js';

async function setup() {
	const db = openDatabase(':memory:');
	migrate(db);
	const userId = await addUser(db, { email: 'u@example.test' });
	return { db, userId };
}

test('a link token can be used exactly once', async () => {
	const { db, userId } = await setup();
	const token = createLinkToken(db, { purpose: 'reset', userId, minutes: 30 });
	assert.equal(useLinkToken(db, token, 'reset').user_id, userId);
	assert.equal(useLinkToken(db, token, 'reset'), null);
});

test('a link token stops working when it expires, and only works for its purpose', async () => {
	const { db, userId } = await setup();
	const expired = createLinkToken(db, { purpose: 'reset', userId, minutes: 30 });
	db.prepare('UPDATE auth_tokens SET expires_at = ?').run(toDbTime(new Date(Date.now() - 1000)));
	assert.equal(useLinkToken(db, expired, 'reset'), null);

	const fresh = createLinkToken(db, { purpose: 'reset', userId, minutes: 30 });
	assert.equal(useLinkToken(db, fresh, 'register'), null);
	assert.ok(useLinkToken(db, fresh, 'reset'));
});

test('only a hash of the token is stored', async () => {
	const { db, userId } = await setup();
	const token = createLinkToken(db, { purpose: 'reset', userId, minutes: 30 });
	const hashed = createHash('sha256').update(token).digest('hex');
	assert.ok(db.prepare('SELECT 1 FROM auth_tokens WHERE id = ?').get(hashed));
	assert.equal(db.prepare('SELECT 1 FROM auth_tokens WHERE id = ?').get(token), undefined);
});
