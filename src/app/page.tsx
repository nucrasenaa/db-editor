'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ConnectionForm from '@/components/ConnectionForm';
import Sidebar from '@/components/Sidebar';
import QueryEditor from '@/components/QueryEditor';
import DataTable from '@/components/DataTable';
import { Database, LogOut, Table as TableIcon, LayoutDashboard, Terminal, Search, Filter, X, Plus, Server, Trash2, Globe, User, Link, Maximize2, Github } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConnectionHistory {
  id: string;
  name?: string;
  dbType?: string;
  connectionString?: string;
  server: string;
  port: number;
  user: string;
  password?: string;
  database: string;
  lastUsed: number;
  rememberPassword?: boolean;
}

interface Tab {
  id: string;
  type: 'table' | 'query';
  title: string;
  database: string;
  sqlQuery: string;
  queryResult: { data: any[], columns: string[], totalRows: number };
  loading: boolean;
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDir: 'ASC' | 'DESC';
  filter: string;
  showFilter: boolean;
}

export default function Home() {
  const [config, setConfig] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [initialFormConfig, setInitialFormConfig] = useState<any>(null);
  const [history, setHistory] = useState<ConnectionHistory[]>([]);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Initial tab setup after connection
  useEffect(() => {
    if (config && tabs.length === 0) {
      const dialect = config.dbType || 'mssql';
      const initialTab: Tab = {
        id: 'sql-main',
        type: 'query',
        title: 'SQL Editor',
        database: config.database,
        sqlQuery: dialect === 'mssql' ? 'SELECT TOP 100 * FROM ' : 'SELECT * FROM ',
        queryResult: { data: [], columns: [], totalRows: 0 },
        loading: false,
        page: 1,
        pageSize: 100,
        sortDir: 'ASC',
        filter: '',
        showFilter: false
      };
      setTabs([initialTab]);
      setActiveTabId(initialTab.id);
    }
  }, [config, tabs.length]);

  // Load history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('db_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        setHistory([]);
      }
    }
  }, []);

  const handleConnect = (newConfig: any) => {
    setConfig(newConfig);

    // Manage history
    const connectionId = newConfig.connectionString
      ? `url-${newConfig.connectionString}`
      : `${newConfig.server}:${newConfig.port}-${newConfig.user}-${newConfig.database}`;

    const newHistoryItem: ConnectionHistory = {
      id: connectionId,
      name: newConfig.name,
      dbType: newConfig.dbType,
      connectionString: newConfig.connectionString,
      server: newConfig.server || '',
      port: newConfig.port || 1433,
      user: newConfig.user || '',
      password: newConfig.rememberPassword ? newConfig.password : undefined,
      database: newConfig.database || '',
      lastUsed: Date.now(),
      rememberPassword: newConfig.rememberPassword
    };

    const updatedHistory = [
      newHistoryItem,
      ...history.filter(item => item.id !== connectionId)
    ].slice(0, 12); // Keep last 12

    setHistory(updatedHistory);
    localStorage.setItem('db_history', JSON.stringify(updatedHistory));
    setShowForm(false);
  };

  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('db_history', JSON.stringify(updatedHistory));
  };

  const handleDisconnect = () => {
    setConfig(null);
    setTabs([]);
    setActiveTabId(null);
    setMetadata(null);
  };

  const updateTab = (tabId: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === tabId ? { ...t, ...updates } : t));
  };

  const executeQuery = useCallback(async (query: string, options: {
    tabId?: string,
    db?: string,
    p?: number,
    pSize?: number,
    sortCol?: string,
    sortD?: 'ASC' | 'DESC',
    includeCount?: boolean,
    silent?: boolean
  } = {}) => {
    const targetTabId = options.tabId || activeTabId;
    if (!targetTabId) return;

    // Search current state for defaults, but don't bail if not found.
    // The tab might have been just added to the state queue.
    const currentTab = tabs.find(t => t.id === targetTabId);

    if (!options.silent) updateTab(targetTabId, { loading: true });

    const targetDb = options.db || currentTab?.database || config.database;
    const currentPageSize = options.pSize || currentTab?.pageSize || 100;
    const currentPage = options.p || currentTab?.page || 1;
    const currentSortCol = options.sortCol || currentTab?.sortColumn;
    const currentSortDir = options.sortD || currentTab?.sortDir || 'ASC';

    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: { ...config, database: targetDb },
          query,
          page: currentPage,
          pageSize: currentPageSize,
          orderBy: currentSortCol,
          orderDir: currentSortDir,
          includeCount: options.includeCount ?? false
        }),
      });
      const data = await res.json();
      if (data.success) {
        updateTab(targetTabId, {
          queryResult: {
            data: data.data,
            columns: data.columns,
            totalRows: options.includeCount ? data.totalRows : (currentTab?.queryResult.totalRows || 0)
          },
          page: currentPage,
          pageSize: currentPageSize,
          sortColumn: currentSortCol,
          sortDir: currentSortDir
        });
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error(err);
      if (!options.silent) alert('Failed to execute query');
    } finally {
      if (!options.silent) updateTab(targetTabId, { loading: false });
    }
  }, [config, activeTabId, tabs]);

  const handleObjectSelect = async (fullName: string, type: 'table' | 'view' | 'procedure' | 'synonym', databaseName?: string) => {
    const db = databaseName || config.database;
    const tabId = `tab-${fullName}-${Date.now()}`;

    // Create new tab
    const newTab: Tab = {
      id: tabId,
      type: type === 'procedure' ? 'query' : 'table',
      title: fullName,
      database: db,
      sqlQuery: '',
      queryResult: { data: [], columns: [], totalRows: 0 },
      loading: false,
      page: 1,
      pageSize: 100,
      sortDir: 'ASC',
      filter: '',
      showFilter: false
    };

    let query = '';
    const dialect = config.dbType || 'mssql';

    if (type === 'procedure') {
      try {
        const res = await fetch('/api/db/procedure-snippet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config, fullName, type, database: db }),
        });
        const data = await res.json();
        if (data.success && data.snippet) {
          query = data.snippet;
        } else {
          query = dialect === 'mssql'
            ? `SELECT definition FROM [${db}].sys.sql_modules WHERE object_id = OBJECT_ID('[${db}].${fullName}')`
            : `SHOW CREATE PROCEDURE ${fullName}`;
        }
      } catch (e) {
        query = `EXEC ${fullName}`;
      }
    } else {
      if (dialect === 'mssql') {
        query = `SELECT TOP 100 * FROM [${db}].${fullName}`;
      } else if (dialect === 'postgres') {
        query = `SELECT * FROM ${fullName} LIMIT 100`;
      } else {
        query = `SELECT * FROM \`${db}\`.\`${fullName.split('.').pop()}\` LIMIT 100`;
      }
    }

    newTab.sqlQuery = query;
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);

    if (type !== 'procedure') {
      executeQuery(query, { tabId, db, p: 1, includeCount: true });
    }
  };

  const closeTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  const addQueryTab = () => {
    const id = `query-${Date.now()}`;
    const dialect = config.dbType || 'mssql';
    const newTab: Tab = {
      id,
      type: 'query',
      title: 'New Query',
      database: config.database,
      sqlQuery: dialect === 'mssql' ? 'SELECT TOP 100 * FROM ' : 'SELECT * FROM ',
      queryResult: { data: [], columns: [], totalRows: 0 },
      loading: false,
      page: 1,
      pageSize: 100,
      sortDir: 'ASC',
      filter: '',
      showFilter: false
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
  };

  const reloadData = () => {
    if (activeTab) {
      executeQuery(activeTab.sqlQuery);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (activeTab) {
      executeQuery(activeTab.sqlQuery, { p: newPage });
    }
  };

  const handleSort = (column: string) => {
    if (activeTab) {
      const newDir = activeTab.sortColumn === column && activeTab.sortDir === 'ASC' ? 'DESC' : 'ASC';
      executeQuery(activeTab.sqlQuery, { sortCol: column, sortD: newDir });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (activeTab) {
      executeQuery(activeTab.sqlQuery, { p: 1, pSize: newSize, includeCount: true });
    }
  };

  const handleFilterSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab) {
      // Simple heuristic: if it's a generated table query, we can append/replace WHERE
      // Otherwise, for custom queries, this might be tricky. 
      // For now, let's assume filtering applies primarily to 'table' tabs which have standard SELECT * FROM ...
      if (activeTab.type === 'table') {
        const baseQuery = activeTab.sqlQuery.split(' WHERE ')[0].split(' ORDER BY ')[0].split(' OFFSET ')[0];
        const condition = activeTab.filter.trim() ? ` WHERE ${activeTab.filter}` : '';
        const newQuery = `${baseQuery}${condition}`;
        updateTab(activeTab.id, { sqlQuery: newQuery });
        executeQuery(newQuery, { p: 1, includeCount: true });
      }
    }
  };

  const handleUpdate = async (rowIndex: number, column: string, newValue: any, originalRow: any) => {
    if (!activeTab || activeTab.type !== 'table' || !config) return false;

    try {
      const res = await fetch('/api/db/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          database: activeTab.database,
          table: activeTab.title, // In table tabs, title is the fullName
          updates: { [column]: newValue },
          where: originalRow
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.rowsAffected === 0) {
          alert('No rows were updated.');
          return false;
        }
        reloadData();
        return true;
      } else {
        alert(data.message);
        return false;
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Update failed');
      return false;
    }
  };

  const handleMetadataLoad = (dbName: string, newMetadata: any) => {
    if (dbName.toLowerCase() === (activeTab?.database.toLowerCase() || config.database.toLowerCase())) {
      setMetadata(newMetadata);
    }
  };

  if (!config) {
    if (showForm) {
      return (
        <ConnectionForm
          onConnect={handleConnect}
          onCancel={() => setShowForm(false)}
          initialConfig={initialFormConfig}
        />
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background overflow-y-auto">
        <div className="w-full max-w-4xl space-y-12">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-accent/10 mb-2">
              <Database className="w-10 h-10 text-accent" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter gradient-text uppercase">Database Explorer</h1>
            <p className="text-muted-foreground text-lg">Select a recent connection or create a new one</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Add New Card */}
            <button
              onClick={() => { setInitialFormConfig(null); setShowForm(true); }}
              className="h-48 rounded-2xl border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all group flex flex-col items-center justify-center gap-4"
            >
              <div className="p-4 bg-muted rounded-full group-hover:bg-accent group-hover:text-accent-foreground transition-all">
                <Plus className="w-6 h-6" />
              </div>
              <span className="font-bold text-sm uppercase tracking-widest opacity-50 group-hover:opacity-100">Add Connection</span>
            </button>

            {/* History Items */}
            {history.map((conn) => (
              <div
                key={conn.id}
                onClick={() => { setInitialFormConfig(conn); setShowForm(true); }}
                className="h-48 rounded-2xl border border-border bg-card/50 p-6 flex flex-col justify-between hover:border-accent hover:shadow-xl hover:shadow-accent/5 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-0 group-hover:opacity-100 transition-all" />

                <div className="flex justify-between items-start">
                  <div className="p-3 bg-muted rounded-xl text-muted-foreground group-hover:text-accent group-hover:bg-accent/10 transition-colors">
                    <Server className="w-6 h-6" />
                  </div>
                  <div className="flex gap-1 items-center">
                    {conn.connectionString && (
                      <div className="p-1.5 bg-accent/10 text-accent rounded-full" title="URL Mode">
                        <Link className="w-3 h-3" />
                      </div>
                    )}
                    <button
                      onClick={(e) => removeFromHistory(conn.id, e)}
                      className="p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-bold text-lg truncate group-hover:text-accent transition-colors flex items-center gap-2">
                    {conn.name || (conn.connectionString ? 'DB URL' : conn.server)}
                    {!conn.name && !conn.connectionString && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground/50 font-normal">Host</span>}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                    <Globe className="w-3 h-3" />
                    {conn.database || 'Metadata URL'}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground/60 font-mono">
                    <User className="w-3 h-3" />
                    {conn.dbType?.toUpperCase() || 'MSSQL'} • {conn.user || 'Link'}
                  </div>
                </div>

                <div className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-bold mt-2">
                  {new Date(conn.lastUsed).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-muted-foreground/40 font-mono uppercase tracking-[0.2em]">
            MSSQL • SECURE • PERSISTENT
          </p>

          <footer className="pt-12 border-t border-border/50 flex flex-col items-center gap-6">
            <a
              href="https://github.com/nucrasenaa/db-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-muted/30 hover:bg-accent/10 border border-border/50 hover:border-accent/20 transition-all"
            >
              <Github className="w-5 h-5 group-hover:text-accent group-hover:scale-110 transition-all" />
              <span className="text-xs font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 group-hover:text-accent transition-all">Source Repository</span>
            </a>

            <div className="text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
                THREE MAN DEV © 2026. ALL RIGHTS RESERVED.
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent/40">
                BANGKOK, THAILAND
              </p>
            </div>
          </footer>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-background h-screen overflow-hidden">
      <Sidebar
        config={config}
        onObjectSelect={handleObjectSelect}
        onMetadataLoad={handleMetadataLoad}
        selectedObject={activeTab?.title || null}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header / Tab Bar */}
        <header className="h-14 border-b border-border bg-card/30 flex items-center px-4 shrink-0 overflow-x-auto no-scrollbar gap-1">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                "group flex items-center gap-2 px-4 py-1.5 rounded-xl cursor-context-menu transition-all h-10 min-w-[120px] max-w-[200px] border relative",
                activeTabId === tab.id
                  ? "bg-accent/10 border-accent/20 text-accent font-bold"
                  : "bg-muted/30 border-transparent text-muted-foreground hover:bg-muted/50"
              )}
            >
              {tab.type === 'table' ? <TableIcon className="w-3.5 h-3.5 shrink-0" /> : <Terminal className="w-3.5 h-3.5 shrink-0" />}
              <span className="text-[11px] truncate uppercase tracking-wider">{tab.title}</span>
              <button
                onClick={(e) => closeTab(tab.id, e)}
                className="ml-auto opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-all"
              >
                <X className="w-3 h-3" />
              </button>
              {activeTabId === tab.id && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full" />}
            </div>
          ))}

          <button
            onClick={addQueryTab}
            className="p-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all ml-1"
            title="Open New Query"
          >
            <Plus className="w-4 h-4" />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex flex-col items-end opacity-60">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase leading-none">Status</span>
              <span className="text-[9px] font-mono font-bold text-emerald-400">ENCRYPTED</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/10 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> Terminate Link
            </button>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {activeTab ? (
            <>
              {activeTab.type === 'query' ? (
                <div className="flex-1 flex flex-col">
                  <QueryEditor
                    query={activeTab.sqlQuery}
                    onQueryChange={(q) => updateTab(activeTab.id, { sqlQuery: q })}
                    onExecute={() => executeQuery(activeTab.sqlQuery, { tabId: activeTab.id, includeCount: true })}
                    loading={activeTab.loading}
                    metadata={metadata}
                    dbType={config.dbType}
                  />
                  <div className="flex-1 overflow-hidden">
                    <DataTable
                      data={activeTab.queryResult.data}
                      columns={activeTab.queryResult.columns}
                      loading={activeTab.loading}
                      page={activeTab.page}
                      pageSize={activeTab.pageSize}
                      totalRows={activeTab.queryResult.totalRows}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      onSort={handleSort}
                      sortColumn={activeTab.sortColumn}
                      sortDir={activeTab.sortDir}
                      onUpdate={handleUpdate} // Query tabs can also have editable results if they are simple selects
                      allowEdit={true} // Allow editing in query results too
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <div className="h-12 border-b border-border bg-muted/10 flex items-center px-6 gap-4 shrink-0">
                    <div className="flex-1 flex gap-4 items-center">
                      <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                        <TableIcon className="w-3.5 h-3.5 text-blue-400" />
                        {activeTab.title}
                      </div>
                      <div className="h-6 w-px bg-border/50 mx-1" />
                      <button
                        onClick={() => updateTab(activeTab.id, { showFilter: !activeTab.showFilter })}
                        className={cn(
                          "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all",
                          activeTab.showFilter ? "bg-accent/10 text-accent border border-accent/20" : "text-muted-foreground hover:bg-muted"
                        )}
                      >
                        <Filter className="w-3.5 h-3.5" /> {activeTab.showFilter ? 'Filtering ON' : 'Quick Filter'}
                      </button>
                      {activeTab.showFilter && (
                        <form onSubmit={handleFilterSearch} className="flex-1 max-w-md animate-in slide-in-from-left-2 fade-in">
                          <div className="relative flex items-center">
                            <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                            <input
                              type="text"
                              placeholder="WHERE condition (e.g., id > 100 AND name LIKE '%A%')"
                              className="w-full bg-muted/50 border border-border/50 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                              value={activeTab.filter}
                              onChange={(e) => updateTab(activeTab.id, { filter: e.target.value })}
                              autoFocus
                            />
                            <button type="submit" className="hidden" />
                          </div>
                        </form>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                        Loaded {activeTab.queryResult.data.length} of {activeTab.queryResult.totalRows}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <DataTable
                      data={activeTab.queryResult.data}
                      columns={activeTab.queryResult.columns}
                      loading={activeTab.loading}
                      page={activeTab.page}
                      pageSize={activeTab.pageSize}
                      totalRows={activeTab.queryResult.totalRows}
                      onPageChange={handlePageChange}
                      onPageSizeChange={handlePageSizeChange}
                      onSort={handleSort}
                      sortColumn={activeTab.sortColumn}
                      sortDir={activeTab.sortDir}
                      onUpdate={handleUpdate}
                      allowEdit={true}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-40">
              <div className="p-10 rounded-full bg-muted/20 border border-dashed border-border flex items-center justify-center">
                <Maximize2 className="w-16 h-16 text-muted-foreground" />
              </div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground">Select an object to forge</p>
            </div>
          )}
        </main>

        <footer className="h-8 border-t border-border/30 bg-card/20 flex items-center justify-between px-6 shrink-0 shrink-0">
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">
            <span>Three Man Dev © 2026</span>
            <div className="w-1 h-1 rounded-full bg-border" />
            <span>Bangkok, Thailand</span>
          </div>
          <a
            href="https://github.com/nucrasenaa/db-editor"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-accent transition-colors"
          >
            <Github className="w-3 h-3" /> GitHub
          </a>
        </footer>
      </div>
    </div>
  );
}
