'use client';

import React, { useState, useEffect } from 'react';
import { Database, Server, User, Globe, Loader2, ArrowLeft, Link, Database as DBIcon, CheckCircle2, AlertCircle, ShieldAlert, Palette, Lock, Info } from 'lucide-react';
import { apiRequest } from '@/lib/api';
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
        envColor: 'default',
        readOnly: false,
        rememberPassword: false,
        options: {
            trustServerCertificate: true,
            encrypt: false,
        }
    });

    const ENV_COLORS = [
        { id: 'default', hex: 'bg-accent', label: 'Default' },
        { id: 'green', hex: 'bg-emerald-500', label: 'Development/Local' },
        { id: 'orange', hex: 'bg-orange-500', label: 'Staging/Test' },
        { id: 'red', hex: 'bg-red-500', label: 'Production (Critical)' },
        { id: 'purple', hex: 'bg-purple-500', label: 'Analytics/Replica' },
    ];

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
            const requestData = connMode === 'url'
                ? { connectionString: config.connectionString, dbType: config.dbType, options: config.options }
                : config;
            const data = await apiRequest('/api/db/test', 'POST', requestData);
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
            const requestData = connMode === 'url'
                ? { connectionString: config.connectionString, dbType: config.dbType, options: config.options }
                : config;
            const data = await apiRequest('/api/db/test', 'POST', requestData);
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
        { id: 'mongodb', label: 'MongoDB', icon: Database, color: 'text-green-500', defaultPort: 27017, disabled: false },
        { id: 'redis', label: 'Redis', icon: Database, color: 'text-red-500', defaultPort: 6379, disabled: false },
        { id: 'kafka', label: 'Kafka', icon: Database, color: 'text-purple-500', defaultPort: 9092, disabled: false },
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
                            <img src="/icons/icon-512.png" alt="Data Forge" className="w-12 h-12 object-contain" />
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
                        <div className="space-y-4">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5 opacity-60">
                                Database Dialect
                            </label>
                            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2 md:gap-3">
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
                                            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all text-center group active:scale-95",
                                            config.dbType === type.id
                                                ? "border-accent bg-accent/5 ring-1 ring-accent/50"
                                                : "border-border bg-card/50 hover:border-border/80",
                                            type.disabled && "opacity-40 cursor-not-allowed contrast-50 grayscale"
                                        )}
                                    >
                                        <type.icon className={cn("w-5 h-5 md:w-6 md:h-6", config.dbType === type.id ? type.color : "text-muted-foreground")} />
                                        <span className={cn("text-[9px] md:text-[10px] font-black uppercase tracking-tighter whitespace-nowrap", config.dbType === type.id ? "text-foreground" : "text-muted-foreground")}>
                                            {type.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5 opacity-60">
                                Connection Name
                            </label>
                            <input
                                type="text"
                                className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-bold text-sm"
                                placeholder="E.g., Production AWS, Localhost Dev..."
                                value={config.name}
                                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                            />
                        </div>

                        {/* Environment & Safety */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5 opacity-60">
                                    <Palette className="w-3.5 h-3.5" /> Environment Color
                                </label>
                                <div className="flex bg-muted/50 p-2 rounded-2xl border border-border/50 gap-2 overflow-x-auto custom-scrollbar">
                                    {ENV_COLORS.map(color => (
                                        <button
                                            key={color.id}
                                            type="button"
                                            title={color.label}
                                            onClick={() => setConfig({ ...config, envColor: color.id })}
                                            className={cn(
                                                "w-8 h-8 rounded-xl shrink-0 transition-all flex items-center justify-center border-2",
                                                color.hex,
                                                config.envColor === color.id
                                                    ? "border-foreground ring-2 ring-background ring-offset-2 scale-110 shadow-lg"
                                                    : "border-transparent opacity-50 hover:opacity-100 hover:scale-105"
                                            )}
                                        >
                                            {config.envColor === color.id && <CheckCircle2 className="w-4 h-4 text-white" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2 mb-1.5 opacity-60">
                                    <ShieldAlert className="w-3.5 h-3.5" /> Safety Override
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setConfig({ ...config, readOnly: !config.readOnly })}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left",
                                        config.readOnly
                                            ? "bg-red-500/10 border-red-500/30 text-red-500"
                                            : "bg-muted/50 border-border/50 text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    <div className={cn("p-1.5 rounded-lg", config.readOnly ? "bg-red-500/20" : "bg-background")}>
                                        {config.readOnly ? <Lock className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
                                            {config.readOnly ? "Read-Only Mode On" : "Read-Only Mode Off"}
                                        </div>
                                        <div className="text-[9px] opacity-70">
                                            {config.readOnly ? "Blocks UPDATE, DELETE, INSERT queries" : "Full access to modify database"}
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {connMode === 'manual' ? (
                            <>
                                {config.dbType !== 'kafka' && (
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
                                )}

                                {config.dbType === 'kafka' && (
                                    <>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                                Bootstrap Servers
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                                placeholder="localhost:9092, broker2:9092"
                                                value={`${config.server}:${config.port}`}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    const [firstBroker] = val.split(',');
                                                    const [host, port] = (firstBroker || '').split(':');
                                                    setConfig({ ...config, server: host || val, port: parseInt(port) || 9092 });
                                                }}
                                            />
                                            <p className="text-[10px] text-muted-foreground/60 italic px-1 mt-1">
                                                Comma separated list of brokers (e.g., localhost:9092, localhost:9093)
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                                    SASL Username (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    className="w-full bg-muted/50 border border-border/50 rounded-2xl px-5 py-3.5 focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono text-sm"
                                                    placeholder="Username"
                                                    value={config.user}
                                                    onChange={(e) => setConfig({ ...config, user: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                                                    SASL Password (Optional)
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

                                        <div className="flex items-center gap-2 px-1">
                                            <input
                                                type="checkbox"
                                                id="ssl"
                                                className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-accent"
                                                checked={config.options.encrypt}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    options: { ...config.options, encrypt: e.target.checked }
                                                })}
                                            />
                                            <label htmlFor="ssl" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                                                Require SSL
                                            </label>
                                        </div>
                                    </>
                                )}

                                {config.dbType !== 'kafka' && (
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
                                )}

                                {config.dbType !== 'kafka' && config.dbType !== 'redis' && config.dbType !== 'mongodb' && (
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
                                )}

                                {config.dbType !== 'kafka' && config.dbType !== 'redis' && config.dbType !== 'mongodb' && (
                                    <div className="grid grid-cols-2 gap-4 px-1 py-1">
                                        {/* Enable SSL/TLS */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="encrypt"
                                                className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-accent"
                                                checked={config.options.encrypt}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    options: { ...config.options, encrypt: e.target.checked }
                                                })}
                                            />
                                            <label htmlFor="encrypt" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                                                Enable SSL/TLS
                                            </label>
                                            <div className="relative group/tip">
                                                <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-accent transition-colors cursor-help" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 rounded-xl bg-card border border-border shadow-2xl text-[10px] text-muted-foreground leading-relaxed font-medium pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-50 normal-case tracking-normal">
                                                    <p className="font-bold text-foreground mb-1">🔒 Enable SSL/TLS</p>
                                                    Encrypts all data sent between the app and the database server, protecting against eavesdropping (Man-in-the-middle attacks). Recommended to keep this ON.
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Trust Server Certificate */}
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id="trustCert"
                                                className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-accent"
                                                checked={config.options.trustServerCertificate}
                                                onChange={(e) => setConfig({
                                                    ...config,
                                                    options: { ...config.options, trustServerCertificate: e.target.checked }
                                                })}
                                            />
                                            <label htmlFor="trustCert" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                                                Trust Certificate
                                            </label>
                                            <div className="relative group/tip2">
                                                <Info className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-accent transition-colors cursor-help" />
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 p-3 rounded-xl bg-card border border-border shadow-2xl text-[10px] text-muted-foreground leading-relaxed font-medium pointer-events-none opacity-0 group-hover/tip2:opacity-100 transition-opacity duration-150 z-50 normal-case tracking-normal">
                                                    <p className="font-bold text-foreground mb-1">⚠️ Trust Server Certificate</p>
                                                    Accepts the server's SSL certificate even if it is not signed by a trusted CA. Use this for local or dev servers with self-signed certs. Not recommended for Production.
                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2 px-1">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        className="w-4 h-4 rounded border-border bg-muted/50 text-accent focus:ring-accent"
                                        checked={config.rememberPassword}
                                        onChange={(e) => setConfig({ ...config, rememberPassword: e.target.checked })}
                                    />
                                    <label htmlFor="remember" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider cursor-pointer select-none">
                                        Save login info
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
                                        Save login info
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
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>
                        <button
                            type="submit"
                            disabled={loading || testing}
                            className="flex-[1.5] bg-accent hover:bg-accent/90 disabled:bg-accent/50 text-accent-foreground font-black uppercase text-[10px] tracking-[0.2em] py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-xl shadow-accent/20"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin font-bold" /> : null}
                            {loading ? 'Connecting...' : 'Connect'}
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
