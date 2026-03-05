import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const config = await req.json();
        const { provider, apiKey, model, endpoint } = config;

        if (provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            const data = await res.json();
            if (res.ok) return NextResponse.json({ success: true, message: `Connected! Found ${data.data?.length || 0} models available.` });
            return NextResponse.json({ success: false, message: data.error?.message || 'Invalid API Key' });
        }

        if (provider === 'anthropic') {
            // Anthropic doesn't have a simple "list models" without a message, but we can try a header check
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    model: model || 'claude-3-haiku-20240307',
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Connection test' }]
                })
            });
            const data = await res.json();
            if (res.ok) return NextResponse.json({ success: true, message: 'Anthropic connection verified!' });
            return NextResponse.json({ success: false, message: data.error?.message || 'Invalid API Key' });
        }

        if (provider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
            const data = await res.json();
            if (res.ok) return NextResponse.json({ success: true, message: 'Gemini API key is valid!' });
            return NextResponse.json({ success: false, message: data.error?.message || 'Invalid API Key' });
        }

        if (provider === 'zai') {
            // Z.ai API PAAS v4
            const baseUrl = endpoint || 'https://api.z.ai/api/coding/paas/v4';
            const testUrl = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;

            const res = await fetch(testUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (res.ok) return NextResponse.json({ success: true, message: 'Z.ai PAAS v4 connection verified!' });
            const data = await res.json();
            return NextResponse.json({ success: false, message: data.error?.message || 'Z.ai connection failed. Please check your key.' });
        }

        if (provider === 'ollama') {
            const baseUrl = endpoint || 'http://localhost:11434';
            const res = await fetch(`${baseUrl}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                return NextResponse.json({ success: true, message: `Ollama is running! Found ${data.models?.length || 0} local models.` });
            }
            return NextResponse.json({ success: false, message: `Could not reach Ollama at ${baseUrl}. Ensure it is running and CORS is enabled.` });
        }

        if (provider === 'custom') {
            const res = await fetch(`${endpoint}/models`, {
                headers: apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}
            });
            if (res.ok) return NextResponse.json({ success: true, message: 'Custom endpoint reachable and responded correctly.' });
            return NextResponse.json({ success: false, message: 'Custom endpoint failed to respond with success code.' });
        }

        return NextResponse.json({ success: false, message: 'Unsupported provider strategy.' });

    } catch (error: any) {
        console.error('[AI Test Error]', error);
        return NextResponse.json({ success: false, message: error.message || 'Server error during connection test.' });
    }
}
