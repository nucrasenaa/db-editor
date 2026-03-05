import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { Book, ChevronRight, FileText, ArrowLeft, Database, Terminal, Settings, ShieldAlert, Layers } from 'lucide-react';

export default function DocsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const docsDir = path.join(process.cwd(), 'Documents');
    const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md') && f !== 'INDEX.md');

    const menuItems = [
        { name: 'Overview', slug: '', icon: Book },
        { name: 'User Guide', slug: 'USER_GUIDE', icon: FileText },
        { name: 'Developer Guide', slug: 'DEVELOPER_GUIDE', icon: Settings },
        { name: 'Dialect Support', slug: 'DIALECTS', icon: Database },
        { name: 'Troubleshooting', slug: 'TROUBLESHOOTING', icon: ShieldAlert },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
            {/* Header */}
            <header className="h-16 border-b border-border bg-card/30 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                    <Link href="/" className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-accent/10 rounded-xl">
                            <Database className="w-5 h-5 text-accent" />
                        </div>
                        <h1 className="font-black tracking-tighter uppercase gradient-text">Data Forge Docs</h1>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">
                    <span>Version 1.1.1</span>
                    <div className="w-1 h-1 rounded-full bg-border" />
                    <span>Three Man Dev</span>
                </div>
            </header>

            <div className="flex-1 flex max-w-7xl w-full mx-auto px-6 py-10 gap-12">
                {/* Sidebar */}
                <aside className="w-64 shrink-0 space-y-8 sticky top-28 h-fit">
                    <section>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50 mb-4 px-4">Documentation</h2>
                        <nav className="space-y-1">
                            {menuItems.map((item) => (
                                <Link
                                    key={item.slug}
                                    href={item.slug === '' ? '/documents' : `/documents/${item.slug}`}
                                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-muted transition-all group border border-transparent hover:border-border/50"
                                >
                                    <item.icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                                    <span className="text-sm font-bold opacity-70 group-hover:opacity-100">{item.name}</span>
                                </Link>
                            ))}
                        </nav>
                    </section>

                    <div className="p-6 rounded-2xl bg-accent/5 border border-accent/10 space-y-4">
                        <div className="flex items-center gap-2 text-accent">
                            <Terminal className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">Dev Tip</span>
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-60">
                            Check the <strong>Developer Guide</strong> to learn how to add your own SQL dialects or custom tools.
                        </p>
                    </div>
                </aside>

                {/* Content */}
                <main className="flex-1 min-w-0 pb-20">
                    <div className="prose prose-invert max-w-none prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-a:text-accent prose-code:text-accent prose-pre:bg-card/50 prose-pre:border prose-pre:border-border prose-pre:rounded-2xl prose-img:rounded-2xl">
                        {children}
                    </div>
                </main>
            </div>
        </div >
    );
}
