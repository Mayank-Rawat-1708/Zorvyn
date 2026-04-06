const test = require('node:test');
const assert = require('node:assert/strict');

process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';

const app = require('../src/app');
const { getDb } = require('../src/models/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function request(method, path, { body, token } = {}) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const options = {
        hostname: '127.0.0.1', port, path,
        method: method.toUpperCase(),
        headers: { 'Content-Type': 'application/json' },
      };
      if (token) options.headers['Authorization'] = `Bearer ${token}`;
      const req = http.request(options, res => {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () => { server.close(); resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }); });
      });
      req.on('error', err => { server.close(); reject(err); });
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  });
}

async function getToken(email, password = 'password123') {
  const res = await request('POST', '/api/auth/login', { body: { email, password } });
  return res.body.data.token;
}

function seedUser(db, overrides = {}) {
  const password = bcrypt.hashSync('password123', 4);
  const id = uuidv4();
  const u = { id, name: 'Test User', email: `user-${id}@test.com`, role: 'viewer', ...overrides };
  db.prepare(`INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`)
    .run(u.id, u.name, u.email, password, u.role);
  return u;
}

// ── Health ────────────────────────────────────────────────────────────────────
test('GET /health returns ok', async () => {
  const res = await request('GET', '/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

// ── Auth ──────────────────────────────────────────────────────────────────────
test('Auth — login success', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'admin', email: 'admin-login@test.com' });
  const res = await request('POST', '/api/auth/login', { body: { email: u.email, password: 'password123' } });
  assert.equal(res.status, 200);
  assert.ok(res.body.data.token);
  assert.ok(!res.body.data.user.password);
});

test('Auth — wrong password returns 401', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'wrongpw@test.com' });
  const res = await request('POST', '/api/auth/login', { body: { email: u.email, password: 'wrong' } });
  assert.equal(res.status, 401);
});

test('Auth — invalid email format returns 400', async () => {
  const res = await request('POST', '/api/auth/login', { body: { email: 'notanemail', password: 'password123' } });
  assert.equal(res.status, 400);
});

test('Auth — /me returns current user', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'me@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/auth/me', { token });
  assert.equal(res.status, 200);
  assert.equal(res.body.data.email, u.email);
});

test('Auth — /me without token returns 401', async () => {
  const res = await request('GET', '/api/auth/me');
  assert.equal(res.status, 401);
});

// ── Users ─────────────────────────────────────────────────────────────────────
test('Users — admin can list users', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'admin', email: 'admin-list@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/users', { token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test('Users — viewer cannot list users', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'viewer-list@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/users', { token });
  assert.equal(res.status, 403);
});

test('Users — admin can create user', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'admin', email: 'admin-create@test.com' });
  const token = await getToken(u.email);
  const res = await request('POST', '/api/users', {
    token,
    body: { name: 'New User', email: 'newuser@test.com', password: 'password123', role: 'viewer' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.email, 'newuser@test.com');
});

test('Users — duplicate email returns 409', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'admin', email: 'admin-dup@test.com' });
  const token = await getToken(u.email);
  await request('POST', '/api/users', { token, body: { name: 'A', email: 'dup@test.com', password: 'password123', role: 'viewer' } });
  const res = await request('POST', '/api/users', { token, body: { name: 'B', email: 'dup@test.com', password: 'password123', role: 'viewer' } });
  assert.equal(res.status, 409);
});

// ── Records ───────────────────────────────────────────────────────────────────
test('Records — admin can create record', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'admin', email: 'admin-rec@test.com' });
  const token = await getToken(u.email);
  const res = await request('POST', '/api/records', {
    token,
    body: { amount: 5000, type: 'income', category: 'Salary', date: '2024-03-01' },
  });
  assert.equal(res.status, 201);
  assert.equal(res.body.data.amount, 5000);
});

test('Records — viewer cannot create record', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'viewer-rec@test.com' });
  const token = await getToken(u.email);
  const res = await request('POST', '/api/records', {
    token,
    body: { amount: 100, type: 'expense', category: 'Food', date: '2024-03-01' },
  });
  assert.equal(res.status, 403);
});

test('Records — negative amount rejected', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'admin', email: 'admin-neg@test.com' });
  const token = await getToken(u.email);
  const res = await request('POST', '/api/records', {
    token,
    body: { amount: -100, type: 'income', category: 'Test', date: '2024-03-01' },
  });
  assert.equal(res.status, 400);
});

test('Records — viewer can list records', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'viewer-list-rec@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/records', { token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
  assert.ok(res.body.meta);
});

test('Records — not found returns 404', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'viewer-404@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/records/nonexistent-id', { token });
  assert.equal(res.status, 404);
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
test('Dashboard — viewer cannot access summary', async () => {
  const db = getDb();
  const u = seedUser(db, { email: 'viewer-dash@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/dashboard/summary', { token });
  assert.equal(res.status, 403);
});

test('Dashboard — analyst can access summary', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'analyst', email: 'analyst-dash@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/dashboard/summary', { token });
  assert.equal(res.status, 200);
  assert.ok(typeof res.body.data.total_income === 'number');
  assert.ok(typeof res.body.data.net_balance === 'number');
});

test('Dashboard — trends endpoint works', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'analyst', email: 'analyst-trends@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/dashboard/trends?period=monthly', { token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

test('Dashboard — recent-activity endpoint works', async () => {
  const db = getDb();
  const u = seedUser(db, { role: 'analyst', email: 'analyst-activity@test.com' });
  const token = await getToken(u.email);
  const res = await request('GET', '/api/dashboard/recent-activity?limit=5', { token });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.data));
});

// ── 404 ───────────────────────────────────────────────────────────────────────
test('Unknown route returns 404', async () => {
  const res = await request('GET', '/api/nonexistent');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
});
