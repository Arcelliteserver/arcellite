import React, { useState, useCallback, useRef } from 'react';
import {
  Database,
  Plus,
  Play,
  Square,
  Trash2,
  Activity,
  HardDrive,
  Server,
  ArrowLeft,
  Table,
  Terminal,
  Eye,
  EyeOff,
  Copy,
  ChevronRight,
  RefreshCw,
  X,
  Loader2,
} from 'lucide-react';
import ConfirmModal from '../../common/ConfirmModal';

interface DatabaseInstance {
  id: string;
  name: string;
  displayName?: string;
  type: 'postgresql' | 'mysql' | 'sqlite' | 'mongodb';
  status: 'running' | 'stopped';
  size: string;
  sizeBytes?: number;
  created: string;
  pgDatabaseName?: string;
  sqliteFilePath?: string;
  isSystem?: boolean;
  config?: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
}

interface TableInfo {
  name: string;
  rowCount: number;
  size: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
}

interface QueryResult {
  rows: any[];
  columns: string[];
  rowCount: number;
  command: string;
}

interface DatabaseType {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
}

const databaseTypes: DatabaseType[] = [
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    icon: '/assets/apps/postgresql.svg',
    description: 'Advanced open-source relational database',
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'mysql',
    name: 'MySQL',
    icon: '/assets/apps/mysql.svg',
    description: 'Popular open-source relational database',
    color: 'from-orange-500 to-orange-600',
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    icon: '/assets/icons/storage_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg',
    description: 'Lightweight embedded database',
    color: 'from-gray-500 to-gray-600',
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    icon: '/assets/icons/hard_disk_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg',
    description: 'Modern NoSQL document database',
    color: 'from-green-500 to-green-600',
  },
];

const PG_TYPES = [
  'SERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
  'TEXT', 'VARCHAR(255)', 'CHAR(1)',
  'BOOLEAN',
  'REAL', 'DOUBLE PRECISION', 'NUMERIC',
  'DATE', 'TIMESTAMP', 'TIMESTAMPTZ', 'TIME',
  'UUID', 'JSON', 'JSONB',
  'BYTEA',
];

const MYSQL_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'TEXT', 'VARCHAR(255)', 'CHAR(1)', 'MEDIUMTEXT', 'LONGTEXT',
  'BOOLEAN',
  'FLOAT', 'DOUBLE', 'DECIMAL(10,2)',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
  'JSON', 'BLOB', 'ENUM',
];

const SQLITE_TYPES = [
  'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NUMERIC',
];

function getTypesForEngine(dbType: string): string[] {
  switch (dbType) {
    case 'mysql': return MYSQL_TYPES;
    case 'sqlite': return SQLITE_TYPES;
    default: return PG_TYPES;
  }
}

/* SQL syntax highlighting helper */
const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE',
  'CREATE','ALTER','DROP','TABLE','DATABASE','INDEX','VIEW','TRIGGER','FUNCTION',
  'PRIMARY','KEY','FOREIGN','REFERENCES','UNIQUE','NOT','NULL','DEFAULT',
  'CHECK','CONSTRAINT','CASCADE','RESTRICT','IF','EXISTS','REPLACE',
  'AND','OR','IN','BETWEEN','LIKE','ILIKE','IS','AS','ON','JOIN',
  'LEFT','RIGHT','INNER','OUTER','CROSS','FULL','NATURAL','USING',
  'ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','DISTINCT','ALL','ANY',
  'UNION','INTERSECT','EXCEPT','CASE','WHEN','THEN','ELSE','END',
  'BEGIN','COMMIT','ROLLBACK','TRANSACTION','GRANT','REVOKE','OWNER',
  'RETURNING','WITH','RECURSIVE','ASC','DESC','NULLS','FIRST','LAST',
  'TRUE','FALSE','SERIAL','BIGSERIAL','SMALLSERIAL',
  'SHOW','DESCRIBE','USE','ENGINE','CHARSET','COLLATE','PRAGMA',
]);

const SQL_TYPES = new Set([
  'INTEGER','INT','BIGINT','SMALLINT','NUMERIC','DECIMAL','REAL',
  'DOUBLE','PRECISION','FLOAT','SERIAL','BIGSERIAL','SMALLSERIAL',
  'TEXT','VARCHAR','CHAR','CHARACTER','VARYING','MEDIUMTEXT','LONGTEXT','TINYINT',
  'BOOLEAN','BOOL','DATE','TIME','TIMESTAMP','TIMESTAMPTZ','INTERVAL','DATETIME',
  'UUID','JSON','JSONB','BYTEA','ARRAY','MONEY','BIT','BLOB','ENUM',
  'INET','CIDR','MACADDR','POINT','LINE','LSEG','BOX','PATH','POLYGON','CIRCLE',
  'XML','TSVECTOR','TSQUERY','OID','REGCLASS',
  'AUTO_INCREMENT',
]);

const SQL_FUNCTIONS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF','CAST',
  'UPPER','LOWER','TRIM','SUBSTRING','LENGTH','CONCAT','REPLACE',
  'NOW','CURRENT_DATE','CURRENT_TIME','CURRENT_TIMESTAMP',
  'EXTRACT','DATE_PART','DATE_TRUNC','AGE','TO_CHAR','TO_DATE','TO_NUMBER',
  'ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD','OVER','PARTITION',
  'PG_DATABASE_SIZE','PG_TOTAL_RELATION_SIZE','PG_SIZE_PRETTY',
  'QUOTE_IDENT','QUOTE_LITERAL','FORMAT','GENERATE_SERIES',
  'ARRAY_AGG','STRING_AGG','JSON_BUILD_OBJECT','JSONB_BUILD_OBJECT',
  'EXISTS','IN','ANY','SOME','EVERY',
]);

function highlightSQL(code: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Regex: strings, comments, numbers, words, parens/operators, whitespace, rest
  const re = /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(--[^\n]*|\$\$[\s\S]*?\$\$)|(\b\d+(?:\.\d+)?\b)|([a-zA-Z_][a-zA-Z0-9_]*(?:\([^)]*\))?)|([();,.*=<>!+\-\/]+)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(code)) !== null) {
    const [full, str, comment, num, word, op, ws, other] = m;
    if (str) {
      tokens.push(<span key={idx++} className="text-green-600">{full}</span>);
    } else if (comment) {
      tokens.push(<span key={idx++} className="text-gray-400 italic">{full}</span>);
    } else if (num) {
      tokens.push(<span key={idx++} className="text-orange-500">{full}</span>);
    } else if (word) {
      const base = word.replace(/\(.*/, '').toUpperCase();
      if (SQL_KEYWORDS.has(base)) {
        tokens.push(<span key={idx++} className="text-[#5D5FEF] font-bold">{full}</span>);
      } else if (SQL_TYPES.has(base)) {
        tokens.push(<span key={idx++} className="text-cyan-600 font-semibold">{full}</span>);
      } else if (SQL_FUNCTIONS.has(base)) {
        tokens.push(<span key={idx++} className="text-amber-600">{full}</span>);
      } else {
        tokens.push(<span key={idx++} className="text-gray-800">{full}</span>);
      }
    } else if (op) {
      tokens.push(<span key={idx++} className="text-red-400">{full}</span>);
    } else {
      tokens.push(<span key={idx++}>{full}</span>);
    }
  }
  return tokens;
}

/* ──────────────────────────── DatabaseDetailView ──────────────────────────── */
const DatabaseDetailView: React.FC<{
  db: DatabaseInstance;
  onBack: () => void;
}> = ({ db, onBack }) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'query' | 'info'>('tables');
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  // Table creation
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCols, setNewTableCols] = useState<{ name: string; type: string; primaryKey: boolean; nullable: boolean }[]>([
    { name: 'id', type: 'SERIAL', primaryKey: true, nullable: false },
  ]);
  const [createTableError, setCreateTableError] = useState('');

  // Table browsing
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [tableTotalCount, setTableTotalCount] = useState(0);
  const [tableDataCols, setTableDataCols] = useState<string[]>([]);
  const [tableLoading, setTableLoading] = useState(false);

  // Query
  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState('');
  const [queryRunning, setQueryRunning] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  // Confirm
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success';
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const dbType = databaseTypes.find((t) => t.id === db.type);

  const loadTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const res = await fetch(`/api/databases/tables?id=${db.id}`);
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch (e) {
      // Silent — tables UI shows empty state
    } finally {
      setTablesLoading(false);
    }
  }, [db.id]);

  React.useEffect(() => {
    loadTables();
  }, [loadTables]);

  const openTable = async (tableName: string) => {
    setSelectedTable(tableName);
    setTableLoading(true);
    try {
      const [colRes, dataRes] = await Promise.all([
        fetch(`/api/databases/columns?id=${db.id}&table=${tableName}`),
        fetch(`/api/databases/data?id=${db.id}&table=${tableName}&limit=100&offset=0`),
      ]);
      if (colRes.ok) {
        const cd = await colRes.json();
        setTableColumns(cd.columns || []);
      }
      if (dataRes.ok) {
        const dd = await dataRes.json();
        setTableRows(dd.rows || []);
        setTableDataCols(dd.columns || []);
        setTableTotalCount(dd.totalCount ?? 0);
      }
    } catch (e) {
      // Silent — table data UI shows empty state
    } finally {
      setTableLoading(false);
    }
  };

  const handleCreateTable = async () => {
    setCreateTableError('');
    if (!newTableName.trim()) { setCreateTableError('Table name is required'); return; }
    if (newTableCols.length === 0) { setCreateTableError('Add at least one column'); return; }
    if (newTableCols.some((c) => !c.name.trim())) { setCreateTableError('All columns must have a name'); return; }

    try {
      const res = await fetch('/api/databases/create-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: db.id, tableName: newTableName.trim(), columns: newTableCols }),
      });
      if (!res.ok) {
        const d = await res.json();
        setCreateTableError(d.error || 'Failed');
        return;
      }
      setShowCreateTable(false);
      setNewTableName('');
      setNewTableCols([{ name: 'id', type: 'SERIAL', primaryKey: true, nullable: false }]);
      await loadTables();
    } catch (e: any) {
      setCreateTableError(e.message || 'Network error');
    }
  };

  const handleDropTable = (tableName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Drop Table',
      message: `Permanently drop table "${tableName}" and all its data?`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((p) => ({ ...p, isOpen: false }));
        try {
          await fetch('/api/databases/drop-table', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: db.id, tableName }),
          });
          if (selectedTable === tableName) {
            setSelectedTable(null);
            setTableColumns([]);
            setTableRows([]);
          }
          await loadTables();
        } catch (e) {
          // Drop table failure — non-critical
        }
      },
    });
  };

  const handleRunQuery = async () => {
    if (!sql.trim()) return;
    setQueryRunning(true);
    setQueryError('');
    setQueryResult(null);
    try {
      const res = await fetch('/api/databases/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: db.id, sql: sql.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setQueryError(data.error || 'Query failed');
      } else {
        setQueryResult(data);
        // Refresh tables in case query changed schema
        loadTables();
      }
    } catch (e: any) {
      setQueryError(e.message || 'Network error');
    } finally {
      setQueryRunning(false);
    }
  };

  const addColumn = () => {
    setNewTableCols([...newTableCols, { name: '', type: 'TEXT', primaryKey: false, nullable: true }]);
  };

  const updateColumn = (idx: number, field: string, value: any) => {
    setNewTableCols((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };

  const removeColumn = (idx: number) => {
    setNewTableCols((prev) => prev.filter((_, i) => i !== idx));
  };

  const getNetworkHost = () => {
    // Use the hostname the user is currently accessing CloudNest from
    const h = window.location.hostname;
    return (h === 'localhost' || h === '127.0.0.1') ? (db.config?.host || 'localhost') : h;
  };

  const getConnectionUrl = () => {
    if (!db.config) return '';
    const host = getNetworkHost();
    return `postgresql://${db.config.username}:${db.config.password}@${host}:${db.config.port}/${db.config.database}`;
  };

  const getJdbcUrl = () => {
    if (!db.config) return '';
    const host = getNetworkHost();
    return `jdbc:postgresql://${host}:${db.config.port}/${db.config.database}`;
  };

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = (text: string, field: string) => {
    // navigator.clipboard requires secure context (HTTPS/localhost)
    // Use fallback for HTTP on LAN
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
      }).catch(() => fallbackCopy(text, field));
    } else {
      fallbackCopy(text, field);
    }
  };
  const fallbackCopy = (text: string, field: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      // Clipboard copy failure — non-critical
    }
    document.body.removeChild(textarea);
  };

  return (
    <div className="w-full animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button onClick={onBack} className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0 hidden md:flex">
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br ${dbType?.color || 'from-gray-500 to-gray-600'} shadow-md flex items-center justify-center p-1.5 sm:p-2 flex-shrink-0`}>
          <img src={dbType?.icon || ''} alt="" className="w-full h-full object-contain filter brightness-0 invert" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg sm:text-xl md:text-2xl font-black text-gray-900 truncate">{db.name}</h2>
          <p className="text-[10px] sm:text-xs text-gray-500 font-bold truncate">{db.pgDatabaseName || db.config?.database || db.type}</p>
        </div>
        <div className={`px-2 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ${db.status === 'running' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          <div className={`w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full ${db.status === 'running' ? 'bg-green-500' : 'bg-gray-400'}`} />
          {db.status === 'running' ? 'Running' : 'Stopped'}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 sm:mb-6 bg-gray-100 rounded-xl p-1">
        {(['tables', 'query', 'info'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab === 'tables' && <Table className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
            {tab === 'query' && <Terminal className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
            {tab === 'info' && <Eye className="w-3.5 sm:w-4 h-3.5 sm:h-4" />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* ─── TABLES TAB ─── */}
      {activeTab === 'tables' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Tables ({tables.length})</p>
            <div className="flex gap-2">
              <button onClick={loadTables} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => setShowCreateTable(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#5D5FEF] text-white rounded-lg text-xs font-bold hover:bg-[#4D4FCF] transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Table
              </button>
            </div>
          </div>

          {/* Create table form */}
          {showCreateTable && (
            <div className="mb-4 sm:mb-6 bg-white rounded-2xl border-2 border-[#5D5FEF]/20 p-3.5 sm:p-5 animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-black text-gray-900">Create Table</h3>
                <button onClick={() => setShowCreateTable(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs font-bold text-gray-600 mb-1.5">Table Name</label>
                <input
                  type="text"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="users"
                  className="w-full px-3 py-2.5 rounded-lg border-2 border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-sm font-medium"
                  autoFocus
                />
              </div>

              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-600 mb-2">Columns</label>
                <div className="space-y-2">
                  {newTableCols.map((col, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-lg p-2.5">
                      {/* Mobile: stack vertically, Desktop: inline row */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <input
                          type="text"
                          value={col.name}
                          onChange={(e) => updateColumn(idx, 'name', e.target.value)}
                          placeholder="column_name"
                          className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-xs font-medium"
                        />
                        <select
                          value={col.type}
                          onChange={(e) => updateColumn(idx, 'type', e.target.value)}
                          className="w-full sm:w-auto px-2 py-2 rounded-lg border border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-xs font-medium bg-white sm:min-w-[130px]"
                        >
                          {getTypesForEngine(db.type).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <div className="flex items-center gap-3 sm:gap-2">
                          <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500 whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={col.primaryKey}
                              onChange={(e) => updateColumn(idx, 'primaryKey', e.target.checked)}
                              className="rounded"
                            />
                            PK
                          </label>
                          <label className="flex items-center gap-1 text-[10px] font-bold text-gray-500 whitespace-nowrap cursor-pointer">
                            <input
                              type="checkbox"
                              checked={col.nullable}
                              onChange={(e) => updateColumn(idx, 'nullable', e.target.checked)}
                              className="rounded"
                            />
                            Null
                          </label>
                          <button onClick={() => removeColumn(idx)} className="ml-auto p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={addColumn} className="mt-2 flex items-center gap-1.5 text-xs font-bold text-[#5D5FEF] hover:text-[#4D4FCF] transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Add Column
                </button>
              </div>

              {createTableError && (
                <p className="text-xs text-red-600 font-bold mb-3 bg-red-50 rounded-lg p-2">{createTableError}</p>
              )}

              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => setShowCreateTable(false)} className="flex-1 px-3 py-2.5 rounded-lg text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all">
                  Cancel
                </button>
                <button
                  onClick={handleCreateTable}
                  disabled={!newTableName.trim() || newTableCols.length === 0}
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm font-bold text-white bg-[#5D5FEF] hover:bg-[#4D4FCF] transition-all disabled:opacity-50"
                >
                  Create Table
                </button>
              </div>
            </div>
          )}

          {/* Table list */}
          {tablesLoading ? (
            <div className="text-center py-12">
              <Loader2 className="w-8 h-8 text-[#5D5FEF] animate-spin mx-auto" />
            </div>
          ) : tables.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border-2 border-gray-100">
              <Table className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-lg font-black text-gray-900 mb-1">No Tables</p>
              <p className="text-sm text-gray-500 font-medium mb-4">Create a table or run a CREATE TABLE query</p>
              <button
                onClick={() => setShowCreateTable(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#5D5FEF] text-white rounded-lg text-xs font-bold hover:bg-[#4D4FCF] transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> New Table
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {tables.map((t) => (
                <div
                  key={t.name}
                  className={`bg-white rounded-xl border-2 p-4 flex items-center gap-3 cursor-pointer transition-all hover:shadow-md ${selectedTable === t.name ? 'border-[#5D5FEF]/40 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}
                  onClick={() => openTable(t.name)}
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <Table className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900 truncate">{t.name}</p>
                    <p className="text-[11px] text-gray-500 font-medium">{t.rowCount} rows &bull; {t.size}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDropTable(t.name); }}
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Drop table"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              ))}
            </div>
          )}

          {/* Table data viewer */}
          {selectedTable && (
            <div className="mt-4 sm:mt-6 bg-white rounded-xl sm:rounded-2xl border-2 border-gray-100 overflow-hidden">
              <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-gray-900 truncate">{selectedTable}</h4>
                  <p className="text-[10px] sm:text-[11px] text-gray-500 font-medium">{tableTotalCount} total rows &bull; {tableColumns.length} columns</p>
                </div>
                <button onClick={() => setSelectedTable(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              {/* Columns schema */}
              <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Schema</p>
                <div className="flex flex-wrap gap-1 sm:gap-1.5">
                  {tableColumns.map((col) => (
                    <span key={col.name} className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-white border border-gray-200 rounded-md text-[10px] sm:text-[11px] font-medium text-gray-700">
                      <span className="font-bold">{col.name}</span>
                      <span className="text-gray-400">{col.type}</span>
                      {col.nullable && <span className="text-yellow-500 text-[9px]">NULL</span>}
                    </span>
                  ))}
                </div>
              </div>

              {/* Data rows */}
              {tableLoading ? (
                <div className="p-8 text-center"><Loader2 className="w-6 h-6 text-[#5D5FEF] animate-spin mx-auto" /></div>
              ) : tableRows.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400 font-medium">No rows</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        {tableDataCols.map((col) => (
                          <th key={col} className="px-4 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, ri) => (
                        <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50/60">
                          {tableDataCols.map((col) => (
                            <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-[240px] truncate font-medium">
                              {row[col] === null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── QUERY TAB ─── */}
      {activeTab === 'query' && (
        <div>
          <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden mb-4">
            <div className="px-3.5 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest">SQL Query</p>
              <button
                onClick={handleRunQuery}
                disabled={queryRunning || !sql.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#5D5FEF] text-white rounded-lg text-xs font-bold hover:bg-[#4D4FCF] transition-all disabled:opacity-50"
              >
                {queryRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Run
              </button>
            </div>
            <div className="relative min-h-[180px] sm:min-h-[320px]">
              {/* Highlighted layer */}
              <pre
                aria-hidden
                className="absolute inset-0 px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-mono whitespace-pre-wrap break-words pointer-events-none overflow-hidden m-0 bg-transparent"
                style={{ color: 'transparent' }}
              >
                {sql ? highlightSQL(sql) : <span className="text-gray-400">{'SELECT * FROM my_table LIMIT 10;\n\n-- Or create tables, insert data, etc.'}</span>}
                {/* Extra newline so scrolling matches */}
                {'\n'}
              </pre>
              {/* Editable textarea on top */}
              <textarea
                value={sql}
                onChange={(e) => setSql(e.target.value)}
                placeholder={'SELECT * FROM my_table LIMIT 10;\n\n-- Or create tables, insert data, etc.'}
                className="relative w-full h-full px-3 sm:px-5 py-3 sm:py-4 text-xs sm:text-sm font-mono focus:outline-none resize-none min-h-[180px] sm:min-h-[320px] bg-transparent caret-gray-900"
                style={{ color: sql ? 'transparent' : undefined, caretColor: '#111827', WebkitTextFillColor: sql ? 'transparent' : undefined }}
                spellCheck={false}
                onKeyDown={(e) => {
                  // Ctrl+Enter to run
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleRunQuery();
                  }
                  // Tab inserts 2 spaces
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    const ta = e.currentTarget;
                    const start = ta.selectionStart;
                    const end = ta.selectionEnd;
                    const val = ta.value;
                    setSql(val.substring(0, start) + '  ' + val.substring(end));
                    requestAnimationFrame(() => {
                      ta.selectionStart = ta.selectionEnd = start + 2;
                    });
                  }
                }}
                onScroll={(e) => {
                  const pre = e.currentTarget.previousElementSibling as HTMLElement;
                  if (pre) {
                    pre.scrollTop = e.currentTarget.scrollTop;
                    pre.scrollLeft = e.currentTarget.scrollLeft;
                  }
                }}
              />
            </div>
          </div>

          {queryError && (
            <div className="mb-4 bg-red-50 border-2 border-red-200 rounded-xl p-4">
              <p className="text-xs font-bold text-red-700">{queryError}</p>
            </div>
          )}

          {queryResult && (
            <div className="bg-white rounded-2xl border-2 border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-600">
                  {queryResult.command} &mdash; {queryResult.rowCount} row{queryResult.rowCount !== 1 ? 's' : ''} affected
                </p>
              </div>
              {queryResult.rows.length > 0 && queryResult.columns.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50/60">
                        {queryResult.columns.map((col) => (
                          <th key={col} className="px-4 py-2.5 text-left font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, ri) => (
                        <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50/60">
                          {queryResult.columns.map((col) => (
                            <td key={col} className="px-4 py-2 text-gray-700 whitespace-nowrap max-w-[240px] truncate font-medium">
                              {row[col] === null ? <span className="text-gray-300 italic">null</span> : String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-400 font-medium">Query executed successfully</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── INFO TAB ─── */}
      {activeTab === 'info' && (
        <div className="space-y-3 sm:space-y-4">
          {/* Connection Details */}
          <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-100 p-3.5 sm:p-5">
            <h3 className="text-sm font-black text-gray-900 mb-3 sm:mb-4">Connection Details</h3>
            <div className="space-y-1">
              {[
                { label: 'Host', value: getNetworkHost() },
                { label: 'Port', value: String(db.config?.port || '-') },
                { label: 'Database', value: db.config?.database || db.pgDatabaseName || '-' },
                { label: 'Username', value: db.config?.username || '-' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs sm:text-sm py-2 sm:py-2.5 border-b border-gray-50 gap-2">
                  <span className="text-gray-500 font-medium flex-shrink-0">{item.label}</span>
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="text-gray-900 font-bold font-mono text-[10px] sm:text-xs truncate">{item.value}</span>
                    <button
                      onClick={() => copyToClipboard(item.value, item.label)}
                      className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-300 hover:text-gray-500"
                      title={`Copy ${item.label.toLowerCase()}`}
                    >
                      {copiedField === item.label ? <span className="text-green-500 text-[10px] font-bold">✓</span> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              ))}

              {/* Password row with show/hide toggle */}
              <div className="flex items-center justify-between text-xs sm:text-sm py-2 sm:py-2.5 border-b border-gray-50 gap-2">
                <span className="text-gray-500 font-medium flex-shrink-0">Password</span>
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <span className="text-gray-900 font-bold font-mono text-[10px] sm:text-xs truncate">
                    {showPassword ? (db.config?.password || '-') : '••••••••••'}
                  </span>
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard(db.config?.password || '', 'Password')}
                    className="p-1 hover:bg-gray-100 rounded-md transition-colors text-gray-300 hover:text-gray-500"
                    title="Copy password"
                  >
                    {copiedField === 'Password' ? <span className="text-green-500 text-[10px] font-bold">✓</span> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Size & Created */}
              <div className="flex items-center justify-between text-xs sm:text-sm py-2 sm:py-2.5 border-b border-gray-50">
                <span className="text-gray-500 font-medium">Size</span>
                <span className="text-gray-900 font-bold font-mono text-[10px] sm:text-xs">{db.size}</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm py-2 sm:py-2.5">
                <span className="text-gray-500 font-medium">Created</span>
                <span className="text-gray-900 font-bold font-mono text-[10px] sm:text-xs">{new Date(db.created).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Connection URLs */}
          {db.config && (
            <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-100 p-3.5 sm:p-5">
              <h3 className="text-sm font-black text-gray-900 mb-3 sm:mb-4">Connection URLs</h3>
              <div className="space-y-3">
                {/* Local PostgreSQL URL */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Local PostgreSQL URL</label>
                  <div className="flex items-start sm:items-center gap-2 bg-gray-50 rounded-lg p-2.5 sm:p-3 border border-gray-100">
                    <code className="flex-1 text-[10px] sm:text-xs font-mono text-gray-800 break-all">{getConnectionUrl()}</code>
                    <button
                      onClick={() => copyToClipboard(getConnectionUrl(), 'pgUrl')}
                      className="flex-shrink-0 p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                      title="Copy URL"
                    >
                      {copiedField === 'pgUrl' ? <span className="text-green-500 text-xs font-bold">✓</span> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Global PostgreSQL URL */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Global PostgreSQL URL</label>
                  <div className="flex items-start sm:items-center gap-2 bg-gray-50 rounded-lg p-2.5 sm:p-3 border border-gray-100">
                    <code className="flex-1 text-[10px] sm:text-xs font-mono text-gray-800 break-all">
                      {`postgresql://${db.config.username}:${db.config.password}@cloud.arcelliteserver.com:${db.config.port}/${db.config.database}`}
                    </code>
                    <button
                      onClick={() => copyToClipboard(`postgresql://${db.config!.username}:${db.config!.password}@cloud.arcelliteserver.com:${db.config!.port}/${db.config!.database}`, 'globalUrl')}
                      className="flex-shrink-0 p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                      title="Copy Global URL"
                    >
                      {copiedField === 'globalUrl' ? <span className="text-green-500 text-xs font-bold">✓</span> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* JDBC URL */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">JDBC URL (DataGrip / IntelliJ)</label>
                  <div className="flex items-start sm:items-center gap-2 bg-gray-50 rounded-lg p-2.5 sm:p-3 border border-gray-100">
                    <code className="flex-1 text-[10px] sm:text-xs font-mono text-gray-800 break-all">{getJdbcUrl()}</code>
                    <button
                      onClick={() => copyToClipboard(getJdbcUrl(), 'jdbcUrl')}
                      className="flex-shrink-0 p-1.5 hover:bg-gray-200 rounded-md transition-colors text-gray-400 hover:text-gray-600"
                      title="Copy JDBC URL"
                    >
                      {copiedField === 'jdbcUrl' ? <span className="text-green-500 text-xs font-bold">✓</span> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((p) => ({ ...p, isOpen: false }))}
      />
    </div>
  );
};

/* ──────────────────────────── Main DatabaseView ──────────────────────────── */
const DatabaseView: React.FC = () => {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDb, setOpenDb] = useState<DatabaseInstance | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedDbType, setSelectedDbType] = useState<string | null>(null);
  const [dbName, setDbName] = useState('');
  const [creating, setCreating] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning' | 'info' | 'success';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const loadDatabases = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/databases/list');
      if (response.ok) {
        const data = await response.json();
        setDatabases(data.databases || []);
      }
    } catch (error) {
      // Silent — databases UI shows empty state
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDatabases();
  }, []);

  const handleCreateDatabase = async () => {
    if (!dbName.trim() || !selectedDbType) return;
    setCreating(true);
    try {
      const response = await fetch('/api/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dbName.trim(), type: selectedDbType }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setSelectedDbType(null);
        setDbName('');
        await loadDatabases();
      } else {
        const error = await response.json();
        alert(`Failed to create database: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      alert('Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleDatabase = (id: string, currentStatus: string) => {
    const action = currentStatus === 'running' ? 'stop' : 'start';
    setConfirmModal({
      isOpen: true,
      title: `${action === 'start' ? 'Start' : 'Stop'} Database`,
      message: `Are you sure you want to ${action} this database?`,
      variant: action === 'stop' ? 'warning' : 'info',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch(`/api/databases/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          if (response.ok) {
            await loadDatabases();
          }
        } catch (error) {
          // Action failure — non-critical
        }
      },
    });
  };

  const handleDeleteDatabase = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Database',
      message: `Are you sure you want to permanently delete "${name}"? This will DROP the PostgreSQL database and all data will be lost!`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        try {
          const response = await fetch('/api/databases/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
          });
          if (response.ok) {
            await loadDatabases();
          }
        } catch (error) {
          // Delete failure — non-critical
        }
      },
    });
  };

  /* If a database is open, show detail view */
  if (openDb) {
    return (
      <DatabaseDetailView
        db={openDb}
        onBack={() => { setOpenDb(null); loadDatabases(); }}
      />
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 md:mb-10 gap-4">
        <div className="relative">
          <div className="absolute -left-2 md:-left-4 top-0 w-1 h-full bg-gradient-to-b from-[#5D5FEF] to-[#5D5FEF]/20 rounded-full opacity-60" />
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-black tracking-tight text-gray-900 capitalize pl-4 md:pl-6 relative">
            Database Management
            <span className="absolute -top-2 -right-8 md:-right-12 w-16 h-16 md:w-20 md:h-20 bg-[#5D5FEF]/5 rounded-full blur-2xl opacity-50" />
          </h2>
        </div>

        <button
          onClick={() => setShowCreateModal(!showCreateModal)}
          className="flex items-center gap-2 px-5 py-3 bg-[#5D5FEF] text-white rounded-xl font-bold text-sm hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/25"
        >
          <Plus className="w-5 h-5" />
          Create Database
        </button>
      </div>

      {/* Create Database Modal */}
      {showCreateModal && (
        <div className="mb-6 md:mb-8 bg-white rounded-2xl md:rounded-3xl border-2 border-[#5D5FEF]/20 p-4 md:p-6 animate-in slide-in-from-top duration-300">
          <div className="flex items-center justify-between mb-4 md:mb-6">
            <h3 className="text-lg md:text-xl font-black text-gray-900">Choose Database Type</h3>
            <button
              onClick={() => setShowCreateModal(false)}
              className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Plus className="w-5 h-5 rotate-45 text-gray-400" />
            </button>
          </div>

          {!selectedDbType ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              {databaseTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedDbType(type.id)}
                  className="group relative bg-white rounded-xl md:rounded-2xl border-2 border-gray-100 p-4 md:p-6 hover:border-[#5D5FEF] hover:shadow-lg transition-all text-left"
                >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-lg md:rounded-xl bg-gradient-to-br ${type.color} shadow-lg mb-3 md:mb-4 flex items-center justify-center p-2.5 md:p-3`}>
                  <img src={type.icon} alt={type.name} className="w-full h-full object-contain filter brightness-0 invert" />
                </div>
                <h4 className="text-sm md:text-base font-black text-gray-900 mb-1 md:mb-2 group-hover:text-[#5D5FEF] transition-colors">
                  {type.name}
                </h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                  {type.description}
                </p>
                <div className="absolute top-3 md:top-4 right-3 md:right-4 w-6 h-6 rounded-full bg-[#5D5FEF]/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Plus className="w-4 h-4 text-[#5D5FEF]" />
                </div>
              </button>
            ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl md:rounded-2xl p-4 md:p-6 border-2 border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={() => { setSelectedDbType(null); setDbName(''); }}
                  className="p-2 hover:bg-white rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-400" />
                </button>
                <h4 className="text-lg font-black text-gray-900">
                  Create {databaseTypes.find(t => t.id === selectedDbType)?.name} Database
                </h4>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Database Name</label>
                  <input
                    type="text"
                    value={dbName}
                    onChange={(e) => setDbName(e.target.value)}
                    placeholder="my_database"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#5D5FEF] focus:outline-none text-sm font-medium transition-colors"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDatabase(); }}
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5 font-medium">PostgreSQL database name will be: <span className="font-mono font-bold">cloudnest_{dbName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')}</span></p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => { setSelectedDbType(null); setDbName(''); }}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-gray-700 bg-white border-2 border-gray-200 hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateDatabase}
                    disabled={!dbName.trim() || creating}
                    className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white bg-[#5D5FEF] hover:bg-[#4D4FCF] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#5D5FEF]/25 flex items-center justify-center gap-2"
                  >
                    {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                    {creating ? 'Creating...' : 'Create Database'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-100 p-3 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <Activity className="w-4 sm:w-5 h-4 sm:h-5 text-green-600" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">Active</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900">
                {databases.filter((db) => db.status === 'running').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-100 p-3 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
              <Server className="w-4 sm:w-5 h-4 sm:h-5 text-gray-600" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">Total</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900">{databases.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-100 p-3 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3">
            <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <HardDrive className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600" />
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">Storage</p>
              <p className="text-lg sm:text-2xl font-black text-gray-900">
                {(() => {
                  const totalBytes = databases.reduce((acc, db: any) => acc + (db.sizeBytes || 0), 0);
                  if (totalBytes === 0) return '0 B';
                  const k = 1024;
                  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                  const i = Math.floor(Math.log(totalBytes) / Math.log(k));
                  return `${parseFloat((totalBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
                })()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Database Instances */}
      <div className="mb-6">
        <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.25em] mb-4 sm:mb-6 ml-1">
          Database Instances
        </p>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 border-4 border-[#5D5FEF]/20 border-t-[#5D5FEF] rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 font-medium mt-4">Loading databases...</p>
          </div>
        ) : databases.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-gray-100">
            <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Database className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">No Databases Yet</h3>
            <p className="text-gray-500 font-medium mb-6">Create your first database to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#5D5FEF] text-white rounded-xl font-bold text-sm hover:bg-[#4D4FCF] transition-all shadow-lg shadow-[#5D5FEF]/25"
            >
              <Plus className="w-5 h-5" />
              Create Database
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-5">
            {databases.map((db) => {
              const dbType = databaseTypes.find((t) => t.id === db.type);
              const isRunning = db.status === 'running';
              const isSystem = !!(db as any).isSystem;
              return (
                <div
                  key={db.id}
                  className="bg-white rounded-2xl md:rounded-3xl border border-gray-100 overflow-hidden hover:shadow-2xl hover:shadow-[#5D5FEF]/8 hover:border-[#5D5FEF]/20 transition-all duration-300 cursor-pointer group"
                  onClick={() => setOpenDb(db)}
                >
                  <div className="p-3.5 sm:p-5 md:p-6">
                    {/* Top: Icon + Name + Status */}
                    <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-5">
                      <div className={`w-11 sm:w-14 h-11 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${dbType?.color || 'from-gray-500 to-gray-600'} shadow-lg flex items-center justify-center p-2.5 sm:p-3 flex-shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                        <img
                          src={dbType?.icon || '/assets/icons/storage_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg'}
                          alt={db.type}
                          className="w-full h-full object-contain filter brightness-0 invert"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base sm:text-lg font-black text-gray-900 group-hover:text-[#5D5FEF] transition-colors truncate">{db.name}</h4>
                        <p className="text-[9px] sm:text-[10px] font-black text-gray-300 uppercase tracking-[0.2em]">
                          {dbType?.name || db.type}
                        </p>
                      </div>
                      <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-wide flex items-center gap-1 sm:gap-1.5 flex-shrink-0 ${isRunning ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
                        {isRunning ? 'Running' : 'Stopped'}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-5">
                      <div className="flex-1 bg-gray-50 rounded-lg sm:rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-center">
                        <p className="text-[7px] sm:text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Storage</p>
                        <p className="text-xs sm:text-sm font-black text-gray-800">{db.size}</p>
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg sm:rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-center">
                        <p className="text-[7px] sm:text-[8px] font-black text-gray-300 uppercase tracking-widest mb-0.5">Created</p>
                        <p className="text-xs sm:text-sm font-black text-gray-800">{new Date(db.created).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Database Name tag */}
                    {(() => {
                      const dbName = db.pgDatabaseName || db.config?.database;
                      const label = db.type === 'sqlite' ? 'DB Name' : db.type === 'mysql' ? 'DB Name' : 'PG Name';
                      return dbName ? (
                        <div className="mb-3 sm:mb-5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-[#5D5FEF]/5 rounded-lg sm:rounded-xl border border-[#5D5FEF]/10">
                          <p className="text-[8px] font-black text-[#5D5FEF]/40 uppercase tracking-widest mb-0.5">{label}</p>
                          <p className="text-xs font-bold font-mono text-[#5D5FEF]/70">{dbName}</p>
                        </div>
                      ) : null;
                    })()}

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                      {!isSystem && (
                        <button
                          onClick={() => handleToggleDatabase(db.id, db.status)}
                          className={`flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-wide transition-all ${
                            isRunning
                              ? 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {isRunning ? (
                            <><Square className="w-3.5 h-3.5" /> Stop</>
                          ) : (
                            <><Play className="w-3.5 h-3.5" /> Start</>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setOpenDb(db)}
                        className={`${isSystem ? 'flex-1' : ''} px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-black tracking-wide bg-[#5D5FEF]/10 text-[#5D5FEF] border border-[#5D5FEF]/15 hover:bg-[#5D5FEF]/20 transition-all`}
                      >
                        View
                      </button>
                      {isSystem && (
                        <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center bg-amber-50 border border-amber-200/60 flex-shrink-0" title="System database — cannot be removed">
                          <img
                            src="/assets/icons/workspace_premium_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg"
                            alt="Protected"
                            className="w-5 h-5 object-contain"
                            style={{ filter: 'brightness(0) saturate(100%) invert(67%) sepia(74%) saturate(575%) hue-rotate(360deg) brightness(101%) contrast(101%)' }}
                          />
                        </div>
                      )}
                      {!isSystem && (
                        <button
                          onClick={() => handleDeleteDatabase(db.id, db.name)}
                          className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default DatabaseView;
