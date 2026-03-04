'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import { Editor } from '@monaco-editor/react';

interface QueryEditorProps {
    onExecute: (query: string) => void;
    loading: boolean;
    metadata?: any;
    query: string;
    onQueryChange: (value: string) => void;
    dbType?: string;
}

export default function QueryEditor({ onExecute, loading, metadata, query, onQueryChange, dbType }: QueryEditorProps) {
    const metadataRef = useRef(metadata);

    // Sync metadata to ref so the provider always sees the latest version
    useEffect(() => {
        metadataRef.current = metadata;
    }, [metadata]);

    const handleEditorChange = (val: string | undefined) => {
        onQueryChange(val || '');
    };

    const handleEditorDidMount = (editor: any, monaco: any) => {
        // Register SQL suggestions
        const provider = monaco.languages.registerCompletionItemProvider('sql', {
            provideCompletionItems: (model: any, position: any) => {
                const suggestions: any[] = [];
                const currentMetadata = metadataRef.current;

                if (currentMetadata) {
                    // Add Databases
                    if (currentMetadata.databases) {
                        currentMetadata.databases.forEach((db: any) => {
                            suggestions.push({
                                label: db.name,
                                kind: monaco.languages.CompletionItemKind.Module,
                                insertText: `[${db.name}]`,
                                detail: 'Database'
                            });
                        });
                    }

                    // Add Tables
                    if (currentMetadata.tables) {
                        currentMetadata.tables.forEach((t: any) => {
                            suggestions.push({
                                label: t.name,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: t.name,
                                detail: `Table (${t.schema})`
                            });
                        });
                    }

                    // Add Views
                    if (currentMetadata.views) {
                        currentMetadata.views.forEach((v: any) => {
                            suggestions.push({
                                label: v.name,
                                kind: monaco.languages.CompletionItemKind.Interface,
                                insertText: v.name,
                                detail: `View (${v.schema})`
                            });
                        });
                    }

                    // Add Procedures
                    if (currentMetadata.procedures) {
                        currentMetadata.procedures.forEach((p: any) => {
                            suggestions.push({
                                label: p.name,
                                kind: monaco.languages.CompletionItemKind.Function,
                                insertText: p.name,
                                detail: `Stored Procedure (${p.schema})`
                            });
                        });
                    }
                }

                // Add keywords
                const keywords = [
                    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'ORDER BY', 'GROUP BY',
                    'INSERT INTO', 'UPDATE', 'DELETE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
                    'INNER JOIN', 'ON', 'AS', 'DISTINCT', 'TOP', 'FETCH NEXT', 'OFFSET', 'ROWS ONLY'
                ];
                keywords.forEach(k => {
                    suggestions.push({
                        label: k,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: k
                    });
                });

                return { suggestions };
            }
        });

        // Optional: Clean up provider if needed (though Monaco usually manages this)
        return () => provider.dispose();
    };

    return (
        <div className="flex-1 flex flex-col bg-card/10 border border-border rounded-xl overflow-hidden min-h-0">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
                <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">SQL Editor</span>
                </div>
                <div className="flex flex-col items-end opacity-60">
                    <span className="text-[10px] font-black tracking-[0.2em] uppercase leading-none">{dbType?.toUpperCase() || 'SQL'} ENGINE</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onQueryChange('')}
                        className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                        title="Clear"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onExecute(query)}
                        disabled={loading || !query.trim()}
                        className="flex items-center gap-2 px-4 py-1.5 bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-accent-foreground text-xs font-bold rounded-md transition-all shadow-lg shadow-accent/20"
                    >
                        <Play className="w-3 h-3 fill-current" />
                        {loading ? 'Running...' : 'Execute'}
                    </button>
                </div>
            </div>
            <div className="flex-1 relative border-t border-border">
                <Editor
                    height="100%"
                    defaultLanguage="sql"
                    theme="vs-dark"
                    value={query}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    options={{
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
                        automaticLayout: true,
                        padding: { top: 16, bottom: 16 },
                        suggestOnTriggerCharacters: true,
                        autoClosingBrackets: 'always',
                    }}
                />
            </div>
        </div>
    );
}
