const { getDb } = require('../models/database');

function buildDateFilter(date_from, date_to) {
  const conditions = ['deleted_at IS NULL'];
  const params = [];
  if (date_from) { conditions.push('date >= ?'); params.push(date_from); }
  if (date_to)   { conditions.push('date <= ?'); params.push(date_to); }
  return { clause: `WHERE ${conditions.join(' AND ')}`, params };
}

function getSummary(date_from, date_to) {
  const db = getDb();
  const { clause, params } = buildDateFilter(date_from, date_to);

  return db.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 0) AS total_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS total_expenses,
       COALESCE(SUM(CASE WHEN type = 'income'  THEN amount
                         WHEN type = 'expense' THEN -amount END), 0)       AS net_balance,
       COUNT(*) AS record_count
     FROM records ${clause}`
  ).get(...params);
}

function getCategoryBreakdown(date_from, date_to) {
  const db = getDb();
  const { clause, params } = buildDateFilter(date_from, date_to);

  return db.prepare(
    `SELECT category, type, ROUND(SUM(amount), 2) AS total, COUNT(*) AS count
     FROM records ${clause}
     GROUP BY category, type
     ORDER BY total DESC`
  ).all(...params);
}

function getTrends(date_from, date_to, granularity = 'monthly') {
  const db = getDb();
  const { clause, params } = buildDateFilter(date_from, date_to);

  const fmt = granularity === 'weekly'
    ? `strftime('%Y-W%W', date)`
    : `strftime('%Y-%m', date)`;

  return db.prepare(
    `SELECT
       ${fmt} AS period,
       ROUND(SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END), 2) AS income,
       ROUND(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 2) AS expenses,
       ROUND(SUM(CASE WHEN type = 'income'  THEN amount
                      WHEN type = 'expense' THEN -amount END), 2)       AS net
     FROM records ${clause}
     GROUP BY period ORDER BY period ASC`
  ).all(...params);
}

function getRecentActivity(limit = 10) {
  const db = getDb();
  return db.prepare(
    `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes, r.created_at,
            u.name AS created_by
     FROM records r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.deleted_at IS NULL
     ORDER BY r.created_at DESC LIMIT ?`
  ).all(limit);
}

function getTopCategories(limit = 5, date_from, date_to) {
  const db = getDb();
  const { clause, params } = buildDateFilter(date_from, date_to);

  return db.prepare(
    `SELECT category, ROUND(SUM(amount), 2) AS total, COUNT(*) AS count
     FROM records ${clause}
     GROUP BY category ORDER BY total DESC LIMIT ?`
  ).all(...params, limit);
}

module.exports = { getSummary, getCategoryBreakdown, getTrends, getRecentActivity, getTopCategories };
