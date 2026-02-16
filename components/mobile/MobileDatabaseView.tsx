import React, { useState, useEffect, useCallback } from 'react';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Table2,
  Terminal,
  Info,
  Play,
  Copy,
  Check,
  Eye,
  EyeOff,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';

/* ───── types ───── */
interface DatabaseInstance {
  id: string;
  name: string;
  displayName?: string;
  type: string;
  status: string;
  size: string;
  sizeBytes?: number;
  created: string;
  pgDatabaseName?: string;
  sqliteFilePath?: string;
  isSystem?: boolean;
  config?: { host: string; port: number; username: string; password: string; database: string };
}

interface TableInfo { name: string; rowCount: number; size: string }
interface ColumnInfo { name: string; type: string; nullable: boolean; defaultValue: string | null }
interface QueryResult { rows: any[]; columns: string[]; rowCount: number; command: string }

const PG_TYPES = [
  'TEXT', 'VARCHAR(255)', 'INTEGER', 'BIGINT', 'SERIAL', 'BOOLEAN',
  'TIMESTAMP', 'DATE', 'NUMERIC', 'REAL', 'DOUBLE PRECISION', 'JSON',
  'JSONB', 'UUID', 'BYTEA', 'INET', 'CIDR', 'MACADDR',
];

/* ══════════════════════════════════════════════════════════════════ */
/*  Database Detail View (mobile-optimised)                         */
/* ══════════════════════════════════════════════════════════════════ */
const MobileDatabaseDetail: React.FC<{
  db: DatabaseInstance;
  onBack: () => void;
  onRefresh: () => void;
}> = ({ db, onBack, onRefresh }) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'query' | 'info'>('tables');

  /* ── tables state ── */
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableCols, setTableCols] = useState<ColumnInfo[]>([]);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [tableRowCount, setTableRowCount] = useState(0);

  /* ── create table state ── */
  const [showCreateTable, setShowCreateTable] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTableCols, setNewTableCols] = useState([{ name: '', type: 'TEXT', primaryKey: false, nullable: true }]);
  const [creating, setCreating] = useState(false);

  /* ── drop table ── */
  const [dropTableTarget, setDropTableTarget] = useState<string | null>(null);

  /* ── query state ── */
  const [sql, setSql] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [queryRunning, setQueryRunning] = useState(false);

  /* ── info state ── */
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  /* ── fetch tables ── */
  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const r = await fetch(`/api/databases/tables?id=${db.id}`);
      const d = await r.json();
      setTables(d.tables || []);
    } catch { /* ignore */ }
    setTablesLoading(false);
  }, [db.id]);

  useEffect(() => { fetchTables(); }, [fetchTables]);

  /* ── load table data ── */
  const loadTableData = useCallback(async (tableName: string) => {
    setSelectedTable(tableName);
    try {
      const [colRes, dataRes] = await Promise.all([
        fetch(`/api/databases/columns?id=${db.id}&table=${tableName}`),
        fetch(`/api/databases/data?id=${db.id}&table=${tableName}&limit=50&offset=0`),
      ]);
      const colData = await colRes.json();
      const rowData = await dataRes.json();
      setTableCols(colData.columns || []);
      setTableRows(rowData.rows || []);
      setTableRowCount(rowData.totalCount || rowData.rows?.length || 0);
    } catch { /* ignore */ }
  }, [db.id]);

  /* ── create table ── */
  const handleCreateTable = async () => {
    if (!newTableName.trim() || newTableCols.every(c => !c.name.trim())) return;
    setCreating(true);
    try {
      await fetch('/api/databases/create-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: db.id, tableName: newTableName, columns: newTableCols.filter(c => c.name.trim()) }),
      });
      setShowCreateTable(false);
      setNewTableName('');
      setNewTableCols([{ name: '', type: 'TEXT', primaryKey: false, nullable: true }]);
      fetchTables();
    } catch { /* ignore */ }
    setCreating(false);
  };

  /* ── drop table ── */
  const handleDropTable = async () => {
    if (!dropTableTarget) return;
    try {
      await fetch('/api/databases/drop-table', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: db.id, tableName: dropTableTarget }) });
      if (selectedTable === dropTableTarget) { setSelectedTable(null); setTableCols([]); setTableRows([]); }
      fetchTables();
    } catch { /* ignore */ }
    setDropTableTarget(null);
  };

  /* ── run query ── */
  const handleRunQuery = async () => {
    if (!sql.trim()) return;
    setQueryRunning(true); setQueryError(null); setQueryResult(null);
    try {
      const r = await fetch('/api/databases/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: db.id, sql }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Query failed');
      setQueryResult(d);
      fetchTables(); // refresh in case schema changed
    } catch (e: any) { setQueryError(e.message); }
    setQueryRunning(false);
  };

  /* ── copy helper ── */
  const copyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const tabs = [
    { id: 'tables' as const, label: 'Tables', icon: Table2 },
    { id: 'query' as const, label: 'Query', icon: Terminal },
    { id: 'info' as const, label: 'Info', icon: Info },
  ];

  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return (
    <div className="animate-in fade-in duration-200">
      {/* Back + DB name */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-500 mb-4 active:opacity-70 touch-manipulation">
        <ChevronLeft className="w-4 h-4" /> All Databases
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-11 h-11 rounded-2xl bg-[#5D5FEF] flex items-center justify-center shadow-md shadow-[#5D5FEF]/20">
          <svg className="w-5 h-5 text-white" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93-6t87.5-18.5q40.5-12.5 69-30T776-290q-19-18-46.5-35.5t-69-30Q623-368 576-374t-96-6q-46 0-93 6t-87 18.5q-40 12.5-68 30T184-290q18 18 46 35.5t68.5 30Q336-212 383-206t97 6Z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-[20px] font-extrabold text-gray-900 truncate">{db.displayName || db.name}</h2>
          <p className="text-[12px] font-medium text-gray-400">{db.type} · {db.size} · {db.status}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-2xl mb-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold transition-all touch-manipulation ${
                activeTab === t.id
                  ? 'bg-white text-[#5D5FEF] shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ─── Tables Tab ─── */}
      {activeTab === 'tables' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[16px] font-bold text-gray-900">{tables.length} Tables</h3>
            <button
              onClick={() => setShowCreateTable(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-[#5D5FEF] text-white rounded-full text-[12px] font-semibold shadow-sm active:scale-95 touch-manipulation"
            >
              <Plus className="w-3.5 h-3.5" /> New Table
            </button>
          </div>

          {tablesLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 text-gray-300 animate-spin" /></div>
          ) : tables.length === 0 ? (
            <div className="text-center py-16">
              <Table2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-[14px] font-bold text-gray-300">No tables yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => loadTableData(t.name)}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all touch-manipulation text-left active:scale-[0.98] ${
                    selectedTable === t.name
                      ? 'bg-[#5D5FEF]/5 border-[#5D5FEF]/30'
                      : 'bg-white border-gray-200/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${selectedTable === t.name ? 'bg-[#5D5FEF]/10' : 'bg-gray-100'}`}>
                      <Table2 className={`w-4 h-4 ${selectedTable === t.name ? 'text-[#5D5FEF]' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-gray-900 truncate">{t.name}</p>
                      <p className="text-[11px] font-medium text-gray-400">{t.rowCount} rows · {t.size}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDropTableTarget(t.name); }}
                      className="p-2 rounded-xl text-gray-300 active:text-red-500 active:bg-red-50 touch-manipulation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected table data */}
          {selectedTable && tableCols.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-[14px] font-bold text-gray-900">{selectedTable}</h4>
                <span className="text-[11px] font-medium text-gray-400">{tableRowCount} rows</span>
              </div>
              {/* Schema */}
              <div className="mb-3 flex flex-wrap gap-1.5">
                {tableCols.map((c) => (
                  <span key={c.name} className="px-2.5 py-1 bg-gray-100 rounded-lg text-[11px] font-semibold text-gray-600">
                    {c.name} <span className="text-gray-400">{c.type}</span>
                  </span>
                ))}
              </div>
              {/* Data */}
              <div className="overflow-x-auto -mx-5 px-5 pb-2">
                <table className="min-w-max text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {tableCols.map((c) => (
                        <th key={c.name} className="px-3 py-2 text-left font-bold text-gray-500 whitespace-nowrap">{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {tableCols.map((c) => (
                          <td key={c.name} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{String(row[c.name] ?? 'NULL')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Create Table Sheet */}
          {showCreateTable && (
            <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setShowCreateTable(false)}>
              <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[18px] font-extrabold text-gray-900">Create Table</h3>
                  <button onClick={() => setShowCreateTable(false)} className="p-2 rounded-xl bg-gray-100 text-gray-500 active:scale-95 touch-manipulation"><X className="w-4 h-4" /></button>
                </div>
                <input
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  placeholder="Table name"
                  className="w-full px-4 py-3 rounded-2xl bg-gray-100 text-[14px] font-medium text-gray-900 placeholder:text-gray-400 mb-4 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30"
                />
                <h4 className="text-[13px] font-bold text-gray-600 mb-3">Columns</h4>
                <div className="space-y-3 mb-4">
                  {newTableCols.map((col, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        value={col.name}
                        onChange={(e) => { const c = [...newTableCols]; c[i].name = e.target.value; setNewTableCols(c); }}
                        placeholder="Column name"
                        className="flex-1 px-3 py-2.5 rounded-xl bg-gray-100 text-[13px] font-medium outline-none"
                      />
                      <select
                        value={col.type}
                        onChange={(e) => { const c = [...newTableCols]; c[i].type = e.target.value; setNewTableCols(c); }}
                        className="px-2 py-2.5 rounded-xl bg-gray-100 text-[12px] font-medium outline-none"
                      >
                        {PG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {newTableCols.length > 1 && (
                        <button onClick={() => setNewTableCols(newTableCols.filter((_, j) => j !== i))} className="p-1.5 text-gray-400 active:text-red-500 touch-manipulation">
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setNewTableCols([...newTableCols, { name: '', type: 'TEXT', primaryKey: false, nullable: true }])}
                  className="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-[13px] font-semibold text-gray-400 active:border-[#5D5FEF] active:text-[#5D5FEF] mb-5 touch-manipulation"
                >
                  + Add Column
                </button>
                <button
                  disabled={creating || !newTableName.trim()}
                  onClick={handleCreateTable}
                  className="w-full py-3.5 bg-[#5D5FEF] text-white rounded-2xl text-[15px] font-bold shadow-lg shadow-[#5D5FEF]/25 disabled:opacity-50 active:scale-[0.98] touch-manipulation"
                >
                  {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Table'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Query Tab ─── */}
      {activeTab === 'query' && (
        <div>
          <textarea
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="SELECT * FROM ..."
            rows={5}
            className="w-full px-4 py-3 rounded-2xl bg-white border border-gray-200/80 text-[13px] font-mono text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30 resize-none mb-3"
          />
          <button
            onClick={handleRunQuery}
            disabled={queryRunning || !sql.trim()}
            className="flex items-center gap-2 px-5 py-3 bg-[#5D5FEF] text-white rounded-2xl text-[14px] font-bold shadow-md shadow-[#5D5FEF]/25 disabled:opacity-50 active:scale-[0.98] touch-manipulation mb-4"
          >
            {queryRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Query
          </button>
          {queryError && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl mb-4">
              <p className="text-[13px] font-semibold text-red-600">{queryError}</p>
            </div>
          )}
          {queryResult && (
            <div>
              <p className="text-[12px] font-semibold text-gray-400 mb-2">{queryResult.command} — {queryResult.rowCount} rows</p>
              {queryResult.columns?.length > 0 && (
                <div className="overflow-x-auto -mx-5 px-5 pb-2">
                  <table className="min-w-max text-[12px]">
                    <thead>
                      <tr className="border-b border-gray-200">
                        {queryResult.columns.map((c) => (
                          <th key={c} className="px-3 py-2 text-left font-bold text-gray-500 whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {queryResult.columns.map((c) => (
                            <td key={c} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">{String(row[c] ?? 'NULL')}</td>
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

      {/* ─── Info Tab ─── */}
      {activeTab === 'info' && db.config && (
        <div className="space-y-3">
          {[
            { label: 'Host', value: host },
            { label: 'Port', value: String(db.config.port) },
            { label: 'Database', value: db.config.database },
            { label: 'Username', value: db.config.username },
            { label: 'Password', value: db.config.password, secret: true },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-200/60">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">{row.label}</p>
                <p className="text-[14px] font-semibold text-gray-900 truncate font-mono">
                  {row.secret && !showPassword ? '••••••••' : row.value}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {row.secret && (
                  <button onClick={() => setShowPassword(!showPassword)} className="p-2 rounded-xl text-gray-400 active:bg-gray-100 touch-manipulation">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                <button onClick={() => copyText(row.value, row.label)} className="p-2 rounded-xl text-gray-400 active:bg-gray-100 touch-manipulation">
                  {copiedField === row.label ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}

          {/* Connection URLs */}
          {(() => {
            const isSqlite = db.type === 'sqlite';
            if (isSqlite) {
              const filePath = db.sqliteFilePath || db.config?.database || '';
              const jdbcUrl = `jdbc:sqlite:${filePath}`;
              return (
                <div className="p-4 bg-white rounded-2xl border border-gray-200/60">
                  <p className="text-[11px] font-bold text-[#5D5FEF] uppercase tracking-wider mb-3">Connection URLs</p>
                  <div className="mb-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">SQLite File Path</p>
                    <p className="text-[11px] font-mono text-gray-700 break-all bg-gray-50 rounded-xl p-2.5 border border-gray-100">{filePath}</p>
                    <button onClick={() => copyText(filePath, 'sqlitePath')} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">
                      {copiedField === 'sqlitePath' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">JDBC URL (DataGrip / IntelliJ)</p>
                    <p className="text-[11px] font-mono text-gray-700 break-all bg-gray-50 rounded-xl p-2.5 border border-gray-100">{jdbcUrl}</p>
                    <button onClick={() => copyText(jdbcUrl, 'jdbcUrl')} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">
                      {copiedField === 'jdbcUrl' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                    </button>
                  </div>
                </div>
              );
            }
            const scheme = db.type === 'mysql' ? 'mysql' : 'postgresql';
            const typeLabel = db.type === 'mysql' ? 'MySQL' : 'PostgreSQL';
            const localUrl = `${scheme}://${db.config!.username}:${db.config!.password}@${host}:${db.config!.port}/${db.config!.database}`;
            const globalUrl = `${scheme}://${db.config!.username}:${db.config!.password}@cloud.arcelliteserver.com:${db.config!.port}/${db.config!.database}`;
            const localUrlDisplay = `${scheme}://${db.config!.username}:${showPassword ? db.config!.password : '****'}@${host}:${db.config!.port}/${db.config!.database}`;
            const globalUrlDisplay = `${scheme}://${db.config!.username}:${showPassword ? db.config!.password : '****'}@cloud.arcelliteserver.com:${db.config!.port}/${db.config!.database}`;
            const localJdbc = `jdbc:${scheme}://${host}:${db.config!.port}/${db.config!.database}`;
            const globalJdbc = `jdbc:${scheme}://cloud.arcelliteserver.com:${db.config!.port}/${db.config!.database}`;
            return (
              <div className="p-4 bg-white rounded-2xl border border-gray-200/60">
                <p className="text-[11px] font-bold text-[#5D5FEF] uppercase tracking-wider mb-3">Connection URLs</p>
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Local {typeLabel} URL</p>
                  <p className="text-[11px] font-mono text-gray-700 break-all bg-gray-50 rounded-xl p-2.5 border border-gray-100">{localUrlDisplay}</p>
                  <button onClick={() => copyText(localUrl, 'localUrl')} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">
                    {copiedField === 'localUrl' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Global {typeLabel} URL</p>
                  <p className="text-[11px] font-mono text-gray-700 break-all bg-gray-50 rounded-xl p-2.5 border border-gray-100">{globalUrlDisplay}</p>
                  <button onClick={() => copyText(globalUrl, 'globalUrl')} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">
                    {copiedField === 'globalUrl' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div className="mb-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">JDBC URL (Local)</p>
                  <p className="text-[11px] font-mono text-gray-700 break-all bg-gray-50 rounded-xl p-2.5 border border-gray-100">{localJdbc}</p>
                  <button onClick={() => copyText(localJdbc, 'jdbcUrl')} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">
                    {copiedField === 'jdbcUrl' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">JDBC URL (Global)</p>
                  <p className="text-[11px] font-mono text-gray-700 break-all bg-gray-50 rounded-xl p-2.5 border border-gray-100">{globalJdbc}</p>
                  <button onClick={() => copyText(globalJdbc, 'globalJdbcUrl')} className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#5D5FEF] active:opacity-70 touch-manipulation">
                    {copiedField === 'globalJdbcUrl' ? <><Check className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Drop table confirm */}
      {dropTableTarget && (
        <ConfirmModal
          isOpen={true}
          title="Drop Table"
          message={`Are you sure you want to drop "${dropTableTarget}"? This will permanently delete all data in this table.`}
          confirmText="Drop"
          variant="danger"
          onConfirm={handleDropTable}
          onCancel={() => setDropTableTarget(null)}
        />
      )}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════ */
/*  Main Database List View (mobile)                                */
/* ══════════════════════════════════════════════════════════════════ */
const MobileDatabaseView: React.FC = () => {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDb, setOpenDb] = useState<DatabaseInstance | null>(null);

  /* ── create modal ── */
  const [showCreate, setShowCreate] = useState(false);
  const [dbName, setDbName] = useState('');
  const [creating, setCreating] = useState(false);

  /* ── delete ── */
  const [deleteTarget, setDeleteTarget] = useState<DatabaseInstance | null>(null);

  const fetchDatabases = useCallback(async () => {
    try {
      const r = await fetch('/api/databases/list');
      const d = await r.json();
      setDatabases(d.databases || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDatabases(); }, [fetchDatabases]);

  const handleCreate = async () => {
    if (!dbName.trim()) return;
    setCreating(true);
    try {
      await fetch('/api/databases/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: dbName, type: 'postgresql' }),
      });
      setShowCreate(false); setDbName('');
      fetchDatabases();
    } catch { /* ignore */ }
    setCreating(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch('/api/databases/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: deleteTarget.id }) });
      fetchDatabases();
    } catch { /* ignore */ }
    setDeleteTarget(null);
  };

  /* ── detail view ── */
  if (openDb) {
    return <MobileDatabaseDetail db={openDb} onBack={() => { setOpenDb(null); fetchDatabases(); }} onRefresh={fetchDatabases} />;
  }

  return (
    <div className="animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-[#5D5FEF] rounded-full" />
          <h1 className="text-[28px] font-extrabold text-gray-900 tracking-tight leading-none">Databases</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-[#5D5FEF] text-white rounded-xl text-[13px] font-semibold shadow-md shadow-[#5D5FEF]/25 active:scale-95 transition-all touch-manipulation"
        >
          <Plus className="w-4 h-4" /> Create
        </button>
      </div>

      {/* Database Cards */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-gray-300 animate-spin" />
        </div>
      ) : databases.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-9 h-9 text-gray-300" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Z"/></svg>
          </div>
          <p className="text-[18px] font-extrabold text-gray-300">No Databases</p>
          <p className="text-[14px] font-medium text-gray-400 mt-1">Create one to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {databases.map((db) => (
            <button
              key={db.id}
              onClick={() => setOpenDb(db)}
              className="w-full flex items-center gap-4 p-4 bg-white rounded-2xl border border-gray-200/60 shadow-sm active:scale-[0.98] transition-all touch-manipulation text-left"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#5D5FEF]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#5D5FEF]" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-151 0-255.5-46.5T120-280v-400q0-66 105.5-113T480-840q149 0 254.5 47T840-680v400q0 67-104.5 113.5T480-120Zm0-479q89 0 179-25.5T760-679q-11-29-100.5-55T480-760q-91 0-178.5 25.5T200-679q14 30 101.5 55T480-599Zm0 199q42 0 81-4t74.5-11.5q35.5-7.5 67-18.5t57.5-25v-120q-26 14-57.5 25t-67 18.5Q600-528 561-524t-81 4q-42 0-82-4t-75.5-11.5Q287-543 256-554t-56-25v120q25 14 56 25t66.5 18.5Q358-408 398-404t82 4Zm0 200q46 0 93-6t87.5-18.5q40.5-12.5 69-30T776-290q-19-18-46.5-35.5t-69-30Q623-368 576-374t-96-6q-46 0-93 6t-87 18.5q-40 12.5-68 30T184-290q18 18 46 35.5t68.5 30Q336-212 383-206t97 6Z"/></svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-gray-900 truncate">{db.displayName || db.name}</p>
                <p className="text-[12px] font-medium text-gray-400 mt-0.5">
                  {db.type} · {db.size} · <span className={db.status === 'running' ? 'text-green-500' : 'text-gray-400'}>{db.status}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {db.isSystem ? (
                  <div className="p-2 rounded-xl bg-amber-50 border border-amber-200/60" title="System database">
                    <svg className="w-4 h-4 text-amber-500" viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120q-33 0-56.5-23.5T400-200h160q0 33-23.5 56.5T480-120ZM320-200v-80h320v80H320Zm10-120q-69-41-109.5-110T180-580q0-125 87.5-212.5T480-880q125 0 212.5 87.5T780-580q0 81-40.5 150T630-320H330Z"/></svg>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(db); }}
                    className="p-2 rounded-xl text-gray-300 active:text-red-500 active:bg-red-50 touch-manipulation"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Database Sheet */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-extrabold text-gray-900">New Database</h3>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-xl bg-gray-100 text-gray-500 active:scale-95 touch-manipulation"><X className="w-4 h-4" /></button>
            </div>
            <input
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="Database name"
              autoFocus
              className="w-full px-4 py-3.5 rounded-2xl bg-gray-100 text-[15px] font-medium text-gray-900 placeholder:text-gray-400 mb-4 outline-none focus:ring-2 focus:ring-[#5D5FEF]/30"
            />
            <p className="text-[12px] font-medium text-gray-400 mb-5">A new PostgreSQL database will be created and ready to use immediately.</p>
            <button
              disabled={creating || !dbName.trim()}
              onClick={handleCreate}
              className="w-full py-3.5 bg-[#5D5FEF] text-white rounded-2xl text-[15px] font-bold shadow-lg shadow-[#5D5FEF]/25 disabled:opacity-50 active:scale-[0.98] touch-manipulation"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Create Database'}
            </button>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          title="Delete Database"
          message={`Are you sure you want to delete "${deleteTarget.displayName || deleteTarget.name}"? This action cannot be undone.`}
          confirmText="Delete"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default MobileDatabaseView;
