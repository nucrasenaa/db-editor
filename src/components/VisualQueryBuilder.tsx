'use client';

import React, { useState } from 'react';
import { Check, Trash2, Table, Play, Settings2, FileCode, Search, PlusCircle, LayoutDashboard, Share2, Loader2, Key, Database, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface VisualQueryBuilderProps {
    metadata: any;
    config: any;
    database: string;
    databases?: any[];
    onExecute: (sql: string) => void;
    onClose: () => void;
}

interface ColumnInfo {
    name: string;
    type: string;
    isPK: boolean;
    isNullable: boolean;
}

export default function VisualQueryBuilder({ metadata: initialMetadata, config, database, databases = [], onExecute, onClose }: VisualQueryBuilderProps) {
    const [selectedDb, setSelectedDb] = useState(database);
    const [currentMetadata, setCurrentMetadata] = useState<any>(initialMetadata);
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({});
    const [searchTerm, setSearchTerm] = useState('');
    // key = table name, value = list of columns with metadata
    const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({});
    const [loadingTable, setLoadingTable] = useState<string | null>(null);
    const [loadingMetadata, setLoadingMetadata] = useState(false);

    React.useEffect(() => {
        const fetchMetadata = async () => {
            if (selectedDb === database) {
                setCurrentMetadata(initialMetadata);
                return;
            }
            setLoadingMetadata(true);
            try {
                const res = await apiRequest('/api/db/metadata', 'POST', { ...config, database: selectedDb });
                if (res.success) {
                    setCurrentMetadata(res.metadata);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingMetadata(false);
            }
        };
        fetchMetadata();
    }, [selectedDb, config, initialMetadata]);

    const fetchColumnsForTable = async (tableMeta: any) => {
        if (!config) return;
        const tableKey = tableMeta.name;
        if (tableColumns[tableKey]) return; // already fetched

        setLoadingTable(tableKey);
        try {
            const dialect = config.dbType || 'mssql';
            let query = '';

            if (dialect === 'mysql' || dialect === 'mariadb') {
                const schemaName = tableMeta.schema || selectedDb || '';
                const tableName = tableMeta.name;
                // Use unquoted column names to avoid backtick-in-template-literal issues
                query = `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_KEY FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${tableName}'${schemaName ? ` AND TABLE_SCHEMA = '${schemaName}'` : ` AND TABLE_SCHEMA = DATABASE()`} ORDER BY ORDINAL_POSITION`;
            } else if (dialect === 'postgres') {
                const parts = (tableMeta.fullName || tableMeta.name).replace(/"/g, '').split('.');
                const schema = parts.length > 1 ? parts[0] : 'public';
                const tbl = parts[parts.length - 1];
                // Use EXISTS subquery to detect Primary Keys in Postgres
                query = `SELECT 
                            column_name, 
                            data_type, 
                            is_nullable, 
                            CASE WHEN EXISTS (
                                SELECT 1 FROM information_schema.key_column_usage kcu
                                JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name
                                WHERE kcu.table_name = '${tbl}' AND kcu.column_name = columns.column_name AND tc.constraint_type = 'PRIMARY KEY' AND kcu.table_schema = '${schema}'
                            ) THEN 'PRI' ELSE '' END as column_key 
                         FROM information_schema.columns 
                         WHERE table_schema = '${schema}' AND table_name = '${tbl}' 
                         ORDER BY ordinal_position`;
            } else {
                // MSSQL
                const parts = (tableMeta.fullName || tableMeta.name).replace(/[\[\]]/g, '').split('.');
                const schema = parts.length > 1 ? parts[0] : 'dbo';
                const tbl = parts[parts.length - 1];
                query = `USE [${selectedDb}]; SELECT c.name AS COLUMN_NAME, ty.name AS DATA_TYPE, c.is_nullable AS IS_NULLABLE, ISNULL((SELECT 1 FROM sys.index_columns ic JOIN sys.indexes i ON ic.object_id=i.object_id AND ic.index_id=i.index_id WHERE ic.object_id=t.object_id AND ic.column_id=c.column_id AND i.is_primary_key=1),0) AS IS_PK FROM sys.tables t JOIN sys.schemas s ON t.schema_id=s.schema_id JOIN sys.columns c ON t.object_id=c.object_id JOIN sys.types ty ON c.user_type_id=ty.user_type_id WHERE s.name='${schema}' AND t.name='${tbl}' ORDER BY c.column_id`;
            }

            // IMPORTANT: /api/db/query expects { config, query } wrapper
            const res = await apiRequest('/api/db/query', 'POST', { config: { ...config, database: selectedDb }, query, page: 1, pageSize: 500 });
            console.log('[Builder] Column fetch result for', tableKey, ':', res);

            if (res.success && res.data && res.data.length > 0) {
                const cols: ColumnInfo[] = res.data.map((row: any) => {
                    // Normalize keys — different drivers return different casing
                    const colName = row.COLUMN_NAME ?? row.column_name ?? row.Column ?? '';
                    const colType = row.DATA_TYPE ?? row.data_type ?? row.Type ?? '';
                    const nullable = row.IS_NULLABLE ?? row.is_nullable ?? row.Nullable ?? '';
                    const key = row.COLUMN_KEY ?? row.column_key ?? row.Key ?? '';
                    const isPK = row.IS_PK === 1 || key === 'PRI';
                    return {
                        name: String(colName),
                        type: String(colType),
                        isPK,
                        isNullable: nullable === 'YES' || nullable === 1,
                    };
                });
                setTableColumns(prev => ({ ...prev, [tableKey]: cols }));
            } else {
                console.warn('[Builder] No data returned. Response:', res);
                setTableColumns(prev => ({ ...prev, [tableKey]: [] }));
            }
        } catch (err) {
            console.error('[Builder] Column fetch error:', err);
            setTableColumns(prev => ({ ...prev, [tableKey]: [] }));
        } finally {
            setLoadingTable(null);
        }
    };

    const toggleTable = (tableMeta: any) => {
        const tableName = tableMeta.name;
        if (selectedTables.includes(tableName)) {
            setSelectedTables(prev => prev.filter(t => t !== tableName));
            const newCols = { ...selectedColumns };
            delete newCols[tableName];
            setSelectedColumns(newCols);
        } else {
            setSelectedTables(prev => [...prev, tableName]);
            setSelectedColumns(prev => ({ ...prev, [tableName]: [] }));
            fetchColumnsForTable(tableMeta);
        }
    };

    const toggleColumn = (tableName: string, column: string) => {
        const currentCols = selectedColumns[tableName] || [];
        if (currentCols.includes(column)) {
            setSelectedColumns({ ...selectedColumns, [tableName]: currentCols.filter(c => c !== column) });
        } else {
            setSelectedColumns({ ...selectedColumns, [tableName]: [...currentCols, column] });
        }
    };

    const selectAllColumns = (tableName: string) => {
        const all = (tableColumns[tableName] || []).map(c => c.name);
        setSelectedColumns(prev => ({ ...prev, [tableName]: all }));
    };

    const generateSql = () => {
        if (selectedTables.length === 0) return '-- Select tables to begin';

        const dialect = config?.dbType || 'mssql';

        if (dialect === 'mongodb') {
            const table = selectedTables[0];
            const cols = selectedColumns[table] || [];

            // Build projection object
            let projectionStr = '';
            if (cols.length > 0) {
                const projObj: Record<string, number> = {};
                cols.forEach(c => projObj[c] = 1);
                projectionStr = `\n  "projection": ${JSON.stringify(projObj)},`;
            }

            return `{
  "collection": "${table}",
  "action": "find",
  "query": {},${projectionStr}
  "limit": 100
}`;
        }

        if (dialect === 'redis') {
            // Redis just uses simple commands
            if (selectedTables[0] === 'Keys') {
                return `KEYS *`;
            }
            return `GET ${selectedTables[0]}`;
        }

        const q = dialect === 'mssql' ? (s: string) => `[${s}]` : (s: string) => `\`${s}\``;

        let sql = 'SELECT ';
        const columnsToSelect: string[] = [];

        selectedTables.forEach(t => {
            const cols = selectedColumns[t] || [];
            if (cols.length === 0) {
                columnsToSelect.push(`${q(t)}.*`);
            } else {
                cols.forEach(c => columnsToSelect.push(`${q(t)}.${q(c)}`));
            }
        });

        sql += columnsToSelect.join(',\n       ');
        sql += `\nFROM ${q(selectedTables[0])}`;

        if (selectedTables.length > 1) {
            for (let i = 1; i < selectedTables.length; i++) {
                sql += `\nCROSS JOIN ${q(selectedTables[i])}`;
            }
        }

        return sql;
    };

    const filteredTables = currentMetadata.tables?.filter((t: any) =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    return (
        <div className="flex-1 flex flex-col bg-background overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="h-16 border-b border-border bg-card/30 flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <LayoutDashboard className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-1">Visual Query Builder</h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">LIVE SCHEMA ENGINE</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-muted/50 border border-border px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-purple-400" />
                        <select
                            value={selectedDb}
                            onChange={(e) => {
                                setSelectedDb(e.target.value);
                                setSelectedTables([]);
                                setSelectedColumns({});
                                setTableColumns({});
                            }}
                            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-foreground focus:ring-0 cursor-pointer outline-none min-w-[120px]"
                        >
                            {databases.map(db => (
                                <option key={db.name} value={db.name} className="bg-background text-foreground uppercase">{db.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-muted-foreground pointer-events-none -ml-6 mr-2" />
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onExecute(generateSql())}
                        className="flex items-center gap-2 px-6 py-2 bg-purple-500 hover:bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-500/20"
                    >
                        <FileCode className="w-4 h-4" /> Generate Query
                    </button>
                    <button
                        onClick={() => onExecute(generateSql())}
                        className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                    >
                        <Play className="w-4 h-4" /> Execute
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left Sidebar: Tables */}
                <div className="w-72 border-r border-border/50 bg-muted/10 flex flex-col shrink-0">
                    <div className="p-4 border-b border-border/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-50" />
                            <input
                                type="text"
                                placeholder="Search tables..."
                                className="w-full bg-muted/50 border border-border/50 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 transition-all"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-2 space-y-1">
                        {loadingMetadata ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-3 opacity-40">
                                <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Fetching {selectedDb}...</span>
                            </div>
                        ) : (
                            (currentMetadata.tables || []).filter((t: any) =>
                                t.name.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map((t: any) => (
                                <button
                                    key={t.name}
                                    onClick={() => toggleTable(t)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-left",
                                        selectedTables.includes(t.name)
                                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                            : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                                    )}
                                >
                                    <Table className="w-4 h-4 shrink-0" />
                                    <span className="flex-1 truncate">{t.name}</span>
                                    {loadingTable === t.name ? (
                                        <Loader2 className="w-3 h-3 ml-auto animate-spin" />
                                    ) : selectedTables.includes(t.name) ? (
                                        <PlusCircle className="w-3 h-3 ml-auto fill-current" />
                                    ) : null}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Workspace: Table Details */}
                <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_center,_#1e1e22_1px,_transparent_1px)] bg-[size:24px_24px] p-8">
                    {selectedTables.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40">
                            <div className="p-10 rounded-full border-2 border-dashed border-border flex items-center justify-center">
                                <Share2 className="w-16 h-16 text-muted-foreground" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Select tables from the sidebar to begin building</p>
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-8 items-start">
                            {selectedTables.map(tName => {
                                const cols = tableColumns[tName];
                                const isLoading = loadingTable === tName;
                                return (
                                    <div key={tName} className="w-64 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                                        {/* Table Header */}
                                        <div className="px-4 py-3 bg-purple-500/10 border-b border-border flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50 shrink-0" />
                                                <span className="text-xs font-black uppercase tracking-widest truncate">{tName}</span>
                                            </div>
                                            <div className="flex items-center gap-1 ml-2">
                                                {!isLoading && cols && cols.length > 0 && (
                                                    <button
                                                        onClick={() => selectAllColumns(tName)}
                                                        title="Select all"
                                                        className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-400 hover:bg-purple-500/10 rounded-lg transition-all"
                                                    >
                                                        All
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => toggleTable(currentMetadata.tables?.find((t: any) => t.name === tName) || { name: tName })}
                                                    className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-all"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Columns */}
                                        <div className="p-2 space-y-0.5 max-h-80 overflow-auto">
                                            {isLoading ? (
                                                <div className="flex items-center justify-center py-6 gap-2">
                                                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Loading schema...</span>
                                                </div>
                                            ) : cols && cols.length > 0 ? (
                                                cols.map((col) => (
                                                    <button
                                                        key={col.name}
                                                        onClick={() => toggleColumn(tName, col.name)}
                                                        className={cn(
                                                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-mono transition-all text-left group",
                                                            selectedColumns[tName]?.includes(col.name)
                                                                ? "bg-purple-500/10 text-purple-400 font-bold"
                                                                : "text-muted-foreground hover:bg-muted/50"
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            "w-2.5 h-2.5 rounded border border-border shrink-0 flex items-center justify-center",
                                                            selectedColumns[tName]?.includes(col.name) && "bg-purple-500 border-purple-500"
                                                        )}>
                                                            {selectedColumns[tName]?.includes(col.name) && <Check className="w-2 h-2 text-white" />}
                                                        </div>
                                                        {col.isPK && <Key className="w-2.5 h-2.5 text-amber-500 shrink-0" />}
                                                        <span className="flex-1 truncate">{col.name}</span>
                                                        <span className="text-[8px] font-mono text-muted-foreground/40 group-hover:text-muted-foreground/60 shrink-0">{col.type}</span>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="text-center py-4 text-[10px] text-muted-foreground/40 uppercase tracking-widest">No columns found</div>
                                            )}
                                        </div>

                                        {/* Column count */}
                                        {!isLoading && cols && cols.length > 0 && (
                                            <div className="px-4 py-2 border-t border-border/50 flex items-center justify-between">
                                                <span className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">{cols.length} columns</span>
                                                <span className="text-[9px] text-purple-400/70 uppercase tracking-widest">{selectedColumns[tName]?.length || 0} selected</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right Panel: SQL Preview */}
                <div className="w-96 border-l border-border/50 bg-muted/5 flex flex-col shrink-0">
                    <div className="h-12 border-b border-border/50 flex items-center px-6 shrink-0">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">SQL GENERATED</span>
                    </div>
                    <div className="flex-1 p-6 font-mono text-xs overflow-auto bg-[#1a1a1e]">
                        <pre className="text-emerald-400/90 leading-relaxed">
                            {generateSql()}
                        </pre>
                    </div>
                    <div className="p-6 border-t border-border/50 bg-card/50">
                        <div className="p-4 bg-muted/20 border border-border rounded-2xl flex items-center gap-4">
                            <div className="p-2 bg-blue-500/10 rounded-xl"><Settings2 className="w-5 h-5 text-blue-500" /></div>
                            <div>
                                <h4 className="text-[10px] font-black uppercase tracking-widest">Query Preview</h4>
                                <p className="text-[10px] text-muted-foreground mt-1">Columns fetched live from your database schema.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
