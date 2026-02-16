/**
 * PostgreSQL Database Connection Module
 * Handles connection pool management and database initialization
 */

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;

// Database configuration from environment variables
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'arcellite',
  user: process.env.DB_USER || 'arcellite_user',
  password: process.env.DB_PASSWORD || 'changeme',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Create connection pool
export const pool = new Pool(DB_CONFIG);

// Test connection
pool.on('connect', () => {
  console.log('[Database] PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('[Database] Unexpected error on idle client', err);
});

/**
 * Print helpful troubleshooting info when database connection fails
 */
function printDbTroubleshooting(error: any) {
  const errMsg = error?.message || String(error);
  console.error('\n' + '='.repeat(60));
  console.error('[Database] CONNECTION FAILED');
  console.error('='.repeat(60));
  console.error(`Error: ${errMsg}`);
  console.error(`\nConnection config:`);
  console.error(`  Host:     ${DB_CONFIG.host}`);
  console.error(`  Port:     ${DB_CONFIG.port}`);
  console.error(`  Database: ${DB_CONFIG.database}`);
  console.error(`  User:     ${DB_CONFIG.user}`);
  console.error('');

  if (errMsg.includes('ENOENT') || errMsg.includes('ECONNREFUSED')) {
    console.error('Possible causes:');
    console.error('  1. PostgreSQL is not running');
    console.error('     → sudo systemctl start postgresql');
    console.error('  2. PostgreSQL is on a different port');
    console.error('     → Check with: sudo -u postgres psql -c "SHOW port"');
    console.error('     → Update DB_PORT in your .env file');
    console.error('  3. Socket path does not exist');
    console.error('     → Use DB_HOST=127.0.0.1 in .env for TCP connection');
  } else if (errMsg.includes('password authentication failed') || errMsg.includes('no pg_hba.conf entry')) {
    console.error('Possible causes:');
    console.error('  1. Wrong credentials in .env');
    console.error('     → Re-run install.sh to regenerate credentials');
    console.error('  2. pg_hba.conf not configured for password auth');
    console.error('     → Add: host all arcellite_user 127.0.0.1/32 md5');
    console.error('     → Then: sudo systemctl reload postgresql');
  } else if (errMsg.includes('does not exist')) {
    console.error('Possible causes:');
    console.error('  1. Database or user not created');
    console.error('     → Re-run install.sh or create manually:');
    console.error('        sudo -u postgres createuser -P arcellite_user');
    console.error('        sudo -u postgres createdb -O arcellite_user arcellite');
  }

  console.error('\nQuick fix: Run ./install.sh from the project directory');
  console.error('='.repeat(60) + '\n');
}

/**
 * Initialize database schema
 * Reads and executes schema.sql file
 */
export async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
  } catch (error) {
    printDbTroubleshooting(error);
    return false;
  }
  try {
    // Get current file directory for schema.sql path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, 'schema.sql');

    // Read and execute schema
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);

    console.log('[Database] Schema initialized successfully');

    // Auto-create the AI chat history database if it doesn't exist
    try {
      const chatDbName = 'arcellite_chat_history';
      const check = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [chatDbName]);
      if (check.rows.length === 0) {
        const dbUser = process.env.DB_USER || 'arcellite_user';
        await client.query(`CREATE DATABASE "${chatDbName}" OWNER "${dbUser}"`);
        console.log(`[Database] Created ${chatDbName} database for AI chat history`);
      }
    } catch (chatErr) {
      // Non-fatal — the chat DB may already exist from a previous run
      const msg = (chatErr as Error).message || '';
      if (!msg.includes('already exists')) {
        console.error('[Database] Failed to create chat history database:', msg);
      }
    }

    return true;
  } catch (error) {
    console.error('[Database] Failed to initialize schema:', error);
    return false;
  } finally {
    client.release();
  }
}

/**
 * Check if setup is needed (no user has completed setup)
 */
export async function isSetupNeeded(): Promise<boolean> {
  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM users WHERE is_setup_complete = TRUE'
    );
    const completedCount = parseInt(result.rows[0].count);
    return completedCount === 0;
  } catch (error) {
    console.error('[Database] Error checking setup status:', error);
    // If table doesn't exist, setup is needed
    return true;
  }
}

/**
 * Clean up expired sessions (run periodically)
 */
export async function cleanupExpiredSessions() {
  try {
    await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
  } catch (error) {
    console.error('[Database] Error cleaning up sessions:', error);
  }
}

/**
 * Health check
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('[Database] Health check failed:', error);
    return false;
  }
}
