'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Activity,
    Cpu,
    Database,
    Clock,
    AlertCircle,
    RefreshCw,
    Search,
    Filter,
    HardDrive,
    Zap,
    Terminal,
    ChevronRight,
    Loader2,
    RotateCcw
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ServerMonitorProps {
    config: any;
    onClose: () => void;
}

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
}

const StatCard = ({ title, value, subtitle, icon, color = 'blue' }: StatCardProps) => (
    <div className="bg-card border border-border/50 rounded-2xl p-5 hover:border-purple-500/30 transition-all group overflow-hidden relative">
        <div className={cn("absolute top-0 right-0 w-24 h-24 blur-3xl opacity-5 rounded-full pointer-events-none", `bg-${color}-500`)} />
        <div className="flex items-start justify-between relative">
            <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{title}</p>
                <h3 className="text-2xl font-black text-foreground tracking-tight">{value}</h3>
                {subtitle && <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{subtitle}</p>}
            </div>
            <div className={cn("p-3 rounded-xl bg-muted group-hover:bg-purple-500/10 transition-colors", `text-${color}-500 group-hover:text-purple-500`)}>
                {icon}
            </div>
        </div>
    </div>
);

export default function ServerMonitor({ config, onClose }: ServerMonitorProps) {
    const [stats, setStats] = useState<any>(null);
    const [activeRequests, setActiveRequests] = useState<any[]>([]);
    const [waitStats, setWaitStats] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentLog, setCurrentLog] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'waits'>('dashboard');
    const [logSearch, setLogSearch] = useState('');
    const [logError, setLogError] = useState<string | null>(null);
    const [logsLoading, setLogsLoading] = useState(false);

    const fetchData = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const dialect = config?.dbType || 'mssql';

            if (dialect === 'mssql') {
                // Combine multiple diagnostic queries into a single multi-result-set query
                const batchQuery = `
                    -- 1. CPU & Basic Stats
                    SELECT TOP 1 
                        [SQLProcessUtilization] as sql_cpu,
                        [SystemIdle] as system_idle,
                        100 - [SystemIdle] - [SQLProcessUtilization] as other_cpu,
                        GETDATE() as snapshot_time
                    FROM (
                        SELECT record.value('(./Record/@id)[1]', 'int') AS record_id,
                            record.value('(./Record/SchedulerMonitorEvent/SystemHealth/SystemIdle)[1]', 'int') AS [SystemIdle],
                            record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS [SQLProcessUtilization], 
                            [timestamp]
                        FROM (
                            SELECT [timestamp], convert(xml, record) AS [record] 
                            FROM sys.dm_os_ring_buffers 
                            WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
                            AND record LIKE '%<SystemHealth>%'
                        ) AS x
                    ) AS y 
                    ORDER BY record_id DESC;

                    -- 2. Buffer Cache Hit Ratio & Page Life Expectancy
                    SELECT 
                        (SELECT CAST(cntr_value AS FLOAT) FROM sys.dm_os_performance_counters WHERE counter_name = 'Buffer cache hit ratio' AND object_name LIKE '%Buffer Manager%') /
                        (SELECT CAST(cntr_value AS FLOAT) FROM sys.dm_os_performance_counters WHERE counter_name = 'Buffer cache hit ratio base' AND object_name LIKE '%Buffer Manager%') * 100 as cache_hit_ratio,
                        (SELECT cntr_value FROM sys.dm_os_performance_counters WHERE counter_name = 'Page life expectancy' AND object_name LIKE '%Buffer Manager%') as ple;

                    -- 3. Active Requests
                    SELECT 
                        r.session_id, r.status, r.command, r.cpu_time, r.total_elapsed_time, r.wait_type, r.wait_time, r.last_wait_type,
                        SUBSTRING(st.text, (r.statement_start_offset/2)+1, ((CASE r.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE r.statement_end_offset END - r.statement_start_offset)/2) + 1) AS query_text,
                        db_name(r.database_id) as database_name
                    FROM sys.dm_exec_requests r
                    CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) st
                    WHERE r.session_id != @@SPID;

                    -- 4. Top Wait Stats
                    SELECT TOP 10 wait_type, waiting_tasks_count, wait_time_ms, max_wait_time_ms
                    FROM sys.dm_os_wait_stats
                    WHERE wait_type NOT IN ('CLR_SEMAPHORE', 'LAZYWRITER_SLEEP', 'RESOURCE_QUEUE', 'SLEEP_TASK', 'SLEEP_SYSTEMTASK', 'SQLTRACE_BUFFER_FLUSH', 'WAITFOR', 'LOGMGR_QUEUE', 'CHECKPOINT_QUEUE', 'REQUEST_FOR_DEADLOCK_SEARCH', 'XE_TIMER_EVENT', 'BROKER_TO_FLUSH', 'BROKER_TASK_STOP', 'CLR_MANUAL_EVENT', 'CLR_AUTO_EVENT', 'DISPATCHER_QUEUE_SEMAPHORE', 'FT_IFTS_SCHEDULER_IDLE_WAIT', 'XE_DISPATCH_WAIT', 'XE_LIVE_TARGET_TVF', 'BROKER_EVENT_HANDLER', 'OLD_JOB_CHECK', 'FILESTREAM_WORKITEM_QUEUE', 'DIRTY_PAGE_POLL', 'HADR_FILESTREAM_IOMGR_IOCOMPLETION')
                    ORDER BY wait_time_ms DESC;
                `;

                const res = await apiRequest('/api/db/query', 'POST', { config, query: batchQuery });

                if (res.success && res.isMultiSet && res.resultSets?.length >= 4) {
                    const cpu = res.resultSets[0].data[0] || {};
                    const memory = res.resultSets[1].data[0] || {};

                    setStats({
                        cpu: cpu.sql_cpu || 0,
                        systemCpu: 100 - (cpu.system_idle || 100),
                        cacheHit: Math.round((memory.cache_hit_ratio || 0) * 100) / 100,
                        ple: memory.ple || 0,
                    });

                    setActiveRequests(res.resultSets[2].data || []);
                    setWaitStats(res.resultSets[3].data || []);
                }
            }
        } catch (err) {
            console.error('[Monitor] Error fetching server health:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [config]);

    const fetchLogs = useCallback(async () => {
        const dialect = config?.dbType || 'mssql';
        if (dialect !== 'mssql') return;

        setLogsLoading(true);
        setLogError(null);
        try {
            // Use NULL if search is empty for better compatibility
            const searchParam = logSearch.trim() ? `'${logSearch.replace(/'/g, "''")}'` : 'NULL';
            const res = await apiRequest('/api/db/query', 'POST', {
                config,
                query: `
                    DECLARE @st datetime = DATEADD(day, -7, GETDATE());
                    EXEC master.sys.xp_readerrorlog 0, 1, ${searchParam}, NULL, @st;
                `
            });

            if (res.success) {
                setCurrentLog(res.data || []);
            } else {
                setLogError(res.message || 'Failed to fetch logs. Ensure you have sysadmin permissions.');
                setCurrentLog([]);
            }
        } catch (err: any) {
            console.error('[Monitor] Error fetching logs:', err);
            setLogError(err.message || 'An unexpected error occurred while fetching logs.');
            setCurrentLog([]);
        } finally {
            setLogsLoading(false);
        }
    }, [config, logSearch]);

    useEffect(() => {
        fetchData();
        const timer = setInterval(() => fetchData(true), 5000);
        return () => clearInterval(timer);
    }, [fetchData]);

    useEffect(() => {
        if (activeTab === 'logs') fetchLogs();
    }, [activeTab, fetchLogs]);

    return (
        <div className="flex-1 flex flex-col bg-background overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="h-16 border-b border-border bg-card/30 flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                        <Activity className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-1">Server Monitor</h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">ENTERPRISE PERFORMANCE DASHBOARD</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-muted/50 p-1 rounded-xl items-center mr-4">
                        <button
                            onClick={() => setActiveTab('dashboard')}
                            className={cn("px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'dashboard' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            Health
                        </button>
                        <button
                            onClick={() => setActiveTab('waits')}
                            className={cn("px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'waits' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            Wait Stats
                        </button>
                        <button
                            onClick={() => setActiveTab('logs')}
                            className={cn("px-4 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all", activeTab === 'logs' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                        >
                            Logs
                        </button>
                    </div>

                    <button
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                        className="p-2 hover:bg-muted rounded-xl text-muted-foreground transition-all flex items-center gap-2"
                    >
                        <RefreshCw className={cn("w-4 h-4", refreshing && "animate-spin")} />
                    </button>
                    <button
                        onClick={onClose}
                        className="flex items-center gap-2 px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_center,_#1e1e22_1px,_transparent_1px)] bg-[size:24px_24px] p-8">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Initializing Diagnostics...</p>
                    </div>
                ) : (
                    <div className="max-w-7xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">

                        {activeTab === 'dashboard' && (
                            <>
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <StatCard
                                        title="SQL CPU Usage"
                                        value={`${stats?.cpu}%`}
                                        subtitle={`System Idle: ${100 - (stats?.systemCpu || 0)}%`}
                                        icon={<Cpu className="w-5 h-5" />}
                                        color="red"
                                    />
                                    <StatCard
                                        title="Buffer Cache Hit"
                                        value={`${stats?.cacheHit}%`}
                                        subtitle="Target: >95.0%"
                                        icon={<HardDrive className="w-5 h-5" />}
                                        color="emerald"
                                    />
                                    <StatCard
                                        title="Page Life Expectancy"
                                        value={`${Math.floor(stats?.ple / 60)}m`}
                                        subtitle={`${stats?.ple} seconds`}
                                        icon={<Clock className="w-5 h-5" />}
                                        color="amber"
                                    />
                                    <StatCard
                                        title="Active Requests"
                                        value={activeRequests.length}
                                        subtitle="Exclusive of monitor"
                                        icon={<Zap className="w-5 h-5" />}
                                        color="indigo"
                                    />
                                </div>

                                {/* Active Queries */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-emerald-500" />
                                            <h3 className="text-xs font-black uppercase tracking-widest">Active Requests</h3>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Live Updates every 5s</span>
                                    </div>

                                    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="bg-muted/30 border-b border-border">
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Session</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">DB</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">CPU</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">Wait Type</th>
                                                        <th className="px-4 py-3 text-[9px] font-black uppercase tracking-widest text-muted-foreground">SQL Text</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {activeRequests.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="px-4 py-12 text-center text-[10px] text-muted-foreground uppercase tracking-widest opacity-40">
                                                                No user requests currently processing
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        activeRequests.map((req, i) => (
                                                            <tr key={i} className="hover:bg-muted/20 transition-colors group">
                                                                <td className="px-4 py-4 text-xs font-mono font-bold text-emerald-500">{req.session_id}</td>
                                                                <td className="px-4 py-4 text-[10px] uppercase font-bold text-muted-foreground">{req.database_name}</td>
                                                                <td className="px-4 py-4">
                                                                    <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest",
                                                                        req.status === 'suspended' ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500")}>
                                                                        {req.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-4 text-xs font-mono">{req.cpu_time}ms</td>
                                                                <td className="px-4 py-4">
                                                                    <span className="text-[10px] font-mono text-muted-foreground break-all">{req.wait_type || 'None'}</span>
                                                                </td>
                                                                <td className="px-4 py-4">
                                                                    <div className="max-w-md truncate text-xs font-mono text-foreground/80 group-hover:text-foreground transition-colors">
                                                                        {req.query_text}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'waits' && (
                            <div className="space-y-6">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-amber-500" />
                                    <h3 className="text-xs font-black uppercase tracking-widest">Wait Statistics</h3>
                                </div>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="bg-card border border-border rounded-2xl p-6">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-6">Cumulative Waits (ms)</h4>
                                        <div className="space-y-4">
                                            {waitStats.map(wait => {
                                                const maxWait = waitStats[0]?.wait_time_ms || 1;
                                                const percentage = Math.min(100, (wait.wait_time_ms / maxWait) * 100);

                                                return (
                                                    <div key={wait.wait_type} className="space-y-2">
                                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                                            <span className="font-bold text-foreground">{wait.wait_type}</span>
                                                            <span className="text-muted-foreground">{(wait.wait_time_ms || 0).toLocaleString()} ms</span>
                                                        </div>
                                                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-amber-500 rounded-full"
                                                                style={{ width: `${percentage}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-6">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-blue-500/20 rounded-xl text-blue-500"><Search className="w-5 h-5 " /></div>
                                                <div>
                                                    <h4 className="text-[10px] font-black uppercase tracking-widest">Performance Insight</h4>
                                                    <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                                                        The top wait type is <span className="text-foreground font-bold">{waitStats[0]?.wait_type}</span>.
                                                        High values here usually indicate specific resource bottlenecks that can be Tuned using indexes or hardware allocation.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'logs' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Search className="w-4 h-4 text-blue-500" />
                                        <h3 className="text-xs font-black uppercase tracking-widest whitespace-nowrap">SQL Server Error Log</h3>
                                        <div className="px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded text-[8px] font-black uppercase tracking-widest border border-blue-500/20">
                                            Last 7 Days
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-64">
                                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground opacity-40" />
                                            <input
                                                type="text"
                                                placeholder="Filter log entries..."
                                                value={logSearch}
                                                onChange={(e) => setLogSearch(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
                                                className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            />
                                        </div>
                                        <button
                                            onClick={fetchLogs}
                                            className="px-4 py-2 bg-blue-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
                                        >
                                            Fetch Logs
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl h-[600px] flex flex-col">
                                    <div className="flex-1 overflow-auto p-4 font-mono text-[11px] space-y-2 bg-[#1a1a1e] relative">
                                        {config?.dbType && config.dbType !== 'mssql' ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-50 px-8 text-center">
                                                <AlertCircle className="w-12 h-12 mb-4 text-amber-500" />
                                                <span className="uppercase tracking-[0.2em] font-black text-amber-500 mb-2">Not Supported</span>
                                                <p className="text-[10px] text-muted-foreground uppercase leading-relaxed">
                                                    SQL Server Error Log monitoring is currently only available for MSSQL connections.
                                                </p>
                                            </div>
                                        ) : logsLoading ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-50">
                                                <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
                                                <span className="uppercase tracking-[0.2em]">Synchronizing Logs...</span>
                                            </div>
                                        ) : logError ? (
                                            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                                                <AlertCircle className="w-12 h-12 mb-4 text-red-500" />
                                                <span className="uppercase tracking-[0.2em] font-black text-red-500 mb-2">Access Denied / Error</span>
                                                <p className="text-[10px] text-red-400 font-bold uppercase mb-6 max-w-md bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                                                    {logError}
                                                </p>
                                                <button
                                                    onClick={fetchLogs}
                                                    className="flex items-center gap-2 px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-border"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> Re-attempt Connection
                                                </button>
                                            </div>
                                        ) : currentLog.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center opacity-30">
                                                <Terminal className="w-12 h-12 mb-4" />
                                                <span className="uppercase tracking-[0.2em] font-black">Memory Empty / No logs found</span>
                                            </div>
                                        ) : (
                                            currentLog.map((log, i) => {
                                                const logDate = log.LogDate || log.logDate || log.log_date;
                                                const processInfo = log.ProcessInfo || log.processInfo || log.process_info || 'SYSTEM';
                                                const text = log.Text || log.text || log.Message || log.message || '';

                                                return (
                                                    <div key={i} className="flex gap-4 p-2 hover:bg-white/5 rounded transition-colors group border-b border-white/[0.03] last:border-0">
                                                        <span className="text-muted-foreground w-40 shrink-0">{logDate ? new Date(logDate).toLocaleString() : 'N/A'}</span>
                                                        <span className="text-amber-500 w-24 shrink-0 font-bold uppercase truncate">{processInfo}</span>
                                                        <span className={cn("flex-1 text-foreground/80 group-hover:text-foreground break-words", text.toLowerCase().includes('error') && "text-red-400")}>
                                                            {text}
                                                        </span>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
