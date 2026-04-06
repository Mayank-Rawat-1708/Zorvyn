const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./models/database');

async function seed() {
  const db = getDb();
  console.log('\n  Seeding database...\n');

  db.exec(`DELETE FROM records; DELETE FROM users;`);

  const password = await bcrypt.hash('password123', 12);

  const users = [
    { id: uuidv4(), name: 'Alice Admin',   email: 'admin@example.com',   role: 'admin' },
    { id: uuidv4(), name: 'Anna Analyst',  email: 'analyst@example.com', role: 'analyst' },
    { id: uuidv4(), name: 'Victor Viewer', email: 'viewer@example.com',  role: 'viewer' },
  ];

  const insertUser = db.prepare(
    `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`
  );
  for (const u of users) {
    insertUser.run(u.id, u.name, u.email, password, u.role);
    console.log(`  ✓ User created: ${u.email}  [${u.role}]`);
  }

  const adminId = users[0].id;

  const categories = {
    income:  ['Salary', 'Freelance', 'Investment', 'Rental', 'Bonus'],
    expense: ['Rent', 'Utilities', 'Groceries', 'Transport', 'Dining', 'Software', 'Marketing'],
  };

  const insertRecord = db.prepare(
    `INSERT INTO records (id, user_id, amount, type, category, date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  let count = 0;
  const seedRecords = db.transaction(() => {
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const d = new Date();
      d.setMonth(d.getMonth() - monthOffset);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');

      for (const cat of ['Salary', 'Freelance']) {
        const day    = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const amount = cat === 'Salary' ? 5000 + Math.random() * 500 : 800 + Math.random() * 1200;
        insertRecord.run(uuidv4(), adminId, Math.round(amount * 100) / 100,
          'income', cat, `${year}-${month}-${day}`, `${cat} for ${year}-${month}`);
        count++;
      }

      const expCats = categories.expense;
      const expCount = 5 + Math.floor(Math.random() * 4);
      for (let i = 0; i < expCount; i++) {
        const cat    = expCats[Math.floor(Math.random() * expCats.length)];
        const day    = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const amount = 50 + Math.random() * 950;
        insertRecord.run(uuidv4(), adminId, Math.round(amount * 100) / 100,
          'expense', cat, `${year}-${month}-${day}`, null);
        count++;
      }
    }
  });

  seedRecords();

  console.log(`\n  ✓ ${count} financial records created`);
  console.log('\n  ─────────────────────────────────────────');
  console.log('  Login credentials (password: password123)');
  console.log('  ─────────────────────────────────────────');
  for (const u of users) {
    console.log(`  ${u.role.padEnd(8)}  →  ${u.email}`);
  }
  console.log('  ─────────────────────────────────────────\n');
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
