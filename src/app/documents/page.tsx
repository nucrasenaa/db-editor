import fs from 'fs';
import path from 'path';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Link from 'next/link';
import { Shield, ShieldAlert, Sparkles, EyeOff, ArrowRight, Zap, GitBranch } from 'lucide-react';

export default async function DocPage() {
    const filePath = path.join(process.cwd(), 'Documents', 'INDEX.md');
    const content = fs.readFileSync(filePath, 'utf8');

    const newFeatures = [
        {
            icon: Sparkles,
            title: 'Intelligent Filter',
            desc: 'Real-time column and SQL keyword suggestions in table grids with keyboard-driven navigation.',
            color: 'from-blue-500/10 to-blue-500/5 border-blue-500/20 text-blue-400',
            iconColor: 'text-blue-400',
        },
        {
            icon: Shield,
            title: 'Environment Colors',
            desc: 'Visual distinction for Prod/Staging/Dev environments via header bars and sidebars.',
            color: 'from-emerald-500/10 to-emerald-500/5 border-emerald-500/20 text-emerald-400',
            iconColor: 'text-emerald-400',
        },
        {
            icon: ShieldAlert,
            title: 'Read-Only Mode',
            desc: 'Server-enforced policy that blocks all destructive SQL (UPDATE, DELETE, DROP, etc.) on critical connections.',
            color: 'from-red-500/10 to-red-500/5 border-red-500/20 text-red-400',
            iconColor: 'text-red-400',
        },
        {
            icon: Sparkles,
            title: 'SQL Linter & Formatter',
            desc: 'Real-time detection of 10 SQL anti-patterns as you type. One-click formatter with Cmd+Shift+F.',
            color: 'from-orange-500/10 to-orange-500/5 border-orange-500/20 text-orange-400',
            iconColor: 'text-orange-400',
        },
        {
            icon: EyeOff,
            title: 'Data Masking',
            desc: 'Auto-detects sensitive columns (email, phone, SSN, cards) and masks values in result grids. Click-to-reveal per cell.',
            color: 'from-purple-500/10 to-purple-500/5 border-purple-500/20 text-purple-400',
            iconColor: 'text-purple-400',
        },
    ];

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-16">
            {/* Hero */}
            <div className="mb-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest mb-4 border border-accent/20">
                    <Zap className="w-3 h-3" />
                    Documentation Hub — v1.4.0
                </div>
                <h1 className="text-5xl font-black tracking-tighter uppercase gradient-text leading-tight">
                    Knowledge Base
                </h1>
                <p className="text-xl text-muted-foreground/60 mt-4 leading-relaxed max-w-2xl">
                    Everything you need to know about Data Forge. From basic setup to advanced database engineering, production safety, and compliance tooling.
                </p>
            </div>

            {/* What's New Banner */}
            <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent p-8">
                <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
                <div className="relative">
                    <div className="flex items-center gap-3 mb-4">
                        <GitBranch className="w-5 h-5 text-accent" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-accent">What's New in v1.4.0</span>
                        <span className="px-2 py-0.5 rounded bg-accent text-accent-foreground text-[9px] font-black uppercase tracking-wider">Latest</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {newFeatures.map((f) => (
                            <div key={f.title} className={`flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br border ${f.color}`}>
                                <div className="shrink-0 p-2 rounded-xl bg-background/40">
                                    <f.icon className={`w-5 h-5 ${f.iconColor}`} />
                                </div>
                                <div>
                                    <p className="text-sm font-black uppercase tracking-wider mb-1">{f.title}</p>
                                    <p className="text-[11px] opacity-70 leading-relaxed">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6">
                        <Link
                            href="/RELEASE_NOTES"
                            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
                        >
                            View Full Release Notes <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>
            </div>

            {/* Markdown Index content */}
            <div className="prose-theme-custom">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        h1: () => null, // hide the markdown h1 since we show our own hero
                        a: ({ node, ...props }) => {
                            let href = props.href || '';
                            if (href.endsWith('.md')) {
                                const slug = href.replace('./', '').replace('.md', '');
                                if (slug === 'INDEX') {
                                    href = '/documents';
                                } else if (slug.startsWith('../')) {
                                    href = '/' + slug.replace('../', '');
                                } else {
                                    href = `/documents/${slug}`;
                                }
                                return <Link href={href} {...props}>{props.children}</Link>;
                            }
                            return <a {...props}>{props.children}</a>;
                        }
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    );
}
