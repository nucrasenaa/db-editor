'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    ArrowUp,
    ArrowDown,
    ArrowUpDown,
    Check,
    X as CloseIcon,
    Loader2,
    Download,
    FileJson,
    FileText,
    Database as DatabaseIcon,
    ChevronDown,
    Share2,
    Table as TableIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface DataTableProps {
    data: any[];
    columns: string[];
    loading?: boolean;
    page: number;
    pageSize: number;
    totalRows?: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    onSort: (column: string) => void;
    sortColumn?: string;
    sortDir?: 'ASC' | 'DESC';
    onUpdate?: (rowIndex: number, column: string, newValue: any, originalRow: any) => Promise<boolean>;
    allowEdit?: boolean;
}

export default function DataTable({
    data,
    columns,
    loading,
    page,
    pageSize,
    totalRows,
    onPageChange,
    onPageSizeChange,
    onSort,
    sortColumn,
    sortDir,
    onUpdate,
    allowEdit
}: DataTableProps) {
    const [editingCell, setEditingCell] = useState<{ rowIndex: number, col: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    // Close export dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
                setShowExport(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    const handleStartEdit = (rowIndex: number, col: string, value: any) => {
        if (!onUpdate || !allowEdit) return;
        setEditingCell({ rowIndex, col });
        setEditValue(value === null ? '' : String(value));
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setIsSaving(false);
    };

    const handleSave = async () => {
        if (!editingCell || isSaving || !onUpdate) return;

        setIsSaving(true);
        const success = await onUpdate(
            editingCell.rowIndex,
            editingCell.col,
            editValue === '' ? null : editValue,
            data[editingCell.rowIndex]
        );

        if (success) {
            setEditingCell(null);
        }
        setIsSaving(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancelEdit();
    };

    const downloadFile = (content: string, fileName: string, contentType: string) => {
        const a = document.createElement('a');
        const file = new Blob([content], { type: contentType });
        a.href = URL.createObjectURL(file);
        a.download = fileName;
        a.click();
    };

    const exportToCSV = () => {
        if (!data || data.length === 0) return;
        const headers = columns.join(',');
        const rows = data.map(row =>
            columns.map(col => {
                const val = row[col];
                if (val === null) return 'NULL';
                const str = String(val).replace(/"/g, '""');
                return `"${str}"`;
            }).join(',')
        );
        const csv = [headers, ...rows].join('\n');
        downloadFile(csv, `export_${Date.now()}.csv`, 'text/csv');
        setShowExport(false);
    };

    const exportToJSON = () => {
        const json = JSON.stringify(data, null, 2);
        downloadFile(json, `export_${Date.now()}.json`, 'application/json');
        setShowExport(false);
    };

    const exportToSQL = (dialect: string = 'mssql') => {
        if (!data || data.length === 0) return;
        const tableName = 'ExportedData';
        const qStart = dialect === 'mssql' ? '[' : (dialect === 'postgres' ? '"' : '`');
        const qEnd = dialect === 'mssql' ? ']' : (dialect === 'postgres' ? '"' : '`');

        const sql = data.map(row => {
            const cols = columns.map(c => `${qStart}${c}${qEnd}`).join(', ');
            const vals = columns.map(c => {
                const val = row[c];
                if (val === null) return 'NULL';
                if (typeof val === 'string') return `'${val.replace(/'/g, dialect === 'mssql' ? "''" : "''")}'`;
                return val;
            }).join(', ');
            return `INSERT INTO ${qStart}${tableName}${qEnd} (${cols}) VALUES (${vals});`;
        }).join('\n');

        downloadFile(sql, `export_${Date.now()}.sql`, 'application/sql');
        setShowExport(false);
    };

    const exportToExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Data");
        XLSX.writeFile(workbook, `export_${Date.now()}.xlsx`);
        setShowExport(false);
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                    <p className="text-sm text-muted-foreground animate-pulse">Processing request...</p>
                </div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center space-y-2">
                    <p className="text-sm italic">No data returned for this view</p>
                    <button
                        onClick={() => onPageChange(1)}
                        className="text-xs text-accent hover:underline"
                    >
                        Reset to Page 1
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto overflow-x-auto rounded-t-xl border border-border bg-card/10 custom-scrollbar min-h-0">
                <table className="w-full min-w-max text-sm text-left border-collapse table-auto">
                    <thead className="sticky top-0 bg-muted/95 backdrop-blur-md z-30 border-b border-border shadow-sm">
                        <tr>
                            <th className="w-12 px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-border/50 bg-muted/50">
                                #
                            </th>
                            {columns.map((col) => (
                                <th
                                    key={col}
                                    onClick={() => onSort(col)}
                                    className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-[0.2em] text-[9px] whitespace-nowrap border-r border-border/50 last:border-r-0 cursor-pointer hover:bg-muted transition-colors group min-w-[120px] max-w-[400px]"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate">{col}</span>
                                        <div className="shrink-0">
                                            {sortColumn === col ? (
                                                sortDir === 'ASC' ? <ArrowUp className="w-3 h-3 text-accent" /> : <ArrowDown className="w-3 h-3 text-accent" />
                                            ) : (
                                                <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {data.map((row, i) => (
                            <tr key={i} className="hover:bg-muted/30 transition-colors group/row">
                                <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground/60 border-r border-border/10 text-center bg-muted/5">
                                    {(page - 1) * pageSize + i + 1}
                                </td>
                                {columns.map((col) => {
                                    const isEditing = editingCell?.rowIndex === i && editingCell?.col === col;
                                    return (
                                        <td
                                            key={col}
                                            onDoubleClick={() => handleStartEdit(i, col, row[col])}
                                            className={cn(
                                                "px-4 py-2 font-mono text-xs border-r border-border/10 last:border-r-0 max-w-[400px] relative transition-all",
                                                isEditing ? "p-0" : "truncate cursor-text hover:bg-accent/5"
                                            )}
                                            title={isEditing ? '' : String(row[col])}
                                        >
                                            {isEditing ? (
                                                <div className="flex items-center h-full gap-1 p-1 bg-card">
                                                    <input
                                                        ref={inputRef}
                                                        type="text"
                                                        value={editValue}
                                                        onChange={(e) => setEditValue(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        className="flex-1 bg-muted border border-accent rounded px-2 py-1 text-xs focus:outline-none"
                                                        disabled={isSaving}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleSave(); }}
                                                        disabled={isSaving}
                                                        className="p-1 text-green-500 hover:bg-green-500/10 rounded"
                                                    >
                                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                                                        disabled={isSaving}
                                                        className="p-1 text-red-500 hover:bg-red-500/10 rounded"
                                                    >
                                                        <CloseIcon className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className={cn(row[col] === null && "text-muted-foreground/30 italic text-[10px]")}>
                                                    {row[col] === null ? "NULL" : String(row[col])}
                                                </span>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="h-auto md:h-14 border border-t-0 border-border bg-muted/20 rounded-b-xl flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:py-0 gap-4 md:gap-0 shrink-0 sticky bottom-0 z-20 backdrop-blur-md">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                    <div className="flex items-center justify-between w-full md:w-auto gap-4">
                        <div className="relative" ref={exportRef}>
                            <button
                                onClick={() => setShowExport(!showExport)}
                                className="flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-[10px] font-black uppercase tracking-widest transition-all border border-accent/20"
                            >
                                <Download className="w-3.5 h-3.5" /> Export <ChevronDown className={cn("w-3 h-3 transition-transform", showExport && "rotate-180")} />
                            </button>

                            {showExport && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-border rounded-xl shadow-2xl overflow-hidden glass animate-in slide-in-from-bottom-2 fade-in z-50">
                                    <button onClick={exportToCSV} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-left">
                                        <FileText className="w-4 h-4 text-emerald-400" /> Export as CSV
                                    </button>
                                    <button onClick={exportToJSON} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-left border-t border-border/50">
                                        <FileJson className="w-4 h-4 text-amber-400" /> Export as JSON
                                    </button>
                                    <button onClick={() => exportToSQL('mssql')} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-left border-t border-border/50">
                                        <DatabaseIcon className="w-4 h-4 text-blue-400" /> INSERT Scripts (MSSQL)
                                    </button>
                                    <button onClick={() => exportToSQL('postgres')} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-left border-t border-border/50">
                                        <Share2 className="w-4 h-4 text-purple-400" /> INSERT Scripts (PG)
                                    </button>
                                    <button onClick={exportToExcel} className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all text-left border-t border-border/50">
                                        <TableIcon className="w-4 h-4 text-green-400" /> Export as Excel (XLSX)
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="md:hidden flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase opacity-40 whitespace-nowrap">Row {data.length} / {totalRows || '?'}</span>
                        </div>
                    </div>

                    <div className="hidden md:block h-4 w-px bg-border mx-2" />

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full md:w-auto justify-between md:justify-start border-t border-border/10 md:border-0 pt-2 md:pt-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider opacity-60">Page:</span>
                            <span className="text-xs text-foreground font-bold bg-muted/50 px-2 py-0.5 rounded border border-border/50">{page}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider opacity-60">Size:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                className="bg-muted border border-border rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                            >
                                {[50, 100, 200, 500].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-1 border-t border-border/10 md:border-0 pt-2 md:pt-0">
                    <button onClick={() => onPageChange(1)} disabled={page === 1} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all">
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all mr-1">
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 mx-1">
                        {[...Array(Math.min(window?.innerWidth < 768 ? 3 : 5, Math.ceil((totalRows || 0) / pageSize) || 1))].map((_, i) => {
                            const totalPages = Math.ceil((totalRows || 0) / pageSize) || 1;
                            let p = page;
                            if (window?.innerWidth < 768) {
                                // Simplified mobile pagination
                                if (page === 1) p = i + 1;
                                else if (page === totalPages) p = Math.max(1, totalPages - 2 + i);
                                else p = Math.max(1, page - 1 + i);
                            } else {
                                p = page > 3 ? page - 2 + i : i + 1;
                            }

                            if (p > totalPages) return null;

                            return (
                                <button
                                    key={i}
                                    onClick={() => onPageChange(p)}
                                    className={cn(
                                        "w-8 h-8 rounded-md text-xs font-medium transition-all",
                                        page === p ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "hover:bg-muted text-muted-foreground"
                                    )}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>

                    <button onClick={() => onPageChange(page + 1)} disabled={data.length < pageSize} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all ml-1">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(page + 5)} disabled={data.length < pageSize} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all">
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div >
    );
}
