// Course offerings and automatic enrolment (REPORT.md section 19).

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser } from './helpers.js';

describe('course offerings and batch enrolment', () => {
	let app, ids, courseId;
	const browsers = {};

	// A student of a batch: programme from the roll number prefix (PHM MSc, PHI Integrated, PHP PhD).
	const student = (email, rollNumber, status = 'approved') => {
		const programme = { PHM: 'MSc', PHI: 'Integrated BSc-MSc', PHP: 'PhD' }[rollNumber.slice(0, 3)];
		return addUser(app.db, { email, rollNumber, programme, status }).then((id) => {
			app.db.prepare('UPDATE users SET batch_year = ? WHERE id = ?').run(2000 + Number(rollNumber.slice(3, 5)), id);
			return id;
		});
	};

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		ids = {
			teacher: await addUser(db, { name: 'Prof Teach', email: 'teach@example.test', role: 'faculty' }),
			otherTeacher: await addUser(db, { name: 'Prof Other', email: 'other@example.test', role: 'faculty' }),
			admin: await addUser(db, { email: 'admin@example.test', role: 'admin' }),
		};
		ids.msc24a = await student('msc24a@example.test', 'PHM24001');
		ids.msc24b = await student('msc24b@example.test', 'PHM24002');
		ids.msc25 = await student('msc25@example.test', 'PHM25001'); // another batch
		ids.phd24 = await student('phd24@example.test', 'PHP24001'); // PhD: by hand only
		ids.pending24 = await student('pending24@example.test', 'PHM24003', 'pending');
		courseId = Number(db.prepare("INSERT INTO courses (code, title, semester, active) VALUES ('PHY 101', 'Mechanics', '-', 1)").run().lastInsertRowid);
		for (const name of ['teach', 'other', 'admin', 'msc24a', 'msc25', 'pending24']) {
			browsers[name] = client(app.baseUrl);
			await browsers[name].login(`${name}@example.test`);
		}
	});
	after(() => app.close());

	const offering = (extra = {}) => ({
		courseId,
		programme: 'MSc',
		batchYear: 2024,
		semester: 'Autumn 2026',
		teacherId: ids.teacher,
		isElective: false,
		...extra,
	});
	const create = (body, who = 'admin') => browsers[who].request('/admin/offerings', { method: 'POST', body });
	const enrolledIn = (offeringId) =>
		app.db
			.prepare('SELECT user_id FROM enrollments WHERE offering_id = ? AND removed = 0 ORDER BY user_id')
			.all(offeringId)
			.map((row) => row.user_id);

	let core;

	test('creating a non-elective offering enrols its approved batch — not other batches, PhD or pending students', async () => {
		const res = await create(offering());
		assert.equal(res.status, 201);
		core = res.body.id;
		assert.equal(res.body.enrolled, 2);
		assert.deepEqual(enrolledIn(core), [ids.msc24a, ids.msc24b]);
	});

	test('students only ever see their own offerings', async () => {
		assert.deepEqual((await browsers.msc24a.request('/my-courses')).body.current.map((c) => [c.code, c.programme, c.batchYear]), [
			['PHY 101', 'MSc', 2024],
		]);
		assert.deepEqual((await browsers.msc25.request('/my-courses')).body, { current: [], past: [] });
		assert.deepEqual((await browsers.pending24.request('/my-courses')).body, { error: 'approval_pending' });
	});

	test('the same course, batch and semester cannot be offered twice; bad values are refused', async () => {
		assert.deepEqual((await create(offering())).body, { error: 'offering_exists' });
		assert.deepEqual((await create(offering({ programme: 'Physics' }))).body, { error: 'invalid_programme' });
		assert.deepEqual((await create(offering({ batchYear: 24 }))).body, { error: 'invalid_batch_year' });
		assert.deepEqual((await create(offering({ semester: ' ' }))).body, { error: 'invalid_semester' });
		assert.deepEqual((await create(offering({ teacherId: ids.msc24a }))).body, { error: 'teacher_not_found' });
		assert.deepEqual((await create(offering({ courseId: 9999 }))).body, { error: 'course_not_found' });
	});

	test('approving a student enrols them in their batch’s active non-elective offerings, once', async () => {
		const elective = (await create(offering({ semester: 'Autumn 2026 (elective)', isElective: true }))).body.id;
		const finished = (await create(offering({ semester: 'Autumn 2025', status: 'finished' }))).body.id;
		assert.deepEqual(enrolledIn(elective), []);
		assert.deepEqual(enrolledIn(finished), []);

		const approve = await browsers.admin.request('/admin/decisions', { method: 'POST', body: { userIds: [ids.pending24], decision: 'approve' } });
		assert.deepEqual(approve.body.done, [ids.pending24]);
		assert.ok(enrolledIn(core).includes(ids.pending24));
		assert.ok(!enrolledIn(elective).includes(ids.pending24));
		assert.ok(!enrolledIn(finished).includes(ids.pending24));

		// Running it again changes nothing.
		const { enrolStudentAutomatically } = await import('../src/enrolment.js');
		assert.equal(enrolStudentAutomatically(app.db, app.config, ids.pending24), 0);
	});

	test('admins add and remove students by hand; a removed student is not added back automatically', async () => {
		const add = (who) => browsers.admin.request(`/admin/offerings/${core}/students`, { method: 'POST', body: { student: who } });
		assert.equal((await add('php24001')).status, 201); // roll number, any case
		assert.ok(enrolledIn(core).includes(ids.phd24));
		assert.deepEqual((await add('msc24a@example.test')).body, { error: 'already_enrolled' });
		assert.deepEqual((await add('teach@example.test')).body, { error: 'not_a_student' });
		assert.deepEqual((await add('nobody@example.test')).body, { error: 'student_not_found' });

		assert.equal((await browsers.admin.request(`/admin/offerings/${core}/students/${ids.msc24b}`, { method: 'DELETE' })).status, 204);
		assert.ok(!enrolledIn(core).includes(ids.msc24b));
		// Edit the offering (triggers automatic enrolment): msc24b stays out.
		const edited = await browsers.admin.request(`/admin/offerings/${core}`, { method: 'PUT', body: offering({ semester: 'Autumn 2026' }) });
		assert.equal(edited.body.enrolled, 0);
		assert.ok(!enrolledIn(core).includes(ids.msc24b));
		// Added back by hand: in again.
		assert.equal((await add('msc24b@example.test')).status, 201);
		assert.ok(enrolledIn(core).includes(ids.msc24b));

		const detail = (await browsers.admin.request(`/admin/offerings/${core}`)).body;
		assert.equal(detail.offering.studentCount, detail.students.length);
		assert.ok(detail.students.some((s) => s.rollNumber === 'PHP24001' && s.addedBy === 'admin'));
	});

	test('finishing an offering keeps it as a past course; reopening enrols the batch again', async () => {
		const finish = await browsers.admin.request(`/admin/offerings/${core}`, { method: 'PUT', body: offering({ status: 'finished' }) });
		assert.equal(finish.status, 200);
		const mine = (await browsers.msc24a.request('/my-courses')).body;
		assert.deepEqual([mine.current.length, mine.past.map((c) => c.code)], [0, ['PHY 101']]);

		const late = await student('late24@example.test', 'PHM24009');
		assert.equal((await browsers.admin.request('/admin/decisions', { method: 'POST', body: { userIds: [late], decision: 'approve' } })).status, 200);
		assert.ok(!enrolledIn(core).includes(late), 'no automatic enrolment into a finished offering');

		const reopen = await browsers.admin.request(`/admin/offerings/${core}`, { method: 'PUT', body: offering({ status: 'active' }) });
		assert.equal(reopen.body.enrolled, 1);
		assert.ok(enrolledIn(core).includes(late));
		const actions = app.db.prepare('SELECT action FROM audit_log').all().map((row) => row.action);
		for (const action of ['offering_created', 'offering_finished', 'offering_reopened', 'enrolled_by_admin', 'unenrolled_by_admin', 'enrolled_automatically']) {
			assert.ok(actions.includes(action), action);
		}
	});

	test('only the offering’s teacher manages its links; another teacher cannot', async () => {
		const body = { offeringId: core, title: 'Week 1', url: 'https://example.com/w1' };
		assert.equal((await browsers.teach.request('/resources', { method: 'POST', body })).status, 201);
		assert.deepEqual((await browsers.other.request('/resources', { method: 'POST', body })).body, { error: 'offering_not_found' });
		assert.deepEqual((await browsers.other.request('/teaching')).body.offerings, []);
	});

	test('the offerings admin tool is for admins only', async () => {
		for (const who of ['teach', 'msc24a']) {
			assert.equal((await browsers[who].request('/admin/offerings')).status, 403);
			assert.equal((await create(offering({ semester: 'Spring 2027' }), who)).status, 403);
			assert.equal((await browsers[who].request(`/admin/offerings/${core}/students`, { method: 'POST', body: { student: 'msc25@example.test' } })).status, 403);
		}
		const list = (await browsers.admin.request('/admin/offerings')).body;
		assert.deepEqual(list.programmes, ['MSc', 'Integrated BSc-MSc', 'PhD']);
		assert.ok(list.teachers.some((t) => t.id === ids.teacher));
		assert.ok(list.offerings.some((o) => o.id === core && o.teacherName === 'Prof Teach'));
	});

	test('AUTO_ENROL_PHD=true also enrols PhD students automatically', async () => {
		const phdApp = await startTestServer({ env: { AUTO_ENROL_PHD: 'true' } });
		try {
			const { addOffering } = await import('./helpers.js');
			const { enrolStudentAutomatically } = await import('../src/enrolment.js');
			const phd = await addUser(phdApp.db, { email: 'p@example.test', rollNumber: 'PHP24001', programme: 'PhD' });
			phdApp.db.prepare('UPDATE users SET batch_year = 2024 WHERE id = ?').run(phd);
			addOffering(phdApp.db, { code: 'PHY 900', programme: 'PhD', batchYear: 2024 });
			assert.equal(enrolStudentAutomatically(phdApp.db, phdApp.config, phd), 1);
		} finally {
			await phdApp.close();
		}
	});
});
