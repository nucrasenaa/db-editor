'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Users,
    Shield,
    Key,
    ShieldCheck,
    UserPlus,
    Lock,
    Search,
    RefreshCw,
    ShieldAlert,
    ChevronRight,
    ChevronDown,
    Loader2,
    Database
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UserManagerProps {
    config: any;
    onClose: () => void;
}

export default function UserManager({ config, onClose }: UserManagerProps) {
    const [databases, setDatabases] = useState<any[]>([]);
    const [selectedDb, setSelectedDb] = useState(config.database);
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any | null>(null);
    const [userPermissions, setUserPermissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchDbs = async () => {
            try {
                const res = await apiRequest('/api/db/metadata', 'POST', config);
                if (res.success) {
                    setDatabases(res.metadata.databases);
                }
            } catch (err) {
                console.error(err);
            }
        };
        fetchDbs();
    }, [config]);

    const fetchUsers = useCallback(async (isRefresh = false, dbName?: string) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        const targetDb = dbName || selectedDb;
        try {
            const dialect = config?.dbType || 'mssql';
            let query = '';

            if (dialect === 'mssql') {
                query = `
                    USE [${targetDb}];
                    SELECT 
                        name as userName, 
                        type_desc as type, 
                        create_date as createDate,
                        modify_date as modifyDate,
                        authentication_type_desc as authType
                    FROM sys.database_principals 
                    WHERE type IN ('S', 'U', 'G') -- SQL, Windows User, Windows Group
                    AND name NOT IN ('sys', 'information_schema')
                    ORDER BY name;
                `;
            } else if (dialect === 'postgres') {
                query = `SELECT rolname as userName, rolsuper as isSuper, rolcreaterole as canCreateRole, rolcanlogin as canLogin FROM pg_roles ORDER BY rolname;`;
            } else {
                query = `SELECT User as userName, Host as host FROM mysql.user ORDER BY User;`;
            }

            const res = await apiRequest('/api/db/query', 'POST', { config: { ...config, database: targetDb }, query });
            if (res.success) {
                setUsers(res.data || []);
            }
        } catch (err) {
            console.error('[UserManager] Error fetching users:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [config, selectedDb]);

    const fetchUserDetails = async (user: any) => {
        setSelectedUser(user);
        setUserPermissions([]);

        try {
            const dialect = config?.dbType || 'mssql';
            let query = '';

            if (dialect === 'mssql') {
                query = `
                    USE [${selectedDb}];
                    SELECT 
                        dp.permission_name as [permission],
                        dp.state_desc as [state],
                        dp.class_desc as [class],
                        OBJECT_NAME(dp.major_id) as [objectName]
                    FROM sys.database_permissions dp
                    JOIN sys.database_principals p ON dp.grantee_principal_id = p.principal_id
                    WHERE p.name = '${user.userName}'
                    ORDER BY dp.permission_name;
                `;
            } else if (dialect === 'postgres') {
                query = `SELECT table_catalog, table_schema, table_name, privilege_type FROM information_schema.role_table_grants WHERE grantee = '${user.userName}' AND table_catalog = '${selectedDb}';`;
            }

            if (query) {
                const res = await apiRequest('/api/db/query', 'POST', { config: { ...config, database: selectedDb }, query });
                if (res.success) {
                    setUserPermissions(res.data || []);
                }
            }
        } catch (err) {
            console.error('[UserManager] Error fetching user details:', err);
        }
    };

    useEffect(() => {
        fetchUsers(false, selectedDb);
    }, [fetchUsers, selectedDb]);

    const filteredUsers = users.filter(u =>
        u.userName.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col bg-background overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="h-16 border-b border-border bg-card/30 flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-500/10 rounded-lg">
                        <Users className="w-5 h-5 text-indigo-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-1">User & Permission Manager</h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:inline">ACCESS CONTROL FORGE</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="bg-muted/50 border border-border px-3 py-1.5 rounded-xl flex items-center gap-2">
                        <Database className="w-3.5 h-3.5 text-indigo-400" />
                        <select
                            value={selectedDb}
                            onChange={(e) => setSelectedDb(e.target.value)}
                            className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-foreground focus:ring-0 cursor-pointer outline-none min-w-[120px]"
                        >
                            {databases.map(db => (
                                <option key={db.name} value={db.name} className="bg-background text-foreground uppercase">{db.name}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3 h-3 text-muted-foreground pointer-events-none -ml-6 mr-2" />
                    </div>

                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={() => fetchUsers(true)}
                        disabled={refreshing}
                        className="flex items-center gap-2 px-8 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20"
                    >
                        {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        Refresh
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* User List Panel */}
                <div className="w-80 border-r border-border/50 bg-muted/10 flex flex-col shrink-0">
                    <div className="p-4 border-b border-border/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground opacity-30" />
                            <input
                                type="text"
                                placeholder="Search users..."
                                className="w-full bg-muted/50 border border-border/50 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-2 space-y-1">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 opacity-30">
                                <Loader2 className="w-6 h-6 animate-spin mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Listing Principals...</span>
                            </div>
                        ) : filteredUsers.length === 0 ? (
                            <div className="text-center py-12 text-[10px] text-muted-foreground uppercase tracking-widest opacity-40">No users found</div>
                        ) : (
                            filteredUsers.map((user) => (
                                <button
                                    key={user.userName}
                                    onClick={() => fetchUserDetails(user)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all text-left group",
                                        selectedUser?.userName === user.userName
                                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                            : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                                    )}
                                >
                                    <div className={cn("p-2 rounded-lg transition-colors", selectedUser?.userName === user.userName ? "bg-indigo-500/20" : "bg-muted/50 group-hover:bg-muted")}>
                                        <Shield className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 truncate">
                                        <div className="truncate mb-0.5">{user.userName}</div>
                                        <div className="text-[9px] uppercase tracking-widest opacity-40 font-black">{user.type || user.host || 'DB Role'}</div>
                                    </div>
                                    <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", selectedUser?.userName === user.userName ? "translate-x-0" : "-translate-x-2 opacity-0 group-hover:opacity-40 group-hover:translate-x-0")} />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Permissions Workspace */}
                <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_center,_#1e1e22_1px,_transparent_1px)] bg-[size:24px_24px] p-8">
                    {!selectedUser ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-40 text-center">
                            <div className="p-10 rounded-full border-2 border-dashed border-border mb-4">
                                <Lock className="w-16 h-16 text-muted-foreground" />
                            </div>
                            <h3 className="text-xs font-black uppercase tracking-[0.3em]">Access Privilege Manager</h3>
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground max-w-xs leading-relaxed">Select a principal from the sidebar to inspect granular database permissions and security object states.</p>
                        </div>
                    ) : (
                        <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
                            {/* User Profile Header */}
                            <div className="bg-card border border-border rounded-2xl p-8 relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Users className="w-32 h-32" />
                                </div>
                                <div className="flex items-center gap-6 relative z-10">
                                    <div className="w-20 h-20 rounded-3xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                        <ShieldCheck className="w-10 h-10 text-indigo-500" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-2xl font-black tracking-tight">{selectedUser.userName}</h3>
                                            <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-500/20">
                                                Active Principal
                                            </span>
                                        </div>
                                        <div className="flex gap-6 items-center">
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Auth Method</p>
                                                <p className="text-xs font-mono">{selectedUser.authType || 'Standard'}</p>
                                            </div>
                                            <div className="w-px h-8 bg-border/50" />
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Type</p>
                                                <p className="text-xs font-mono">{selectedUser.type || (selectedUser.isSuper ? 'Superuser' : 'User')}</p>
                                            </div>
                                            <div className="w-px h-8 bg-border/50" />
                                            <div className="space-y-1">
                                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Registry Date</p>
                                                <p className="text-xs font-mono">{selectedUser.createDate ? new Date(selectedUser.createDate).toLocaleDateString() : 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Permissions Grid */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Key className="w-4 h-4 text-amber-500" />
                                        <h3 className="text-xs font-black uppercase tracking-widest">Effective Permissions</h3>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{userPermissions.length} Rights Granted</span>
                                </div>

                                <div className="grid grid-cols-1 gap-3">
                                    {userPermissions.length === 0 ? (
                                        <div className="bg-muted/30 border border-dashed border-border rounded-2xl py-12 flex flex-col items-center justify-center opacity-40">
                                            <ShieldAlert className="w-8 h-8 mb-2" />
                                            <span className="text-[10px] font-black uppercase tracking-widest">No Grantable Permissions Detected</span>
                                        </div>
                                    ) : (
                                        userPermissions.map((perm, i) => (
                                            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-indigo-500/30 transition-all group">
                                                <div className="flex items-center gap-4">
                                                    <div className={cn("p-2 rounded-lg bg-muted group-hover:bg-indigo-500/10 transition-colors", perm.state === 'GRANT' ? "text-emerald-500" : "text-amber-500")}>
                                                        {perm.state === 'GRANT' ? <ShieldCheck className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs font-mono font-bold">{perm.permission || perm.privilege_type}</div>
                                                        <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-0.5">
                                                            Scope: {perm.class || 'Table'} — {perm.objectName || perm.table_name || 'Database Global'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest", perm.state === 'GRANT' ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                                                    {perm.state || 'Authorized'}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
