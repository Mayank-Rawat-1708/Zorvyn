const express = require('express');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes      = require('./routes/auth.routes');
const userRoutes      = require('./routes/users.routes');
const recordRoutes    = require('./routes/records.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',      authRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/records',   recordRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, async () => {
    console.log(`\n  Finance Dashboard API`);
    console.log(`  Running on http://localhost:${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}\n`);

    // Auto-seed if database has no users
    try {
      const { getDb } = require('./models/database');
      const db = getDb();
      const { count } = db.prepare('SELECT COUNT(*) as count FROM users').get();
      if (count === 0) {
        console.log('  No users found — seeding database...');
        await require('./seed');
      } else {
        console.log(`  Database ready — ${count} user(s) found.\n`);
      }
    } catch (e) {
      console.error('  Seed check failed:', e.message);
    }
  });
}

module.exports = app;
