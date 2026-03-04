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
    FolderOpen
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';

interface SidebarProps {
    config: any;
    onObjectSelect: (objectName: string, type: 'table' | 'view' | 'procedure' | 'synonym', database?: string) => void;
    onMetadataLoad?: (dbName: string, metadata: MetadataType) => void;
    selectedObject: string | null;
}

type MetadataType = {
    databases: any[];
    schemas: any[];
    tables: any[];
    views: any[];
    procedures: any[];
    synonyms: any[];
};

export default function Sidebar({ config, onObjectSelect, onMetadataLoad, selectedObject }: SidebarProps) {
    const [databases, setDatabases] = useState<any[]>([]);
    const [dbMetadata, setDbMetadata] = useState<Record<string, MetadataType>>({});
    const [loadingDb, setLoadingDb] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [expanded, setExpanded] = useState<Record<string, boolean>>({
        'root-databases': true,
    });

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
                                        onClick={() => onObjectSelect(item.fullName, node.itemType, node.database)}
                                        className={cn(
                                            "flex items-center gap-2 py-1 px-3 mx-2 rounded cursor-pointer text-[12px] group transition-all",
                                            isSelected
                                                ? "bg-accent text-accent-foreground font-medium shadow-sm"
                                                : "text-muted-foreground/80 hover:text-foreground hover:bg-muted/30"
                                        )}
                                        style={{ marginLeft: `${(level + 1) * 8}px` }}
                                    >
                                        <div className={cn(
                                            "w-1 h-1 rounded-full",
                                            node.itemType === 'table' && "bg-blue-400/50",
                                            node.itemType === 'view' && "bg-purple-400/50",
                                            node.itemType === 'procedure' && "bg-orange-400/50",
                                            node.itemType === 'synonym' && "bg-green-400/50",
                                            isSelected && "bg-white"
                                        )} />
                                        <span className="truncate">{item.name}</span>
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
        <div className="w-80 h-screen border-r border-border flex flex-col bg-card/30 glass">
            <div className="p-4 border-b border-border space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <Layers className="w-4 h-4 text-accent" />
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
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search all databases..."
                        className="w-full bg-muted/30 border border-border/50 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all font-medium"
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

            <div className="p-3 border-t border-border bg-muted/20">
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono truncate">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    Connected: {config.server}
                </div>
            </div>
        </div>
    );
}
