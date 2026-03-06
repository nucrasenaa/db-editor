'use client';

import React, { useState, useMemo } from 'react';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { BarChart as BarChartIcon, LineChart as LineChartIcon, PieChart as PieChartIcon, Settings2, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataVisualizationProps {
    data: any[];
    columns: string[];
    hideControls?: boolean;
    defaultChartType?: 'bar' | 'line' | 'pie';
    defaultXAxis?: string;
    defaultYAxis?: string;
    onSaveToDashboard?: (config: { chartType: 'bar' | 'line' | 'pie', xAxisCol: string, yAxisCol: string }) => void;
}

const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export default function DataVisualization({
    data,
    columns,
    hideControls = false,
    defaultChartType = 'bar',
    defaultXAxis,
    defaultYAxis,
    onSaveToDashboard
}: DataVisualizationProps) {
    const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>(defaultChartType);
    const [xAxisCol, setXAxisCol] = useState<string>(defaultXAxis || columns[0] || '');
    const [yAxisCol, setYAxisCol] = useState<string>(defaultYAxis || (columns.length > 1 ? columns[1] : columns[0] || ''));

    // Prepare data (convert string numbers to actual numbers for Y axis)
    const chartData = useMemo(() => {
        return data.slice(0, 50).map(row => { // Limit to 50 for performance and readability
            const item: any = { ...row };
            if (yAxisCol && item[yAxisCol] !== undefined && item[yAxisCol] !== null) {
                const val = Number(item[yAxisCol]);
                item[yAxisCol] = isNaN(val) ? 0 : val;
            }
            return item;
        });
    }, [data, yAxisCol]);

    if (!data || data.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center text-muted-foreground p-8">
                No data available for visualization
            </div>
        );
    }

    const renderChart = () => {
        if (!xAxisCol || !yAxisCol) return <div className="p-4 text-muted-foreground">Please select X and Y axes</div>;

        switch (chartType) {
            case 'bar':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey={xAxisCol} stroke="#666" tick={{ fill: '#888', fontSize: 12 }} angle={-45} textAnchor="end" />
                            <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Bar dataKey={yAxisCol} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                );
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis dataKey={xAxisCol} stroke="#666" tick={{ fill: '#888', fontSize: 12 }} angle={-45} textAnchor="end" />
                            <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line type="monotone" dataKey={yAxisCol} stroke={COLORS[1]} strokeWidth={3} dot={{ r: 4, fill: COLORS[1] }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                );
            case 'pie':
                return (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip
                                contentStyle={{ backgroundColor: 'rgba(0,0,0,0.8)', border: '1px solid #333', borderRadius: '8px' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Pie
                                data={chartData}
                                dataKey={yAxisCol}
                                nameKey={xAxisCol}
                                cx="50%"
                                cy="50%"
                                outerRadius={150}
                                innerRadius={60}
                                paddingAngle={2}
                                label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                labelLine={false}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                );
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-card/5 border border-border rounded-xl overflow-hidden min-h-0">
            {!hideControls && (
                <div className="h-14 border-b border-border bg-muted/20 flex flex-col md:flex-row md:items-center px-4 md:px-6 py-2 md:py-0 gap-4 shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/50">
                            <button
                                onClick={() => setChartType('bar')}
                                className={cn("p-1.5 rounded-md transition-all", chartType === 'bar' ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}
                                title="Bar Chart"
                            >
                                <BarChartIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setChartType('line')}
                                className={cn("p-1.5 rounded-md transition-all", chartType === 'line' ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}
                                title="Line Chart"
                            >
                                <LineChartIcon className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setChartType('pie')}
                                className={cn("p-1.5 rounded-md transition-all", chartType === 'pie' ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}
                                title="Pie Chart"
                            >
                                <PieChartIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="hidden md:block h-6 w-px bg-border/50" />

                    <div className="flex flex-1 items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">X-Axis (Label):</span>
                            <select
                                value={xAxisCol}
                                onChange={(e) => setXAxisCol(e.target.value)}
                                className="bg-muted border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent max-w-[150px]"
                            >
                                {columns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Y-Axis (Value):</span>
                            <select
                                value={yAxisCol}
                                onChange={(e) => setYAxisCol(e.target.value)}
                                className="bg-muted border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent max-w-[150px]"
                            >
                                {columns.map(col => <option key={col} value={col}>{col}</option>)}
                            </select>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            {onSaveToDashboard && (
                                <button
                                    onClick={() => onSaveToDashboard({ chartType, xAxisCol, yAxisCol })}
                                    className="text-[10px] font-black hover:text-orange-400 uppercase tracking-widest bg-orange-400/5 hover:bg-orange-400/10 text-orange-400/70 px-3 py-1.5 rounded-lg border border-orange-400/20 transition-all flex items-center gap-1.5"
                                >
                                    <LayoutDashboard className="w-3.5 h-3.5" />
                                    Save to Dash
                                </button>
                            )}
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-accent/10 text-accent px-3 py-1.5 rounded-lg border border-accent/20 flex items-center gap-2">
                                <Settings2 className="w-3.5 h-3.5" />
                                <span>Top 50 Rows</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className={cn("flex-1 p-4 min-h-0 bg-gradient-to-br from-card/30 to-background", hideControls && "p-0")}>
                {renderChart()}
            </div>
        </div>
    );
}
