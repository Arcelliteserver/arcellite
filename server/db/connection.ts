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
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'arcellite',
  user: process.env.DB_USER || 'arcellite_user',
  password: process.env.DB_PASSWORD || 'changeme',
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
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
 * Initialize database schema
 * Reads and executes schema.sql file
 */
export async function initializeDatabase() {
  const client = await pool.connect();
  try {
    // Get current file directory for schema.sql path
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const schemaPath = path.join(__dirname, 'schema.sql');

    // Read and execute schema
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(schema);

    console.log('[Database] Schema initialized successfully');
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
