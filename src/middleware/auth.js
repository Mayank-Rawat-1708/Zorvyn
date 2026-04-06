const jwt = require('jsonwebtoken');
const { getDb } = require('../models/database');
const { UnauthorizedError, ForbiddenError } = require('../utils/response');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

const ROLE_LEVELS = { viewer: 1, analyst: 2, admin: 3 };

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Bearer token required'));
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return next(new UnauthorizedError('Invalid or expired token'));
  }

  const db = getDb();
  const user = db.prepare(
    `SELECT id, name, email, role, status
     FROM users
     WHERE id = ? AND deleted_at IS NULL`
  ).get(payload.sub);

  if (!user) return next(new UnauthorizedError('User not found'));
  if (user.status === 'inactive') return next(new UnauthorizedError('Account is inactive'));

  req.user = user;
  next();
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    const allowed = roles.some(role => req.user.role === role);
    if (!allowed) return next(new ForbiddenError());
    next();
  };
}

function authorizeLevel(minRole) {
  return (req, res, next) => {
    if (!req.user) return next(new UnauthorizedError());
    const userLevel = ROLE_LEVELS[req.user.role] ?? 0;
    const requiredLevel = ROLE_LEVELS[minRole] ?? 99;
    if (userLevel < requiredLevel) return next(new ForbiddenError());
    next();
  };
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

module.exports = { authenticate, authorize, authorizeLevel, signToken, JWT_SECRET };
