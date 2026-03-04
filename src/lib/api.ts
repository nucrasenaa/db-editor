export async function apiRequest(endpoint: string, method: string, body: any) {
    // Check if running in Electron and the bridge is available
    const isElectron = typeof window !== 'undefined' && (window as any).electron;

    if (isElectron && (window as any).electron.db) {
        const db = (window as any).electron.db;

        // Map API endpoints to Electron IPC methods
        if (endpoint.includes('/api/db/test')) {
            return await db.test(body);
        }
        if (endpoint.includes('/api/db/query')) {
            return await db.query(body);
        }
        if (endpoint.includes('/api/db/metadata')) {
            return await db.metadata(body);
        }
        if (endpoint.includes('/api/db/procedure-snippet')) {
            return await db.procSnippet(body);
        }
        if (endpoint.includes('/api/db/update')) {
            return await db.update(body);
        }
    }

    // Fallback to standard fetch for Web
    const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    return await res.json();
}
