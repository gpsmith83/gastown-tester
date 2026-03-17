import { readFileSync } from 'fs';
import { join } from 'path';
import { db } from './database';

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