'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { apiRequest } from '@/lib/api';
import { Loader2, ZoomIn, ZoomOut, Maximize, RotateCcw, Database, Table as TableIcon, Share2, Square, Hash, Key } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ERDiagramProps {
    config: any;
}

interface TableMetadata {
    Schema: string;
    Table: string;
    Column: string;
    Type: string;
    Nullable: boolean;
    PK: boolean;
    x?: number;
    y?: number;
}

interface Relationship {
    Table: string;
    Column: string;
    ReferencedTable: string;
    ReferencedColumn: string;
}

export default function ERDiagram({ config }: ERDiagramProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<{ tables: Record<string, TableMetadata[]>, relationships: Relationship[] }>({ tables: {}, relationships: [] });
    const [positions, setPositions] = useState<Record<string, { x: number, y: number }>>({});
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState<string | null>(null);
    const [panning, setPanning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const lastMousePos = useRef({ x: 0, y: 0 });

    const fetchERData = async () => {
        setLoading(true);
        try {
            const res = await apiRequest('/api/db/erd', 'POST', config);
            if (res.success) {
                const groupedTables: Record<string, TableMetadata[]> = {};
                res.tables.forEach((row: any) => {
                    // normalize names (handle case differences across dialects)
                    const schemaName = row.Schema || row.schema || 'dbo';
                    const tableName = row.Table || row.table || row.TABLE_NAME;
                    const colName = row.Column || row.column || row.COLUMN_NAME;
                    const typeName = row.Type || row.type || row.DATA_TYPE || 'unknown';
                    const isPK = row.PK || row.pk || row.is_primary_key || false;
                    const isNullable = row.Nullable || row.nullable || false;

                    const col: TableMetadata = {
                        Schema: schemaName,
                        Table: tableName,
                        Column: colName,
                        Type: typeName,
                        Nullable: !!isNullable,
                        PK: !!isPK
                    };

                    const key = `${schemaName}.${tableName}`;
                    if (!groupedTables[key]) groupedTables[key] = [];
                    groupedTables[key].push(col);
                });

                setData({ tables: groupedTables, relationships: res.relationships || [] });

                // Initial layout (Grid)
                const newPositions: Record<string, { x: number, y: number }> = {};
                const tableKeys = Object.keys(groupedTables);
                const cols = Math.ceil(Math.sqrt(tableKeys.length));
                tableKeys.forEach((key, i) => {
                    newPositions[key] = {
                        x: (i % cols) * 350 + 100,
                        y: Math.floor(i / cols) * 450 + 100
                    };
                });
                setPositions(newPositions);
            }
        } catch (err) {
            console.error('ERD Fetch Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchERData();
    }, [config]);

    const handleMouseDown = (e: React.MouseEvent, tableKey?: string) => {
        if (tableKey) {
            setDragging(tableKey);
        } else {
            setPanning(true);
        }
        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        const dx = (e.clientX - lastMousePos.current.x) / zoom;
        const dy = (e.clientY - lastMousePos.current.y) / zoom;

        if (dragging && positions[dragging]) {
            setPositions(prev => ({
                ...prev,
                [dragging]: { x: prev[dragging].x + dx, y: prev[dragging].y + dy }
            }));
        } else if (panning) {
            setPan(prev => ({ x: prev.x + dx * zoom, y: prev.y + dy * zoom }));
        }

        lastMousePos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
        setDragging(null);
        setPanning(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.min(Math.max(prev * delta, 0.2), 3));
    };

    const connections = useMemo(() => {
        return data.relationships.map((rel: any, i) => {
            const relSourceTable = rel.Table || rel.table;
            const relTargetTable = rel.ReferencedTable || rel.referencedTable;

            const sourceTable = Object.keys(data.tables).find(k => k.toLowerCase().endsWith(`.${relSourceTable?.toLowerCase()}`) || k.toLowerCase() === relSourceTable?.toLowerCase());
            const targetTable = Object.keys(data.tables).find(k => k.toLowerCase().endsWith(`.${relTargetTable?.toLowerCase()}`) || k.toLowerCase() === relTargetTable?.toLowerCase());

            if (!sourceTable || !targetTable || !positions[sourceTable] || !positions[targetTable]) return null;

            const start = {
                x: positions[sourceTable].x + 250,
                y: positions[sourceTable].y + 50
            };
            const end = {
                x: positions[targetTable].x,
                y: positions[targetTable].y + 50
            };

            const cp1x = start.x + Math.abs(end.x - start.x) * 0.5;
            const cp2x = end.x - Math.abs(end.x - start.x) * 0.5;

            return (
                <path
                    key={i}
                    d={`M ${start.x} ${start.y} C ${cp1x} ${start.y}, ${cp2x} ${end.y}, ${end.x} ${end.y}`}
                    stroke="rgba(59, 130, 246, 0.4)"
                    strokeWidth="2"
                    fill="none"
                    className="transition-all hover:stroke-accent hover:stroke-[3px]"
                />
            );
        });
    }, [data, positions, zoom]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-background/50 backdrop-blur-xl">
                <Loader2 className="w-8 h-8 animate-spin text-accent mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Architecting Diagram...</p>
            </div>
        );
    }

    const tableKeys = Object.keys(data.tables);

    return (
        <div
            className="flex-1 flex flex-col overflow-hidden bg-[#050505] relative select-none"
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
        >
            {/* Toolbar */}
            <div className="absolute top-6 left-6 z-20 flex flex-col gap-2">
                <div className="bg-card/80 backdrop-blur-xl border border-border p-1.5 rounded-2xl shadow-2xl flex flex-col gap-1">
                    <button onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))} className="p-2 hover:bg-white/5 rounded-xl transition-all text-muted-foreground hover:text-foreground">
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button onClick={() => setZoom(prev => Math.max(prev * 0.8, 0.2))} className="p-2 hover:bg-white/5 rounded-xl transition-all text-muted-foreground hover:text-foreground">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <div className="h-px bg-border mx-2" />
                    <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="p-2 hover:bg-white/5 rounded-xl transition-all text-muted-foreground hover:text-foreground">
                        <RotateCcw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="absolute top-6 right-6 z-20">
                <div className="bg-card/80 backdrop-blur-xl border border-border px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-3">
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">Canvas Status</span>
                        <span className="text-[10px] font-mono font-bold text-emerald-400">ACTIVE ENGINE</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
            </div>

            {/* Canvas or Empty State */}
            {tableKeys.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                    <div className="w-24 h-24 rounded-full bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
                        <Share2 className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                    <div className="text-center space-y-2">
                        <h3 className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground/80">No Schema Detected</h3>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-widest">The architect found no tables in the current context.</p>
                    </div>
                    <button
                        onClick={fetchERData}
                        className="px-6 py-2 bg-accent/10 border border-accent/20 rounded-xl text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
                    >
                        Re-scan Schema
                    </button>
                </div>
            ) : (
                <div
                    ref={containerRef}
                    className="flex-1 cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => handleMouseDown(e)}
                    style={{
                        backgroundImage: 'radial-gradient(circle, #ffffff05 1px, transparent 1px)',
                        backgroundSize: `${32 * zoom}px ${32 * zoom}px`,
                        backgroundPosition: `${pan.x}px ${pan.y}px`
                    }}
                >
                    <div
                        style={{
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: '0 0',
                        }}
                    >
                        <svg className="absolute inset-0 pointer-events-none" style={{ width: '10000px', height: '10000px' }}>
                            {connections}
                        </svg>

                        {Object.entries(data.tables).map(([tableKey, columns]) => (
                            <div
                                key={tableKey}
                                className={cn(
                                    "absolute w-[250px] bg-card/90 backdrop-blur-md border border-border rounded-2xl shadow-2xl transition-shadow group",
                                    dragging === tableKey && "ring-2 ring-accent/50 z-50",
                                    !dragging && "hover:ring-1 hover:ring-white/10"
                                )}
                                style={{
                                    left: positions[tableKey]?.x || 0,
                                    top: positions[tableKey]?.y || 0,
                                }}
                                onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(e, tableKey); }}
                            >
                                {/* Table Header */}
                                <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-accent/5 to-transparent rounded-t-2xl flex items-center gap-2">
                                    <TableIcon className="w-3.5 h-3.5 text-accent" />
                                    <div className="flex-1 flex flex-col min-w-0">
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none">{columns[0].Schema}</span>
                                        <span className="text-[11px] font-black uppercase tracking-[0.1em] truncate text-foreground">{columns[0].Table}</span>
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full bg-white/10 group-hover:bg-accent/50 transition-colors" />
                                </div>

                                {/* Columns */}
                                <div className="py-2">
                                    {columns.map((col, idx) => (
                                        <div key={idx} className="px-4 py-1.5 flex items-center gap-2 hover:bg-white/5 transition-colors relative group/row">
                                            {col.PK ? (
                                                <Key className="w-2.5 h-2.5 text-amber-500 shrink-0" />
                                            ) : (
                                                <div className="w-2.5 h-2.5 border border-white/20 rounded-sm shrink-0" />
                                            )}
                                            <span className={cn(
                                                "text-[10px] font-medium flex-1 truncate",
                                                col.PK ? "text-amber-200/90" : "text-muted-foreground/90 group-hover/row:text-foreground"
                                            )}>
                                                {col.Column}
                                            </span>
                                            <span className="text-[8px] font-mono text-muted-foreground/40 group-hover/row:text-muted-foreground/60 transition-colors">
                                                {col.Type.toLowerCase()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-6 px-4 py-2 bg-card/50 backdrop-blur-xl border border-border rounded-xl text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                <div className="flex items-center gap-2"><Key className="w-3 h-3 text-amber-500" /> Primary Key</div>
                <div className="flex items-center gap-2"><div className="w-3 h-0.5 bg-blue-500/40" /> Relationship</div>
                <div className="flex items-center gap-2"><RotateCcw className="w-3 h-3" /> Draggable Canvas</div>
            </div>
        </div>
    );
}
