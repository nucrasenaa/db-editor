'use client';

import React, { useState } from 'react';
import { Plus, Trash2, Save, Play, Code, Settings2, ShieldCheck, Database, Type, FileJson, Link, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column {
    name: string;
    type: string;
    length?: string;
    nullable: boolean;
    isPrimary: boolean;
    isIdentity?: boolean;
    defaultValue?: string;
}

interface TableDesignerProps {
    dbType: string;
    database: string;
    onExecute: (sql: string) => void;
    loading?: boolean;
}

const COMMON_TYPES: Record<string, string[]> = {
    mssql: ['int', 'bigint', 'varchar(50)', 'varchar(max)', 'nvarchar(50)', 'nvarchar(max)', 'datetime', 'date', 'bit', 'decimal(18,2)', 'uniqueidentifier', 'smallint', 'tinyint'],
    postgres: ['integer', 'bigint', 'varchar', 'text', 'timestamp', 'boolean', 'numeric', 'uuid', 'date', 'jsonb'],
    mysql: ['int', 'bigint', 'varchar(255)', 'text', 'datetime', 'date', 'tinyint(1)', 'decimal(10,2)', 'json', 'timestamp'],
};

export default function TableDesigner({ dbType, database, onExecute, loading }: TableDesignerProps) {
    const dialect = dbType || 'mssql';
    const [tableName, setTableName] = useState('');
    const [schema, setSchema] = useState(dialect === 'mssql' ? 'dbo' : (dialect === 'postgres' ? 'public' : ''));
    const [columns, setColumns] = useState<Column[]>([
        { name: 'id', type: dialect === 'mssql' ? 'int' : (dialect === 'postgres' ? 'integer' : 'int'), nullable: false, isPrimary: true, isIdentity: true }
    ]);
    const [showSql, setShowSql] = useState(false);

    const addColumn = () => {
        setColumns([...columns, { name: '', type: COMMON_TYPES[dialect]?.[2] || 'varchar(50)', nullable: true, isPrimary: false }]);
    };

    const removeColumn = (index: number) => {
        setColumns(columns.filter((_, i) => i !== index));
    };

    const updateColumn = (index: number, updates: Partial<Column>) => {
        const newCols = [...columns];
        newCols[index] = { ...newCols[index], ...updates };
        setColumns(newCols);
    };

    const generateSql = () => {
        if (!tableName) return '-- Please provide a table name';

        const qStart = dialect === 'mssql' ? '[' : (dialect === 'postgres' ? '"' : '`');
        const qEnd = dialect === 'mssql' ? ']' : (dialect === 'postgres' ? '"' : '`');

        let sql = `CREATE TABLE ${schema ? `${qStart}${schema}${qEnd}.` : ''}${qStart}${tableName}${qEnd} (\n`;

        const columnDefs = columns.map(c => {
            let def = `  ${qStart}${c.name}${qEnd} ${c.type.toUpperCase()}`;

            if (dialect === 'mssql' && c.isIdentity) {
                def += ' IDENTITY(1,1)';
            } else if (dialect === 'postgres' && c.isIdentity) {
                // Simplified for Postgres, usually use SERIAL or IDENTITY
                if (c.type.toLowerCase() === 'integer') def = `  ${qStart}${c.name}${qEnd} SERIAL`;
                else if (c.type.toLowerCase() === 'bigint') def = `  ${qStart}${c.name}${qEnd} BIGSERIAL`;
            } else if (dialect === 'mysql' && c.isIdentity) {
                def += ' AUTO_INCREMENT';
            }

            if (!c.nullable) def += ' NOT NULL';
            if (c.isPrimary) def += ' PRIMARY KEY';
            if (c.defaultValue) def += ` DEFAULT ${c.defaultValue}`;

            return def;
        });

        sql += columnDefs.join(',\n');
        sql += '\n);';

        return sql;
    };

    const handleExecute = () => {
        const sql = generateSql();
        if (tableName && columns.every(c => c.name)) {
            onExecute(sql);
        } else {
            alert('Please fill in table name and all column names');
        }
    };

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
            {/* Header */}
            <div className="h-16 border-b border-border bg-card/30 flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <Plus className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-1">Table Designer</h2>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                            <Database className="w-3 h-3" /> {database || 'Default'}
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
                        disabled={loading || !tableName}
                        className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Settings2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Create Table
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto flex p-6 gap-6">
                <div className="flex-1 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Schema</label>
                            <input
                                type="text"
                                value={schema}
                                onChange={(e) => setSchema(e.target.value)}
                                placeholder="e.g. dbo, public"
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Table Name</label>
                            <input
                                type="text"
                                value={tableName}
                                onChange={(e) => setTableName(e.target.value)}
                                placeholder="Enter table name..."
                                className="w-full bg-muted/30 border border-border/50 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono font-bold"
                            />
                        </div>
                    </div>

                    {/* Columns List */}
                    <div className="bg-card/30 border border-border rounded-2xl overflow-hidden glass">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-muted/30 border-b border-border">
                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">PK</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">ID</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">Column Name</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">Data Type</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">Allow Null</th>
                                    <th className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">Default Value</th>
                                    <th className="px-4 py-3 text-right"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {columns.map((col, i) => (
                                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={col.isPrimary}
                                                onChange={(e) => updateColumn(i, { isPrimary: e.target.checked, nullable: e.target.checked ? false : col.nullable })}
                                                className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={col.isIdentity}
                                                onChange={(e) => updateColumn(i, { isIdentity: e.target.checked })}
                                                className="w-4 h-4 rounded border-border bg-muted/50 text-blue-500 focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="text"
                                                value={col.name}
                                                onChange={(e) => updateColumn(i, { name: e.target.value })}
                                                placeholder="column_name"
                                                className="w-full bg-transparent border-none p-0 text-sm focus:outline-none focus:ring-0 font-mono"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <select
                                                value={col.type}
                                                onChange={(e) => updateColumn(i, { type: e.target.value })}
                                                className="w-full bg-muted/50 border border-border/50 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                                            >
                                                {COMMON_TYPES[dialect]?.map(t => (
                                                    <option key={t} value={t}>{t.toUpperCase()}</option>
                                                ))}
                                                <option value="CUSTOM">-- CUSTOM --</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="checkbox"
                                                checked={col.nullable}
                                                disabled={col.isPrimary}
                                                onChange={(e) => updateColumn(i, { nullable: e.target.checked })}
                                                className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-0 focus:ring-offset-0 transition-all cursor-pointer disabled:opacity-30"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <input
                                                type="text"
                                                value={col.defaultValue || ''}
                                                onChange={(e) => updateColumn(i, { defaultValue: e.target.value })}
                                                placeholder="NULL"
                                                className="w-full bg-transparent border-none p-0 text-[10px] focus:outline-none focus:ring-0 font-mono text-muted-foreground"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                onClick={() => removeColumn(i)}
                                                className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <button
                            onClick={addColumn}
                            className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-accent hover:bg-accent/5 flex items-center justify-center gap-2 transition-all border-t border-border border-dashed"
                        >
                            <Plus className="w-4 h-4" /> Add New Column
                        </button>
                    </div>

                    <div className="flex items-center gap-4 text-[10px] text-muted-foreground italic">
                        <HelpCircle className="w-4 h-4" />
                        Tip: Identity columns are automatically incremented. Primary keys cannot be nullable.
                    </div>
                </div>

                {/* SQL Preview Panel */}
                {showSql && (
                    <div className="w-[450px] flex flex-col gap-4 animate-in slide-in-from-right-4 fade-in">
                        <div className="flex-1 bg-[#1e1e1e] border border-border rounded-2xl p-6 font-mono text-sm overflow-auto shadow-2xl relative">
                            <div className="absolute top-4 right-4 text-[9px] font-black uppercase tracking-[0.2em] text-accent/40 bg-accent/5 px-2 py-1 rounded border border-accent/10">Generated SQL</div>
                            <pre className="text-emerald-400/90 leading-relaxed whitespace-pre-wrap">
                                {generateSql()}
                            </pre>
                        </div>
                        <div className="p-4 bg-muted/20 border border-border rounded-xl">
                            <div className="flex items-center gap-3 text-amber-500">
                                <ShieldCheck className="w-4 h-4" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Safe Deployment</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">This will execute a standard CREATE statement. Ensure you have the necessary permissions.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
