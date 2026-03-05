'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ConnectionForm from '@/components/ConnectionForm';
import Sidebar from '@/components/Sidebar';
import QueryEditor from '@/components/QueryEditor';
import DataTable from '@/components/DataTable';
import { Database, LogOut, Table as TableIcon, LayoutDashboard, Terminal, Search, Filter, X, Plus, Server, Trash2, Globe, User, Link as LinkIcon, Maximize2, Github, PlusCircle, Layers, Zap, RotateCcw, Share2, Sparkles, AlertCircle, Menu, Sun, Moon, Book } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/api';
import TableDesigner from '@/components/TableDesigner';
import ImportWizard from '@/components/ImportWizard';
import VisualQueryBuilder from '@/components/VisualQueryBuilder';
import ViewDesigner from '@/components/ViewDesigner';
import ProcDesigner from '@/components/ProcDesigner';
import ExecutionPlan from '@/components/ExecutionPlan';
import ERDiagram from '@/components/ERDiagram';
import ServerMonitor from '@/components/ServerMonitor';
import UserManager from '@/components/UserManager';
import SchemaCompare from '@/components/SchemaCompare';
import AISettings from '@/components/AISettings';
import PerformanceAdvisor from '@/components/PerformanceAdvisor';
import { saveToHistory } from '@/lib/history';
import { popoutTab } from '@/lib/popout';
import { Activity, Users, GitCompare, Settings } from 'lucide-react';

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

interface ResultSet {
  data: any[];
  columns: string[];
  totalRows: number;
}

interface Tab {
  id: string;
  type: 'table' | 'query' | 'table-designer' | 'view-designer' | 'proc-designer' | 'import-wizard' | 'query-builder' | 'er-diagram' | 'server-monitor' | 'user-manager' | 'schema-compare' | 'ai-settings' | 'performance-advisor';
  title: string;
  database: string;
  sqlQuery: string;
  queryResult: ResultSet;
  resultSets?: ResultSet[];
  activeResultSetIndex?: number;
  loading: boolean;
  page: number;
  pageSize: number;
  sortColumn?: string;
  sortDir: 'ASC' | 'DESC';
  filter: string;
  showFilter: boolean;
  tableName?: string;
  executionPlan?: any[];
  showPlan?: boolean;
  error?: string;
  aiThinking?: boolean;
  aiStatus?: string;
}

export default function Home() {
  const [config, setConfig] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [initialFormConfig, setInitialFormConfig] = useState<any>(null);
  const [history, setHistory] = useState<ConnectionHistory[]>([]);

  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [allMetadata, setAllMetadata] = useState<Record<string, any>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const autoFetchedTabs = React.useRef<Set<string>>(new Set());

  // Restore theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('forge-theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      // Theme class is also handled in a inline script in layout.tsx to prevent flicker, 
      // but we ensure it matches the state here after hydration.
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    } else {
      // Default to light if nothing is in localStorage
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('forge-theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  };

  const activeTab = tabs.find(t => t.id === activeTabId);

  // Initial tab setup after connection: Load from cache or set default
  useEffect(() => {
    if (config && tabs.length === 0) {
      const connectionId = config.connectionString
        ? `url-${config.connectionString}`
        : `${config.server}:${config.port}-${config.user}-${config.database}`;

      const savedData = localStorage.getItem(`tabs_${connectionId}`);
      if (savedData) {
        try {
          const { tabs: savedTabs, activeTabId: savedActiveTabId } = JSON.parse(savedData);
          if (savedTabs && savedTabs.length > 0) {
            const restoredTabs = savedTabs.map((t: any) => ({
              ...t,
              queryResult: { data: [], columns: [], totalRows: 0 },
              loading: false
            }));
            setTabs(restoredTabs);
            setActiveTabId(savedActiveTabId || restoredTabs[0].id);
            return;
          }
        } catch (e) {
          console.error("Failed to restore tabs", e);
        }
      }

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

  // Save tabs to localStorage whenever they change
  useEffect(() => {
    if (config && tabs.length > 0) {
      const connectionId = config.connectionString
        ? `url-${config.connectionString}`
        : `${config.server}:${config.port}-${config.user}-${config.database}`;

      const tabsToSave = tabs.map(tab => ({
        id: tab.id,
        type: tab.type,
        title: tab.title,
        database: tab.database,
        sqlQuery: tab.sqlQuery,
        page: tab.page,
        pageSize: tab.pageSize,
        sortColumn: tab.sortColumn,
        sortDir: tab.sortDir,
        filter: tab.filter,
        showFilter: tab.showFilter
      }));

      localStorage.setItem(`tabs_${connectionId}`, JSON.stringify({
        tabs: tabsToSave,
        activeTabId
      }));
    }
  }, [tabs, activeTabId, config]);

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

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + T -> New Query Tab (only if connected)
      if ((e.metaKey || e.ctrlKey) && e.key === 't' && config) {
        e.preventDefault();
        addQueryTab();
      }

      // Cmd/Ctrl + W -> Close current Tab
      if ((e.metaKey || e.ctrlKey) && e.key === 'w' && activeTabId) {
        e.preventDefault();
        closeTab(activeTabId);
      }

      // Cmd/Ctrl + P -> Quick Search Focus
      if ((e.metaKey || e.ctrlKey) && e.key === 'p' && config) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('focus-search'));
      }

      // Cmd/Ctrl + R -> Reload Data
      if ((e.metaKey || e.ctrlKey) && e.key === 'r' && config && activeTab) {
        e.preventDefault();
        reloadData();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, activeTabId, activeTab]);

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

    const currentTab = tabs.find(t => t.id === targetTabId);
    if (!options.silent) updateTab(targetTabId, { loading: true, error: undefined });

    const targetDb = options.db || currentTab?.database || config.database;
    const currentPageSize = options.pSize || currentTab?.pageSize || 100;
    const currentPage = options.p || currentTab?.page || 1;
    const currentSortCol = options.sortCol || currentTab?.sortColumn;
    const currentSortDir = options.sortD || currentTab?.sortDir || 'ASC';

    const startTime = Date.now();
    try {
      const data = await apiRequest('/api/db/query', 'POST', {
        config: { ...config, database: targetDb },
        query,
        page: currentPage,
        pageSize: currentPageSize,
        orderBy: currentSortCol,
        orderDir: currentSortDir,
        includeCount: options.includeCount ?? false
      });

      if (data.success) {
        saveToHistory({
          sql: query,
          database: targetDb,
          success: true,
          executionTime: Date.now() - startTime,
          rowsAffected: data.data?.length
        });

        const mainResult = data.isMultiSet && data.resultSets && data.resultSets.length > 0
          ? data.resultSets[0]
          : {
            data: data.data || [],
            columns: data.columns || [],
            totalRows: options.includeCount ? data.totalRows : (currentTab?.queryResult.totalRows || 0)
          };

        updateTab(targetTabId, {
          queryResult: mainResult,
          resultSets: data.isMultiSet ? data.resultSets : undefined,
          activeResultSetIndex: data.isMultiSet ? 0 : undefined,
          executionPlan: data.executionPlan,
          showPlan: !!data.executionPlan,
          page: currentPage,
          pageSize: currentPageSize,
          sortColumn: currentSortCol,
          sortDir: currentSortDir,
          error: undefined
        });
      } else {
        saveToHistory({
          sql: query,
          database: targetDb,
          success: false,
          executionTime: Date.now() - startTime
        });
        updateTab(targetTabId, {
          error: data.message,
          queryResult: { data: [], columns: [], totalRows: 0 },
          resultSets: undefined,
          executionPlan: undefined
        });
      }
    } catch (err: any) {
      console.error(err);
      saveToHistory({
        sql: query,
        database: targetDb,
        success: false,
        executionTime: Date.now() - startTime
      });
      if (!options.silent) {
        updateTab(targetTabId, {
          error: err.message || 'Failed to execute query',
          queryResult: { data: [], columns: [], totalRows: 0 }
        });
      }
    } finally {
      if (!options.silent) updateTab(targetTabId, { loading: false });
    }
  }, [config, activeTabId, tabs]);

  // Clear auto-fetch tracking on disconnect
  useEffect(() => {
    if (!config) {
      autoFetchedTabs.current.clear();
    }
  }, [config]);

  // Auto-fetch data for restored table tabs when they become active
  useEffect(() => {
    if (config && activeTabId && activeTab && activeTab.type === 'table' && !activeTab.loading && !autoFetchedTabs.current.has(activeTabId)) {
      autoFetchedTabs.current.add(activeTabId);
      if (activeTab.sqlQuery) {
        executeQuery(activeTab.sqlQuery, { tabId: activeTabId, includeCount: true, silent: true });
      }
    } else if (activeTabId && activeTab && activeTab.type !== 'table') {
      // Mark non-table tabs as "fetched" so we don't keep checking them
      autoFetchedTabs.current.add(activeTabId);
    }
  }, [config, activeTabId, activeTab, executeQuery]);

  const handleObjectSelect = async (fullName: string, type: 'table' | 'view' | 'procedure' | 'synonym', databaseName?: string) => {
    const db = databaseName || config.database;

    // Check if tab already exists for this object
    const existingTab = tabs.find(t =>
      (t.type === 'table' || t.type === 'query') &&
      t.title === fullName &&
      t.database === db
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

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
      showFilter: false,
      tableName: type === 'procedure' ? undefined : fullName
    };

    let query = '';
    const dialect = config.dbType || 'mssql';

    if (type === 'procedure') {
      try {
        const data = await apiRequest('/api/db/procedure-snippet', 'POST', { config, fullName, type, database: db });
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

  const handleViewScript = async (fullName: string, type: 'table' | 'view' | 'procedure', database: string) => {
    const title = `DDL: ${fullName}`;
    const existingTab = tabs.find(t =>
      t.title === title &&
      t.database === database
    );

    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const startTime = Date.now();
    try {
      const data = await apiRequest('/api/db/get-ddl', 'POST', {
        config,
        fullName,
        type,
        database
      });

      if (data.success) {
        // Save to history
        saveToHistory({
          sql: data.script,
          database: database,
          success: true,
          executionTime: Date.now() - startTime,
          rowsAffected: 0 // DDL doesn't return rows affected in this context
        });

        const newTab: Tab = {
          id: `ddl-${Date.now()}`,
          type: 'query',
          title: `DDL: ${fullName}`,
          database: database,
          sqlQuery: data.script,
          queryResult: { data: [], columns: [], totalRows: 0 },
          loading: false,
          page: 1,
          pageSize: 100,
          sortDir: 'ASC',
          filter: '',
          showFilter: false
        };
        setTabs([...tabs, newTab]);
        setActiveTabId(newTab.id);
      } else {
        // Save failed query to history
        saveToHistory({
          sql: `GET DDL FOR ${fullName} (${type})`, // Placeholder for failed DDL fetch
          database: database,
          success: false,
          executionTime: Date.now() - startTime
        });
        alert('Error fetching DDL: ' + data.message);
      }
    } catch (err: any) {
      console.error(err);
      // Save failed query to history
      saveToHistory({
        sql: `GET DDL FOR ${fullName} (${type})`, // Placeholder for failed DDL fetch
        database: database,
        success: false,
        executionTime: Date.now() - startTime
      });
      alert('Error fetching DDL: ' + (err.message || 'Unknown error'));
    }
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);
    if (activeTabId === id && newTabs.length > 0) {
      setActiveTabId(newTabs[newTabs.length - 1].id);
    } else if (newTabs.length === 0) {
      setActiveTabId(null);
    }
  };

  const addQueryTab = useCallback((initialSql?: string) => {
    const id = `query-${Date.now()}`;
    const dialect = config?.dbType || 'mssql';
    const newTab: Tab = {
      id,
      type: 'query',
      title: 'New Query',
      database: config?.database,
      sqlQuery: typeof initialSql === 'string' ? initialSql : (dialect === 'mssql' ? 'SELECT TOP 100 * FROM ' : 'SELECT * FROM '),
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
  }, [config, tabs.length]);

  const handleRunHistoryQuery = useCallback((sql: string) => {
    if (activeTab && activeTab.type === 'query') {
      updateTab(activeTab.id, { sqlQuery: sql });
      executeQuery(sql, { tabId: activeTab.id, db: activeTab.database, p: 1, includeCount: true });
    } else {
      addQueryTab(sql);
    }
  }, [activeTab, addQueryTab, executeQuery, updateTab]);

  const addDesignerTab = (type: Tab['type']) => {
    const id = `${type}-${Date.now()}`;
    const dialect = config.dbType || 'mssql';
    let title = 'New Table';
    let query = '';

    if (type === 'view-designer') {
      title = 'New View';
      query = dialect === 'mssql'
        ? 'CREATE VIEW [dbo].[ViewName]\nAS\nSELECT * FROM ...'
        : 'CREATE VIEW view_name AS\nSELECT * FROM ...';
    } else if (type === 'proc-designer') {
      title = 'New Procedure';
      query = dialect === 'mssql'
        ? 'CREATE PROCEDURE [dbo].[ProcedureName]\n  @Param1 INT\nAS\nBEGIN\n  SELECT * FROM ...\nEND'
        : 'CREATE PROCEDURE procedure_name()\nBEGIN\n  SELECT * FROM ...\nEND';
    } else if (type === 'import-wizard') {
      title = 'Import Data';
    } else if (type === 'query-builder') {
      title = 'Visual Builder';
    } else if (type === 'er-diagram' as any) {
      title = 'ER Architect';
    } else if (type === 'server-monitor' as any) {
      title = 'Server Monitor';
    } else if (type === 'user-manager' as any) {
      title = 'User Manager';
    } else if (type === 'schema-compare' as any) {
      title = 'Schema Diff';
    } else if (type === 'performance-advisor') {
      title = 'Performance Advisor';
    }

    const newTab: Tab = {
      id,
      type,
      title,
      database: config.database,
      sqlQuery: query,
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
    if (!activeTab || !config) return false;

    const tableName = activeTab.tableName || (activeTab.type === 'table' ? activeTab.title : null);

    if (!tableName) {
      alert('🔒 Inline editing requires a target table.\n\nPlease open the table directly from the Explorer to enable editing, or use a query that allows identification of the source table.');
      return false;
    }

    try {
      const data = await apiRequest('/api/db/update', 'POST', {
        config,
        database: activeTab.database,
        table: tableName,
        updates: { [column]: newValue },
        where: originalRow
      });

      if (data.success) {
        if (data.rowsAffected === 0) {
          alert('Update successful but 0 rows were affected. The row might have been changed or deleted by another user.');
          return false;
        }
        // Use a slight delay to ensure the database has finished the write
        setTimeout(() => reloadData(), 100);
        return true;
      } else {
        alert('Update Error: ' + data.message);
        return false;
      }
    } catch (err: any) {
      console.error('Update operation failed:', err);
      alert('Update failed: ' + (err.message || 'Unknown network error'));
      return false;
    }
  };

  const handleMetadataLoad = (dbName: string, newMetadata: any) => {
    setAllMetadata(prev => ({ ...prev, [dbName]: newMetadata }));
    if (dbName.toLowerCase() === (activeTab?.database.toLowerCase() || config.database.toLowerCase())) {
      setMetadata(newMetadata);
    }
  };

  if (!config) {
    if (showForm) {
      return (
        <div>
          <ConnectionForm
            onConnect={handleConnect}
            onCancel={() => setShowForm(false)}
            initialConfig={initialFormConfig}
          />
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background overflow-y-auto transition-colors duration-300 relative">
        <div className="absolute top-8 right-8 z-50">
          <button
            onClick={toggleTheme}
            className="group flex items-center gap-3 px-4 py-2 rounded-xl bg-card/50 hover:bg-accent/10 border border-border/50 hover:border-accent/20 transition-all backdrop-blur-sm"
          >
            {theme === 'dark' ? (
              <>
                <Moon className="w-4 h-4 group-hover:text-accent group-hover:rotate-12 transition-all text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 group-hover:text-accent transition-all text-muted-foreground">Dark mode</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 group-hover:text-accent group-hover:rotate-45 transition-all text-muted-foreground" />
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 group-hover:text-accent transition-all text-muted-foreground">Light mode</span>
              </>
            )}
          </button>
        </div>
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
                onClick={() => {
                  if (conn.rememberPassword) {
                    handleConnect(conn);
                  } else {
                    setInitialFormConfig(conn);
                    setShowForm(true);
                  }
                }}
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
                        <LinkIcon className="w-3 h-3" />
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setInitialFormConfig(conn);
                        setShowForm(true);
                      }}
                      className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      title="Edit Connection"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
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
              </div >
            ))
            }
          </div >

          <p className="text-center text-xs text-muted-foreground/40 font-mono uppercase tracking-[0.2em]">
            PostgreSQL • MySQL • MSSQL • SECURE • PERSISTENT
          </p>

          <footer className="pt-12 border-t border-border/50 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4">
              <Link
                href="/documents"
                className="group flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-muted/30 hover:bg-accent/10 border border-border/50 hover:border-accent/20 transition-all font-sans"
              >
                <Book className="w-5 h-5 group-hover:text-accent group-hover:scale-110 transition-all text-muted-foreground/60" />
                <span className="text-xs font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 group-hover:text-accent transition-all">Documentation Center</span>
              </Link>

              <a
                href="https://github.com/nucrasenaa/db-editor"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-muted/30 hover:bg-accent/10 border border-border/50 hover:border-accent/20 transition-all"
              >
                <Github className="w-5 h-5 group-hover:text-accent group-hover:scale-110 transition-all text-muted-foreground/60" />
                <span className="text-xs font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 group-hover:text-accent transition-all">Source Repository</span>
              </a>
            </div>

            <div className="text-center space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground/40">
                THREE MAN DEV © 2026. ALL RIGHTS RESERVED.
              </p>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-accent/40">
                BANGKOK, THAILAND
              </p>
            </div>
          </footer>
        </div >
      </div >
    );
  }

  return (
    <div className="flex bg-background h-screen overflow-hidden relative transition-colors duration-300">
      <div className={cn(
        "fixed inset-0 bg-black/50 z-[60] lg:hidden transition-opacity duration-300",
        sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setSidebarOpen(false)} />

      <Sidebar
        config={config}
        onObjectSelect={(name, type, db) => {
          handleObjectSelect(name, type, db);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onMetadataLoad={handleMetadataLoad}
        selectedObject={activeTab?.title || null}
        onAddClick={(type) => {
          addDesignerTab(type);
          if (window.innerWidth < 1024) setSidebarOpen(false);
        }}
        onViewScript={handleViewScript}
        onRunQuery={handleRunHistoryQuery}
        className={cn(
          "fixed inset-y-0 left-0 z-[70] lg:relative lg:flex transition-transform duration-300 transform",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header / Tab Bar */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-4 shrink-0 overflow-hidden relative z-50">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2.5 mr-2 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center overflow-x-auto no-scrollbar gap-1 mr-4 flex-nowrap h-full">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  "group flex items-center shrink-0 gap-2 px-4 py-1.5 rounded-xl cursor-context-menu transition-all h-10 min-w-[120px] max-w-[200px] border relative",
                  activeTabId === tab.id
                    ? "bg-accent/5 border-accent/20 text-accent font-bold shadow-premium"
                    : "border-transparent text-muted-foreground hover:bg-muted/30"
                )}
              >
                {tab.type === 'table' && <TableIcon className="w-3.5 h-3.5 shrink-0" />}
                {tab.type === 'query' && <Terminal className="w-3.5 h-3.5 shrink-0" />}
                {tab.type === 'table-designer' && <PlusCircle className="w-3.5 h-3.5 shrink-0 text-blue-400" />}
                {tab.type === 'view-designer' && <Layers className="w-3.5 h-3.5 shrink-0 text-purple-400" />}
                {tab.type === 'proc-designer' && <Zap className="w-3.5 h-3.5 shrink-0 text-orange-400" />}
                {tab.type === 'er-diagram' && <Share2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />}
                {tab.type === 'server-monitor' && <Activity className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                {tab.type === 'user-manager' && <Users className="w-3.5 h-3.5 shrink-0 text-indigo-400" />}
                {tab.type === 'schema-compare' && <GitCompare className="w-3.5 h-3.5 shrink-0 text-orange-400" />}
                <span className="text-[10px] truncate uppercase tracking-[0.15em] font-black">{tab.title}</span>
                <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); popoutTab(config, tab); }}
                    className="p-1 hover:bg-accent/10 hover:text-accent rounded-md transition-all"
                    title="Pop out to new window"
                  >
                    <Maximize2 className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={(e) => closeTab(tab.id, e)}
                    className="p-1 hover:bg-red-500/10 hover:text-red-500 rounded-md transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {activeTabId === tab.id && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-full shadow-glow" />
                )}
              </div>
            ))}

            <button
              onClick={() => addQueryTab()}
              className="p-2.5 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-all ml-1 shrink-0"
              title="Open New Query"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex flex-col items-end opacity-40">
              <span className="text-[10px] font-black tracking-[0.2em] uppercase leading-none">Access Control</span>
              <span className="text-[9px] font-mono font-bold text-emerald-500">ENCRYPTED LINK</span>
            </div>
            <button
              onClick={handleDisconnect}
              className="flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-red-500/5 hover:bg-red-500/10 text-red-500 border border-red-500/10 text-[9px] font-black uppercase tracking-[0.2em] transition-all"
            >
              <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Terminate</span>
            </button>
          </div>
        </header>

        {/* Workspace */}
        <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          {activeTab ? (
            <>
              {activeTab.type === 'query' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <QueryEditor
                    query={activeTab.sqlQuery}
                    onQueryChange={(q) => updateTab(activeTab.id, { sqlQuery: q })}
                    onExecute={(q) => executeQuery(q || activeTab.sqlQuery, { tabId: activeTab.id, includeCount: true })}
                    loading={activeTab.loading}
                    metadata={metadata}
                    allMetadata={allMetadata}
                    dbType={config.dbType}
                    theme={theme}
                  />
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
                    {activeTab.resultSets && activeTab.resultSets.length > 1 && !activeTab.showPlan && (
                      <div className="flex items-center gap-1 px-4 py-1.5 bg-muted/20 border-b border-border shrink-0">
                        {activeTab.resultSets.map((set, idx) => (
                          <button
                            key={idx}
                            onClick={() => updateTab(activeTab.id, {
                              queryResult: set,
                              activeResultSetIndex: idx
                            })}
                            className={cn(
                              "px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg transition-all border",
                              activeTab.activeResultSetIndex === idx
                                ? "bg-accent/10 border-accent/30 text-accent shadow-sm"
                                : "border-transparent text-muted-foreground hover:bg-muted"
                            )}
                          >
                            Result {idx + 1}
                            <span className="ml-2 opacity-50 font-mono text-[8px]">{set.data.length}r</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {activeTab.executionPlan && activeTab.executionPlan.length > 0 && (
                      <div className="absolute top-4 right-8 z-10 flex gap-1 bg-card/80 backdrop-blur-md border border-border rounded-xl p-1 shadow-2xl shadow-black/20 animate-in fade-in zoom-in duration-300">
                        <button
                          onClick={() => updateTab(activeTab.id, { showPlan: false })}
                          className={cn(
                            "px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg transition-all",
                            !activeTab.showPlan ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "hover:bg-muted text-muted-foreground"
                          )}
                        >
                          Result Data
                        </button>
                        <button
                          onClick={() => updateTab(activeTab.id, { showPlan: true })}
                          className={cn(
                            "px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] rounded-lg transition-all",
                            activeTab.showPlan ? "bg-accent text-accent-foreground shadow-lg shadow-accent/20" : "hover:bg-muted text-muted-foreground"
                          )}
                        >
                          Execution Plan
                        </button>
                      </div>
                    )}

                    {activeTab.error ? (
                      <div className="flex-1 flex flex-col items-center justify-start p-8 animate-in fade-in zoom-in-95 duration-300 overflow-y-auto custom-scrollbar">
                        <div className="max-w-2xl w-full bg-red-500/5 border border-red-500/20 rounded-3xl p-8 shadow-2xl shadow-red-500/5 transition-all hover:bg-red-500/10 group mb-8">
                          <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-red-500/10 rounded-2xl text-red-500 group-hover:scale-110 transition-transform">
                              <AlertCircle className="w-8 h-8" />
                            </div>
                            <div>
                              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-500">Execution Error</h3>
                              <p className="text-[10px] text-red-400/60 font-bold uppercase tracking-widest mt-1">Syntax or Runtime Exception</p>
                            </div>
                          </div>

                          <div className="bg-black/20 border border-red-500/10 rounded-2xl p-6 font-mono text-sm text-red-400 leading-relaxed whitespace-pre-wrap mb-8 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {activeTab.error}
                          </div>

                          <div className="flex items-center gap-4">
                            <button
                              onClick={async () => {
                                const aiConfig = localStorage.getItem('ai_config');
                                if (!aiConfig) {
                                  alert('Please configure AI in settings first.');
                                  return;
                                }

                                const statuses = [
                                  "Initializing AI Engine...",
                                  "Analyzing SQL Syntax Error...",
                                  "Checking Database Schema Metadata...",
                                  "Generating Optimized SQL Fix...",
                                  "Validating Proposed Solution..."
                                ];

                                updateTab(activeTab.id, { loading: true, aiThinking: true, aiStatus: statuses[0] });

                                // Cycle through statuses every 1.5s
                                let currentStatusIdx = 0;
                                const statusInterval = setInterval(() => {
                                  currentStatusIdx = (currentStatusIdx + 1) % statuses.length;
                                  updateTab(activeTab.id, { aiStatus: statuses[currentStatusIdx] });
                                }, 1500);

                                try {
                                  const res = await apiRequest('/api/ai/generate', 'POST', {
                                    prompt: `Fix this SQL error. Deeply analyze the error and schema to provide the correct SQL.\nERROR: ${activeTab.error}\nQUERY: ${activeTab.sqlQuery}`,
                                    schema: metadata,
                                    config: JSON.parse(aiConfig),
                                    dbType: config.dbType
                                  });
                                  if (res.success && res.sql) {
                                    updateTab(activeTab.id, { sqlQuery: res.sql, error: undefined, aiThinking: false });
                                  } else {
                                    updateTab(activeTab.id, { aiThinking: false });
                                    alert(res.message || 'AI could not fix this error.');
                                  }
                                } catch (err: any) {
                                  updateTab(activeTab.id, { aiThinking: false });
                                  alert(err.message || 'Error communicating with AI.');
                                } finally {
                                  clearInterval(statusInterval);
                                  updateTab(activeTab.id, { loading: false, aiThinking: false });
                                }
                              }}
                              disabled={activeTab.loading}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-3 py-4 text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl active:scale-[0.98]",
                                activeTab.aiThinking
                                  ? "bg-purple-500/50 cursor-not-allowed text-white"
                                  : "bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20"
                              )}
                            >
                              {activeTab.aiThinking ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  AI IS BRAINSTORMING...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4" /> Fix SQL with AI Assistant
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => reloadData()}
                              className="px-6 py-4 bg-muted hover:bg-muted/80 text-muted-foreground text-[11px] font-black uppercase tracking-widest rounded-2xl transition-all"
                            >
                              Retry
                            </button>
                          </div>

                          {activeTab.aiThinking && (
                            <div className="mt-8 pt-8 border-t border-red-500/10 animate-in slide-in-from-top-4 duration-500">
                              <div className="flex items-center gap-4 mb-4">
                                <div className="flex gap-1">
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                  <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400 animate-pulse">
                                  AI Analysis: {activeTab.aiStatus}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-purple-500/10 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 animate-[loading-bar_2s_infinite_linear]" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : activeTab.showPlan && activeTab.executionPlan ? (
                      <ExecutionPlan data={activeTab.executionPlan} dialect={config.dbType || 'mssql'} />
                    ) : (
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
                    )}
                  </div>
                </div>
              ) : activeTab.type === 'table' ? (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="h-auto md:h-12 border-b border-border bg-muted/10 flex flex-col md:flex-row md:items-center px-4 md:px-6 py-2 md:py-0 gap-2 md:gap-4 shrink-0">
                    <div className="flex-1 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                      <div className="flex items-center justify-between md:justify-start gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-muted/30 px-3 py-1.5 rounded-lg border border-border/50">
                          <TableIcon className="w-3.5 h-3.5 text-blue-400" />
                          <span className="truncate max-w-[150px] md:max-w-none">{activeTab.title}</span>
                        </div>
                        <div className="md:hidden text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter">
                          {activeTab.queryResult.data.length} / {activeTab.queryResult.totalRows}
                        </div>
                      </div>
                      <div className="hidden md:block h-6 w-px bg-border/50 mx-1" />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateTab(activeTab.id, { showFilter: !activeTab.showFilter })}
                          className={cn(
                            "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                            activeTab.showFilter ? "bg-accent/10 text-accent border border-accent/20" : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          <Filter className="w-3.5 h-3.5" /> {activeTab.showFilter ? (window?.innerWidth < 768 ? 'ON' : 'Filtering ON') : 'Quick Filter'}
                        </button>
                        {activeTab.showFilter && (
                          <form onSubmit={handleFilterSearch} className="flex-1 md:max-w-md animate-in slide-in-from-left-2 fade-in">
                            <div className="relative flex items-center">
                              <Search className="absolute left-3 w-3.5 h-3.5 text-muted-foreground opacity-50" />
                              <input
                                type="text"
                                placeholder="WHERE..."
                                className="w-full bg-muted/50 border border-border/50 rounded-lg pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent transition-all font-mono"
                                value={activeTab.filter}
                                onChange={(e) => updateTab(activeTab.id, { filter: e.target.value })}
                                autoFocus
                              />
                            </div>
                          </form>
                        )}
                      </div>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                      <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-tighter text-right">
                        Loaded {activeTab.queryResult.data.length} <br /> of {activeTab.queryResult.totalRows}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-hidden flex flex-col min-h-0">
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
              ) : activeTab.type === 'table-designer' ? (
                <TableDesigner
                  dbType={config.dbType}
                  database={activeTab.database}
                  databases={metadata?.databases || []}
                  onExecute={(sql) => executeQuery(sql, { tabId: activeTab.id, silent: false })}
                  loading={activeTab.loading}
                />
              ) : activeTab.type === 'view-designer' ? (
                <ViewDesigner
                  dbType={config.dbType}
                  database={activeTab.database}
                  databases={metadata?.databases || []}
                  metadata={metadata || {}}
                  config={config}
                  onExecute={(sql) => executeQuery(sql, { tabId: activeTab.id, silent: false })}
                  onClose={() => closeTab(activeTab.id)}
                />
              ) : activeTab.type === 'proc-designer' ? (
                <ProcDesigner
                  dbType={config.dbType}
                  database={activeTab.database}
                  databases={metadata?.databases || []}
                  onExecute={(sql) => executeQuery(sql, { tabId: activeTab.id, silent: false })}
                  onClose={() => closeTab(activeTab.id)}
                />
              ) : activeTab.type === 'import-wizard' ? (
                <ImportWizard
                  config={config}
                  metadata={metadata || {}}
                  databases={metadata?.databases || []}
                  onExecute={(sql) => executeQuery(sql, { tabId: activeTab.id, silent: false })}
                  onClose={() => closeTab(activeTab.id)}
                />
              ) : activeTab.type === 'query-builder' ? (
                <VisualQueryBuilder
                  metadata={metadata || {}}
                  config={config}
                  database={activeTab.database}
                  databases={metadata?.databases || []}
                  onExecute={(sql) => {
                    // Create a new query tab with this SQL
                    const id = `q-${Date.now()}`;
                    const newTab: Tab = {
                      id,
                      type: 'query',
                      title: 'Generated Query',
                      database: activeTab.database,
                      sqlQuery: sql,
                      queryResult: { data: [], columns: [], totalRows: 0 },
                      loading: false,
                      page: 1,
                      pageSize: 100,
                      sortDir: 'ASC',
                      filter: '',
                      showFilter: false
                    };
                    setTabs([...tabs, newTab]);
                    setActiveTabId(id);
                  }}
                  onClose={() => closeTab(activeTab.id)}
                />
              ) : activeTab.type === 'er-diagram' ? (
                <ERDiagram config={config} />
              ) : activeTab.type === 'server-monitor' ? (
                <ServerMonitor config={config} onClose={() => closeTab(activeTab.id)} />
              ) : activeTab.type === 'user-manager' ? (
                <UserManager config={config} onClose={() => closeTab(activeTab.id)} />
              ) : activeTab.type === 'schema-compare' ? (
                <SchemaCompare config={config} onClose={() => closeTab(activeTab.id)} />
              ) : activeTab.type === 'ai-settings' ? (
                <AISettings onClose={() => closeTab(activeTab.id)} />
              ) : activeTab.type === 'performance-advisor' ? (
                <PerformanceAdvisor config={config} onClose={() => closeTab(activeTab.id)} />
              ) : null
              }
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-40">
              <div className="p-10 rounded-full bg-muted/20 border border-dashed border-border flex items-center justify-center">
                <Maximize2 className="w-16 h-16 text-muted-foreground" />
              </div>
              <p className="text-sm font-black uppercase tracking-[0.3em] text-muted-foreground">Select an object to forge</p>
            </div>
          )}
        </main >

        <footer className="h-8 border-t border-border/30 bg-card/20 flex items-center justify-between px-6 shrink-0 shrink-0">
          <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-muted-foreground/30">
            <span>Three Man Dev © 2026</span>
            <div className="w-1 h-1 rounded-full bg-border" />
            <span>Bangkok, Thailand</span>
            <div className="w-1 h-1 rounded-full bg-border" />
            <span className="text-accent/40">v1.1.1</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-accent transition-all group"
            >
              {theme === 'dark' ? (
                <><Moon className="w-3 h-3 group-hover:rotate-12 transition-transform" /> DARK MODE</>
              ) : (
                <><Sun className="w-3 h-3 group-hover:rotate-45 transition-transform" /> LIGHT MODE</>
              )}
            </button>
            <div className="w-px h-3 bg-border/20" />
            <a
              href="https://github.com/nucrasenaa/db-editor"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 hover:text-accent transition-colors"
            >
              <Github className="w-3 h-3" /> GitHub
            </a>
          </div>
        </footer>
      </div >
    </div >
  );
}
