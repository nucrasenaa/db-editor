'use client';

import React, { useState, useEffect } from 'react';
import { X, LayoutDashboard, Plus, Settings, Trash2, Save, BarChart3, LineChart, PieChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import DataVisualization from './DataVisualization';

interface DashboardItem {
    id: string;
    title: string;
    sourceTabId: string;
    sourceTabName: string;
    chartType: 'bar' | 'line' | 'pie';
    xAxisCol: string;
    yAxisCol: string;
    data: any[];
    columns: string[];
}

interface MiniDashboardsProps {
    onClose: () => void;
    savedDashboards?: DashboardItem[];
}

export default function MiniDashboards({ onClose, savedDashboards = [] }: MiniDashboardsProps) {
    const [items, setItems] = useState<DashboardItem[]>([]);

    // Load from local storage or passed props
    useEffect(() => {
        const saved = localStorage.getItem('forge_dashboards');
        if (saved) {
            try {
                setItems(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse saved dashboards", e);
            }
        } else if (savedDashboards && savedDashboards.length > 0) {
            setItems(savedDashboards);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveDashboards = (newItems: DashboardItem[]) => {
        setItems(newItems);
        localStorage.setItem('forge_dashboards', JSON.stringify(newItems));
    };

    const removeItem = (id: string) => {
        if (confirm("Remove this chart from dashboard?")) {
            saveDashboards(items.filter(item => item.id !== id));
        }
    };

    const clearAll = () => {
        if (confirm("Clear all items from your mini dashboard?")) {
            saveDashboards([]);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden">
            {/* Header */}
            <div className="h-14 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center px-4 md:px-6 py-2 md:py-0 gap-4 shrink-0 shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-400 bg-orange-400/10 px-3 py-1.5 rounded-lg border border-orange-400/20">
                        <LayoutDashboard className="w-4 h-4" />
                        <span>Mini Dashboards</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter hidden md:inline-block">
                        {items.length} SAVED CHARTS
                    </span>
                </div>

                <div className="hidden md:block h-6 w-px bg-border/50" />

                <div className="flex flex-1 items-center justify-end gap-2">
                    {items.length > 0 && (
                        <button
                            onClick={clearAll}
                            className="px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all text-red-400 hover:bg-red-400/10 hover:text-red-500 flex items-center gap-2"
                        >
                            <Trash2 className="w-3.5 h-3.5" /> Clear All
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground ml-2"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar bg-gradient-to-br from-card/30 to-background grid auto-rows-[400px] grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {items.length === 0 ? (
                    <div className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center p-12 text-center text-muted-foreground/60 h-[50vh]">
                        <div className="w-24 h-24 mb-6 rounded-3xl bg-orange-500/5 flex items-center justify-center border border-orange-500/10">
                            <LayoutDashboard className="w-12 h-12 text-orange-400 opacity-50" />
                        </div>
                        <h3 className="text-xl font-bold uppercase tracking-widest text-foreground/80 mb-2">No Saved Dashboards</h3>
                        <p className="max-w-md text-sm leading-relaxed text-muted-foreground/60">
                            You haven't saved any charts yet. To add items here, go to any Query or Table tab, switch to the Chart view, and click the "Save to Dashboard" button.
                        </p>
                    </div>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="bg-card/40 border border-border rounded-2xl flex flex-col overflow-hidden hover:border-accent/40 hover:shadow-xl hover:shadow-black/20 transition-all group">
                            <div className="h-12 border-b border-border/50 bg-muted/20 flex items-center justify-between px-4 shrink-0">
                                <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground truncate max-w-[80%] uppercase tracking-wider">
                                    {item.chartType === 'bar' && <BarChart3 className="w-3.5 h-3.5 shrink-0 text-accent opacity-70" />}
                                    {item.chartType === 'line' && <LineChart className="w-3.5 h-3.5 shrink-0 text-accent opacity-70" />}
                                    {item.chartType === 'pie' && <PieChart className="w-3.5 h-3.5 shrink-0 text-accent opacity-70" />}
                                    <span className="truncate">{item.title}</span>
                                </div>
                                <button
                                    onClick={() => removeItem(item.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 text-red-400 rounded-md transition-all"
                                    title="Remove from Dashboard"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                            <div className="flex-1 p-2 min-h-0 relative pointer-events-none">
                                {/* Pointer events none so it acts as a display-only dashboard, or remove if interaction is wanted */}
                                <DataVisualization
                                    data={item.data}
                                    columns={item.columns}
                                    defaultChartType={item.chartType}
                                    defaultXAxis={item.xAxisCol}
                                    defaultYAxis={item.yAxisCol}
                                    hideControls={true}
                                />
                            </div>
                            <div className="h-8 border-t border-border/20 bg-muted/10 flex items-center px-4 shrink-0 text-[9px] font-mono text-muted-foreground/50 uppercase tracking-widest">
                                Source: {item.sourceTabName.substring(0, 30)}...
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
