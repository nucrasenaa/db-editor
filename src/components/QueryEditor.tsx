'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Bookmark, Network, Sparkles } from 'lucide-react';
import { saveBookmark } from '@/lib/history';
import { Editor } from '@monaco-editor/react';
import AICopilot from './AICopilot';

interface QueryEditorProps {
    onExecute: (query: string) => void;
    loading: boolean;
    metadata?: any;
    allMetadata?: Record<string, any>;
    query: string;
    onQueryChange: (value: string) => void;
    dbType?: string;
    theme?: 'dark' | 'light';
}

export default function QueryEditor({ onExecute, loading, metadata, allMetadata, query, onQueryChange, dbType, theme }: QueryEditorProps) {
    const [showCopilot, setShowCopilot] = useState(false);
    const metadataRef = useRef(metadata);
    const allMetadataRef = useRef(allMetadata);
    const queryRef = useRef(query);
    const editorRef = useRef<any>(null);

    // Sync query to ref for auto-execute listener
    useEffect(() => {
        queryRef.current = query;
    }, [query]);

    // Handle auto-execute from AI
    useEffect(() => {
        const handleAutoExecute = () => {
            if (queryRef.current.trim()) {
                onExecute(queryRef.current);
            }
        };
        window.addEventListener('execute-generated-sql', handleAutoExecute);
        return () => window.removeEventListener('execute-generated-sql', handleAutoExecute);
    }, [onExecute]);

    // Sync metadata to ref so the provider always sees the latest version
    useEffect(() => {
        metadataRef.current = metadata;
    }, [metadata]);

    useEffect(() => {
        allMetadataRef.current = allMetadata;
    }, [allMetadata]);

    const handleEditorChange = (val: string | undefined) => {
        onQueryChange(val || '');
    };

    const handleEditorDidMount = (editor: any, monaco: any) => {
        editorRef.current = editor;
        // ... (existing actions)
        editor.addAction({
            id: 'execute-query',
            label: 'Execute SQL',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
            run: () => {
                const selection = editor.getSelection();
                const selectedText = editor.getModel().getValueInRange(selection);
                const val = selectedText.trim() || editor.getValue();
                if (val.trim()) onExecute(val);
            }
        });

        editor.addAction({
            id: 'save-bookmark',
            label: 'Save Bookmark',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
            run: () => {
                const val = editor.getValue();
                if (val.trim()) {
                    const name = prompt('Enter a name for this bookmark:');
                    if (name) {
                        saveBookmark(name, val);
                        alert('Query bookmarked successfully!');
                    }
                }
            }
        });

        editor.addAction({
            id: 'clear-editor',
            label: 'Clear Editor',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash],
            run: () => {
                onQueryChange('');
            }
        });

        editor.addAction({
            id: 'explain-query',
            label: 'Explain SQL',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE],
            run: () => {
                const val = editor.getValue();
                if (val.trim()) onExecute(`EXPLAIN_PLAN:${val}`);
            }
        });

        editor.addAction({
            id: 'open-copilot',
            label: 'AI Copilot',
            keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK],
            run: () => {
                setShowCopilot(true);
            }
        });

        // Register SQL suggestions
        const provider = monaco.languages.registerCompletionItemProvider('sql', {
            provideCompletionItems: (model: any, position: any) => {
                const suggestions: any[] = [];
                const currentMetadata = metadataRef.current;
                const allMetas = allMetadataRef.current || {};

                // Use all available metadata for cross-database completions
                Object.keys(allMetas).forEach(dbName => {
                    const meta = allMetas[dbName];
                    if (!meta) return;

                    // Add Tables
                    if (meta.tables) {
                        meta.tables.forEach((t: any) => {
                            suggestions.push({
                                label: t.name,
                                kind: monaco.languages.CompletionItemKind.Field,
                                insertText: t.name,
                                detail: `Table (${t.schema}) @ ${dbName}`,
                                documentation: `Fully qualified: [${dbName}].[${t.schema}].[${t.name}]`
                            });
                        });
                    }

                    // Add Views
                    if (meta.views) {
                        meta.views.forEach((v: any) => {
                            suggestions.push({
                                label: v.name,
                                kind: monaco.languages.CompletionItemKind.Interface,
                                insertText: v.name,
                                detail: `View (${v.schema}) @ ${dbName}`
                            });
                        });
                    }

                    // Add Procedures
                    if (meta.procedures) {
                        meta.procedures.forEach((p: any) => {
                            suggestions.push({
                                label: p.name,
                                kind: monaco.languages.CompletionItemKind.Function,
                                insertText: p.name,
                                detail: `Stored Procedure (${p.schema}) @ ${dbName}`
                            });
                        });
                    }
                });

                // Add Databases from current metadata if not already covered
                if (currentMetadata && currentMetadata.databases) {
                    currentMetadata.databases.forEach((db: any) => {
                        suggestions.push({
                            label: db.name,
                            kind: monaco.languages.CompletionItemKind.Module,
                            insertText: `[${db.name}]`,
                            detail: 'Database'
                        });
                    });
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
                        onClick={() => {
                            const name = prompt('Enter a name for this bookmark:');
                            if (name) {
                                saveBookmark(name, query);
                                alert('Query bookmarked successfully!');
                            }
                        }}
                        disabled={!query.trim()}
                        className="p-1.5 hover:bg-amber-500/10 rounded-md transition-colors text-muted-foreground hover:text-amber-500 group"
                        title="Save Bookmark"
                    >
                        <Bookmark className="w-4 h-4 group-hover:fill-current transition-all" />
                    </button>
                    <button
                        onClick={() => onQueryChange('')}
                        className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                        title="Clear"
                    >
                        <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowCopilot(true)}
                        className="p-1.5 hover:bg-purple-500/10 rounded-md transition-colors text-purple-400"
                        title="AI Copilot (Cmd+K)"
                    >
                        <Sparkles className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-border mx-1" />
                    <button
                        onClick={() => {
                            if (query.trim()) onExecute(`EXPLAIN_PLAN:${query.trim()}`);
                        }}
                        disabled={loading || !query.trim()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 text-muted-foreground text-xs font-bold rounded-md transition-all group border border-border/50"
                        title="Explain Plan (Cmd+E)"
                    >
                        <Network className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
                        Explain
                    </button>
                    <button
                        onClick={() => {
                            let queryToRun = query;
                            if (editorRef.current) {
                                const selection = editorRef.current.getSelection();
                                const selectedText = editorRef.current.getModel().getValueInRange(selection);
                                if (selectedText.trim()) {
                                    queryToRun = selectedText;
                                }
                            }
                            onExecute(queryToRun);
                        }}
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
                    theme={theme === 'light' ? 'light' : 'vs-dark'}
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

                {showCopilot && (
                    <AICopilot
                        onClose={() => setShowCopilot(false)}
                        onGenerated={(generated) => onQueryChange(generated)}
                        metadata={metadata}
                        config={{ dbType }}
                    />
                )}
            </div>
        </div>
    );
}
