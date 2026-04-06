const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/database');
const { NotFoundError } = require('../utils/response');

function listRecords(filters) {
  const db = getDb();
  const { type, category, date_from, date_to, page, limit, sort, order } = filters;

  const conditions = ['r.deleted_at IS NULL'];
  const params = [];

  if (type)      { conditions.push('r.type = ?');        params.push(type); }
  if (category)  { conditions.push('r.category LIKE ?'); params.push(`%${category}%`); }
  if (date_from) { conditions.push('r.date >= ?');       params.push(date_from); }
  if (date_to)   { conditions.push('r.date <= ?');       params.push(date_to); }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const orderClause = `ORDER BY r.${sort} ${order.toUpperCase()}`;

  const total = db.prepare(
    `SELECT COUNT(*) AS count FROM records r ${where}`
  ).get(...params).count;

  const offset = (page - 1) * limit;
  const rows = db.prepare(
    `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
            r.created_at, r.updated_at,
            u.id AS created_by_id, u.name AS created_by_name
     FROM records r
     LEFT JOIN users u ON u.id = r.user_id
     ${where} ${orderClause}
     LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return {
    data: rows,
    meta: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function getRecordById(id) {
  const db = getDb();
  const record = db.prepare(
    `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes,
            r.created_at, r.updated_at,
            u.id AS created_by_id, u.name AS created_by_name
     FROM records r
     LEFT JOIN users u ON u.id = r.user_id
     WHERE r.id = ? AND r.deleted_at IS NULL`
  ).get(id);

  if (!record) throw new NotFoundError('Record');
  return record;
}

function createRecord(data, requester) {
  const db = getDb();
  const id = uuidv4();

  db.prepare(
    `INSERT INTO records (id, user_id, amount, type, category, date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, requester.id, data.amount, data.type, data.category, data.date, data.notes ?? null);

  return getRecordById(id);
}

function updateRecord(id, updates) {
  getRecordById(id);

  const db = getDb();
  const fields = [];
  const params = [];

  if (updates.amount   !== undefined) { fields.push('amount = ?');   params.push(updates.amount); }
  if (updates.type     !== undefined) { fields.push('type = ?');     params.push(updates.type); }
  if (updates.category !== undefined) { fields.push('category = ?'); params.push(updates.category); }
  if (updates.date     !== undefined) { fields.push('date = ?');     params.push(updates.date); }
  if (updates.notes    !== undefined) { fields.push('notes = ?');    params.push(updates.notes); }

  fields.push("updated_at = datetime('now')");
  params.push(id);

  db.prepare(`UPDATE records SET ${fields.join(', ')} WHERE id = ?`).run(...params);
  return getRecordById(id);
}

function deleteRecord(id) {
  getRecordById(id);
  const db = getDb();
  db.prepare(`UPDATE records SET deleted_at = datetime('now') WHERE id = ?`).run(id);
}

module.exports = { listRecords, getRecordById, createRecord, updateRecord, deleteRecord };
