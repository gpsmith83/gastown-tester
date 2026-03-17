import { Pool } from 'pg';

// Database connection configuration
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

// Parse database URL or use individual env vars
function getDatabaseConfig(): DatabaseConfig {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    // Parse DATABASE_URL format: postgresql://user:password@host:port/database
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 5432,
      database: url.pathname.slice(1), // Remove leading slash
      user: url.username,
      password: url.password,
      max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
      idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_TIMEOUT || '30000'),
      connectionTimeoutMillis: 5000,
    };
  }

  // Fallback to individual environment variables
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'gastown_tester_dev',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    max: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '10'),
    idleTimeoutMillis: parseInt(process.env.DATABASE_POOL_TIMEOUT || '30000'),
    connectionTimeoutMillis: 5000,
  };
}

// Create and configure database connection pool
const dbConfig = getDatabaseConfig();
export const db = new Pool(dbConfig);

// Handle pool events
db.on('connect', (client) => {
  console.log('📊 New database client connected');
});

db.on('error', (err, client) => {
  console.error('📊 Database pool error:', err);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('📊 Closing database pool...');
  await db.end();
});

process.on('SIGTERM', async () => {
  console.log('📊 Closing database pool...');
  await db.end();
});

export default db;