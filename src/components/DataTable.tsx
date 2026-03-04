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
    Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
    const inputRef = useRef<HTMLInputElement>(null);

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
        <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-auto rounded-t-xl border border-border bg-card/10 custom-scrollbar">
                <table className="w-full min-w-max text-sm text-left border-collapse">
                    <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10 border-b border-border">
                        <tr>
                            <th className="w-12 px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-border/50 bg-muted/50">
                                #
                            </th>
                            {columns.map((col) => (
                                <th
                                    key={col}
                                    onClick={() => onSort(col)}
                                    className="px-4 py-3 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap border-r border-border/50 last:border-r-0 cursor-pointer hover:bg-muted transition-colors group min-w-[120px] max-w-[400px]"
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
                                                    <button onClick={handleSave} disabled={isSaving} className="p-1 text-green-500 hover:bg-green-500/10 rounded">
                                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    </button>
                                                    <button onClick={handleCancelEdit} disabled={isSaving} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
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

            <div className="h-14 border border-t-0 border-border bg-muted/20 rounded-b-xl flex items-center justify-between px-6 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                        Showing <span className="text-foreground font-medium">{data.length}</span> rows
                    </span>
                    <div className="h-4 w-px bg-border" />
                    <span className="text-xs text-muted-foreground">
                        Page <span className="text-foreground font-medium">{page}</span>
                    </span>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Rows per page:</span>
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

                <div className="flex items-center gap-1">
                    <button onClick={() => onPageChange(1)} disabled={page === 1} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all">
                        <ChevronsLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(page - 1)} disabled={page === 1} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all mr-2">
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="flex items-center gap-1 mx-2">
                        {[...Array(Math.min(5, Math.ceil((totalRows || 0) / pageSize) || 5))].map((_, i) => {
                            const p = page > 3 ? page - 2 + i : i + 1;
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

                    <button onClick={() => onPageChange(page + 1)} disabled={data.length < pageSize} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all ml-2">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => onPageChange(page + 5)} disabled={data.length < pageSize} className="p-1.5 hover:bg-muted disabled:opacity-30 rounded-md transition-all">
                        <ChevronsRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
