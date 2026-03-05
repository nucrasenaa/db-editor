'use client';

import React, { useMemo, useState } from 'react';
import { Network, Activity, Clock, Database, ChevronRight, ChevronDown, Table as TableIcon, Filter, Layers, Zap, Sparkles, Loader2, AlertCircle, X, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface PlanNode {
    id: number;
    parent: number;
    type: string;
    logicalOp: string;
    physicalOp: string;
    estimateRows: number;
    actualRows: number;
    actualExecutions: number;
    totalSubtreeCost: number;
    description: string;
    children: PlanNode[];
    level: number;
}

interface ExecutionPlanProps {
    data: any[];
    dialect: string;
}

export default function ExecutionPlan({ data, dialect }: ExecutionPlanProps) {
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(true);

    const planTree = useMemo(() => {
        // ... (existing planTree logic)
        if (!data || data.length === 0) return null;

        if (dialect === 'mssql') {
            const nodes: Record<number, PlanNode> = {};
            const rootNodes: PlanNode[] = [];
            const sortedData = [...data].sort((a, b) => (a.NodeId || 0) - (b.NodeId || 0));

            sortedData.forEach(row => {
                const node: PlanNode = {
                    id: row.NodeId,
                    parent: row.Parent,
                    type: row.PhysicalOp,
                    logicalOp: row.LogicalOp,
                    physicalOp: row.PhysicalOp,
                    estimateRows: row.EstimateRows,
                    actualRows: row.ActualRows,
                    actualExecutions: row.ActualExecutions || row.Executions || 1,
                    totalSubtreeCost: row.TotalSubtreeCost || 0,
                    description: row.Argument || '',
                    children: [],
                    level: 0
                };
                nodes[node.id] = node;
            });

            Object.values(nodes).forEach(node => {
                if (node.parent === 0) {
                    rootNodes.push(node);
                } else if (nodes[node.parent]) {
                    nodes[node.parent].children.push(node);
                }
            });

            return rootNodes;
        } else if (dialect === 'postgres') {
            const pgPlan = data[0]?.['Plan'];
            if (pgPlan) {
                const parsePgNode = (pgNode: any, id: number, parentId: number): PlanNode => {
                    const node: PlanNode = {
                        id,
                        parent: parentId,
                        type: pgNode['Node Type'],
                        logicalOp: pgNode['Strategy'] || pgNode['Node Type'],
                        physicalOp: pgNode['Node Type'],
                        estimateRows: pgNode['Plan Rows'],
                        actualRows: pgNode['Actual Rows'] || 0,
                        actualExecutions: pgNode['Actual Loops'] || 1,
                        totalSubtreeCost: pgNode['Total Cost'] / 100, // Normalized
                        description: pgNode['Alias'] ? `Table: ${pgNode['Alias']}` : '',
                        children: [],
                        level: 0
                    };

                    if (pgNode['Plans']) {
                        pgNode['Plans'].forEach((child: any, i: number) => {
                            node.children.push(parsePgNode(child, id * 10 + i + 1, id));
                        });
                    }
                    return node;
                };

                return [parsePgNode(pgPlan, 1, 0)];
            }
        }

        return null;
    }, [data, dialect]);

    const handleAIAnalysis = async () => {
        const aiConfig = localStorage.getItem('ai_config');
        if (!aiConfig) {
            setError('AI Configuration missing. Please set up a provider in AI Forge.');
            return;
        }

        setAnalyzing(true);
        setError(null);
        try {
            const res = await apiRequest('/api/ai/generate', 'POST', {
                prompt: `Explain this ${dialect} execution plan in plain English and suggest optimizations like missing indexes or expensive joins. PLAN DATA: ${JSON.stringify(data)}`,
                schema: null, // We don't need full schema for plan analysis
                config: JSON.parse(aiConfig),
                dbType: dialect
            });

            if (res.success && res.sql) {
                // The API returns 'sql' field, but it will be our analysis text
                setAnalysis(res.sql);
                setShowAnalysis(true);
            } else {
                setError(res.message || 'Failed to analyze plan.');
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred during analysis.');
        } finally {
            setAnalyzing(false);
        }
    };

    const renderNode = (node: PlanNode, index: number) => {
        const isExpensive = node.totalSubtreeCost > 0.5; // Arbitrary threshold
        const rowDiscrepancy = node.actualRows > node.estimateRows * 2 || node.actualRows < node.estimateRows / 2;

        return (
            <div key={`${node.id}-${index}`} className="ml-6 border-l border-border/30 pl-4 py-2 relative">
                <div className="absolute left-0 top-6 w-4 h-px bg-border/30" />

                <div className={cn(
                    "p-3 rounded-xl border bg-card/50 hover:bg-card transition-all group relative max-w-2xl",
                    isExpensive ? "border-orange-500/30 group-hover:border-orange-500/50" : "border-border/50"
                )}>
                    {isExpensive && (
                        <div className="absolute -top-2 -right-2 p-1 bg-orange-500 text-white rounded-md">
                            <Zap className="w-3 h-3 fill-current" />
                        </div>
                    )}

                    <div className="flex items-start gap-3">
                        <div className={cn(
                            "p-2 rounded-lg",
                            node.physicalOp.includes('Scan') ? "bg-blue-500/10 text-blue-400" :
                                node.physicalOp.includes('Seek') ? "bg-emerald-500/10 text-emerald-400" :
                                    node.physicalOp.includes('Join') ? "bg-purple-500/10 text-purple-400" : "bg-muted text-muted-foreground"
                        )}>
                            <Layers className="w-4 h-4" />
                        </div>

                        <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold uppercase tracking-wider">{node.physicalOp}</h4>
                                <span className="text-[10px] font-mono opacity-40">#{node.id}</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground font-medium">{node.logicalOp}</p>

                            {node.description && (
                                <div className="text-[10px] bg-muted/30 p-2 rounded border border-border/20 font-mono text-muted-foreground/80 break-all mt-2">
                                    {node.description}
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-border/10">
                                <div>
                                    <span className="block text-[9px] font-black uppercase text-muted-foreground/40">Cost</span>
                                    <span className="text-[11px] font-bold text-accent">{(node.totalSubtreeCost * 100).toFixed(2)}%</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase text-muted-foreground/40">Rows</span>
                                    <span className={cn(
                                        "text-[11px] font-bold",
                                        rowDiscrepancy ? "text-orange-400" : "text-foreground"
                                    )}>{node.actualRows.toLocaleString()}</span>
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black uppercase text-muted-foreground/40">Execs</span>
                                    <span className="text-[11px] font-bold">{node.actualExecutions.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {node.children.length > 0 && (
                    <div className="mt-2">
                        {node.children.map((child, i) => renderNode(child, i))}
                    </div>
                )}
            </div>
        );
    };

    if (!planTree) {
        return (
            <div className="flex-1 flex flex-col p-6 bg-card/20 rounded-xl border border-dashed border-border overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-accent/10 rounded-lg text-accent">
                                <Network className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold uppercase tracking-wider">Raw Execution Plan</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-black opacity-60">{dialect.toUpperCase()} ANALYSIS</p>
                            </div>
                        </div>
                        <button
                            onClick={handleAIAnalysis}
                            disabled={analyzing}
                            className="flex items-center gap-2 px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-500/20"
                        >
                            {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            {analysis ? 'Re-Analyze with AI' : 'Explain with AI'}
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 gap-6">
                    {analysis && showAnalysis && (
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-2xl overflow-hidden animate-in slide-in-from-top duration-500">
                            <div className="flex items-center justify-between px-6 py-3 bg-purple-500/20 border-b border-purple-500/20">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-300">AI Logic Forge Analysis</span>
                                </div>
                                <button onClick={() => setShowAnalysis(false)} className="text-purple-400 hover:text-purple-300">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="p-6 text-sm text-purple-100 leading-relaxed font-medium prose prose-invert max-w-none">
                                {analysis.split('\n').map((line, i) => (
                                    <p key={i} className="mb-2 last:mb-0">{line}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex-1 overflow-auto bg-card/50 rounded-lg border border-border/30 p-4 font-mono text-xs custom-scrollbar">
                        {data && data.length > 0 ? (
                            <pre className="text-emerald-400 leading-relaxed">
                                {JSON.stringify(data, null, 2)}
                            </pre>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full opacity-30 italic">
                                No execution plan data captured for this query.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto bg-background/50 custom-scrollbar relative">
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 p-6 flex items-center justify-between">
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-accent/10 rounded-xl text-accent border border-accent/20">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black uppercase tracking-[0.2em]">Live Execution Plan</h2>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Relational Flow Analysis</p>
                        </div>
                    </div>
                    <button
                        onClick={handleAIAnalysis}
                        disabled={analyzing}
                        className="flex items-center gap-2 px-6 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-500/20 h-fit"
                    >
                        {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {analysis ? 'Re-Analyze with AI' : 'Explain with AI'}
                    </button>
                </div>
                <div className="flex gap-4">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Visualizer Active</span>
                    </div>
                </div>
            </div>

            <div className="p-6">
                {/* AI Analysis Result */}
                {analysis && (
                    <div className="mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="bg-purple-500/5 border border-purple-500/20 rounded-2xl overflow-hidden shadow-xl shadow-purple-500/5">
                            <div
                                className="px-6 py-3 bg-purple-500/10 border-b border-purple-500/10 flex items-center justify-between cursor-pointer group"
                                onClick={() => setShowAnalysis(!showAnalysis)}
                            >
                                <div className="flex items-center gap-3">
                                    <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-purple-400">AI Optimization Intelligence</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="px-2 py-0.5 rounded-full bg-purple-500/20 text-[8px] font-bold text-purple-400 uppercase tracking-widest animate-pulse">
                                        Human Readable Report
                                    </div>
                                    {showAnalysis ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-purple-400" />}
                                </div>
                            </div>

                            {showAnalysis && (
                                <div className="p-6 space-y-4">
                                    <div className="text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap font-medium font-sans">
                                        {analysis}
                                    </div>
                                    <div className="flex items-center gap-2 pt-4 border-t border-purple-500/10 opacity-40">
                                        <AlertCircle className="w-3.5 h-3.5" />
                                        <p className="text-[9px] font-black uppercase tracking-widest">Always verify AI suggestions against production data distribution.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 animate-shake">
                        <AlertCircle className="w-5 h-5" />
                        <p className="text-xs font-bold uppercase tracking-widest">{error}</p>
                        <button onClick={() => setError(null)} className="ml-auto p-1 hover:bg-red-500/10 rounded"><X className="w-4 h-4" /></button>
                    </div>
                )}

                <div className="py-2">
                    {planTree.map((node, i) => renderNode(node, i))}
                </div>
            </div>
        </div>
    );
}

