import fs from 'fs';
import path from 'path';
import os from 'os';
import pg from 'pg';

const { Pool } = pg;

const homeDir = os.homedir();
let baseDir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
if (baseDir.startsWith('~/') || baseDir === '~') {
  baseDir = path.join(homeDir, baseDir.slice(2));
}
const dbDir = path.join(baseDir, 'databases');
const dbMetadataFile = path.join(dbDir, 'metadata.json');

// PostgreSQL connection config — force TCP (localhost) for password auth
// (Unix socket paths like /var/run/postgresql use peer auth which fails for user DBs)
const rawHost = process.env.DB_HOST || 'localhost';
const PG_CONFIG = {
  host: rawHost.startsWith('/') ? 'localhost' : rawHost,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'arcellite_user',
  password: process.env.DB_PASSWORD || 'changeme',
};

interface DatabaseMetadata {
  id: string;
  name: string;
  displayName: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  status: 'running' | 'stopped';
  size: string;
  sizeBytes: number;
  created: string;
  createdTimestamp: number;
  pgDatabaseName: string;
  config: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

interface DatabasesMetadata {
  [id: string]: DatabaseMetadata;
}

function ensureDbDir() {
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

function loadMetadata(): DatabasesMetadata {
  ensureDbDir();
  if (!fs.existsSync(dbMetadataFile)) return {};
  try {
    return JSON.parse(fs.readFileSync(dbMetadataFile, 'utf-8'));
  } catch {
    return {};
  }
}

function saveMetadata(metadata: DatabasesMetadata) {
  ensureDbDir();
  fs.writeFileSync(dbMetadataFile, JSON.stringify(metadata, null, 2), 'utf-8');
}

function generateId(): string {
  return `db_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePgName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').substring(0, 63);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getMainPool(): pg.Pool {
  return new Pool({ ...PG_CONFIG, database: process.env.DB_NAME || 'arcellite', max: 5, idleTimeoutMillis: 10000 });
}

function getUserDbPool(pgDatabaseName: string): pg.Pool {
  return new Pool({ ...PG_CONFIG, database: pgDatabaseName, max: 5, idleTimeoutMillis: 10000 });
}

// List all databases
export function listDatabases(): DatabaseMetadata[] {
  return Object.values(loadMetadata());
}

// Create real PostgreSQL database
export async function createDatabase(name: string, type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb'): Promise<DatabaseMetadata> {
  const metadata = loadMetadata();
  const existing = Object.values(metadata).find((db) => db.name === name);
  if (existing) throw new Error(`Database with name "${name}" already exists`);

  const id = generateId();
  const pgDatabaseName = `cloudnest_${sanitizePgName(name)}`;

  const existingPg = Object.values(metadata).find((db) => db.pgDatabaseName === pgDatabaseName);
  if (existingPg) throw new Error('A database with a similar name already exists. Try a different name.');

  const mainPool = getMainPool();
  try {
    const checkResult = await mainPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [pgDatabaseName]);
    if (checkResult.rows.length > 0) throw new Error(`PostgreSQL database "${pgDatabaseName}" already exists on this server`);
    await mainPool.query(`CREATE DATABASE "${pgDatabaseName}" OWNER "${PG_CONFIG.user}"`);
  } finally {
    await mainPool.end();
  }

  let sizeBytes = 0;
  const sizePool = getUserDbPool(pgDatabaseName);
  try {
    const sizeResult = await sizePool.query(`SELECT pg_database_size(current_database()) as size`);
    sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
  } catch { /* ignore */ } finally {
    await sizePool.end();
  }

  const now = Date.now();
  const db: DatabaseMetadata = {
    id,
    name,
    displayName: name,
    type,
    status: 'running',
    size: formatBytes(sizeBytes),
    sizeBytes,
    created: new Date(now).toISOString(),
    createdTimestamp: now,
    pgDatabaseName,
    config: { host: PG_CONFIG.host, port: PG_CONFIG.port, username: PG_CONFIG.user, password: PG_CONFIG.password, database: pgDatabaseName },
  };

  metadata[id] = db;
  saveMetadata(metadata);
  return db;
}

// Delete database (drops the real PG database)
export async function deleteDatabase(id: string): Promise<void> {
  const metadata = loadMetadata();
  if (!metadata[id]) throw new Error('Database not found');

  const pgDatabaseName = metadata[id].pgDatabaseName;
  if (pgDatabaseName) {
    const mainPool = getMainPool();
    try {
      await mainPool.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [pgDatabaseName]);
      await mainPool.query(`DROP DATABASE IF EXISTS "${pgDatabaseName}"`);
    } finally {
      await mainPool.end();
    }
  }

  const dbPath = path.join(dbDir, id);
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true, force: true });

  delete metadata[id];
  saveMetadata(metadata);
}

// Get database details with size refresh
export async function getDatabase(id: string): Promise<DatabaseMetadata | null> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) return null;

  if (db.pgDatabaseName) {
    const pool = getUserDbPool(db.pgDatabaseName);
    try {
      const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) as size`);
      db.sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
      db.size = formatBytes(db.sizeBytes);
      db.status = 'running';
      metadata[id] = db;
      saveMetadata(metadata);
    } catch {
      db.status = 'stopped';
    } finally {
      await pool.end();
    }
  }
  return db;
}

// List tables in a database
export async function listTables(id: string): Promise<{ name: string; rowCount: number; size: string }[]> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) throw new Error('Database not found');
  if (!db.pgDatabaseName) throw new Error('No PostgreSQL database associated');

  const pool = getUserDbPool(db.pgDatabaseName);
  try {
    const result = await pool.query(`
      SELECT t.tablename AS name, COALESCE(s.n_live_tup, 0) AS row_count,
             pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename))) AS size
      FROM pg_tables t LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
      WHERE t.schemaname = 'public' ORDER BY t.tablename
    `);
    return result.rows.map((r: any) => ({ name: r.name, rowCount: parseInt(r.row_count, 10), size: r.size }));
  } finally {
    await pool.end();
  }
}

// Get table columns
export async function getTableColumns(id: string, tableName: string): Promise<{ name: string; type: string; nullable: boolean; defaultValue: string | null }[]> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) throw new Error('Database not found');

  const pool = getUserDbPool(db.pgDatabaseName);
  try {
    const result = await pool.query(
      `SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS nullable, column_default AS default_value
       FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [tableName]
    );
    return result.rows.map((r: any) => ({ name: r.name, type: r.type, nullable: r.nullable, defaultValue: r.default_value }));
  } finally {
    await pool.end();
  }
}

// Get table data (paginated)
export async function getTableData(id: string, tableName: string, limit = 100, offset = 0): Promise<{ rows: any[]; totalCount: number; columns: string[] }> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) throw new Error('Database not found');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) throw new Error('Invalid table name');

  const pool = getUserDbPool(db.pgDatabaseName);
  try {
    const countResult = await pool.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
    const totalCount = parseInt(countResult.rows[0].total, 10);
    const dataResult = await pool.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
    const columns = dataResult.fields.map((f: any) => f.name);
    return { rows: dataResult.rows, totalCount, columns };
  } finally {
    await pool.end();
  }
}

// Execute a SQL query
export async function executeQuery(id: string, sql: string): Promise<{ rows: any[]; columns: string[]; rowCount: number; command: string }> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) throw new Error('Database not found');

  const pool = getUserDbPool(db.pgDatabaseName);
  try {
    const result = await pool.query(sql);
    const columns = result.fields ? result.fields.map((f: any) => f.name) : [];
    return { rows: result.rows || [], columns, rowCount: result.rowCount ?? 0, command: result.command || '' };
  } finally {
    await pool.end();
  }
}

// Create a table
export async function createTable(id: string, tableName: string, columns: { name: string; type: string; primaryKey?: boolean; nullable?: boolean; defaultValue?: string }[]): Promise<void> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) throw new Error('Database not found');
  // Normalize table name to lowercase for PostgreSQL compatibility
  const normalizedTable = tableName.toLowerCase();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalizedTable)) throw new Error('Invalid table name. Use letters, numbers, and underscores only.');
  if (!columns || columns.length === 0) throw new Error('At least one column is required');

  const colDefs = columns.map((col) => {
    // Normalize column names to lowercase
    const colName = col.name.toLowerCase();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(colName)) throw new Error(`Invalid column name: "${colName}"`);
    let def = `${colName} ${col.type}`;
    if (col.primaryKey) def += ' PRIMARY KEY';
    if (col.nullable === false && !col.primaryKey) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    return def;
  });

  const sql = `CREATE TABLE ${normalizedTable} (\n  ${colDefs.join(',\n  ')}\n)`;
  const pool = getUserDbPool(db.pgDatabaseName);
  try {
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}

// Drop a table
export async function dropTable(id: string, tableName: string): Promise<void> {
  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) throw new Error('Database not found');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) throw new Error('Invalid table name');

  const pool = getUserDbPool(db.pgDatabaseName);
  try {
    await pool.query(`DROP TABLE IF EXISTS ${tableName.toLowerCase()} CASCADE`);
  } finally {
    await pool.end();
  }
}

// Refresh database sizes
export async function refreshDatabaseSizes(): Promise<DatabaseMetadata[]> {
  const metadata = loadMetadata();
  for (const id of Object.keys(metadata)) {
    const db = metadata[id];
    if (db.pgDatabaseName) {
      const pool = getUserDbPool(db.pgDatabaseName);
      try {
        const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) as size`);
        db.sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
        db.size = formatBytes(db.sizeBytes);
        db.status = 'running';
      } catch { db.status = 'stopped'; } finally { await pool.end(); }
    }
  }
  saveMetadata(metadata);
  return Object.values(metadata);
}

export function startDatabase(id: string): DatabaseMetadata {
  const metadata = loadMetadata();
  if (!metadata[id]) throw new Error('Database not found');
  metadata[id].status = 'running';
  saveMetadata(metadata);
  return metadata[id];
}

export function stopDatabase(id: string): DatabaseMetadata {
  const metadata = loadMetadata();
  if (!metadata[id]) throw new Error('Database not found');
  metadata[id].status = 'stopped';
  saveMetadata(metadata);
  return metadata[id];
}
