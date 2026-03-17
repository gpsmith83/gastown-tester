import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool, testConnection } from './connection';
import { join } from 'path';

// Run database migrations
export const runMigrations = async (): Promise<void> => {
  try {
    console.log('🔄 Running database migrations...');

    // Test connection first
    const isConnected = await testConnection();
    if (!isConnected) {
      throw new Error('Database connection test failed');
    }

    // Run migrations
    await migrate(db, {
      migrationsFolder: join(__dirname, 'migrations'),
    });

    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    throw error;
  }
};

// Standalone migration runner script
if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('🎉 Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    });
}