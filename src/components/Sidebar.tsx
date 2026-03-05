'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
    Database,
    Search,
    RefreshCw,
    ChevronRight,
    ChevronDown,
    Loader2,
    Box,
    FileText,
    Zap,
    Layers,
    Table as TableIcon,
    Folder,
    FolderOpen,
    PlusCircle,
    Code,
    Upload,
    Share2,
    LayoutDashboard,
    Clock,
    Bookmark,
    Activity,
    Users,
    GitCompare,
    Sparkles
} from 'lucide-react';
import HistoryPanel from './HistoryPanel';
import BookmarkPanel from './BookmarkPanel';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface SidebarProps {
    config: any;
    onObjectSelect: (objectName: string, type: 'table' | 'view' | 'procedure' | 'synonym', database?: string) => void;
    onMetadataLoad?: (dbName: string, metadata: MetadataType) => void;
    selectedObject: string | null;
    onAddClick: (type: 'table-designer' | 'view-designer' | 'proc-designer' | 'import-wizard' | 'query-builder' | 'er-diagram' | 'server-monitor' | 'user-manager' | 'schema-compare' | 'ai-settings') => void;
    onViewScript: (fullName: string, type: 'table' | 'view' | 'procedure', database: string) => void;
    onRunQuery: (sql: string) => void;
}

type MetadataType = {
    databases: any[];
    schemas: any[];
    tables: any[];
    views: any[];
    procedures: any[];
    synonyms: any[];
};

export default function Sidebar({ config, onObjectSelect, onMetadataLoad, selectedObject, onAddClick, onViewScript, onRunQuery }: SidebarProps) {
    const [activeTab, setActiveTab] = useState<'explorer' | 'history' | 'bookmarks'>('explorer');
    const [databases, setDatabases] = useState<any[]>([]);
    const [dbMetadata, setDbMetadata] = useState<Record<string, MetadataType>>({});
    const [loadingDb, setLoadingDb] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        'root-databases': true,
    });

    const searchRef = React.useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleFocusSearch = () => {
            setActiveTab('explorer');
            setTimeout(() => {
                searchRef.current?.focus();
                searchRef.current?.select();
            }, 50);
        };

        window.addEventListener('focus-search', handleFocusSearch);
        return () => window.removeEventListener('focus-search', handleFocusSearch);
    }, []);

    const fetchDatabases = async () => {
        setLoading(true);
        try {
            const data = await apiRequest('/api/db/metadata', 'POST', config);
            if (data.success) {
                setDatabases(data.metadata.databases);
                // Automatically load the current database's metadata
                if (config.database) {
                    setDbMetadata(prev => ({ ...prev, [config.database]: data.metadata }));
                    setExpanded(prev => ({ ...prev, [`db-${config.database}`]: true }));
                    onMetadataLoad?.(config.database, data.metadata);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDbMetadata = async (dbName: string) => {
        if (dbMetadata[dbName]) return;

        setLoadingDb(prev => ({ ...prev, [dbName]: true }));
        try {
            const data = await apiRequest('/api/db/metadata', 'POST', { ...config, database: dbName });
            if (data.success) {
                setDbMetadata(prev => ({ ...prev, [dbName]: data.metadata }));
                onMetadataLoad?.(dbName, data.metadata);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDb(prev => ({ ...prev, [dbName]: false }));
        }
    };

    useEffect(() => {
        fetchDatabases();
    }, [config]);

    const toggleExpand = (key: string, dbName?: string) => {
        const newExpanded = !expanded[key];
        setExpanded(prev => ({ ...prev, [key]: newExpanded }));

        if (newExpanded && dbName) {
            fetchDbMetadata(dbName);
        }
    };

    const renderTree = (node: any, level: number = 0) => {
        const isExpanded = expanded[node.id];
        const hasChildren = node.children && node.children.length > 0;
        const isLoading = node.dbName && loadingDb[node.dbName];

        if (search && node.type === 'category') {
            const filteredItems = node.items.filter((item: any) =>
                item.name.toLowerCase().includes(search.toLowerCase())
            );
            if (filteredItems.length === 0) return null;
        }

        return (
            <div key={node.id} className="select-none">
                <div
                    className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-all group text-sm",
                        level === 0 ? "font-bold text-muted-foreground uppercase tracking-widest text-[11px] mb-1" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
                        node.isCurrent && "text-accent font-semibold bg-accent/5"
                    )}
                    style={{ paddingLeft: `${level * 12 + 8}px` }}
                    onClick={() => toggleExpand(node.id, node.dbName)}
                >
                    {isLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                    ) : (hasChildren || node.dbName) ? (
                        isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                        <div className="w-3.5 h-3.5" />
                    )}

                    {node.type === 'database' && <Database className={cn("w-3.5 h-3.5", node.isCurrent ? "text-accent" : "text-emerald-400/70")} />}
                    {node.type === 'schema' && <Layers className="w-3.5 h-3.5 text-amber-400/70" />}
                    {node.type === 'folder' && (isExpanded ? <FolderOpen className="w-3.5 h-3.5 text-blue-400/70" /> : <Folder className="w-3.5 h-3.5 text-blue-400/70" />)}
                    {node.icon && React.createElement(node.icon, { className: "w-3.5 h-3.5 opacity-70" })}

                    <span className="truncate flex-1">{node.name}</span>
                    {node.itemCount !== undefined && <span className="text-[10px] opacity-40 ml-auto">{node.itemCount}</span>}
                </div>

                {isExpanded && node.children && (
                    <div className="border-l border-border/20 ml-[14px]">
                        {node.children.map((child: any) => renderTree(child, level + 1))}
                    </div>
                )}

                {isExpanded && node.type === 'category' && (
                    <div className="border-l border-border/20 ml-[14px]">
                        {node.items
                            .filter((item: any) => !search || item.name.toLowerCase().includes(search.toLowerCase()))
                            .map((item: any, i: number) => {
                                const identifier = `${node.database}.${item.fullName}`;
                                const isSelected = selectedObject === identifier;
                                return (
                                    <div
                                        key={i}
                                        className={cn(
                                            "flex items-center gap-2 py-1 px-3 mx-2 rounded cursor-pointer text-[12px] group/item transition-all relative",
                                            isSelected
                                                ? "bg-accent text-accent-foreground font-medium shadow-sm"
                                                : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/30"
                                        )}
                                        style={{ marginLeft: `${(level + 1) * 8}px` }}
                                    >
                                        <div className="flex-1 flex items-center gap-2 overflow-hidden" onClick={() => onObjectSelect(item.fullName, node.itemType, node.database)}>
                                            <div className={cn(
                                                "w-1 h-1 rounded-full shrink-0",
                                                node.itemType === 'table' && "bg-blue-400/50",
                                                node.itemType === 'view' && "bg-purple-400/50",
                                                node.itemType === 'procedure' && "bg-orange-400/50",
                                                node.itemType === 'synonym' && "bg-green-400/50",
                                                isSelected && "bg-white"
                                            )} />
                                            <span className="truncate">{item.name}</span>
                                        </div>
                                        {node.itemType !== 'synonym' && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onViewScript(item.fullName, node.itemType, node.database);
                                                }}
                                                className={cn(
                                                    "p-1 rounded hover:bg-white/20 transition-all opacity-0 group-hover/item:opacity-100",
                                                    isSelected && "opacity-100 text-white"
                                                )}
                                                title="View Create Script"
                                            >
                                                <Code className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        );
    };

    const databasesTree = useMemo(() => ({
        name: 'Databases',
        id: 'root-databases',
        children: databases.map(db => {
            const meta = dbMetadata[db.name];
            const isCurrent = db.name.toLowerCase() === config.database.toLowerCase();

            return {
                name: db.name,
                id: `db-${db.name}`,
                dbName: db.name,
                type: 'database',
                isCurrent,
                children: meta ? [
                    {
                        name: 'Schemas',
                        id: `db-${db.name}-schemas`,
                        type: 'folder',
                        children: meta.schemas.map(s => ({
                            name: s.name,
                            id: `schema-${db.name}-${s.name}`,
                            type: 'schema',
                            children: [
                                {
                                    name: 'Tables',
                                    id: `tables-${db.name}-${s.name}`,
                                    type: 'category',
                                    icon: TableIcon,
                                    database: db.name,
                                    items: meta.tables.filter(t => t.schema === s.name),
                                    itemType: 'table',
                                    itemCount: meta.tables.filter(t => t.schema === s.name).length
                                },
                                {
                                    name: 'Views',
                                    id: `views-${db.name}-${s.name}`,
                                    type: 'category',
                                    icon: Box,
                                    database: db.name,
                                    items: meta.views.filter(v => v.schema === s.name),
                                    itemType: 'view',
                                    itemCount: meta.views.filter(v => v.schema === s.name).length
                                },
                                {
                                    name: 'Procedures',
                                    id: `procs-${db.name}-${s.name}`,
                                    type: 'category',
                                    icon: Zap,
                                    database: db.name,
                                    items: meta.procedures.filter(p => p.schema === s.name),
                                    itemType: 'procedure',
                                    itemCount: meta.procedures.filter(p => p.schema === s.name).length
                                },
                                {
                                    name: 'Synonyms',
                                    id: `syns-${db.name}-${s.name}`,
                                    type: 'category',
                                    icon: FileText,
                                    database: db.name,
                                    items: meta.synonyms.filter(sn => sn.schema === s.name),
                                    itemType: 'synonym',
                                    itemCount: meta.synonyms.filter(sn => sn.schema === s.name).length
                                }
                            ].filter(cat => cat.items.length > 0)
                        }))
                    }
                ] : []
            };
        })
    }), [databases, dbMetadata, config.database]);

    return (
        <div className="w-80 h-screen border-r border-border flex flex-col bg-background/50 backdrop-blur-2xl">
            {/* Object Forge (Action Buttons) */}
            <div className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.3em] flex items-center gap-2">
                        <PlusCircle className="w-3.5 h-3.5 text-accent" />
                        Object Forge
                    </h2>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    <button
                        onClick={() => onAddClick('table-designer')}
                        className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 transition-all group"
                        title="Create New Table"
                    >
                        <TableIcon className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-blue-400/70">Table</span>
                    </button>
                    <button
                        onClick={() => onAddClick('view-designer')}
                        className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-purple-500/5 hover:bg-purple-500/10 border border-purple-500/10 transition-all group"
                        title="Create New View"
                    >
                        <Layers className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-purple-400/70">View</span>
                    </button>
                    <button
                        onClick={() => onAddClick('proc-designer')}
                        className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 transition-all group"
                        title="Create New Procedure"
                    >
                        <Zap className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[8px] font-black uppercase tracking-tighter text-orange-400/70">Proc</span>
                    </button>
                </div>
            </div>

            {/* Sidebar Tabs */}
            <div className="flex px-3 gap-1 overflow-hidden shrink-0 mt-4">
                {[
                    { id: 'explorer', icon: Layers, label: 'Search' },
                    { id: 'history', icon: Clock, label: 'Past Exec' },
                    { id: 'bookmarks', icon: Bookmark, label: 'Saved' }
                ].map(t => (
                    <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id as any)}
                        className={cn(
                            "flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-all border shrink-0",
                            activeTab === t.id
                                ? "bg-accent/10 border-accent/30 text-accent shadow-sm"
                                : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/30"
                        )}
                    >
                        <t.icon className={cn("w-4 h-4", activeTab === t.id ? "opacity-100" : "opacity-40")} />
                        <span className="text-[8px] font-black uppercase tracking-tighter">{t.label}</span>
                    </button>
                ))}
            </div>

            {activeTab === 'explorer' && (
                <>
                    <div className="p-4 border-b border-border/50 space-y-4 overflow-hidden shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                                <Search className="w-3.5 h-3.5" />
                                Object Explorer
                            </h2>
                            <button
                                onClick={fetchDatabases}
                                disabled={loading}
                                className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground"
                            >
                                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                            </button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Search all databases..."
                                className="w-full bg-muted/30 border border-border/50 rounded-lg pl-9 pr-3 py-2 text-[11px] focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all font-medium"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                        {loading && databases.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                                <Loader2 className="w-6 h-6 animate-spin mb-3 opacity-50" />
                                <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Fetching Instance...</p>
                            </div>
                        ) : (
                            renderTree(databasesTree)
                        )}
                    </div>

                    {/* AI Forge */}
                    <div className="mx-3 mb-2 mt-auto pt-4 border-t border-border/30 space-y-3 shrink-0">
                        <div className="flex items-center gap-2 px-2 text-[9px] font-black uppercase tracking-widest text-purple-500/60">
                            <Sparkles className="w-2.5 h-2.5" /> AI Forge
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => onAddClick('ai-settings' as any)}
                                className="flex items-center justify-center gap-3 p-3 rounded-xl bg-purple-500/5 hover:bg-purple-600/10 border border-purple-500/10 transition-all group"
                            >
                                <Sparkles className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[8px] font-black uppercase tracking-widest text-purple-400/70">AI Engine & Provider Management</span>
                            </button>
                        </div>
                    </div>

                    {/* Enterprise Forge */}
                    <div className="mx-3 mb-4 mt-2 pt-4 border-t border-border/30 space-y-3 shrink-0">
                        <div className="flex items-center gap-2 px-2 text-[9px] font-black uppercase tracking-widest text-emerald-500/60">
                            <Zap className="w-2.5 h-2.5" /> Enterprise Forge
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => onAddClick('server-monitor' as any)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 transition-all group"
                            >
                                <Activity className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-emerald-400/70">Health</span>
                            </button>
                            <button
                                onClick={() => onAddClick('user-manager' as any)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 transition-all group"
                            >
                                <Users className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-indigo-400/70">Users</span>
                            </button>
                            <button
                                onClick={() => onAddClick('schema-compare' as any)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 transition-all group"
                            >
                                <GitCompare className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-orange-400/70">Diff</span>
                            </button>
                            <button
                                onClick={() => onAddClick('er-diagram' as any)}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/10 transition-all group"
                            >
                                <Share2 className="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-blue-400/70">Architect</span>
                            </button>
                            <button
                                onClick={() => onAddClick('query-builder')}
                                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-purple-500/5 hover:bg-purple-600/10 border border-purple-500/10 transition-all group"
                            >
                                <LayoutDashboard className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                                <span className="text-[8px] font-black uppercase tracking-tighter text-purple-400/70">Builder</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'history' && (
                <div className="flex-1 overflow-hidden">
                    <HistoryPanel onSelectQuery={onRunQuery} />
                </div>
            )}

            {activeTab === 'bookmarks' && (
                <div className="flex-1 overflow-hidden">
                    <BookmarkPanel onSelectQuery={onRunQuery} />
                </div>
            )}

            <div className="p-3 border-t border-border bg-muted/20">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono truncate">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Connected: {config.server}
                </div>
            </div>
        </div>
    );
}
