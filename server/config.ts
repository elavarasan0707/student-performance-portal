import dotenv from 'dotenv';

dotenv.config();

function parseDbUrl(urlStr?: string) {
  if (!urlStr) return null;
  try {
    const parsed = new URL(urlStr);
    const isMysql = parsed.protocol.startsWith('mysql');
    const isPg = parsed.protocol.startsWith('postgres');
    return {
      isMysql,
      isPg,
      host: parsed.hostname,
      port: Number(parsed.port) || (isMysql ? 4000 : 5432),
      user: decodeURIComponent(parsed.username || ''),
      password: decodeURIComponent(parsed.password || ''),
      database: parsed.pathname.replace(/^\//, '') || (isMysql ? 'test' : 'postgres'),
    };
  } catch {
    return null;
  }
}

const parsedDatabaseUrl = parseDbUrl(process.env.DATABASE_URL || process.env.TIDB_URL);

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'park-college-enterprise-secret-key-2026-prod-auth',
  jwtExpiresIn: '7d',
  
  // PostgreSQL Database settings
  pg: {
    connectionString: parsedDatabaseUrl?.isPg ? process.env.DATABASE_URL : undefined,
    host: parsedDatabaseUrl?.isPg ? parsedDatabaseUrl.host : (process.env.PGHOST || process.env.SQL_HOST || 'localhost'),
    port: parsedDatabaseUrl?.isPg ? parsedDatabaseUrl.port : Number(process.env.PGPORT || process.env.SQL_PORT || 5432),
    user: parsedDatabaseUrl?.isPg ? parsedDatabaseUrl.user : (process.env.PGUSER || process.env.SQL_USER || 'postgres'),
    password: parsedDatabaseUrl?.isPg ? parsedDatabaseUrl.password : (process.env.PGPASSWORD || process.env.SQL_PASSWORD || ''),
    database: parsedDatabaseUrl?.isPg ? parsedDatabaseUrl.database : (process.env.PGDATABASE || process.env.SQL_DB_NAME || 'postgres'),
  },

  // TiDB Cloud (MySQL 8.0) settings
  tidb: {
    host: parsedDatabaseUrl?.isMysql
      ? parsedDatabaseUrl.host
      : (process.env.TIDB_HOST || 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com'),
    port: parsedDatabaseUrl?.isMysql
      ? parsedDatabaseUrl.port
      : Number(process.env.TIDB_PORT || 4000),
    user: parsedDatabaseUrl?.isMysql
      ? parsedDatabaseUrl.user
      : (process.env.TIDB_USER || '3sofZfmeAkgsoaf.root'),
    password: parsedDatabaseUrl?.isMysql
      ? parsedDatabaseUrl.password
      : (process.env.TIDB_PASSWORD || ''),
    database: parsedDatabaseUrl?.isMysql
      ? parsedDatabaseUrl.database
      : (process.env.TIDB_DATABASE || 'test'),
  },

  // Security & limits
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 500, // max requests per window
  },
  
  institution: {
    name: 'Park College of Engineering and Technology',
    affiliation: 'Autonomous Institution Affiliated to Anna University, Chennai',
    academicYear: '2026-2027',
    currentSemester: 5,
    attendanceThreshold: 75,
  }
};

export function updateTiDbRuntimeConfig(updates: Partial<typeof config.tidb>) {
  Object.assign(config.tidb, updates);
}
