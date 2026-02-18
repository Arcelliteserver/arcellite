import fs from 'fs';
import path from 'path';
import os from 'os';
import pg from 'pg';
import mysql from 'mysql2/promise';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';

const { Pool } = pg;

const homeDir = os.homedir();

function getStorageBase(): string {
  const cached = (globalThis as any).__arcellite_storage_path;
  if (cached) return cached;
  let dir = process.env.ARCELLITE_DATA || path.join(homeDir, 'arcellite-data');
  if (dir.startsWith('~/') || dir === '~') {
    dir = path.join(homeDir, dir.slice(2));
  }
  return dir;
}

function getDbDir(): string {
  return path.join(getStorageBase(), 'databases');
}

function getDbMetadataFile(): string {
  return path.join(getDbDir(), 'metadata.json');
}

// PostgreSQL connection config — force TCP (localhost) for password auth
const rawHost = process.env.DB_HOST || 'localhost';
const PG_CONFIG = {
  host: rawHost.startsWith('/') ? 'localhost' : rawHost,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'arcellite_user',
  password: process.env.DB_PASSWORD,
};

// MySQL/MariaDB connection config
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT || '3306'),
  user: process.env.MYSQL_USER || 'arcellite_user',
  password: process.env.MYSQL_PASSWORD,
};

interface DatabaseMetadata {
  id: string;
  name: string;
  displayName: string;
  type: 'postgresql' | 'mysql' | 'sqlite';
  status: 'running' | 'stopped';
  size: string;
  sizeBytes: number;
  created: string;
  createdTimestamp: number;
  pgDatabaseName: string;   // Also used for MySQL database name
  sqliteFilePath?: string;  // File path for SQLite databases
  isSystem?: boolean;       // Mark system databases (e.g. AI Chat History)
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
  const dir = getDbDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadMetadata(): DatabasesMetadata {
  ensureDbDir();
  if (!fs.existsSync(getDbMetadataFile())) return {};
  try {
    return JSON.parse(fs.readFileSync(getDbMetadataFile(), 'utf-8'));
  } catch {
    return {};
  }
}

function saveMetadata(metadata: DatabasesMetadata) {
  ensureDbDir();
  fs.writeFileSync(getDbMetadataFile(), JSON.stringify(metadata, null, 2), 'utf-8');
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

// ── MySQL helpers ──
async function getMysqlAdminConn(): Promise<mysql.Connection> {
  // Use root to create databases, then grant to arcellite_user
  return mysql.createConnection({
    host: MYSQL_CONFIG.host,
    port: MYSQL_CONFIG.port,
    user: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD,
  });
}

async function getMysqlConn(dbName: string): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: MYSQL_CONFIG.host,
    port: MYSQL_CONFIG.port,
    user: MYSQL_CONFIG.user,
    password: MYSQL_CONFIG.password,
    database: dbName,
  });
}

// ── SQLite helpers ──
function getSqliteDir(): string {
  return path.join(getDbDir(), 'sqlite');
}

function ensureSqliteDir() {
  const dir = getSqliteDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getSqlitePath(id: string): string {
  return path.join(getSqliteDir(), `${id}.sqlite`);
}

let sqlJsInstance: Awaited<ReturnType<typeof initSqlJs>> | null = null;
async function getSqlJs() {
  if (!sqlJsInstance) {
    sqlJsInstance = await initSqlJs();
  }
  return sqlJsInstance;
}

async function openSqliteDb(filePath: string): Promise<SqlJsDatabase> {
  const SQL = await getSqlJs();
  if (fs.existsSync(filePath)) {
    const buffer = fs.readFileSync(filePath);
    return new SQL.Database(buffer);
  }
  return new SQL.Database();
}

function saveSqliteDb(db: SqlJsDatabase, filePath: string) {
  const data = db.export();
  fs.writeFileSync(filePath, Buffer.from(data));
}

// System database IDs
const SYSTEM_CHAT_DB_ID = '__system_chat_history';
const SYSTEM_CHAT_PG_NAME = 'arcellite_chat_history';

// List all databases
export function listDatabases(): DatabaseMetadata[] {
  return Object.values(loadMetadata());
}

// Create real PostgreSQL database
export async function createDatabase(name: string, type: 'postgresql' | 'mysql' | 'sqlite'): Promise<DatabaseMetadata> {
  const metadata = loadMetadata();
  const existing = Object.values(metadata).find((db) => db.name === name);
  if (existing) throw new Error(`Database with name "${name}" already exists`);

  const id = generateId();
  const sanitizedName = `arcellite_${sanitizePgName(name)}`;
  const now = Date.now();

  if (type === 'postgresql') {
    // ── PostgreSQL ──
    const existingPg = Object.values(metadata).find((db) => db.pgDatabaseName === sanitizedName);
    if (existingPg) throw new Error('A database with a similar name already exists. Try a different name.');

    const mainPool = getMainPool();
    try {
      const checkResult = await mainPool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [sanitizedName]);
      if (checkResult.rows.length > 0) throw new Error(`PostgreSQL database "${sanitizedName}" already exists on this server`);
      await mainPool.query(`CREATE DATABASE "${sanitizedName}" OWNER "${PG_CONFIG.user}"`);
    } finally {
      await mainPool.end();
    }

    let sizeBytes = 0;
    const sizePool = getUserDbPool(sanitizedName);
    try {
      const sizeResult = await sizePool.query(`SELECT pg_database_size(current_database()) as size`);
      sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
    } catch { /* ignore */ } finally {
      await sizePool.end();
    }

    const db: DatabaseMetadata = {
      id, name, displayName: name, type, status: 'running',
      size: formatBytes(sizeBytes), sizeBytes,
      created: new Date(now).toISOString(), createdTimestamp: now,
      pgDatabaseName: sanitizedName,
      config: { host: PG_CONFIG.host, port: PG_CONFIG.port, username: PG_CONFIG.user, password: PG_CONFIG.password, database: sanitizedName },
    };
    metadata[id] = db;
    saveMetadata(metadata);
    return db;

  } else if (type === 'mysql') {
    // ── MySQL / MariaDB ──
    const conn = await getMysqlAdminConn();
    try {
      const [rows] = await conn.query(`SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = ?`, [sanitizedName]);
      if ((rows as any[]).length > 0) throw new Error(`MySQL database "${sanitizedName}" already exists`);
      await conn.query(`CREATE DATABASE \`${sanitizedName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      await conn.query(`GRANT ALL PRIVILEGES ON \`${sanitizedName}\`.* TO ?@'%'`, [MYSQL_CONFIG.user]);
      await conn.query(`FLUSH PRIVILEGES`);
    } finally {
      await conn.end();
    }

    let sizeBytes = 0;
    try {
      const userConn = await getMysqlConn(sanitizedName);
      try {
        const [rows] = await userConn.query(
          `SELECT SUM(data_length + index_length) AS size FROM information_schema.TABLES WHERE table_schema = ?`, [sanitizedName]
        );
        sizeBytes = parseInt((rows as any[])[0]?.size || '0', 10) || 0;
      } finally { await userConn.end(); }
    } catch { /* ignore */ }

    const db: DatabaseMetadata = {
      id, name, displayName: name, type, status: 'running',
      size: formatBytes(sizeBytes), sizeBytes,
      created: new Date(now).toISOString(), createdTimestamp: now,
      pgDatabaseName: sanitizedName,
      config: { host: MYSQL_CONFIG.host, port: MYSQL_CONFIG.port, username: MYSQL_CONFIG.user, password: MYSQL_CONFIG.password, database: sanitizedName },
    };
    metadata[id] = db;
    saveMetadata(metadata);
    return db;

  } else if (type === 'sqlite') {
    // ── SQLite ──
    ensureSqliteDir();
    const sqliteDbName = `arcellite_${sanitizePgName(name)}`;
    const filePath = path.join(getSqliteDir(), `${sqliteDbName}.sqlite`);

    // Check for existing file with same sanitized name
    if (fs.existsSync(filePath)) throw new Error(`SQLite database "${sqliteDbName}" already exists`);

    const sqliteDb = await openSqliteDb(filePath);
    saveSqliteDb(sqliteDb, filePath);
    sqliteDb.close();

    const stats = fs.statSync(filePath);
    const sizeBytes = stats.size;

    const db: DatabaseMetadata = {
      id, name, displayName: name, type, status: 'running',
      size: formatBytes(sizeBytes), sizeBytes,
      created: new Date(now).toISOString(), createdTimestamp: now,
      pgDatabaseName: sqliteDbName,
      sqliteFilePath: filePath,
      config: { host: 'embedded', port: 0, username: '', password: '', database: sqliteDbName },
    };
    metadata[id] = db;
    saveMetadata(metadata);
    return db;

  } else {
    throw new Error(`Unsupported database type: ${type}`);
  }
}

// Delete database
export async function deleteDatabase(id: string): Promise<void> {
  if (id === SYSTEM_CHAT_DB_ID) throw new Error('Cannot delete system database');
  const metadata = loadMetadata();
  if (!metadata[id]) throw new Error('Database not found');

  const db = metadata[id];

  if (db.type === 'postgresql' && db.pgDatabaseName) {
    const mainPool = getMainPool();
    try {
      await mainPool.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [db.pgDatabaseName]);
      await mainPool.query(`DROP DATABASE IF EXISTS "${db.pgDatabaseName}"`);
    } finally {
      await mainPool.end();
    }
  } else if (db.type === 'mysql' && db.pgDatabaseName) {
    const conn = await getMysqlAdminConn();
    try {
      await conn.query(`DROP DATABASE IF EXISTS \`${db.pgDatabaseName}\``);
    } finally {
      await conn.end();
    }
  } else if (db.type === 'sqlite') {
    const filePath = db.sqliteFilePath || getSqlitePath(id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const dbPath = path.join(getDbDir(), id);
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true, force: true });

  delete metadata[id];
  saveMetadata(metadata);
}

// Get database details with size refresh
export async function getDatabase(id: string): Promise<DatabaseMetadata | null> {
  if (id === SYSTEM_CHAT_DB_ID) {
    const pool = getUserDbPool(SYSTEM_CHAT_PG_NAME);
    try {
      const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) as size`);
      const sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
      return {
        id: SYSTEM_CHAT_DB_ID,
        name: 'Arcellite',
        displayName: 'Arcellite',
        type: 'postgresql',
        status: 'running',
        size: formatBytes(sizeBytes),
        sizeBytes,
        created: new Date().toISOString(),
        pgDatabaseName: SYSTEM_CHAT_PG_NAME,
        isSystem: true,
      } as any;
    } catch {
      return {
        id: SYSTEM_CHAT_DB_ID,
        name: 'Arcellite',
        displayName: 'Arcellite',
        type: 'postgresql',
        status: 'stopped',
        size: '0 B',
        sizeBytes: 0,
        created: new Date().toISOString(),
        pgDatabaseName: SYSTEM_CHAT_PG_NAME,
        isSystem: true,
      } as any;
    } finally {
      await pool.end();
    }
  }

  const metadata = loadMetadata();
  const db = metadata[id];
  if (!db) return null;

  if (db.type === 'postgresql' && db.pgDatabaseName) {
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
  } else if (db.type === 'mysql' && db.pgDatabaseName) {
    try {
      const conn = await getMysqlConn(db.pgDatabaseName);
      try {
        const [rows] = await conn.query(
          `SELECT SUM(data_length + index_length) AS size FROM information_schema.TABLES WHERE table_schema = ?`, [db.pgDatabaseName]
        );
        db.sizeBytes = parseInt((rows as any[])[0]?.size || '0', 10) || 0;
        db.size = formatBytes(db.sizeBytes);
        db.status = 'running';
        metadata[id] = db;
        saveMetadata(metadata);
      } finally { await conn.end(); }
    } catch {
      db.status = 'stopped';
    }
  } else if (db.type === 'sqlite') {
    const filePath = db.sqliteFilePath || getSqlitePath(id);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      db.sizeBytes = stats.size;
      db.size = formatBytes(db.sizeBytes);
      db.status = 'running';
    } else {
      db.status = 'stopped';
      db.sizeBytes = 0;
      db.size = '0 B';
    }
    metadata[id] = db;
    saveMetadata(metadata);
  }
  return db;
}

// ═══════════════════════════════════════════════════════════
// ──  Multi-engine table & query operations  ────────────────
// ═══════════════════════════════════════════════════════════

/** Resolve DB metadata (user or system) */
function getDbMeta(id: string): DatabaseMetadata | null {
  if (id === SYSTEM_CHAT_DB_ID) {
    return { id: SYSTEM_CHAT_DB_ID, name: 'Arcellite', displayName: 'Arcellite', type: 'postgresql', status: 'running', size: '', sizeBytes: 0, created: '', createdTimestamp: 0, pgDatabaseName: SYSTEM_CHAT_PG_NAME, config: { host: PG_CONFIG.host, port: PG_CONFIG.port, username: PG_CONFIG.user, password: PG_CONFIG.password, database: SYSTEM_CHAT_PG_NAME } };
  }
  const metadata = loadMetadata();
  return metadata[id] || null;
}

// ── List tables ──
export async function listTables(id: string): Promise<{ name: string; rowCount: number; size: string }[]> {
  const meta = getDbMeta(id);
  if (!meta) throw new Error('Database not found');

  if (meta.type === 'postgresql') {
    const pool = getUserDbPool(meta.pgDatabaseName);
    try {
      const result = await pool.query(`
        SELECT t.tablename AS name, COALESCE(s.n_live_tup, 0) AS row_count,
               pg_size_pretty(pg_total_relation_size(quote_ident(t.tablename))) AS size
        FROM pg_tables t LEFT JOIN pg_stat_user_tables s ON s.relname = t.tablename
        WHERE t.schemaname = 'public' ORDER BY t.tablename
      `);
      return result.rows.map((r: any) => ({ name: r.name, rowCount: parseInt(r.row_count, 10), size: r.size }));
    } finally { await pool.end(); }

  } else if (meta.type === 'mysql') {
    const conn = await getMysqlConn(meta.pgDatabaseName);
    try {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME AS name,
                TABLE_ROWS AS row_count,
                CONCAT(ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024, 2), ' KB') AS size
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME`, [meta.pgDatabaseName]
      );
      return (rows as any[]).map((r: any) => ({ name: r.name, rowCount: parseInt(r.row_count || '0', 10), size: r.size || '0 KB' }));
    } finally { await conn.end(); }

  } else if (meta.type === 'sqlite') {
    const filePath = meta.sqliteFilePath || getSqlitePath(id);
    const db = await openSqliteDb(filePath);
    try {
      const stmt = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`);
      const tables: { name: string; rowCount: number; size: string }[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as { name: string };
        // Get row count
        const countStmt = db.prepare(`SELECT COUNT(*) AS cnt FROM "${row.name}"`);
        countStmt.step();
        const cnt = (countStmt.getAsObject() as { cnt: number }).cnt || 0;
        countStmt.free();
        tables.push({ name: row.name, rowCount: cnt, size: '-' });
      }
      stmt.free();
      return tables;
    } finally { db.close(); }

  } else {
    throw new Error(`Unsupported database type: ${meta.type}`);
  }
}

// ── Get table columns ──
export async function getTableColumns(id: string, tableName: string): Promise<{ name: string; type: string; nullable: boolean; defaultValue: string | null }[]> {
  const meta = getDbMeta(id);
  if (!meta) throw new Error('Database not found');

  if (meta.type === 'postgresql') {
    const pool = getUserDbPool(meta.pgDatabaseName);
    try {
      const result = await pool.query(
        `SELECT column_name AS name, data_type AS type, is_nullable = 'YES' AS nullable, column_default AS default_value
         FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`, [tableName]
      );
      return result.rows.map((r: any) => ({ name: r.name, type: r.type, nullable: r.nullable, defaultValue: r.default_value }));
    } finally { await pool.end(); }

  } else if (meta.type === 'mysql') {
    const conn = await getMysqlConn(meta.pgDatabaseName);
    try {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type, IS_NULLABLE = 'YES' AS nullable, COLUMN_DEFAULT AS default_value
         FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`, [meta.pgDatabaseName, tableName]
      );
      return (rows as any[]).map((r: any) => ({ name: r.name, type: r.type, nullable: !!r.nullable, defaultValue: r.default_value }));
    } finally { await conn.end(); }

  } else if (meta.type === 'sqlite') {
    const filePath = meta.sqliteFilePath || getSqlitePath(id);
    const db = await openSqliteDb(filePath);
    try {
      const stmt = db.prepare(`PRAGMA table_info("${tableName}")`);
      const cols: { name: string; type: string; nullable: boolean; defaultValue: string | null }[] = [];
      while (stmt.step()) {
        const row = stmt.getAsObject() as { name: string; type: string; notnull: number; dflt_value: string | null; pk: number };
        cols.push({ name: row.name, type: row.type, nullable: row.notnull === 0, defaultValue: row.dflt_value });
      }
      stmt.free();
      return cols;
    } finally { db.close(); }

  } else {
    throw new Error(`Unsupported database type: ${meta.type}`);
  }
}

// ── Get table data (paginated) ──
export async function getTableData(id: string, tableName: string, limit = 100, offset = 0): Promise<{ rows: any[]; totalCount: number; columns: string[] }> {
  const meta = getDbMeta(id);
  if (!meta) throw new Error('Database not found');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) throw new Error('Invalid table name');

  if (meta.type === 'postgresql') {
    const pool = getUserDbPool(meta.pgDatabaseName);
    try {
      const countResult = await pool.query(`SELECT COUNT(*) as total FROM "${tableName}"`);
      const totalCount = parseInt(countResult.rows[0].total, 10);
      const dataResult = await pool.query(`SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`, [limit, offset]);
      const columns = dataResult.fields.map((f: any) => f.name);
      return { rows: dataResult.rows, totalCount, columns };
    } finally { await pool.end(); }

  } else if (meta.type === 'mysql') {
    const conn = await getMysqlConn(meta.pgDatabaseName);
    try {
      const [countRows] = await conn.query(`SELECT COUNT(*) AS total FROM \`${tableName}\``);
      const totalCount = parseInt((countRows as any[])[0].total, 10);
      const [dataRows, fields] = await conn.query(`SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`, [limit, offset]);
      const columns = (fields as any[]).map((f: any) => f.name);
      return { rows: dataRows as any[], totalCount, columns };
    } finally { await conn.end(); }

  } else if (meta.type === 'sqlite') {
    const filePath = meta.sqliteFilePath || getSqlitePath(id);
    const db = await openSqliteDb(filePath);
    try {
      const countStmt = db.prepare(`SELECT COUNT(*) AS total FROM "${tableName}"`);
      countStmt.step();
      const totalCount = (countStmt.getAsObject() as { total: number }).total || 0;
      countStmt.free();

      const stmt = db.prepare(`SELECT * FROM "${tableName}" LIMIT ? OFFSET ?`);
      stmt.bind([limit, offset]);
      const rows: any[] = [];
      const columns: string[] = stmt.getColumnNames();
      while (stmt.step()) {
        const row = stmt.getAsObject();
        rows.push(row);
      }
      stmt.free();
      return { rows, totalCount, columns };
    } finally { db.close(); }

  } else {
    throw new Error(`Unsupported database type: ${meta.type}`);
  }
}

// ── Execute a SQL query ──
export async function executeQuery(id: string, sql: string): Promise<{ rows: any[]; columns: string[]; rowCount: number; command: string }> {
  const meta = getDbMeta(id);
  if (!meta) throw new Error('Database not found');

  if (meta.type === 'postgresql') {
    const pool = getUserDbPool(meta.pgDatabaseName);
    try {
      const result = await pool.query(sql);
      const columns = result.fields ? result.fields.map((f: any) => f.name) : [];
      return { rows: result.rows || [], columns, rowCount: result.rowCount ?? 0, command: result.command || '' };
    } finally { await pool.end(); }

  } else if (meta.type === 'mysql') {
    const conn = await getMysqlConn(meta.pgDatabaseName);
    try {
      const [result, fields] = await conn.query(sql);
      if (Array.isArray(result)) {
        const columns = (fields as any[])?.map((f: any) => f.name) || [];
        return { rows: result as any[], columns, rowCount: (result as any[]).length, command: sql.trim().split(/\s/)[0].toUpperCase() };
      } else {
        return { rows: [], columns: [], rowCount: (result as any).affectedRows ?? 0, command: sql.trim().split(/\s/)[0].toUpperCase() };
      }
    } finally { await conn.end(); }

  } else if (meta.type === 'sqlite') {
    const filePath = meta.sqliteFilePath || getSqlitePath(id);
    const db = await openSqliteDb(filePath);
    try {
      const trimmed = sql.trim().toUpperCase();
      const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('EXPLAIN');

      if (isSelect) {
        const stmt = db.prepare(sql);
        const columns: string[] = stmt.getColumnNames();
        const rows: any[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject());
        }
        stmt.free();
        saveSqliteDb(db, filePath);
        return { rows, columns, rowCount: rows.length, command: trimmed.split(/\s/)[0] };
      } else {
        db.run(sql);
        const changes = db.getRowsModified();
        saveSqliteDb(db, filePath);
        return { rows: [], columns: [], rowCount: changes, command: trimmed.split(/\s/)[0] };
      }
    } finally { db.close(); }

  } else {
    throw new Error(`Unsupported database type: ${meta.type}`);
  }
}

// ── Create a table ──
export async function createTable(id: string, tableName: string, columns: { name: string; type: string; primaryKey?: boolean; nullable?: boolean; defaultValue?: string }[]): Promise<void> {
  const meta = getDbMeta(id);
  if (!meta) throw new Error('Database not found');
  const normalizedTable = tableName.toLowerCase();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalizedTable)) throw new Error('Invalid table name. Use letters, numbers, and underscores only.');
  if (!columns || columns.length === 0) throw new Error('At least one column is required');

  const colDefs = columns.map((col) => {
    const colName = col.name.toLowerCase();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(colName)) throw new Error(`Invalid column name: "${colName}"`);

    // Handle auto-increment types per engine
    let colType = col.type;
    if (meta.type === 'mysql') {
      // Convert PostgreSQL SERIAL to MySQL AUTO_INCREMENT
      if (colType === 'SERIAL') colType = 'INT AUTO_INCREMENT';
      else if (colType === 'BIGSERIAL') colType = 'BIGINT AUTO_INCREMENT';
    } else if (meta.type === 'sqlite') {
      if (colType === 'SERIAL' || colType === 'BIGSERIAL') colType = 'INTEGER';
    }

    let def = `${colName} ${colType}`;
    if (col.primaryKey) def += ' PRIMARY KEY';
    if (col.nullable === false && !col.primaryKey) def += ' NOT NULL';
    if (col.defaultValue) {
      // Whitelist safe DEFAULT expressions to prevent SQL injection (SEC-003)
      const safeDefault = /^('[^']*'|-?\d+(\.\d+)?|NULL|CURRENT_TIMESTAMP|NOW\(\)|true|false)$/i.test(col.defaultValue.trim());
      if (!safeDefault) throw new Error(`Invalid DEFAULT value for column "${col.name}". Use a string literal, number, NULL, or CURRENT_TIMESTAMP.`);
      def += ` DEFAULT ${col.defaultValue}`;
    }
    return def;
  });

  const sqlStr = `CREATE TABLE ${normalizedTable} (\n  ${colDefs.join(',\n  ')}\n)`;

  if (meta.type === 'postgresql') {
    const pool = getUserDbPool(meta.pgDatabaseName);
    try { await pool.query(sqlStr); } finally { await pool.end(); }

  } else if (meta.type === 'mysql') {
    const conn = await getMysqlConn(meta.pgDatabaseName);
    try { await conn.query(sqlStr); } finally { await conn.end(); }

  } else if (meta.type === 'sqlite') {
    const filePath = meta.sqliteFilePath || getSqlitePath(id);
    const db = await openSqliteDb(filePath);
    try {
      db.run(sqlStr);
      saveSqliteDb(db, filePath);
    } finally { db.close(); }

  } else {
    throw new Error(`Unsupported database type: ${meta.type}`);
  }
}

// ── Drop a table ──
export async function dropTable(id: string, tableName: string): Promise<void> {
  const meta = getDbMeta(id);
  if (!meta) throw new Error('Database not found');
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) throw new Error('Invalid table name');

  if (meta.type === 'postgresql') {
    const pool = getUserDbPool(meta.pgDatabaseName);
    try { await pool.query(`DROP TABLE IF EXISTS ${tableName.toLowerCase()} CASCADE`); } finally { await pool.end(); }

  } else if (meta.type === 'mysql') {
    const conn = await getMysqlConn(meta.pgDatabaseName);
    try { await conn.query(`DROP TABLE IF EXISTS \`${tableName.toLowerCase()}\``); } finally { await conn.end(); }

  } else if (meta.type === 'sqlite') {
    const filePath = meta.sqliteFilePath || getSqlitePath(id);
    const db = await openSqliteDb(filePath);
    try {
      db.run(`DROP TABLE IF EXISTS "${tableName.toLowerCase()}"`);
      saveSqliteDb(db, filePath);
    } finally { db.close(); }

  } else {
    throw new Error(`Unsupported database type: ${meta.type}`);
  }
}

// Refresh database sizes
export async function refreshDatabaseSizes(): Promise<DatabaseMetadata[]> {
  const metadata = loadMetadata();
  for (const id of Object.keys(metadata)) {
    const db = metadata[id];
    if (db.type === 'postgresql' && db.pgDatabaseName) {
      const pool = getUserDbPool(db.pgDatabaseName);
      try {
        const sizeResult = await pool.query(`SELECT pg_database_size(current_database()) as size`);
        db.sizeBytes = parseInt(sizeResult.rows[0]?.size || '0', 10);
        db.size = formatBytes(db.sizeBytes);
        db.status = 'running';
      } catch { db.status = 'stopped'; } finally { await pool.end(); }
    } else if (db.type === 'mysql' && db.pgDatabaseName) {
      try {
        const conn = await getMysqlConn(db.pgDatabaseName);
        try {
          const [rows] = await conn.query(
            `SELECT SUM(data_length + index_length) AS size FROM information_schema.TABLES WHERE table_schema = ?`, [db.pgDatabaseName]
          );
          db.sizeBytes = parseInt((rows as any[])[0]?.size || '0', 10) || 0;
          db.size = formatBytes(db.sizeBytes);
          db.status = 'running';
        } finally { await conn.end(); }
      } catch { db.status = 'stopped'; }
    } else if (db.type === 'sqlite') {
      const filePath = db.sqliteFilePath || getSqlitePath(id);
      if (fs.existsSync(filePath)) {
        db.sizeBytes = fs.statSync(filePath).size;
        db.size = formatBytes(db.sizeBytes);
        db.status = 'running';
      } else { db.status = 'stopped'; }
    }
  }
  saveMetadata(metadata);
  return Object.values(metadata);
}

/**
 * Purge ALL user-created databases — drops every database and clears metadata.
 */
export async function purgeAllDatabases(): Promise<{ purgedCount: number; names: string[] }> {
  const metadata = loadMetadata();
  const ids = Object.keys(metadata);
  const purgedNames: string[] = [];

  for (const id of ids) {
    const db = metadata[id];
    purgedNames.push(db.displayName || db.name);

    try {
      if (db.type === 'postgresql' && db.pgDatabaseName) {
        const mainPool = getMainPool();
        try {
          await mainPool.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`, [db.pgDatabaseName]);
          await mainPool.query(`DROP DATABASE IF EXISTS "${db.pgDatabaseName}"`);
        } finally { await mainPool.end(); }
      } else if (db.type === 'mysql' && db.pgDatabaseName) {
        const conn = await getMysqlAdminConn();
        try { await conn.query(`DROP DATABASE IF EXISTS \`${db.pgDatabaseName}\``); } finally { await conn.end(); }
      } else if (db.type === 'sqlite') {
        const filePath = db.sqliteFilePath || getSqlitePath(id);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    } catch (err) {
      console.error(`[purgeAllDatabases] Failed to drop ${db.displayName || db.name}:`, err);
    }

    const dbPath = path.join(getDbDir(), id);
    if (fs.existsSync(dbPath)) fs.rmSync(dbPath, { recursive: true, force: true });
  }

  saveMetadata({});
  return { purgedCount: ids.length, names: purgedNames };
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
