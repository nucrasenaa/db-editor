'use client';

import React, { useState } from 'react';
import { Check, Plus, Trash2, Database, Table, ChevronRight, Play, Settings2, FileCode, Layers, Search, PlusCircle, LayoutDashboard, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VisualQueryBuilderProps {
    metadata: any;
    onExecute: (sql: string) => void;
    onClose: () => void;
}

export default function VisualQueryBuilder({ metadata, onExecute, onClose }: VisualQueryBuilderProps) {
    const [selectedTables, setSelectedTables] = useState<string[]>([]);
    const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({});
    const [searchTerm, setSearchTerm] = useState('');

    const toggleTable = (tableName: string) => {
        if (selectedTables.includes(tableName)) {
            setSelectedTables(prev => prev.filter(t => t !== tableName));
            const newCols = { ...selectedColumns };
            delete newCols[tableName];
            setSelectedColumns(newCols);
        } else {
            setSelectedTables(prev => [...prev, tableName]);
            // Auto select some columns or wait for user
            setSelectedColumns(prev => ({ ...prev, [tableName]: [] }));
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

    const generateSql = () => {
        if (selectedTables.length === 0) return '-- Select tables to begin';

        let sql = 'SELECT ';
        const columnsToSelect: string[] = [];

        selectedTables.forEach(t => {
            const cols = selectedColumns[t] || [];
            if (cols.length === 0) {
                columnsToSelect.push(`[${t}].*`);
            } else {
                cols.forEach(c => columnsToSelect.push(`[${t}].[${c}]`));
            }
        });

        sql += columnsToSelect.join(',\n       ');
        sql += `\nFROM [${selectedTables[0]}]`;

        if (selectedTables.length > 1) {
            for (let i = 1; i < selectedTables.length; i++) {
                // Heuristic: attempt to find a common column (e.g. id) or just cross join
                sql += `\nCROSS JOIN [${selectedTables[i]}]`;
            }
        }

        return sql;
    };

    const filteredTables = metadata.tables?.filter((t: any) => t.name.toLowerCase().includes(searchTerm.toLowerCase())) || [];

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
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">DRAG-AND-DROP WORKSPACE</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
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
                        {filteredTables.map((t: any) => (
                            <button
                                key={t.name}
                                onClick={() => toggleTable(t.name)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all text-left",
                                    selectedTables.includes(t.name) ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                                )}
                            >
                                <Table className="w-4 h-4" /> {t.name}
                                {selectedTables.includes(t.name) && <PlusCircle className="w-3 h-3 ml-auto fill-current" />}
                            </button>
                        ))}
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
                        <div className="flex flex-wrap gap-8">
                            {selectedTables.map(tName => (
                                <div key={tName} className="w-64 bg-card border border-border rounded-2xl shadow-xl overflow-hidden glass animate-in fade-in slide-in-from-bottom-4">
                                    <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-purple-500 shadow-sm shadow-purple-500/50" />
                                            <span className="text-xs font-black uppercase tracking-widest">{tName}</span>
                                        </div>
                                        <button onClick={() => toggleTable(tName)} className="p-1 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-md transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <div className="p-2 space-y-0.5">
                                        {/* In a real app we'd fetch columns. Using metadata tables.columns if it exists */}
                                        {(metadata.tables?.find((t: any) => t.name === tName)?.columns || ['id', 'name', 'created_at', 'status']).map((c: string) => (
                                            <button
                                                key={c}
                                                onClick={() => toggleColumn(tName, c)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[11px] font-mono transition-all text-left",
                                                    selectedColumns[tName]?.includes(c) ? "bg-purple-500/10 text-purple-400 font-bold" : "text-muted-foreground hover:bg-muted/50"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-2.5 h-2.5 rounded border border-border shrink-0 flex items-center justify-center",
                                                    selectedColumns[tName]?.includes(c) && "bg-purple-500 border-purple-500"
                                                )}>
                                                    {selectedColumns[tName]?.includes(c) && <Check className="w-2 h-2 text-white" />}
                                                </div>
                                                {c}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
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
                                <p className="text-[10px] text-muted-foreground mt-1">Cross-Join enabled by default. Add JOIN logic in the SQL editor.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
