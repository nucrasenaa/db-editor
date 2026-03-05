'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Loader2, ArrowRight, CornerDownLeft, ShieldCheck, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';
import { analyzeQuerySafety } from '@/lib/ai-utils';

interface AICopilotProps {
    onClose: () => void;
    onGenerated: (sql: string) => void;
    metadata: any;
    config: any;
}

export default function AICopilot({ onClose, onGenerated, metadata, config }: AICopilotProps) {
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [aiConfig, setAiConfig] = useState<any>(null);
    const [generatedSql, setGeneratedSql] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const saved = localStorage.getItem('ai_config');
        if (saved) {
            setAiConfig(JSON.parse(saved));
        }
        inputRef.current?.focus();
    }, []);

    const handleGenerate = async () => {
        if (!prompt.trim() || !aiConfig) return;

        setLoading(true);
        setError(null);
        try {
            const res = await apiRequest('/api/ai/generate', 'POST', {
                prompt,
                schema: metadata,
                config: aiConfig,
                dbType: config?.dbType || 'mssql'
            });

            if (res.success && res.sql) {
                setGeneratedSql(res.sql);
            } else {
                setError(res.message || 'Failed to generate SQL.');
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred during generation.');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = (execute: boolean) => {
        if (generatedSql) {
            onGenerated(generatedSql);
            if (execute) {
                // In a real app, we might fire an event or use a callback to run it immediately
                setTimeout(() => {
                    const event = new CustomEvent('execute-generated-sql');
                    window.dispatchEvent(event);
                }, 100);
            }
            onClose();
        }
    };

    if (!aiConfig) {
        return (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[500px] z-50 bg-card border border-border rounded-2xl p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
                <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-red-500/10 rounded-xl text-red-400">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">AI Configuration Missing</h3>
                        <p className="text-[11px] text-muted-foreground mt-1">Please configure an AI provider in the AI Forge tab first.</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="w-full py-2 bg-muted hover:bg-muted/80 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                    Dismiss
                </button>
            </div>
        );
    }

    const safety = generatedSql ? analyzeQuerySafety(generatedSql) : null;

    return (
        <div className={cn(
            "absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur-xl border border-purple-500/30 rounded-2xl p-2 shadow-2xl animate-in fade-in duration-200",
            generatedSql ? "w-[700px] slide-in-from-top-2" : "w-[600px] slide-in-from-top-4"
        )}>
            {!generatedSql ? (
                <div className="flex items-center gap-3 px-3 py-2">
                    <div className="relative">
                        <div className="absolute -inset-1 bg-purple-500/20 rounded-lg blur-sm animate-pulse" />
                        <Sparkles className="relative w-5 h-5 text-purple-400" />
                    </div>

                    <input
                        ref={inputRef}
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleGenerate();
                            if (e.key === 'Escape') onClose();
                        }}
                        placeholder="Describe what you want to forge... (e.g. Find users who ordered last month)"
                        className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium placeholder:text-muted-foreground/50 py-2"
                    />

                    <div className="flex items-center gap-2">
                        {loading ? (
                            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                        ) : (
                            <button
                                onClick={handleGenerate}
                                disabled={!prompt.trim()}
                                className="p-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-30 rounded-lg text-white transition-all shadow-lg shadow-purple-500/20"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="p-4 space-y-4 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center justify-between border-b border-border/20 pb-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className={cn("w-4 h-4", safety?.isSafe ? "text-emerald-400" : "text-amber-400")} />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Review Generated SQL</h3>
                        </div>
                        <button onClick={() => setGeneratedSql(null)} className="text-[10px] font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors">← Back to Prompt</button>
                    </div>

                    <div className="bg-muted/30 border border-border/50 rounded-xl p-4 max-h-[300px] overflow-auto custom-scrollbar">
                        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap leading-relaxed">
                            {generatedSql}
                        </pre>
                    </div>

                    {!safety?.isSafe && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                            <p className="text-[11px] text-amber-400/80 font-bold leading-relaxed">
                                This query performs a <span className="text-amber-500 underline font-black">{safety?.type}</span> operation. Please review carefully before executing.
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => handleAction(false)}
                            className="px-6 py-2 border border-purple-500/30 hover:bg-purple-500/5 text-purple-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                        >
                            Insert to Editor
                        </button>
                        <button
                            onClick={() => handleAction(true)}
                            className={cn(
                                "px-8 py-2 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg",
                                safety?.isSafe
                                    ? "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/20"
                                    : "bg-purple-500 hover:bg-purple-600 shadow-purple-500/20"
                            )}
                        >
                            Insert & Execute
                        </button>
                    </div>
                </div>
            )}

            {!generatedSql && (
                <div className="px-4 py-2 border-t border-border/20 flex items-center justify-between">
                    {error ? (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 animate-in fade-in slide-in-from-left-2">
                            <AlertCircle className="w-3 h-3" />
                            {error}
                        </div>
                    ) : (
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                                <CornerDownLeft className="w-2.5 h-2.5" /> press Enter to generate
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-500/50">
                                <ShieldCheck className="w-3 h-3 text-emerald-500/40" /> Safety: {aiConfig.safetyPolicy || 'Strict'} mode active
                            </div>
                        </div>
                    )}
                    <div className="text-[9px] font-black uppercase tracking-widest text-purple-500/40">
                        POWERED BY {aiConfig.provider}
                    </div>
                </div>
            )}
        </div>
    );
}
