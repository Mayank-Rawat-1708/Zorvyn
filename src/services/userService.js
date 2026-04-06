const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const { hashPassword } = require('./authService');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/response');

const PUBLIC_FIELDS = `id, name, email, role, status, created_at, updated_at`;

function listUsers() {
  const db = getDb();
  return db.prepare(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC`
  ).all();
}

function getUserById(id) {
  const db = getDb();
  const user = db.prepare(
    `SELECT ${PUBLIC_FIELDS} FROM users WHERE id = ? AND deleted_at IS NULL`
  ).get(id);
  if (!user) throw new NotFoundError('User');
  return user;
}

async function createUser({ name, email, password, role }) {
  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM users WHERE email = ? AND deleted_at IS NULL`
  ).get(email.toLowerCase());

  if (existing) throw new ConflictError(`Email '${email}' is already registered`);

  const id = uuidv4();
  const hashed = await hashPassword(password);

  db.prepare(
    `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name.trim(), email.toLowerCase(), hashed, role);

  return getUserById(id);
}

function updateUser(targetId, updates, requester) {
  getUserById(targetId);

  if (requester.id === targetId && updates.status === 'inactive') {
    throw new ForbiddenError('You cannot deactivate your own account');
  }

  const db = getDb();
  const fields = [];
  const params = [];

  if (updates.name   !== undefined) { fields.push('name = ?');   params.push(updates.name.trim()); }
  if (updates.role   !== undefined) { fields.push('role = ?');   params.push(updates.role); }
  if (updates.status !== undefined) { fields.push('status = ?'); params.push(updates.status); }

  fields.push("updated_at = datetime('now')");
  params.push(targetId);

  db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getUserById(targetId);
}

function deleteUser(targetId, requester) {
  getUserById(targetId);
  if (requester.id === targetId) throw new ForbiddenError('You cannot delete your own account');

  const db = getDb();
  db.prepare(
    `UPDATE users SET deleted_at = datetime('now'), status = 'inactive' WHERE id = ?`
  ).run(targetId);
}

module.exports = { listUsers, getUserById, createUser, updateUser, deleteUser };
