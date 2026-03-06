'use client';

import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, Info, X, ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { LintIssue, LintSeverity } from '@/lib/sqlLinter';
import { cn } from '@/lib/utils';

interface SQLLintPanelProps {
    issues: LintIssue[];
    onGoToLine?: (line: number, col: number) => void;
}

const SEVERITY_CONFIG: Record<LintSeverity, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10 border-red-500/20', label: 'Error' },
    warning: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Warning' },
    info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Info' },
};

export default function SQLLintPanel({ issues, onGoToLine }: SQLLintPanelProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

    if (issues.length === 0) return null;

    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const infos = issues.filter(i => i.severity === 'info').length;

    return (
        <div className={cn(
            'border-t border-border bg-card/50 backdrop-blur-sm shrink-0 transition-all duration-200',
            collapsed ? 'max-h-10' : 'max-h-[220px]'
        )}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-muted/20 transition-colors select-none"
                onClick={() => setCollapsed(c => !c)}
            >
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">SQL Linter</span>
                    <div className="flex items-center gap-2">
                        {errors > 0 && (
                            <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/15 text-red-500 border border-red-500/20">
                                <AlertCircle className="w-2.5 h-2.5" /> {errors}
                            </span>
                        )}
                        {warnings > 0 && (
                            <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-500 border border-orange-500/20">
                                <AlertTriangle className="w-2.5 h-2.5" /> {warnings}
                            </span>
                        )}
                        {infos > 0 && (
                            <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">
                                <Info className="w-2.5 h-2.5" /> {infos}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-muted-foreground">
                    {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
            </div>

            {/* Issues list */}
            {!collapsed && (
                <div className="overflow-y-auto max-h-[172px] divide-y divide-border/30 custom-scrollbar">
                    {issues.map((issue, idx) => {
                        const cfg = SEVERITY_CONFIG[issue.severity];
                        const Icon = cfg.icon;
                        const isExpanded = expandedIssue === `${idx}`;

                        return (
                            <div
                                key={idx}
                                className="group cursor-pointer hover:bg-muted/20 transition-colors"
                                onClick={() => setExpandedIssue(isExpanded ? null : `${idx}`)}
                            >
                                <div className="flex items-start gap-3 px-4 py-2">
                                    <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', cfg.color)} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <button
                                                className={cn('text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border hover:opacity-80 transition-opacity shrink-0', cfg.bg, cfg.color)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onGoToLine?.(issue.line, issue.col);
                                                }}
                                                title="Go to line"
                                            >
                                                {issue.code} L{issue.line}:{issue.col}
                                            </button>
                                            <span className={cn('text-[10px] font-semibold truncate', cfg.color)}>
                                                {issue.message}
                                            </span>
                                        </div>
                                        {isExpanded && issue.suggestion && (
                                            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 animate-in slide-in-from-top-1">
                                                <Lightbulb className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                                                <span className="text-[10px] text-muted-foreground font-medium">{issue.suggestion}</span>
                                            </div>
                                        )}
                                    </div>
                                    {issue.suggestion && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            {isExpanded
                                                ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                                                : <Lightbulb className="w-3 h-3 text-amber-500" />
                                            }
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
