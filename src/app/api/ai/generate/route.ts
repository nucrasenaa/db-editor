import { NextResponse } from 'next/server';
import { generateSchemaContext } from '@/lib/ai-utils';

export async function POST(req: Request) {
    try {
        const { prompt, schema, config, dbType } = await req.json();
        const { provider, apiKey, model, endpoint } = config;

        if (!apiKey && provider !== 'ollama' && provider !== 'custom') {
            return NextResponse.json({ success: false, message: 'API Key is missing for selected provider.' }, { status: 400 });
        }

        const schemaContext = generateSchemaContext(schema);

        const isMongo = dbType === 'mongodb';
        const isRedis = dbType === 'redis';

        let systemPrompt = '';
        if (isMongo) {
            systemPrompt = `
You are an expert MongoDB Query and Aggregation Pipeline Generator.
Generate a valid JSON object representing a MongoDB query or aggregation based on the request.
Context:
${schemaContext}

Rules:
1. ONLY return the JSON object. No markdown formatting, no explanations.
2. Your response MUST be valid JSON format that matches our application's expected format:
   For simple queries:
   { "collection": "collection_name", "action": "find", "query": {...}, "limit": 100 }
   For aggregations (group by, complex joins):
   { "collection": "collection_name", "action": "aggregate", "pipeline": [{...}, {...}] }
3. Always specify the "collection" and "action" fields.
`;
        } else if (isRedis) {
            systemPrompt = `
You are an expert Redis Command Generator.
Generate a valid Redis CLI command based on the request.

Rules:
1. ONLY return the raw Redis command. No markdown formatting, no explanations.
2. Examples: GET mykey, SET mykey "value", KEYS *, HGETALL user:1000
`;
        } else {
            systemPrompt = `
You are an expert SQL Generator for ${dbType || 'MSSQL'}.
Generate a valid SQL query based on the database schema provided:
${schemaContext}

Rules:
1. ONLY return the SQL query. No markdown formatting, no explanations, no prefix/suffix.
2. Use proper schema prefix for tables.
3. If specific column names are requested, use them. 
4. If you don't know the schema for a requested table, assume standard naming conventions.
5. If the user asks for data modification (Insert, Update, Delete), ensure the query is accurate.
`;
        }

        let url = '';
        let headers: any = { 'Content-Type': 'application/json' };
        let body: any = {};

        // Prepare provider-specific request
        switch (provider) {
            case 'openai':
                url = 'https://api.openai.com/v1/chat/completions';
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: model || 'gpt-4o',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                };
                break;
            case 'zai':
                const baseUrl = endpoint || 'https://api.z.ai/api/coding/paas/v4';
                url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: model || 'GLM-4.7',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                };
                break;
            case 'anthropic':
                url = 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = apiKey;
                headers['anthropic-version'] = '2023-06-01';
                body = {
                    model: model || 'claude-3-5-sonnet-latest',
                    max_tokens: 1024,
                    messages: [
                        { role: 'user', content: `${systemPrompt}\n\nUSER PROMPT: ${prompt}` }
                    ]
                };
                break;
            case 'gemini':
                url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
                body = {
                    contents: [{
                        parts: [{ text: `${systemPrompt}\n\nUSER PROMPT: ${prompt}` }]
                    }]
                };
                break;
            case 'ollama':
                const ollamaUrl = endpoint || 'http://localhost:11434';
                url = `${ollamaUrl}/api/chat`;
                body = {
                    model: model || 'llama3',
                    stream: false,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                };
                break;
            case 'custom':
                url = endpoint;
                headers['Authorization'] = `Bearer ${apiKey}`;
                body = {
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt }
                    ]
                };
                break;
            default:
                return NextResponse.json({ success: false, message: 'Provider not implemented.' });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json({ success: false, message: data.error?.message || 'Error from AI Provider.' });
        }

        // Extract SQL text based on provider
        let sql = '';
        if (provider === 'openai' || provider === 'zai' || provider === 'custom') {
            sql = data.choices[0]?.message?.content || '';
        } else if (provider === 'anthropic') {
            sql = data.content[0]?.text || '';
        } else if (provider === 'gemini') {
            sql = data.candidates[0]?.content?.parts[0]?.text || '';
        } else if (provider === 'ollama') {
            sql = data.message?.content || '';
        }

        // Cleanup: remove markdown if present
        sql = sql.replace(/```sql\n?/gi, '').replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

        return NextResponse.json({ success: true, sql });

    } catch (error: any) {
        console.error('[AI Generate Error]', error);
        return NextResponse.json({ success: false, message: error.message || 'Server error during generation.' });
    }
}
