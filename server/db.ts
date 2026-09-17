import pg from 'pg';
import mysql, { Pool as MySqlPool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config, updateTiDbRuntimeConfig } from './config';
import {
  INITIAL_STUDENTS,
  INITIAL_FACULTY,
  INITIAL_HOD,
  INITIAL_ADMIN,
  INITIAL_DEPARTMENTS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_FEES,
  INITIAL_AUDIT_LOGS,
  SUBJECT_CATALOG,
  generateInitialAttendanceLogs,
} from '../src/data/initialData';

const { Pool: PgPool } = pg;

export interface DbStatus {
  connected: boolean;
  type: string;
  host: string;
  port: number;
  user: string;
  database: string;
  hasPassword: boolean;
  message: string;
  tableCounts?: {
    users: number;
    students: number;
    faculty: number;
    hod: number;
    attendance: number;
    leave_requests: number;
    announcements: number;
    fees: number;
    audit_logs: number;
  };
  lastChecked?: string;
  error?: string;
}

let pgPool: pg.Pool | null = null;
let mysqlPool: MySqlPool | null = null;

// Determine active database configuration
export function getDbMode(): 'postgres' | 'mysql' | 'memory' {
  if (config.pg.connectionString || (config.pg.password && config.pg.password.trim() !== '')) {
    return 'postgres';
  }
  if (config.tidb.host && config.tidb.password && config.tidb.password.trim() !== '') {
    return 'mysql';
  }
  return 'memory';
}

// PostgreSQL Connection Pool
export function getPgPool(): pg.Pool | null {
  const dbUrl = config.pg.connectionString || process.env.DATABASE_URL;
  const pgHost = config.pg.host;
  const hasPgConfig = !!(
    dbUrl ||
    (config.pg.password && config.pg.password.trim() !== '') ||
    (pgHost && pgHost !== 'localhost')
  );

  if (!hasPgConfig) {
    return null;
  }

  if (!pgPool) {
    try {
      if (dbUrl) {
        pgPool = new PgPool({
          connectionString: dbUrl,
          ssl: config.isProduction ? { rejectUnauthorized: false } : false,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
      } else {
        pgPool = new PgPool({
          host: pgHost,
          port: config.pg.port,
          user: config.pg.user,
          password: config.pg.password,
          database: config.pg.database,
          ssl: config.isProduction ? { rejectUnauthorized: false } : false,
          max: 15,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });
      }

      pgPool.on('error', (err) => {
        console.error('[PostgreSQL Pool Error]', err.message);
      });
    } catch (err: any) {
      console.error('[PostgreSQL] Failed to initialize pool:', err.message);
      return null;
    }
  }

  return pgPool;
}

// MySQL / TiDB Connection Pool
export function getMySqlPool(): MySqlPool | null {
  const password = config.tidb.password;
  if (!password || password.trim() === '') {
    return null;
  }

  if (!mysqlPool) {
    try {
      mysqlPool = mysql.createPool({
        host: config.tidb.host,
        port: config.tidb.port,
        user: config.tidb.user,
        password: password,
        database: config.tidb.database,
        ssl: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: false,
        },
        waitForConnections: true,
        connectionLimit: 15,
        queueLimit: 0,
        connectTimeout: 10000,
      });
      console.log(`[TiDB Cloud] Initialized MySQL pool for ${config.tidb.user}@${config.tidb.host}:${config.tidb.port}/${config.tidb.database}`);
    } catch (err: any) {
      console.error('[MySQL/TiDB] Failed to initialize pool:', err.message);
      return null;
    }
  }

  return mysqlPool;
}

// Reset/Recreate MySQL Pool dynamically with new parameters
export async function resetMySqlPool(params?: {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
}): Promise<MySqlPool | null> {
  if (mysqlPool) {
    try {
      await mysqlPool.end();
    } catch (e) {
      // ignore close errors
    }
    mysqlPool = null;
  }

  if (params) {
    updateTiDbRuntimeConfig({
      host: params.host || config.tidb.host,
      port: params.port || config.tidb.port,
      user: params.user || config.tidb.user,
      password: params.password !== undefined ? params.password : config.tidb.password,
      database: params.database || config.tidb.database,
    });
  }

  return getMySqlPool();
}

// Test TiDB connection directly with custom parameters
export async function testTiDbConnection(params: {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}): Promise<{ success: boolean; version?: string; message: string; error?: string }> {
  try {
    const conn = await mysql.createConnection({
      host: params.host,
      port: params.port,
      user: params.user,
      password: params.password,
      database: params.database,
      ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false,
      },
      connectTimeout: 8000,
    });

    try {
      const [rows]: any = await conn.query('SELECT 1 as alive, VERSION() as version');
      const version = rows[0]?.version || 'TiDB / MySQL 8.0';
      await conn.end();
      return {
        success: true,
        version,
        message: `Successfully connected to TiDB Cloud (${version})!`,
      };
    } catch (queryErr: any) {
      await conn.end();
      return {
        success: false,
        message: `Connected to host, but query failed: ${queryErr.message}`,
        error: queryErr.message,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message}`,
      error: err.message,
    };
  }
}

// Table Counts Helper for TiDB / MySQL
export async function getTiDbTableCounts(pool: MySqlPool): Promise<{
  users: number;
  students: number;
  faculty: number;
  hod: number;
  attendance: number;
  leave_requests: number;
  announcements: number;
  fees: number;
  audit_logs: number;
}> {
  const counts = {
    users: 0,
    students: 0,
    faculty: 0,
    hod: 0,
    attendance: 0,
    leave_requests: 0,
    announcements: 0,
    fees: 0,
    audit_logs: 0,
  };

  try {
    const [u]: any = await pool.query('SELECT COUNT(*) as count FROM users');
    counts.users = Number(u[0]?.count || 0);
  } catch {}
  try {
    const [s]: any = await pool.query('SELECT COUNT(*) as count FROM students');
    counts.students = Number(s[0]?.count || 0);
  } catch {}
  try {
    const [f]: any = await pool.query('SELECT COUNT(*) as count FROM faculty');
    counts.faculty = Number(f[0]?.count || 0);
  } catch {}
  try {
    const [h]: any = await pool.query('SELECT COUNT(*) as count FROM hod');
    counts.hod = Number(h[0]?.count || 0);
  } catch {}
  try {
    const [a]: any = await pool.query('SELECT COUNT(*) as count FROM attendance_records');
    counts.attendance = Number(a[0]?.count || 0);
  } catch {}
  try {
    const [l]: any = await pool.query('SELECT COUNT(*) as count FROM leave_requests');
    counts.leave_requests = Number(l[0]?.count || 0);
  } catch {}
  try {
    const [ann]: any = await pool.query('SELECT COUNT(*) as count FROM announcements');
    counts.announcements = Number(ann[0]?.count || 0);
  } catch {}
  try {
    const [fee]: any = await pool.query('SELECT COUNT(*) as count FROM fees');
    counts.fees = Number(fee[0]?.count || 0);
  } catch {}
  try {
    const [aud]: any = await pool.query('SELECT COUNT(*) as count FROM audit_logs');
    counts.audit_logs = Number(aud[0]?.count || 0);
  } catch {}

  return counts;
}

// Health check connection validator
export async function checkDbConnection(): Promise<DbStatus> {
  const mode = getDbMode();

  if (mode === 'mysql' || (config.tidb.host && config.tidb.password)) {
    const pool = getMySqlPool();
    if (!pool) {
      return {
        connected: false,
        type: 'TiDB Cloud (MySQL 8.0 Compatible)',
        host: config.tidb.host,
        port: config.tidb.port,
        user: config.tidb.user,
        database: config.tidb.database,
        hasPassword: Boolean(config.tidb.password),
        message: 'TiDB Cloud host configured. Awaiting TIDB_PASSWORD to connect.',
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      const [rows]: any = await pool.query('SELECT 1 as alive, VERSION() as version');
      const counts = await getTiDbTableCounts(pool);
      return {
        connected: true,
        type: 'TiDB Cloud (MySQL 8.0 Compatible)',
        host: config.tidb.host,
        port: config.tidb.port,
        user: config.tidb.user,
        database: config.tidb.database,
        hasPassword: true,
        message: `Connected successfully to TiDB Cloud (${rows[0]?.version || 'v8+'})! Live tables synced.`,
        tableCounts: counts,
        lastChecked: new Date().toISOString(),
      };
    } catch (err: any) {
      return {
        connected: false,
        type: 'TiDB Cloud (MySQL 8.0 Compatible)',
        host: config.tidb.host,
        port: config.tidb.port,
        user: config.tidb.user,
        database: config.tidb.database,
        hasPassword: Boolean(config.tidb.password),
        message: `TiDB Cloud connection failed: ${err.message}`,
        error: err.message,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  if (mode === 'postgres') {
    const pool = getPgPool();
    if (!pool) {
      return {
        connected: false,
        type: 'PostgreSQL Relational DB',
        host: config.pg.host,
        port: config.pg.port,
        user: config.pg.user,
        database: config.pg.database,
        hasPassword: Boolean(config.pg.password),
        message: 'PostgreSQL credentials configured; initializing connection...',
        lastChecked: new Date().toISOString(),
      };
    }

    try {
      const client = await pool.connect();
      try {
        const res = await client.query('SELECT version();');
        const v = res.rows[0]?.version || 'PostgreSQL 16+';
        return {
          connected: true,
          type: 'PostgreSQL Relational Database',
          host: config.pg.host,
          port: config.pg.port,
          user: config.pg.user,
          database: config.pg.database,
          hasPassword: true,
          message: `Connected securely to ${v.split(',')[0]}`,
          lastChecked: new Date().toISOString(),
        };
      } finally {
        client.release();
      }
    } catch (err: any) {
      return {
        connected: false,
        type: 'PostgreSQL',
        host: config.pg.host,
        port: config.pg.port,
        user: config.pg.user,
        database: config.pg.database,
        hasPassword: true,
        message: `PostgreSQL connection attempt failed: ${err.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  // Active Relational In-Memory + Local Persistence Engine
  return {
    connected: false,
    type: 'TiDB Cloud (Awaiting Credentials)',
    host: config.tidb.host,
    port: config.tidb.port,
    user: config.tidb.user,
    database: config.tidb.database,
    hasPassword: false,
    message: 'TiDB Cloud cluster configured. Enter your TiDB password to connect and save data to TiDB.',
    lastChecked: new Date().toISOString(),
  };
}

// Password hashing utility with Bcrypt
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, hashed: string): Promise<boolean> {
  if (plainText === hashed) return true;
  try {
    return await bcrypt.compare(plainText, hashed);
  } catch {
    return false;
  }
}

// Global initialization for tables and indexes in TiDB / MySQL & PostgreSQL
export async function initDbSchema(): Promise<boolean> {
  const myPool = getMySqlPool();
  if (myPool) {
    try {
      const conn = await myPool.getConnection();
      try {
        // 1. Users
        await conn.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(50) PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role VARCHAR(20) NOT NULL,
            name VARCHAR(255) NOT NULL,
            status VARCHAR(20) DEFAULT 'Active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP NULL
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 2. Students
        await conn.query(`
          CREATE TABLE IF NOT EXISTS students (
            reg_no VARCHAR(50) PRIMARY KEY,
            id VARCHAR(50),
            name VARCHAR(255) NOT NULL,
            department VARCHAR(255) NOT NULL,
            year INT DEFAULT 3,
            semester INT DEFAULT 5,
            section VARCHAR(10) DEFAULT 'A',
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            dob VARCHAR(50),
            blood_group VARCHAR(10),
            faculty_advisor VARCHAR(255),
            mentor VARCHAR(255),
            parent_name VARCHAR(255),
            parent_phone VARCHAR(50),
            address TEXT,
            cgpa DECIMAL(4,2) DEFAULT 0.00,
            current_semester_gpa DECIMAL(4,2) DEFAULT 0.00,
            subjects JSON,
            marks JSON,
            assignments JSON,
            overall_attendance JSON,
            subject_attendance JSON,
            performance_rating VARCHAR(50) DEFAULT 'Good',
            faculty_remarks TEXT,
            mentor_notes JSON,
            avatar TEXT,
            account_status VARCHAR(20) DEFAULT 'Active',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 3. Faculty
        await conn.query(`
          CREATE TABLE IF NOT EXISTS faculty (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            designation VARCHAR(255),
            department VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50),
            cabin VARCHAR(50),
            qualification VARCHAR(255),
            experience VARCHAR(50),
            office_hours VARCHAR(255),
            specialization VARCHAR(255),
            bio TEXT,
            assigned_mentee_section VARCHAR(10),
            assigned_classes JSON,
            avatar TEXT,
            details JSON,
            account_status VARCHAR(20) DEFAULT 'Active',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 4. HOD
        await conn.query(`
          CREATE TABLE IF NOT EXISTS hod (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            designation VARCHAR(255),
            department VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50),
            cabin VARCHAR(50),
            qualification VARCHAR(255),
            office_hours VARCHAR(255),
            specialization VARCHAR(255),
            message TEXT,
            avatar TEXT,
            account_status VARCHAR(20) DEFAULT 'Active',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 5. Admin
        await conn.query(`
          CREATE TABLE IF NOT EXISTS admin (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(50),
            role VARCHAR(20) DEFAULT 'admin',
            department VARCHAR(255),
            designation VARCHAR(255),
            avatar TEXT,
            last_login VARCHAR(50)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 6. Departments
        await conn.query(`
          CREATE TABLE IF NOT EXISTS departments (
            id VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            code VARCHAR(50) NOT NULL,
            hod_name VARCHAR(255),
            student_count INT DEFAULT 0,
            faculty_count INT DEFAULT 0,
            courses_offered JSON
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 7. Subjects
        await conn.query(`
          CREATE TABLE IF NOT EXISTS subjects (
            code VARCHAR(50) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            department VARCHAR(255),
            semester INT,
            credits INT,
            type VARCHAR(50)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 8. Attendance Records
        await conn.query(`
          CREATE TABLE IF NOT EXISTS attendance_records (
            id VARCHAR(100) PRIMARY KEY,
            date VARCHAR(20) NOT NULL,
            reg_no VARCHAR(50) NOT NULL,
            student_name VARCHAR(255),
            subject_code VARCHAR(50) NOT NULL,
            subject_name VARCHAR(255),
            section VARCHAR(10) NOT NULL,
            year INT NOT NULL,
            status VARCHAR(20) NOT NULL,
            marked_by VARCHAR(255) NOT NULL,
            period INT DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 9. Leave Requests
        await conn.query(`
          CREATE TABLE IF NOT EXISTS leave_requests (
            id VARCHAR(100) PRIMARY KEY,
            student_reg_no VARCHAR(50) NOT NULL,
            student_name VARCHAR(255),
            department VARCHAR(255),
            year INT,
            section VARCHAR(10),
            start_date VARCHAR(20) NOT NULL,
            end_date VARCHAR(20) NOT NULL,
            days_count INT DEFAULT 1,
            reason TEXT NOT NULL,
            type VARCHAR(50) NOT NULL,
            status VARCHAR(20) DEFAULT 'Pending',
            applied_on VARCHAR(50) NOT NULL,
            reviewed_by VARCHAR(255),
            reviewed_on VARCHAR(50),
            reviewer_comments TEXT
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 10. Announcements
        await conn.query(`
          CREATE TABLE IF NOT EXISTS announcements (
            id VARCHAR(100) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            author VARCHAR(255) NOT NULL,
            author_role VARCHAR(20) NOT NULL,
            target_audience VARCHAR(50) DEFAULT 'All',
            priority VARCHAR(20) DEFAULT 'Normal',
            date VARCHAR(50) NOT NULL,
            category VARCHAR(50) DEFAULT 'Academic'
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 11. Notifications
        await conn.query(`
          CREATE TABLE IF NOT EXISTS notifications (
            id VARCHAR(100) PRIMARY KEY,
            target_role VARCHAR(50),
            target_user_id VARCHAR(50),
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            type VARCHAR(20) DEFAULT 'info',
            timestamp VARCHAR(50) NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            link VARCHAR(255)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 12. Fees
        await conn.query(`
          CREATE TABLE IF NOT EXISTS fees (
            id VARCHAR(100) PRIMARY KEY,
            student_reg_no VARCHAR(50) NOT NULL,
            student_name VARCHAR(255),
            academic_year VARCHAR(50),
            semester INT,
            tuition_fee DECIMAL(10,2) DEFAULT 0,
            development_fee DECIMAL(10,2) DEFAULT 0,
            exam_fee DECIMAL(10,2) DEFAULT 0,
            total_fee DECIMAL(10,2) DEFAULT 0,
            paid_amount DECIMAL(10,2) DEFAULT 0,
            due_amount DECIMAL(10,2) DEFAULT 0,
            status VARCHAR(20) DEFAULT 'Pending',
            no_due_approved BOOLEAN DEFAULT FALSE,
            last_payment_date VARCHAR(50),
            receipt_number VARCHAR(100)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 13. Audit Logs
        await conn.query(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id VARCHAR(100) PRIMARY KEY,
            action VARCHAR(100) NOT NULL,
            performed_by VARCHAR(255) NOT NULL,
            user_role VARCHAR(50) NOT NULL,
            details TEXT NOT NULL,
            timestamp VARCHAR(50) NOT NULL,
            ip_address VARCHAR(50)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        // 14. System Settings
        await conn.query(`
          CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value JSON NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        `);

        console.log('[MySQL/TiDB] Full institutional schema initialized successfully');

        // Check if students table is empty; if so, seed initial records
        const [rows]: any = await conn.query('SELECT COUNT(*) as count FROM students');
        const count = rows[0]?.count || 0;
        if (count === 0) {
          console.log('[MySQL/TiDB] Database is empty. Seeding initial institutional data into TiDB Cloud...');
          await seedTiDbWithInitialData(conn);
        }

        return true;
      } finally {
        conn.release();
      }
    } catch (err: any) {
      console.error('[MySQL/TiDB] Schema init failed:', err.message);
      return false;
    }
  }

  return true;
}

// Seed Initial Data into TiDB Cloud Connection
export async function seedTiDbWithInitialData(conn: mysql.PoolConnection | mysql.Connection): Promise<void> {
  try {
    // 1. Seed Users
    const initialUsers = [
      { id: 'ADM001', email: 'kasthuricse23@sasurie.com', passwordHash: 'kasthu123', role: 'admin', name: 'Kasthuri' },
      { id: 'admin', email: 'admin@college.edu', passwordHash: 'admin123', role: 'admin', name: 'Kasthuri' },
      { id: 'FAC001', email: 'r.sharma@college.edu', passwordHash: 'faculty123', role: 'faculty', name: 'Dr. R. Sharma' },
      { id: 'HOD001', email: 'hod.cse@college.edu', passwordHash: 'hod123', role: 'hod', name: 'Dr. M. Sundararajan' },
      { id: '2023CSE001', email: 'aakash.varma@student.college.edu', passwordHash: 'student123', role: 'student', name: 'Aakash Varma' },
    ];

    for (const u of initialUsers) {
      await conn.query(
        `INSERT INTO users (id, email, password_hash, role, name, status) VALUES (?, ?, ?, ?, ?, 'Active')
         ON DUPLICATE KEY UPDATE name=VALUES(name), role=VALUES(role);`,
        [u.id, u.email, u.passwordHash, u.role, u.name]
      );
    }

    // 2. Seed Admin
    await conn.query(
      `INSERT INTO admin (id, name, email, phone, role, department, designation, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email);`,
      [
        INITIAL_ADMIN.id,
        INITIAL_ADMIN.name,
        INITIAL_ADMIN.email,
        INITIAL_ADMIN.phone,
        INITIAL_ADMIN.role,
        INITIAL_ADMIN.department,
        INITIAL_ADMIN.designation,
        INITIAL_ADMIN.avatar,
      ]
    );

    // 3. Seed HOD
    await conn.query(
      `INSERT INTO hod (id, name, designation, department, email, phone, cabin, qualification, office_hours, specialization, message, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email);`,
      [
        INITIAL_HOD.id,
        INITIAL_HOD.name,
        INITIAL_HOD.designation,
        INITIAL_HOD.department,
        INITIAL_HOD.email,
        INITIAL_HOD.phone,
        INITIAL_HOD.cabin,
        INITIAL_HOD.qualification,
        INITIAL_HOD.officeHours,
        INITIAL_HOD.specialization,
        INITIAL_HOD.message,
        INITIAL_HOD.avatar,
      ]
    );

    // 4. Seed Departments
    for (const d of INITIAL_DEPARTMENTS) {
      await conn.query(
        `INSERT INTO departments (id, name, code, hod_name, student_count, faculty_count, courses_offered)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name);`,
        [d.id, d.name, d.code, d.hodName, d.studentCount, d.facultyCount, JSON.stringify(d.coursesOffered || [])]
      );
    }

    // 5. Seed Subjects
    for (const s of SUBJECT_CATALOG) {
      await conn.query(
        `INSERT INTO subjects (code, name, department, semester, credits, type)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name);`,
        [s.code, s.name, s.department, s.semester, s.credits, s.type]
      );
    }

    // 6. Seed Faculty
    for (const f of INITIAL_FACULTY) {
      await conn.query(
        `INSERT INTO faculty (id, name, designation, department, email, phone, cabin, qualification, experience, office_hours, specialization, bio, assigned_mentee_section, assigned_classes, avatar, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), email=VALUES(email);`,
        [
          f.id,
          f.name,
          f.designation,
          f.department,
          f.email,
          f.phone,
          f.cabin,
          f.qualification,
          f.experience,
          f.officeHours,
          f.specialization,
          f.bio,
          f.assignedMenteeSection,
          JSON.stringify(f.assignedClasses || []),
          f.avatar,
          JSON.stringify(f.details || {}),
        ]
      );
      // also ensure in users table
      await conn.query(
        `INSERT INTO users (id, email, password_hash, role, name, status) VALUES (?, ?, ?, 'faculty', ?, 'Active')
         ON DUPLICATE KEY UPDATE name=VALUES(name);`,
        [f.id, f.email, 'faculty123', f.name]
      );
    }

    // 7. Seed Students
    for (const s of INITIAL_STUDENTS) {
      await conn.query(
        `INSERT INTO students (reg_no, id, name, department, year, semester, section, email, phone, dob, blood_group, faculty_advisor, mentor, parent_name, parent_phone, address, cgpa, current_semester_gpa, subjects, marks, assignments, overall_attendance, subject_attendance, performance_rating, faculty_remarks, mentor_notes, avatar, account_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), department=VALUES(department);`,
        [
          s.regNo,
          s.id,
          s.name,
          s.department,
          s.year,
          s.semester,
          s.section,
          s.email,
          s.phone,
          s.dob,
          s.bloodGroup,
          s.facultyAdvisor,
          s.mentor,
          s.parentName,
          s.parentPhone,
          s.address,
          s.cgpa,
          s.currentSemesterGpa,
          JSON.stringify(s.subjects || []),
          JSON.stringify(s.marks || {}),
          JSON.stringify(s.assignments || []),
          JSON.stringify(s.overallAttendance || {}),
          JSON.stringify(s.subjectAttendance || {}),
          s.performanceRating || 'Good',
          s.facultyRemarks || '',
          JSON.stringify(s.mentorNotes || []),
          s.avatar || '',
          s.accountStatus || 'Active',
        ]
      );
      // also ensure in users table
      await conn.query(
        `INSERT INTO users (id, email, password_hash, role, name, status) VALUES (?, ?, ?, 'student', ?, 'Active')
         ON DUPLICATE KEY UPDATE name=VALUES(name);`,
        [s.regNo, s.email, 'student123', s.name]
      );
    }

    // 8. Seed Attendance
    const logs = generateInitialAttendanceLogs();
    for (const a of logs) {
      await conn.query(
        `INSERT INTO attendance_records (id, date, reg_no, student_name, subject_code, subject_name, section, year, status, marked_by, period)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status);`,
        [a.id, a.date, a.regNo, a.studentName, a.subjectCode, a.subjectName, a.section, a.year, a.status, a.markedBy, a.period || 1]
      );
    }

    // 9. Seed Announcements
    for (const ann of INITIAL_ANNOUNCEMENTS) {
      await conn.query(
        `INSERT INTO announcements (id, title, content, author, author_role, target_audience, priority, date, category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE title=VALUES(title);`,
        [ann.id, ann.title, ann.content, ann.author, ann.authorRole, ann.targetAudience, ann.priority, ann.date, ann.category]
      );
    }

    // 10. Seed Leave Requests
    for (const l of INITIAL_LEAVE_REQUESTS) {
      await conn.query(
        `INSERT INTO leave_requests (id, student_reg_no, student_name, department, year, section, start_date, end_date, days_count, reason, type, status, applied_on, reviewed_by, reviewed_on, reviewer_comments)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status);`,
        [l.id, l.studentRegNo, l.studentName, l.department, l.year, l.section, l.startDate, l.endDate, l.daysCount, l.reason, l.type, l.status, l.appliedOn, l.reviewedBy || null, l.reviewedOn || null, l.reviewerComments || null]
      );
    }

    // 11. Seed Fees
    for (const fee of INITIAL_FEES) {
      await conn.query(
        `INSERT INTO fees (id, student_reg_no, student_name, academic_year, semester, tuition_fee, development_fee, exam_fee, total_fee, paid_amount, due_amount, status, no_due_approved, last_payment_date, receipt_number)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE paid_amount=VALUES(paid_amount);`,
        [
          fee.id,
          fee.studentRegNo,
          fee.studentName,
          fee.academicYear,
          fee.semester,
          fee.tuitionFee,
          fee.developmentFee,
          fee.examFee,
          fee.totalFee,
          fee.paidAmount,
          fee.dueAmount,
          fee.status,
          fee.noDueApproved ? 1 : 0,
          fee.lastPaymentDate || null,
          fee.receiptNumber || null,
        ]
      );
    }

    // 12. Seed Audit Logs
    for (const aud of INITIAL_AUDIT_LOGS) {
      await conn.query(
        `INSERT INTO audit_logs (id, action, performed_by, user_role, details, timestamp, ip_address)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE details=VALUES(details);`,
        [aud.id, aud.action, aud.performedBy, aud.userRole, aud.details, aud.timestamp, aud.ipAddress || '127.0.0.1']
      );
    }

    console.log('[MySQL/TiDB] Successfully seeded all initial institutional data to TiDB Cloud!');
  } catch (err: any) {
    console.error('[MySQL/TiDB] Seeding failed:', err.message);
  }
}
