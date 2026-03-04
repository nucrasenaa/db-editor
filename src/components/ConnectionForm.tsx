'use client';

import React, { useState, useEffect } from 'react';
import { Database, Server, User, Lock, Globe, Loader2, ArrowLeft, Plus, Link, Database as DBIcon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionFormProps {
    onConnect: (config: any) => void;
    onCancel?: () => void;
    initialConfig?: any;
}

export default function ConnectionForm({ onConnect, onCancel, initialConfig }: ConnectionFormProps) {
    const [connMode, setConnMode] = useState<'manual' | 'url'>('manual');
    const [config, setConfig] = useState({
        dbType: 'mssql',
        name: '',
        connectionString: '',
        server: 'localhost',
        port: 1433,
        user: 'sa',
        password: '',
        database: 'master',
        rememberPassword: false,
        options: {
            trustServerCertificate: true,
            encrypt: false,
        }
    });

    useEffect(() => {
        if (initialConfig) {
            setConnMode(initialConfig.connectionString ? 'url' : 'manual');
            setConfig(prev => ({
                ...prev,
                ...initialConfig,
                password: initialConfig.password || ''
            }));
        }
    }, [initialConfig]);

    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testSuccess, setTestSuccess] = useState(false);

    const handleTestConnection = async (e: React.MouseEvent) => {
        e.preventDefault();
        setTesting(true);
        setError(null);
        setTestSuccess(false);

        try {
            const res = await fetch('/api/db/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(connMode === 'url' ? { connectionString: config.connectionString } : config),
            });

            const data = await res.json();
            if (data.success) {
                setTestSuccess(true);
                setTimeout(() => setTestSuccess(false), 3000);
            } else {
                setError(data.message);
            }
        } catch (err: any) {
            setError(err.message || 'Connection test failed.');
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setTestSuccess(false);

        try {
            const res = await fetch('/api/db/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(connMode === 'url' ? { connectionString: config.connectionString } : config),
            });

            const data = await res.json();
            if (data.success) {
                onConnect(connMode === 'url' ? { ...config, server: config.connectionString.split('@')[1]?.split('/')[0] || 'MSSQL URL' } : config);
            } else {
                setError(data.message);
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred while connecting.');
        } finally {
            setLoading(false);
        }
    };

    const dbTypes = [
        { id: 'mssql', label: 'SQL Server', icon: Database, color: 'text-blue-500', disabled: false },
        { id: 'mysql', label: 'MySQL', icon: Database, color: 'text-orange-500', defaultPort: 3306, disabled: false },
        { id: 'mariadb', label: 'MariaDB', icon: Database, color: 'text-emerald-500', defaultPort: 3306, disabled: false },
        { id: 'postgres', label: 'Postgres', icon: Database, color: 'text-indigo-500', defaultPort: 5432, disabled: false },
    ];

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background overflow-y-auto">
            <div className="w-full max-w-xl glass p-8 rounded-3xl shadow-2xl space-y-8 animate-in zoom-in-95 my-10 border border-border/50">
                <div className="relative">
                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="absolute -left-2 -top-2 p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className="text-center space-y-2">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-accent/10 mb-2">
                            <DBIcon className="w-10 h-10 text-accent" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tight gradient-text uppercase">Data Forge</h1>
                        <p className="text-muted-foreground text-sm font-medium">Configure your database environment</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-muted/30 p-1 rounded-xl">
                    <button
                        onClick={() => setConnMode('manual')}
                        className={cn(
                            "py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2",
                            connMode === 'manual' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Server className="w-3.5 h-3.5" /> Manual Params
                    </button>
                    <button
                        onClick={() => setConnMode('url')}
                        className={cn(
                            "py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-[0.1em] transition-all flex items-center justify-center gap-2",
                            connMode === 'url' ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Link className="w-3.5 h-3.5" /> Connection URL
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-5">
                        {/* DB Type Selection */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5 opacity-60">
                                Database Dialect
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                                {dbTypes.map((type) => (
                                    <button
                                        key={type.id}
                                        type="button"
                                        disabled={type.disabled}
                                        onClick={() => {
                                            const updates: any = { dbType: type.id };
                                            if (type.defaultPort && config.port === 1433) {
                                                updates.port = type.defaultPort;
                                            }
                                            setConfig({ ...config, ...updates });
                                        }}
                                        className={cn(
                                            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center group",
                                            config.dbType === type.id
                                                ? "border-accent bg-accent/5 ring-1 ring-accent/50"
                                                : "border-border bg-card/50 hover:border-border/80",
                                            type.disabled && "opacity-40 cursor-not-allowed contrast-50 grayscale"
                                        )}
                                    >
                                        <type.icon className={cn("w-6 h-6", config.dbType === type.id ? type.color : "text-muted-foreground")} />
                                        <span className={cn("text-[10px] font-black uppercase tracking-tighter", config.dbType === type.id ? "text-foreground" : "text-muted-foreground")}>
                                            {type.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5 opacity-60">
                                Identifier
                            </label>
                            <input
                                type="text"
                                className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-bold text-sm"
                                placeholder="E.g., Production AWS, Localhost Dev..."
                                value={config.name}
                                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                            />
                        </div>

                        {connMode === 'manual' ? (
                            <>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-3 space-y-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                            Host
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                            placeholder="localhost or server-address"
                                            value={config.server}
                                            onChange={(e) => setConfig({ ...config, server: e.target.value })}
                                        />
                                    </div>
                                    <div className="col-span-1 space-y-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                            Port
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                            value={config.port}
                                            onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                            Username
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                            placeholder="sa"
                                            value={config.user}
                                            onChange={(e) => setConfig({ ...config, user: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                            Password
                                        </label>
                                        <input
                                            type="password"
                                            className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                            placeholder="••••••••"
                                            value={config.password}
                                            onChange={(e) => setConfig({ ...config, password: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                        Initial Database
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                        placeholder="master"
                                        value={config.database}
                                        onChange={(e) => setConfig({ ...config, database: e.target.value })}
                                    />
                                </div>

                                <div className="flex items-center gap-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-accent"
                                        checked={config.rememberPassword}
                                        onChange={(e) => setConfig({ ...config, rememberPassword: e.target.checked })}
                                    />
                                    <label htmlFor="remember" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                                        Securely Cache Credentials
                                    </label>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                        Connection String (URI)
                                    </label>
                                    <textarea
                                        required
                                        className="w-full h-32 bg-muted/50 border border-border/50 rounded-2xl px-5 py-4 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm resize-none"
                                        placeholder={config.dbType === 'mssql' ? "mssql://username:password@localhost:1433/database" : "mysql://username:password@localhost:3306/database"}
                                        value={config.connectionString}
                                        onChange={(e) => setConfig({ ...config, connectionString: e.target.value })}
                                    />
                                    <p className="text-[10px] text-muted-foreground/60 italic px-1">
                                        Format: {config.dbType}://user:password@host:port/database
                                    </p>
                                </div>

                                <div className="flex items-center gap-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="remember-url"
                                        className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-accent"
                                        checked={config.rememberPassword}
                                        onChange={(e) => setConfig({ ...config, rememberPassword: e.target.checked })}
                                    />
                                    <label htmlFor="remember-url" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                                        Securely Cache Credentials
                                    </label>
                                </div>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-medium animate-in fade-in slide-in-from-top-1">
                            {error}
                        </div>
                    )}

                    {testSuccess && (
                        <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-2xl text-green-500 text-xs font-bold animate-in fade-in slide-in-from-top-1 text-center">
                            Handshake successful! ✓
                        </div>
                    )}

                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testing || loading}
                            className="flex-1 bg-muted/50 hover:bg-muted border border-border/50 disabled:opacity-50 text-foreground font-black uppercase text-[10px] tracking-widest py-4 rounded-2xl transition-all flex items-center justify-center gap-2"
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : null}
                            {testing ? 'Testing...' : 'Diagnostics'}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || testing}
                            className="flex-[1.5] bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-accent-foreground font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin font-bold" /> : null}
                            {loading ? 'Forging Connection...' : 'Establish Link'}
                        </button>
                    </div>
                </form>

                <p className="text-center text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-30">
                    Enterprise Grade Secure Connector
                </p>
            </div >
        </div >
    );
}
