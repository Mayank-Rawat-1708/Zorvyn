const bcrypt = require('bcryptjs');
const { getDb } = require('../models/database');
const { signToken } = require('../middleware/auth');
const { UnauthorizedError } = require('../utils/response');

async function login(email, password) {
  const db = getDb();
  const user = db.prepare(
    `SELECT id, name, email, role, status, password
     FROM users
     WHERE email = ? AND deleted_at IS NULL`
  ).get(email.toLowerCase());

  if (!user) throw new UnauthorizedError('Invalid email or password');
  if (user.status === 'inactive') throw new UnauthorizedError('Account is inactive');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new UnauthorizedError('Invalid email or password');

  const token = signToken(user);
  const { password: _, ...publicUser } = user;

  return { token, user: publicUser };
}

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 12);
}

module.exports = { login, hashPassword };
