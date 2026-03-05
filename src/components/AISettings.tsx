'use client';

import React, { useState, useEffect } from 'react';
import {
    Cpu,
    Shield,
    Key,
    Zap,
    Save,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    Server,
    Globe,
    Lock,
    Link,
    Settings,
    Loader2,
    Database,
    ChevronDown,
    X
} from 'lucide-react';
import { apiRequest } from '@/lib/api';
import { cn } from '@/lib/utils';

interface AISettingsProps {
    onClose: () => void;
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'zai' | 'ollama' | 'custom';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model: string;
    endpoint?: string;
    safetyPolicy: 'strict' | 'relaxed' | 'auto-select';
}

const PROVIDERS = [
    { id: 'openai', name: 'OpenAI', icon: Globe, color: 'text-emerald-400', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
    { id: 'anthropic', name: 'Anthropic', icon: Zap, color: 'text-orange-400', models: ['claude-3-5-sonnet-latest', 'claude-3-5-haiku-latest', 'claude-3-opus-latest'] },
    { id: 'gemini', name: 'Google Gemini', icon: Cpu, color: 'text-blue-400', models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash-exp'] },
    { id: 'zai', name: 'Z.ai', icon: StarsIcon, color: 'text-purple-400', models: ['GLM-4.7', 'GLM-4.6'] },
    { id: 'ollama', name: 'Ollama (Local)', icon: Server, color: 'text-white', models: ['llama3', 'mistral', 'codellama', 'sqlcoder'] },
    { id: 'custom', name: 'Custom Proxy', icon: Settings, color: 'text-gray-400', models: [] },
];

function StarsIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M12 3l1.912 5.886L20 10l-6.088 1.114L12 17l-1.912-5.886L4 10l6.088-1.114L12 3z" />
        </svg>
    );
}

export default function AISettings({ onClose }: AISettingsProps) {
    const [config, setConfig] = useState<AIConfig>({
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o-mini',
        safetyPolicy: 'strict'
    });
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        const saved = localStorage.getItem('ai_config');
        if (saved) {
            try {
                setConfig(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to parse AI config', e);
            }
        }
    }, []);

    const handleSave = () => {
        setLoading(true);
        localStorage.setItem('ai_config', JSON.stringify(config));
        setTimeout(() => {
            setLoading(false);
            // Show toast or feedback here
        }, 500);
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await apiRequest('/api/ai/test', 'POST', config);
            setTestResult({
                success: res.success,
                message: res.message || (res.success ? 'Connection successful!' : 'Connection failed.')
            });
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.message || 'Error connecting to provider.'
            });
        } finally {
            setTesting(false);
        }
    };

    const selectedProvider = PROVIDERS.find(p => p.id === config.provider);

    return (
        <div className="flex-1 flex flex-col bg-background overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Header */}
            <div className="h-16 border-b border-border bg-card/30 flex items-center px-6 justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <StarsIcon className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black uppercase tracking-widest leading-none mb-1">AI Engine Settings</h2>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">PROVIDER & INTELLIGENCE MANAGEMENT</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-muted hover:bg-muted/80 text-foreground text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                        Close
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2 px-8 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-purple-500/20"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Configuration
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-[radial-gradient(circle_at_center,_#1e1e22_1px,_transparent_1px)] bg-[size:32px_32px] p-8">
                <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">

                    {/* Left: Provider Selection */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-card border border-border rounded-2xl p-4 overflow-hidden">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-4 px-2 flex items-center gap-2">
                                <Globe className="w-3 h-3 text-purple-400" /> Choose Provider
                            </h3>
                            <div className="space-y-1">
                                {PROVIDERS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            const newProvider = p.id as AIProvider;
                                            setConfig(prev => {
                                                let endpoint = prev.endpoint;
                                                if (newProvider === 'ollama') endpoint = 'http://localhost:11434';
                                                if (newProvider === 'zai') endpoint = 'https://api.z.ai/api/coding/paas/v4';

                                                return {
                                                    ...prev,
                                                    provider: newProvider,
                                                    model: p.models[0] || '',
                                                    endpoint
                                                };
                                            });
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left group",
                                            config.provider === p.id
                                                ? "bg-purple-500/10 border border-purple-500/30 text-foreground ring-1 ring-purple-500/20"
                                                : "border border-transparent hover:bg-muted/50 text-muted-foreground"
                                        )}
                                    >
                                        <div className={cn("p-2 rounded-lg bg-background/50 border border-border transition-colors", config.provider === p.id && "bg-background border-purple-500/50")}>
                                            <p.icon className={cn("w-4 h-4", p.color)} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-black uppercase tracking-widest">{p.name}</p>
                                        </div>
                                        {config.provider === p.id && <CheckCircle2 className="w-4 h-4 text-purple-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500"><Lock className="w-5 h-5" /></div>
                                <div>
                                    <h4 className="text-[10px] font-black uppercase tracking-widest">Privacy Note</h4>
                                    <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                                        Data Forge only sends schema metadata and SQL fragments to the AI. Your actual database records are never transmitted.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Configuration Form */}
                    <div className="lg:col-span-8 space-y-6">
                        <div className="bg-card border border-border rounded-2xl p-8 shadow-xl space-y-8">

                            {/* Connection Details */}
                            <section className="space-y-6">
                                <div className="flex items-center gap-3 border-b border-border pb-4">
                                    <Server className="w-4 h-4 text-purple-500" />
                                    <h3 className="text-xs font-black uppercase tracking-widest">Connection Details</h3>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {config.provider !== 'ollama' && (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                                                <Key className="w-3 h-3" /> API Key
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="password"
                                                    value={config.apiKey}
                                                    onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                                                    placeholder={`Enter your ${selectedProvider?.name} API key`}
                                                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-xs font-mono transition-all focus:ring-1 focus:ring-purple-500 group-hover:bg-muted/50 outline-none"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {config.provider === 'ollama' && (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                                                <Link className="w-3 h-3" /> Ollama Endpoint
                                            </label>
                                            <input
                                                type="text"
                                                value={config.endpoint}
                                                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                                                placeholder="http://localhost:11434"
                                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-xs font-mono transition-all focus:ring-1 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    )}

                                    {(config.provider === 'custom' || config.provider === 'zai') && (
                                        <div className="space-y-2 md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                                                <Link className="w-3 h-3" /> {config.provider === 'zai' ? 'Z.ai PAAS Endpoint' : 'Proxy Endpoint'}
                                            </label>
                                            <input
                                                type="text"
                                                value={config.endpoint}
                                                onChange={(e) => setConfig({ ...config, endpoint: e.target.value })}
                                                placeholder={config.provider === 'zai' ? 'https://api.z.ai/api/coding/paas/v4' : 'https://your-proxy-endpoint.com/v1'}
                                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-xs font-mono transition-all focus:ring-1 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                                            <Cpu className="w-3 h-3" /> Preferred Model
                                        </label>
                                        {selectedProvider?.models.length ? (
                                            <div className="relative group">
                                                <select
                                                    value={config.model}
                                                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                                    className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-xs font-bold appearance-none transition-all focus:ring-1 focus:ring-purple-500 group-hover:bg-muted/50 outline-none pr-10"
                                                >
                                                    {selectedProvider.models.map(m => <option key={m} value={m}>{m}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={config.model}
                                                onChange={(e) => setConfig({ ...config, model: e.target.value })}
                                                placeholder="Enter model name (e.g. gpt-4o)"
                                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-xs font-bold transition-all focus:ring-1 focus:ring-purple-500 outline-none"
                                            />
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1 flex items-center gap-2">
                                            <Shield className="w-3 h-3" /> Safety Policy
                                        </label>
                                        <div className="relative group">
                                            <select
                                                value={config.safetyPolicy}
                                                onChange={(e) => setConfig({ ...config, safetyPolicy: e.target.value as any })}
                                                className="w-full bg-muted/30 border border-border rounded-xl px-4 py-3 text-xs font-bold appearance-none transition-all focus:ring-1 focus:ring-purple-500 group-hover:bg-muted/50 outline-none pr-10"
                                            >
                                                <option value="strict">Safety First (Require Approval)</option>
                                                <option value="auto-select">Smart Strategy (Auto-Run SELECT)</option>
                                                <option value="relaxed">Relaxed (Always Auto-Run)</option>
                                            </select>
                                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Test Connection Button */}
                            <section className="pt-4 flex flex-col items-center gap-4">
                                <button
                                    onClick={handleTest}
                                    disabled={testing || (!config.apiKey && config.provider !== 'ollama' && config.provider !== 'custom')}
                                    className="flex items-center gap-2 px-12 py-3 bg-muted hover:bg-muted/80 disabled:opacity-30 border border-border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group"
                                >
                                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />}
                                    Test AI Connection
                                </button>

                                {testResult && (
                                    <div className={cn(
                                        "w-full p-4 rounded-xl border flex items-center gap-3 animate-in fade-in zoom-in-95",
                                        testResult.success ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" : "bg-red-500/5 border-red-500/20 text-red-400"
                                    )}>
                                        {testResult.success ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertCircle className="w-5 h-5 shrink-0" />}
                                        <p className="text-[11px] font-bold leading-relaxed">{testResult.message}</p>
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* Usage Guide */}
                        <div className="bg-card/50 border border-border rounded-2xl p-6">
                            <h4 className="text-[10px] font-black uppercase tracking-widest mb-4">How to use AI Forge</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black shrink-0">1</div>
                                    <p className="text-[11px] text-muted-foreground">Press <span className="text-foreground font-bold">Cmd + K</span> inside the SQL Editor to open the prompt assistant.</p>
                                </div>
                                <div className="flex gap-3">
                                    <div className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black shrink-0">2</div>
                                    <p className="text-[11px] text-muted-foreground">Ask in plain language. AI will use the current database schema to generate SQL.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
