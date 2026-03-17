import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { db } from './database';

// Run database migrations
export async function runMigrations(): Promise<void> {
  try {
    console.log('📊 Running database migrations...');

    const migrationsPath = join(__dirname, 'migrations');

    // Check if migrations directory exists
    try {
      const migrationFiles = readdirSync(migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort(); // Run migrations in order

      for (const file of migrationFiles) {
        console.log(`🔧 Running migration: ${file}`);
        const migrationPath = join(migrationsPath, file);
        const migrationSql = readFileSync(migrationPath, 'utf-8');
        await db.query(migrationSql);
        console.log(`✅ Migration ${file} completed`);
      }

      if (migrationFiles.length > 0) {
        console.log('✅ All migrations completed successfully');
      } else {
        console.log('📊 No migrations found');
      }
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log('📊 No migrations directory found, skipping migrations');
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Failed to run migrations:', error);
    throw error;
  }
}

// Initialize database schema
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('📊 Initializing database schema...');

    // Read schema SQL file
    const schemaPath = join(__dirname, 'schema.sql');
    const schemaSql = readFileSync(schemaPath, 'utf-8');

    // Execute schema
    await db.query(schemaSql);

    console.log('✅ Database schema initialized successfully');

    // Run migrations
    await runMigrations();

  } catch (error) {
    console.error('❌ Failed to initialize database schema:', error);
    throw error;
  }
}

// Test database connection
export async function testDatabaseConnection(): Promise<void> {
  try {
    console.log('📊 Testing database connection...');
    const result = await db.query('SELECT NOW() as current_time');
    console.log('✅ Database connection successful:', result.rows[0].current_time);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

// Gracefully check if database is available
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await db.query('SELECT 1');
    return true;
  } catch (error) {
    console.warn('⚠️ Database is not available:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}