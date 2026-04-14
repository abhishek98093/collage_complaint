const pool = require('./db');
const bcrypt = require('bcrypt');
const createTable = async () => {
  try {

    // ================= USERS TABLE =================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password TEXT NOT NULL,
        phone_number VARCHAR(15) UNIQUE,
        dob DATE,
        role VARCHAR(20) NOT NULL CHECK (
          role IN ('user', 'worker', 'admin')
        ),
        department VARCHAR(50) CHECK (
          department IN (
            'Network', 'Cleaning', 'Carpentry',
            'PC Maintenance', 'Plumbing', 'Electricity'
          )
        ),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

      const createDefaultAdmin = async () => {
  try {
    const email = "admin@gmail.com";
    const password = "Abhishek@123";

    console.log("🔍 Checking admin...");

    const existingAdmin = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingAdmin.rows.length === 0) {
      console.log("⚡ Creating admin...");

      const hashedPassword = await bcrypt.hash(password, 10);

      await pool.query(
        `INSERT INTO users (name, email, password, role)
         VALUES ($1, $2, $3, $4)`,
        ["Admin", email, hashedPassword, "admin"]
      );

      console.log("✅ Default admin created");
    } else {
      console.log("ℹ️ Admin already exists");
    }
  } catch (err) {
    console.error("❌ Error creating admin:", err);
  }
};

    // ================= COMPLAINTS TABLE =================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS complaints (
        complaint_id SERIAL PRIMARY KEY,

        -- Who created complaint
        user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

        -- Assigned worker (user_id of worker)
        assigned_to INT REFERENCES users(user_id) ON DELETE SET NULL,

        title TEXT NOT NULL,
        description TEXT,

        category VARCHAR(50) NOT NULL CHECK (
          category IN (
            'Network',
            'Cleaning',
            'Carpentry',
            'PC Maintenance',
            'Plumbing',
            'Electricity'
          )
        ),

        priority VARCHAR(10) DEFAULT 'medium' CHECK (
          priority IN ('low', 'medium', 'high')
        ),

        status VARCHAR(20) DEFAULT 'Submitted' CHECK (
          status IN (
            'Submitted',
            'Assigned',
            'In Progress',
            'Resolved',
            'Closed',
            'Escalated',
            'Withdrawn'
          )
        ),

        -- Media (images/videos)
        media_urls JSONB NOT NULL DEFAULT '[]',

        remark TEXT,
        withdrawal_reason TEXT,  -- ✅ New field for withdrawal reason
        reopened_at TIMESTAMP,    -- ✅ Track when complaint was reopened

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // ================= STATUS HISTORY =================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS status_history (
        id SERIAL PRIMARY KEY,
        complaint_id INT REFERENCES complaints(complaint_id) ON DELETE CASCADE,
        old_status VARCHAR(20),
        new_status VARCHAR(20),
        changed_by INT REFERENCES users(user_id),
        remark TEXT,  -- ✅ Added remark field for withdrawal/reopen reason
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // ================= AUDIT LOGS =================
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(user_id),
        action VARCHAR(50), -- CREATE, ASSIGN, STATUS_CHANGE, WITHDRAW, REOPEN
        entity_type VARCHAR(50), -- complaint, user
        entity_id INT,
        old_value JSONB,
        new_value JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await createDefaultAdmin();

    console.log("✅ All tables created successfully");

  } catch (err) {
    console.error("❌ Error creating tables:", err);
  }
};

module.exports = { createTable };