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
    Table as TableIcon,
    Trash2,
    EyeOff,
    Eye,
    ShieldCheck,
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
    onDeleteRows?: (rows: any[]) => void;
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
    allowEdit,
    onDeleteRows
}: DataTableProps) {
    const [editingCell, setEditingCell] = useState<{ rowIndex: number, col: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);
    const [showExport, setShowExport] = useState(false);
    const [selectedRows, setSelectedRows] = useState<number[]>([]);
    const [maskingEnabled, setMaskingEnabled] = useState(true);
    const [revealedCells, setRevealedCells] = useState<Set<string>>(new Set());

    // Detect sensitive columns by name patterns
    const SENSITIVE_PATTERNS = [
        /password/i, /passwd/i, /pwd/i, /secret/i,
        /email/i, /e_mail/i,
        /phone/i, /mobile/i, /tel/i, /fax/i,
        /ssn/i, /social.?sec/i, /national.?id/i, /tax.?id/i, /passport/i,
        /credit.?card/i, /card.?num/i, /cvv/i, /ccv/i, /card_no/i,
        /bank.?acc/i, /account.?no/i, /iban/i, /routing/i,
        /dob/i, /birth.?date/i, /date.?of.?birth/i,
        /salary/i, /wage/i, /income/i, /compensation/i,
        /token/i, /api.?key/i, /access.?key/i, /secret.?key/i, /private.?key/i,
        /address/i, /street/i, /zip/i, /postcode/i,
        /pin/i, /otp/i,
    ];

    const sensitiveColumns = new Set(
        columns.filter(col => SENSITIVE_PATTERNS.some(rx => rx.test(col)))
    );

    const maskValue = (val: any, col: string): string => {
        if (!maskingEnabled) return val === null ? 'NULL' : String(val);
        if (!sensitiveColumns.has(col)) return val === null ? 'NULL' : String(val);
        if (val === null) return 'NULL';
        const str = String(val);
        // Email: show first 2 chars then *** @domain
        if (/email/i.test(col) && str.includes('@')) {
            const [local, domain] = str.split('@');
            return local.slice(0, 2) + '•••@' + domain;
        }
        // Phone: show last 4 digits
        if (/phone|mobile|tel/i.test(col)) {
            return '•••-•••-' + str.replace(/\D/g, '').slice(-4);
        }
        // Card: show last 4
        if (/credit|card/i.test(col)) {
            return '•••• •••• •••• ' + str.replace(/\D/g, '').slice(-4);
        }
        // Default: mask all but first + last char
        if (str.length <= 2) return '••';
        return str[0] + '•'.repeat(Math.min(str.length - 2, 8)) + str[str.length - 1];
    };

    const toggleReveal = (rowIndex: number, col: string) => {
        const key = `${rowIndex}__${col}`;
        setRevealedCells(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    const isCellRevealed = (rowIndex: number, col: string): boolean => {
        return revealedCells.has(`${rowIndex}__${col}`);
    };

    const inputRef = useRef<HTMLInputElement>(null);
    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setSelectedRows([]);
    }, [data, page]);

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

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked && data.length > 0) {
            setSelectedRows(data.map((_, i) => i));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (i: number, checked: boolean) => {
        if (checked) {
            setSelectedRows(prev => [...prev, i]);
        } else {
            setSelectedRows(prev => prev.filter(index => index !== i));
        }
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
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-500">
                <div className="relative mb-6">
                    <div className="absolute inset-0 bg-accent/5 blur-3xl rounded-full" />
                    <div className="relative w-24 h-24 rounded-3xl bg-muted/30 border border-border/50 flex items-center justify-center shadow-inner group">
                        <DatabaseIcon className="w-10 h-10 text-muted-foreground/30 group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center shadow-lg">
                            <CloseIcon className="w-4 h-4 text-red-500/50" />
                        </div>
                    </div>
                </div>

                <div className="space-y-2 max-w-sm">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-foreground">No Records Found</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        This view or request returned zero rows. Try adjusting your filters or checking the table metadata.
                    </p>
                </div>

                {page > 1 && (
                    <button
                        onClick={() => onPageChange(1)}
                        className="mt-8 px-6 py-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95"
                    >
                        Reset to Page 1
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden h-full">
            <div className="flex-1 overflow-y-auto overflow-x-auto rounded-t-xl border border-border bg-card/10 custom-scrollbar min-h-0">
                <table className="w-full min-w-max text-sm text-left border-collapse table-auto">
                    <thead className="sticky top-0 bg-muted/95 backdrop-blur-md z-30 border-b border-border shadow-sm">
                        <tr>
                            <th className="w-16 px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-border/50 bg-muted/50">
                                <div className="flex items-center gap-2">
                                    {onDeleteRows && (
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 rounded border-border bg-muted/50 text-red-500 focus:ring-1 focus:ring-red-500/50 focus:ring-offset-0 cursor-pointer"
                                            checked={data.length > 0 && selectedRows.length === data.length}
                                            onChange={handleSelectAll}
                                        />
                                    )}
                                    <span>#</span>
                                </div>
                            </th>
                            {columns.map((col) => (
                                <th
                                    key={col}
                                    onClick={() => onSort(col)}
                                    className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-[0.2em] text-[9px] whitespace-nowrap border-r border-border/50 last:border-r-0 cursor-pointer hover:bg-muted transition-colors group min-w-[120px] max-w-[400px]"
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 truncate">
                                            {sensitiveColumns.has(col) && maskingEnabled && (
                                                <span title="Sensitive column — masked">
                                                    <ShieldCheck className="w-3 h-3 text-amber-500 shrink-0" />
                                                </span>
                                            )}
                                            <span className="truncate">{col}</span>
                                        </div>
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
                                <td className="w-16 px-4 py-2 font-mono text-[10px] text-muted-foreground/60 border-r border-border/10 text-center bg-muted/5">
                                    <div className="flex items-center gap-2">
                                        {onDeleteRows && (
                                            <input
                                                type="checkbox"
                                                className="w-3.5 h-3.5 rounded border-border bg-muted/50 text-red-500 focus:ring-1 focus:ring-red-500/50 focus:ring-offset-0 cursor-pointer"
                                                checked={selectedRows.includes(i)}
                                                onChange={(e) => handleSelectRow(i, e.target.checked)}
                                            />
                                        )}
                                        <span>{(page - 1) * pageSize + i + 1}</span>
                                    </div>
                                </td>
                                {columns.map((col) => {
                                    const isEditing = editingCell?.rowIndex === i && editingCell?.col === col;
                                    const isSensitive = sensitiveColumns.has(col);
                                    const isRevealed = isCellRevealed(i, col);
                                    const shouldMask = maskingEnabled && isSensitive && !isRevealed;
                                    const rawVal = row[col];
                                    const displayVal = shouldMask ? maskValue(rawVal, col) : (rawVal === null ? 'NULL' : String(rawVal));
                                    return (
                                        <td
                                            key={col}
                                            onDoubleClick={() => handleStartEdit(i, col, rawVal)}
                                            className={cn(
                                                "px-4 py-2 font-mono text-xs border-r border-border/10 last:border-r-0 max-w-[400px] relative transition-all",
                                                isEditing ? "p-0" : "truncate hover:bg-accent/5",
                                                shouldMask ? "cursor-pointer" : "cursor-text"
                                            )}
                                            title={isEditing ? '' : (shouldMask ? 'Click to reveal' : String(rawVal))}
                                            onClick={shouldMask ? () => toggleReveal(i, col) : undefined}
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
                                                <span className={cn(
                                                    rawVal === null && !shouldMask && "text-muted-foreground/30 italic text-[10px]",
                                                    shouldMask && "text-muted-foreground/40 tracking-widest select-none"
                                                )}>
                                                    {displayVal}
                                                    {shouldMask && (
                                                        <Eye className="inline w-3 h-3 ml-1 opacity-40 hover:opacity-100 transition-opacity" />
                                                    )}
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

            <div className="h-auto md:h-14 border border-t-0 border-border bg-card/40 rounded-b-xl flex flex-col md:flex-row md:items-center justify-between px-3 md:px-6 py-2.5 md:py-0 gap-2 md:gap-0 shrink-0 sticky bottom-0 z-20 backdrop-blur-md">
                <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4">
                    <div className="flex items-center justify-between w-full md:w-auto gap-2">
                        <div className="relative" ref={exportRef}>
                            <button
                                onClick={() => setShowExport(!showExport)}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border border-accent/20 active:scale-95"
                            >
                                <Download className="w-3 h-3 md:w-3.5 md:h-3.5" /> Export <ChevronDown className={cn("w-2.5 h-2.5 transition-transform", showExport && "rotate-180")} />
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
                        {onDeleteRows && selectedRows.length > 0 && (
                            <button
                                onClick={() => onDeleteRows(selectedRows.map(i => data[i]))}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20 animate-in fade-in active:scale-95"
                            >
                                <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" /> Drop ({selectedRows.length})
                            </button>
                        )}
                        {sensitiveColumns.size > 0 && (
                            <button
                                onClick={() => { setMaskingEnabled(m => !m); setRevealedCells(new Set()); }}
                                className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border active:scale-95",
                                    maskingEnabled
                                        ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border-amber-500/20"
                                        : "bg-muted/50 hover:bg-muted text-muted-foreground border-border/50"
                                )}
                                title={maskingEnabled ? `Masking ON — ${sensitiveColumns.size} sensitive column(s) protected` : 'Masking OFF — data exposed'}
                            >
                                {maskingEnabled ? <EyeOff className="w-3 h-3 md:w-3.5 md:h-3.5" /> : <Eye className="w-3 h-3 md:w-3.5 md:h-3.5" />}
                                {maskingEnabled ? `Masked` : 'Unmasked'}
                            </button>
                        )}
                    </div>

                    <div className="hidden md:block h-4 w-px bg-border mx-2" />

                    <div className="flex flex-row items-center gap-3 w-full md:w-auto justify-between md:justify-start border-t border-border/10 md:border-0 pt-2 md:pt-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase tracking-wider opacity-60">P. {page}</span>
                            <div className="hidden sm:block h-3 w-px bg-border/50" />
                            <span className="text-[9px] md:text-[10px] font-black text-muted-foreground uppercase opacity-40 whitespace-nowrap">{data.length} / {totalRows || '?'} r</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                className="bg-muted/50 border border-border/50 rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-accent font-bold"
                            >
                                {[50, 100, 200, 500].map(size => (
                                    <option key={size} value={size}>{size} / page</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-center gap-1 border-t border-border/10 md:border-0 pt-2 md:pt-0 self-center">
                    <button onClick={() => onPageChange(1)} disabled={page === 1} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all active:scale-90">
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all active:scale-90">
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 mx-1">
                        {[...Array(Math.min(5, Math.ceil((totalRows || 0) / pageSize) || 1))].map((_, i) => {
                            const totalPages = Math.ceil((totalRows || 0) / pageSize) || 1;
                            let p = page;

                            // Better stable pagination logic
                            if (totalPages <= 5) {
                                p = i + 1;
                            } else {
                                if (page <= 3) p = i + 1;
                                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                                else p = page - 2 + i;
                            }

                            if (p > totalPages || p < 1) return null;

                            return (
                                <button
                                    key={i}
                                    onClick={() => onPageChange(p)}
                                    className={cn(
                                        "w-8 h-8 rounded-lg text-[10px] font-black uppercase transition-all active:scale-90",
                                        page === p ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20 border border-accent/20" : "hover:bg-muted text-muted-foreground border border-transparent"
                                    )}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>

                    <button onClick={() => onPageChange(page + 1)} disabled={data.length < pageSize} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all active:scale-90">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(Math.ceil((totalRows || 0) / pageSize) || page + 1)} disabled={!totalRows || page >= Math.ceil(totalRows / pageSize)} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all active:scale-90">
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div >
    );
}
