'use client';

import React, { useState, useEffect } from 'react';
import { Database, Plus, Trash2, Settings2, Play, Table as TableIcon, Code, Save, Zap, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface MockDataGeneratorProps {
    dbType: string;
    database: string;
    databases?: any[];
    metadata: any;
    config: any;
    onExecute: (sql: string) => void;
    onClose: () => void;
}

interface ColumnDef {
    name: string;
    dataType: string;
    mockType: string;
    staticValue?: string;
    exclude?: boolean;
}

const MOCK_TYPES = [
    { value: 'auto', label: '🤖 Auto-Detect' },
    { value: 'uuid', label: '🔑 UUID' },
    { value: 'firstName', label: '👤 First Name' },
    { value: 'lastName', label: '👤 Last Name' },
    { value: 'fullName', label: '👥 Full Name' },
    { value: 'email', label: '✉️ Email' },
    { value: 'phone', label: '📱 Phone Number' },
    { value: 'int_1_100', label: '🔢 Random Int (1-100)' },
    { value: 'int_1000_9999', label: '🔢 Random Int (1000-9999)' },
    { value: 'decimal', label: '🏷️ Random Decimal' },
    { value: 'date_past', label: '📅 Random Date (Past Year)' },
    { value: 'bool', label: '✅ Random Boolean' },
    { value: 'lorem', label: '📝 Lorem Ipsum Word' },
    { value: 'static', label: '📌 Static Value' }
];

export default function MockDataGenerator({ dbType, database, databases = [], metadata, config, onExecute, onClose }: MockDataGeneratorProps) {
    const dialect = dbType || 'mssql';
    const [selectedDb, setSelectedDb] = useState(database);
    const [selectedTable, setSelectedTable] = useState('');
    const [rowsToGenerate, setRowsToGenerate] = useState<number>(50);
    const [columns, setColumns] = useState<ColumnDef[]>([]);
    const [isFetchingCols, setIsFetchingCols] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showSql, setShowSql] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generateProgress, setGenerateProgress] = useState(0);
    const [generateSuccess, setGenerateSuccess] = useState(false);

    const tables = metadata?.tables || [];

    useEffect(() => {
        if (!selectedTable) {
            setColumns([]);
            return;
        }

        const fetchColumns = async () => {
            setIsFetchingCols(true);
            setFetchError(null);
            try {
                const tableObj = tables.find((t: any) => t.fullName === selectedTable);
                if (!tableObj) return;

                const dbNameStr = selectedDb.replace(/'/g, "''");
                const schemaStr = (tableObj.schema || '').replace(/'/g, "''");
                const nameStr = (tableObj.name || '').replace(/'/g, "''");

                let query = '';
                if (dialect === 'mssql') {
                    query = `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${schemaStr}' AND TABLE_NAME = '${nameStr}'`;
                } else if (dialect === 'postgres') {
                    query = `SELECT column_name as "COLUMN_NAME", data_type as "DATA_TYPE" FROM information_schema.columns WHERE table_schema = '${schemaStr}' AND table_name = '${nameStr}'`;
                } else {
                    query = `SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${dbNameStr}' AND TABLE_NAME = '${nameStr}'`;
                }

                const res = await apiRequest('/api/db/query', 'POST', {
                    config: { ...config, database: selectedDb },
                    query
                });

                if (res.success && res.data) {
                    const fetchedCols = res.data.map((c: any) => {
                        const name = c.COLUMN_NAME || c.column_name;
                        const dataType = c.DATA_TYPE || c.data_type || '';

                        // Auto-detect basic mock type
                        let mockType = 'auto';
                        let exclude = false;

                        // Exclude identities typically, but here let's just default to exclude if it's 'id' and int
                        const lowerName = name.toLowerCase();
                        if (lowerName === 'id' && dataType.includes('int')) {
                            exclude = true;
                        } else if (lowerName.includes('email')) {
                            mockType = 'email';
                        } else if (lowerName.includes('first') && lowerName.includes('name')) {
                            mockType = 'firstName';
                        } else if (lowerName.includes('last') && lowerName.includes('name')) {
                            mockType = 'lastName';
                        } else if (lowerName.includes('name')) {
                            mockType = 'fullName';
                        } else if (lowerName.includes('phone')) {
                            mockType = 'phone';
                        } else if (dataType.includes('uniqueidentifier') || dataType.includes('uuid')) {
                            mockType = 'uuid';
                        } else if (dataType.includes('date') || dataType.includes('time')) {
                            mockType = 'date_past';
                        } else if (dataType.includes('bit') || dataType.includes('bool') || dataType.includes('tinyint(1)')) {
                            mockType = 'bool';
                        } else if (dataType.includes('int')) {
                            mockType = 'int_1_100';
                        } else if (dataType.includes('decimal') || dataType.includes('numeric')) {
                            mockType = 'decimal';
                        }

                        return {
                            name,
                            dataType,
                            mockType,
                            exclude
                        };
                    });

                    if (fetchedCols.length === 0) {
                        setFetchError(`No columns found for ${selectedTable}.`);
                    } else {
                        setColumns(fetchedCols);
                    }
                } else {
                    setFetchError(res.message || 'Failed to fetch columns. Check database connection.');
                }
            } catch (err: any) {
                console.error(err);
                setFetchError(err.message || 'An error occurred while fetching schema.');
            } finally {
                setIsFetchingCols(false);
            }
        };

        fetchColumns();
    }, [selectedTable, selectedDb, tables, dialect, config]);

    const updateColumn = (index: number, updates: Partial<ColumnDef>) => {
        const newCols = [...columns];
        newCols[index] = { ...newCols[index], ...updates };
        setColumns(newCols);
    };

    // Very basic generators for client-side purely dummy data
    const generateValue = (mockType: string, dataType: string) => {
        switch (mockType) {
            case 'uuid': return `'${crypto.randomUUID()}'`;
            case 'firstName': return `'${['John', 'Jane', 'Alex', 'Emily', 'Michael', 'Sarah', 'William', 'Emma', 'David', 'Olivia'][Math.floor(Math.random() * 10)]}'`;
            case 'lastName': return `'${['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez'][Math.floor(Math.random() * 10)]}'`;
            case 'fullName': return `'${['John Smith', 'Jane Doe', 'Alex Johnson', 'Emily Brown', 'Sarah Jones', 'Michael Miller'][Math.floor(Math.random() * 6)]}'`;
            case 'email': return `'user${Math.floor(Math.random() * 10000)}@example.com'`;
            case 'phone': return `'555-${String(Math.floor(Math.random() * 9000) + 1000)}-${String(Math.floor(Math.random() * 9000) + 1000)}'`;
            case 'int_1_100': return Math.floor(Math.random() * 100) + 1;
            case 'int_1000_9999': return Math.floor(Math.random() * 9000) + 1000;
            case 'decimal': return (Math.random() * 100).toFixed(2);
            case 'date_past': {
                const d = new Date();
                d.setDate(d.getDate() - Math.floor(Math.random() * 365));
                return `'${d.toISOString().slice(0, 19).replace('T', ' ')}'`;
            }
            case 'bool': return Math.random() > 0.5 ? 1 : 0;
            case 'lorem': return `'${['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit'][Math.floor(Math.random() * 8)]}'`;
            case 'auto':
                if (dataType.includes('int')) return Math.floor(Math.random() * 100);
                if (dataType.includes('date')) return `'${new Date().toISOString().slice(0, 10)}'`;
                return `'dummy_text_${Math.floor(Math.random() * 1000)}'`;
            default: return 'NULL';
        }
    };

    const buildSql = () => {
        if (!selectedTable || columns.length === 0) return '-- Please select a table and configure columns';

        const activeCols = columns.filter(c => !c.exclude);
        if (activeCols.length === 0) return '-- No columns selected to generate data for';

        let sql = `-- Auto-Generated Mock Data (${rowsToGenerate} Rows)\n`;
        const qStart = dialect === 'mssql' ? '[' : (dialect === 'postgres' ? '"' : '`');
        const qEnd = dialect === 'mssql' ? ']' : (dialect === 'postgres' ? '"' : '`');

        // Note: For postgres fullName is like "public"."users" normally, we just use selectedTable raw assuming it's correctly formatted by metadata.
        const tableName = selectedTable;

        const colNames = activeCols.map(c => `${qStart}${c.name}${qEnd}`).join(', ');

        const batchSize = dialect === 'mssql' ? 1000 : 5000;
        const valuesArr: string[] = [];

        for (let i = 0; i < rowsToGenerate; i++) {
            const vals = activeCols.map(c => {
                if (c.mockType === 'static') return c.staticValue ? `'${c.staticValue.replace(/'/g, "''")}'` : 'NULL';
                return generateValue(c.mockType, c.dataType);
            });
            valuesArr.push(`  (${vals.join(', ')})`);
        }

        // Chunking the INSERTs
        const chunkSize = 100; // 100 rows per insert statement
        const chunks: string[] = [];
        for (let i = 0; i < valuesArr.length; i += chunkSize) {
            const chunk = valuesArr.slice(i, i + chunkSize);
            chunks.push(`INSERT INTO ${tableName} (${colNames}) \nVALUES \n${chunk.join(',\n')};`);
        }

        return chunks;
    };

    const handleExecute = async () => {
        const chunks = buildSql();
        if (!selectedTable || typeof chunks === 'string') {
            alert(typeof chunks === 'string' ? chunks : 'Please select a table to generate data for.');
            return;
        }

        setIsGenerating(true);
        setGenerateSuccess(false);
        setGenerateProgress(0);

        try {
            for (let i = 0; i < chunks.length; i++) {
                const query = chunks[i];
                const res = await apiRequest('/api/db/query', 'POST', {
                    config: { ...config, database: selectedDb },
                    query,
                    page: 1,
                    pageSize: 10
                });

                if (!res.success) {
                    throw new Error(res.message || `Failed on chunk ${i + 1}`);
                }

                setGenerateProgress(Math.floor(((i + 1) / chunks.length) * 100));
            }

            setGenerateSuccess(true);
        } catch (err: any) {
            alert('Error generating mock data: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="h-16 border-b border-border bg-card/30 flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-pink-500/10 rounded-lg">
                        <Zap className="w-5 h-5 text-pink-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-1 text-pink-500">Mock Data Generator</h2>
                        <div className="flex items-center gap-2">
                            <Database className="w-3 h-3 text-muted-foreground" />
                            <select
                                value={selectedDb}
                                onChange={(e) => setSelectedDb(e.target.value)}
                                className="bg-transparent border-none p-0 text-[10px] text-muted-foreground uppercase font-black tracking-widest focus:ring-0 cursor-pointer hover:text-accent transition-colors"
                            >
                                {databases.map(db => (
                                    <option key={db.name} value={db.name} className="bg-background text-foreground">{db.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSql(!showSql)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                            showSql ? "bg-accent text-accent-foreground" : "bg-muted/50 hover:bg-muted text-muted-foreground"
                        )}
                    >
                        <Code className="w-4 h-4" /> {showSql ? 'Hide SQL' : 'Preview SQL'}
                    </button>
                    <button
                        onClick={handleExecute}
                        disabled={!selectedTable || columns.length === 0}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-pink-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Play className="w-4 h-4" /> Run Generator
                    </button>
                    <div className="h-6 w-px bg-border/50 mx-2" />
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-all">
                        <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto flex p-6 gap-6">
                <div className="flex-1 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-2 lg:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target Table</label>
                            <select
                                value={selectedTable}
                                onChange={(e) => setSelectedTable(e.target.value)}
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                            >
                                <option value="">-- Select a table --</option>
                                {tables.map((t: any) => (
                                    <option key={t.fullName} value={t.fullName}>{t.fullName}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Rows to Generate</label>
                            <input
                                type="number"
                                min="1"
                                max="10000"
                                value={rowsToGenerate}
                                onChange={(e) => setRowsToGenerate(Number(e.target.value))}
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono font-bold text-accent"
                            />
                        </div>
                    </div>

                    {/* Columns List */}
                    <div className="bg-card/30 border border-border rounded-2xl overflow-hidden glass">
                        {isFetchingCols ? (
                            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground h-40">
                                <Settings2 className="w-6 h-6 animate-spin mb-3 text-pink-500" />
                                <span className="text-[10px] uppercase tracking-widest font-bold">Analyzing Table Schema...</span>
                            </div>
                        ) : fetchError ? (
                            <div className="p-12 flex flex-col items-center justify-center text-red-400 h-40">
                                <AlertCircle className="w-8 h-8 mb-3 opacity-80" />
                                <span className="text-xs font-bold text-center bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">{fetchError}</span>
                            </div>
                        ) : columns.length === 0 ? (
                            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground/50 h-40">
                                <TableIcon className="w-8 h-8 opacity-20 mb-3" />
                                <span className="text-xs uppercase tracking-widest font-black opacity-40">Select a table to map columns</span>
                            </div>
                        ) : (
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-muted/30 border-b border-border">
                                        <th className="px-4 py-3 text-left w-12 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Gen</th>
                                        <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">Column Name</th>
                                        <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">Data Type</th>
                                        <th className="px-4 py-3 text-left w-64 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Mock Generator Type</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {columns.map((col, i) => (
                                        <tr key={i} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors group", col.exclude ? "opacity-40 bg-muted/10 grayscale" : "")}>
                                            <td className="px-4 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={!col.exclude}
                                                    onChange={(e) => updateColumn(i, { exclude: !e.target.checked })}
                                                    className="w-4 h-4 rounded border-border bg-muted/50 text-pink-500 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="text-sm font-mono font-bold">{col.name}</span>
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className="text-[10px] text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded">{col.dataType}</span>
                                            </td>
                                            <td className="px-4 py-2 flex flex-col gap-2">
                                                <select
                                                    value={col.mockType}
                                                    onChange={(e) => updateColumn(i, { mockType: e.target.value })}
                                                    disabled={col.exclude}
                                                    className="w-full bg-muted/50 border border-border/50 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                                                >
                                                    {MOCK_TYPES.map(t => (
                                                        <option key={t.value} value={t.value}>{t.label}</option>
                                                    ))}
                                                </select>
                                                {col.mockType === 'static' && (
                                                    <input
                                                        type="text"
                                                        value={col.staticValue || ''}
                                                        onChange={(e) => updateColumn(i, { staticValue: e.target.value })}
                                                        placeholder="Enter fixed value..."
                                                        disabled={col.exclude}
                                                        className="w-full bg-background border border-border/50 rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all"
                                                    />
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {!isFetchingCols && columns.length > 0 && (
                        <div className="flex items-center justify-between p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                            <div className="flex items-center gap-3 text-yellow-500/80">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Testing Environment Check</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground font-mono">Ensure you are NOT generating dummy data in a Production Database!</p>
                        </div>
                    )}
                </div>

                {/* SQL Preview Panel */}
                {showSql && (
                    <div className="w-[450px] flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in">
                        <div className="flex-1 bg-[#1e1e1e] border border-border rounded-2xl p-6 font-mono text-xs overflow-auto shadow-2xl relative custom-scrollbar">
                            <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-[0.2em] text-pink-400 bg-pink-500/10 px-2 py-1 rounded border border-pink-500/20">SQL Preview</div>
                            <pre className="text-pink-400/90 leading-relaxed whitespace-pre-wrap">
                                {columns.length > 0 && Array.isArray(buildSql()) ? (buildSql() as string[]).slice(0, 5).join('\n\n') + '\n\n... (preview limited to 5 chunks) ...' : buildSql()}
                            </pre>
                        </div>
                        <div className="p-4 bg-muted/20 border border-border rounded-xl">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">This mock data script supports batched inserts. For very large counts, it's recommended to run it in chunks to avoid overwhelming the database proxy.</p>
                        </div>
                    </div>
                )}
            </div>
            {/* Overlay Loaders */}
            {isGenerating && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 flex-col animate-in fade-in duration-300">
                    <div className="bg-card border border-border p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full">
                        <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mb-6 relative">
                            <Settings2 className="w-8 h-8 text-pink-500 animate-spin absolute" />
                            <div className="w-16 h-16 rounded-full border-t-2 border-pink-500 animate-[spin_2s_linear_infinite]" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-foreground mb-2 text-center">Generating Data</h3>
                        <p className="text-xs text-muted-foreground mb-6 text-center">Inserting {rowsToGenerate.toLocaleString()} rows into {selectedTable}...</p>

                        <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-300 ease-out flex items-center justify-end"
                                style={{ width: `${generateProgress}%` }}
                            >
                                <div className="w-4 h-full bg-white/30 animate-pulse" />
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-pink-500">{generateProgress}%</div>
                    </div>
                </div>
            )}

            {generateSuccess && !isGenerating && (
                <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 flex-col animate-in fade-in duration-300">
                    <div className="bg-card border border-emerald-500/30 p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 flex flex-col items-center max-w-sm w-full relative overflow-hidden">
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
                        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6">
                            <Zap className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-foreground mb-2 text-center">Generation Complete!</h3>
                        <p className="text-xs text-muted-foreground mb-8 text-center">Successfully inserted {rowsToGenerate.toLocaleString()} mock rows.</p>
                        <button
                            onClick={() => setGenerateSuccess(false)}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest transition-all"
                        >
                            Awesome!
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
