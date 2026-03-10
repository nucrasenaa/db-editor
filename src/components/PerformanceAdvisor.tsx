'use client';

import React, { useState, useEffect } from 'react';
import {
    Zap,
    TrendingUp,
    AlertTriangle,
    Search,
    Sparkles,
    Loader2,
    ArrowRight,
    Database,
    Clock,
    Activity,
    Info,
    RefreshCw,
    CheckCircle2,
    XCircle,
    Copy,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { cn, decryptValue } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface PerformanceAdvisorProps {
    config: any;
    onClose: () => void;
}

export default function PerformanceAdvisor({ config, onClose }: PerformanceAdvisorProps) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState<string | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiRequest('/api/db/performance', 'POST', config);
            if (res.success) {
                setData(res.data);
            } else {
                setError(res.message);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect to performance engine');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [config]);

    const handleAIExplain = async (id: string, context: any, type: 'index' | 'query') => {
        const savedConfig = localStorage.getItem('ai_config');
        if (!savedConfig) {
            alert('Please configure AI in settings first.');
            return;
        }

        setAnalyzing(id);
        try {
            const parsedConfig = JSON.parse(savedConfig);
            const decryptedKey = await decryptValue(parsedConfig.apiKey);
            const activeConfig = { ...parsedConfig, apiKey: decryptedKey };

            const prompt = type === 'index'
                ? `Analyze this missing index recommendation and explain the benefit. Suggest the SQL CREATE INDEX script. DATA: ${JSON.stringify(context)}`
                : `Analyze this expensive query and suggest optimizations. QUERY: ${context.query_text}\nSTATS: ${JSON.stringify(context)}`;

            const res = await apiRequest('/api/ai/generate', 'POST', {
                prompt,
                schema: null,
                config: activeConfig,
                dbType: config.dbType
            });

            if (res.success) {
                setAiAnalysis(prev => ({ ...prev, [id]: res.sql }));
            }
        } catch (err) {
            console.error(err);
        } finally {
            setAnalyzing(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        // Could add a toast here
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-background/50 backdrop-blur-md">
                <div className="relative">
                    <div className="w-20 h-20 border-4 border-accent/10 border-t-accent rounded-full animate-spin" />
                    <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-accent animate-pulse" />
                </div>
                <p className="mt-6 text-sm font-black uppercase tracking-[0.3em] text-muted-foreground animate-pulse">Scanning Engine Health...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-background/50">
                <div className="max-w-md w-full bg-red-500/5 border border-red-500/20 rounded-3xl p-8 text-center space-y-4">
                    <XCircle className="w-12 h-12 text-red-500 mx-auto" />
                    <h3 className="text-lg font-black uppercase tracking-widest text-red-500">Engine Offline</h3>
                    <p className="text-xs text-red-400/70 leading-relaxed font-bold">{error}</p>
                    <button onClick={fetchData} className="px-8 py-3 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-red-600 shadow-xl shadow-red-500/20">Retry Diagnostic</button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background overflow-hidden relative">
            {/* Header */}
            <header className="h-16 border-b border-border bg-card/30 flex items-center px-8 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-accent/10 rounded-xl text-accent border border-accent/20">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-[0.2em] leading-none mb-1">Performance Advisor</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Deep Performance Analysis Engine</span>
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] text-emerald-500/70 font-black uppercase tracking-widest">Optimized for {config.dbType?.toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchData}
                        className="p-2.5 hover:bg-muted rounded-xl transition-all text-muted-foreground hover:text-accent group"
                        title="Refresh Diagnostic"
                    >
                        <RefreshCw className="w-4 h-4 group-active:rotate-180 transition-transform duration-500" />
                    </button>
                </div>
            </header>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="max-w-6xl mx-auto p-10 space-y-12">

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="w-24 h-24 text-emerald-500" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">Missing Indexes</h4>
                            <div className="text-3xl font-black tracking-tighter text-emerald-400">{data?.missingIndexes?.length || 0}</div>
                            <p className="text-[10px] font-bold text-emerald-300/40 uppercase tracking-widest">Potential Impact Boost Detected</p>
                        </div>

                        <div className="bg-orange-500/5 border border-orange-500/10 rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                                <Activity className="w-24 h-24 text-orange-500" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-orange-500/60">Expensive Queries</h4>
                            <div className="text-3xl font-black tracking-tighter text-orange-400">{data?.expensiveQueries?.length || 0}</div>
                            <p className="text-[10px] font-bold text-orange-300/40 uppercase tracking-widest">High Consumption Hotspots</p>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-3xl p-6 space-y-3 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                            <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                                <Database className="w-24 h-24 text-blue-500" />
                            </div>
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500/60">Engine Load</h4>
                            <div className="text-3xl font-black tracking-tighter text-blue-400">Normal</div>
                            <p className="text-[10px] font-bold text-blue-300/40 uppercase tracking-widest">Capacity & Resource Health</p>
                        </div>
                    </div>

                    {/* Missing Indexes Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                <Zap className="w-4 h-4" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tighter border-b-2 border-emerald-500/20 pb-1">Index Recommendations</h3>
                        </div>

                        {data?.missingIndexes?.length > 0 ? (
                            <div className="grid grid-cols-1 gap-4">
                                {data.missingIndexes.map((item: any, idx: number) => {
                                    const id = `index-${idx}`;
                                    const isExpanded = expandedIndex === idx;
                                    const impact = Math.round(item.avg_user_impact || 0);

                                    return (
                                        <div key={id} className={cn(
                                            "bg-card/30 border rounded-3xl overflow-hidden transition-all duration-300",
                                            isExpanded ? "border-emerald-500/30 shadow-2xl shadow-emerald-500/5" : "border-border/50 hover:border-border"
                                        )}>
                                            <div
                                                className="p-6 flex items-center justify-between cursor-pointer"
                                                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                                            >
                                                <div className="flex-1 flex items-center gap-6">
                                                    <div className="flex flex-col items-center justify-center w-16 h-16 bg-muted/30 rounded-2xl border border-border/50 shrink-0">
                                                        <span className="text-[8px] font-black uppercase text-muted-foreground/60 leading-none mb-1">Impact</span>
                                                        <span className={cn(
                                                            "text-xl font-black tracking-tighter",
                                                            impact > 80 ? "text-emerald-400" : impact > 50 ? "text-amber-400" : "text-blue-400"
                                                        )}>{impact}%</span>
                                                    </div>
                                                    <div className="space-y-1 min-w-0">
                                                        <h4 className="text-sm font-bold truncate text-foreground/90">{item.table_name || 'System Table'}</h4>
                                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground font-mono font-bold uppercase tracking-widest">
                                                            <span>Seeks: {item.user_seeks?.toLocaleString()}</span>
                                                            <div className="w-1 h-1 rounded-full bg-border" />
                                                            <span>Scans: {item.user_scans?.toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {!aiAnalysis[id] && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleAIExplain(id, item, 'index'); }}
                                                            disabled={analyzing === id}
                                                            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-500/10 flex items-center gap-2"
                                                        >
                                                            {analyzing === id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                                            Advisor
                                                        </button>
                                                    )}
                                                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="px-6 pb-6 pt-2 border-t border-border/10 animate-in slide-in-from-top-2 duration-300">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                        <div className="space-y-6">
                                                            <div className="space-y-4">
                                                                <h5 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Definition Details</h5>
                                                                <div className="space-y-3">
                                                                    <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-4">
                                                                        <div className="w-10 text-[9px] font-black uppercase text-accent/60 shrink-0">Cols</div>
                                                                        <div className="text-xs font-mono font-bold text-accent break-all">{item.equality_columns || 'N/A'} {item.inequality_columns}</div>
                                                                    </div>
                                                                    <div className="p-4 bg-muted/20 border border-border/50 rounded-2xl flex items-center gap-4">
                                                                        <div className="w-10 text-[9px] font-black uppercase text-emerald-500/60 shrink-0">Include</div>
                                                                        <div className="text-xs font-mono font-bold text-emerald-400 break-all">{item.included_columns || 'N/A'}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {aiAnalysis[id] ? (
                                                            <div className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-6 relative group">
                                                                <div className="absolute top-4 right-6 flex items-center gap-2">
                                                                    <Sparkles className="w-3 h-3 text-purple-400" />
                                                                    <span className="text-[8px] font-black uppercase tracking-widest text-purple-400/60">AI Diagnostic</span>
                                                                </div>
                                                                <div className="prose prose-invert prose-sm max-w-none text-purple-100/90 text-[11px] leading-relaxed font-medium whitespace-pre-wrap">
                                                                    {aiAnalysis[id]}
                                                                </div>
                                                                <button
                                                                    onClick={() => copyToClipboard(aiAnalysis[id])}
                                                                    className="mt-4 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
                                                                >
                                                                    <Copy className="w-3 h-3" /> Copy Analysis
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border/50 rounded-3xl opacity-30">
                                                                <Sparkles className="w-8 h-8 mb-4" />
                                                                <p className="text-[10px] font-black uppercase tracking-widest">Click 'Advisor' for full AI analysis</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-12 border-2 border-dashed border-border/50 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                                <div>
                                    <h4 className="text-sm font-black uppercase tracking-widest">Schema Optimized</h4>
                                    <p className="text-xs font-bold">No High-impact missing indexes detected at this time.</p>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Expensive Queries Section */}
                    <section className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                                <Activity className="w-4 h-4" />
                            </div>
                            <h3 className="text-lg font-black uppercase tracking-tighter border-b-2 border-orange-500/20 pb-1">Performance Hotspots</h3>
                        </div>

                        <div className="bg-card/30 border border-border/50 rounded-3xl overflow-hidden glass">
                            <table className="w-full border-collapse text-left">
                                <thead>
                                    <tr className="bg-muted/30 border-b border-border">
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Query Signature</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground w-32">Exec Hits</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground w-32">Duration (ms)</th>
                                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground w-20"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {data?.expensiveQueries?.map((query: any, i: number) => {
                                        const id = `query-${i}`;
                                        return (
                                            <tr key={id} className="hover:bg-muted/10 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="max-w-md">
                                                        <div className="text-[11px] font-mono text-foreground/80 break-all line-clamp-2 bg-muted/20 p-2 rounded border border-border/30 group-hover:border-accent/30 transition-all">
                                                            {query.query_text}
                                                        </div>
                                                        <span className="mt-2 block text-[9px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                                                            Last Run: {new Date(query.last_execution_time).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-black tracking-tight">{query.execution_count?.toLocaleString()}</div>
                                                    <div className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest">In-Life Total</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-black tracking-tight text-orange-400">{Math.round(query.total_duration_ms)?.toLocaleString()}</div>
                                                    <div className="text-[9px] font-bold text-muted-foreground opacity-40 uppercase tracking-widest">Aggregated</div>
                                                </td>
                                                <td className="px-6 py-4 flex justify-end">
                                                    <button
                                                        onClick={() => handleAIExplain(id, query, 'query')}
                                                        disabled={analyzing === id}
                                                        className="p-2 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded-xl transition-all disabled:opacity-30"
                                                        title="AI Optimization Analysis"
                                                    >
                                                        {analyzing === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Query AI Result Render (Floating or at Bottom) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.keys(aiAnalysis).filter(k => k.startsWith('query-')).map(k => (
                                <div key={k} className="bg-purple-500/5 border border-purple-500/20 rounded-3xl p-6 relative animate-in zoom-in-95 duration-300">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">Optimization Advisor</span>
                                        </div>
                                        <button onClick={() => setAiAnalysis(prev => {
                                            const next = { ...prev };
                                            delete next[k];
                                            return next;
                                        })} className="text-muted-foreground/40 hover:text-muted-foreground">
                                            <ArrowRight className="w-3 h-3 rotate-45" />
                                        </button>
                                    </div>
                                    <div className="text-[11px] leading-relaxed text-purple-100/90 whitespace-pre-wrap font-sans font-medium mb-4">
                                        {aiAnalysis[k]}
                                    </div>
                                    <button
                                        onClick={() => copyToClipboard(aiAnalysis[k])}
                                        className="text-[9px] font-black uppercase tracking-widest text-accent hover:underline flex items-center gap-2"
                                    >
                                        <Copy className="w-3 h-3" /> Copy Full Suggestion
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>

            {/* Footer Stats */}
            <footer className="h-10 border-t border-border bg-muted/20 flex items-center px-8 justify-between shrink-0">
                <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">
                    <span className="flex items-center gap-1.5"><Info className="w-3 h-3" /> Results based on internal engine metrics</span>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <span>Scan Depth: Aggregated Execution Stats</span>
                </div>
            </footer>
        </div>
    );
}
