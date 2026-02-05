import overrides from './overrides.json';
import { corsHeaders, resolveProxyRequest, transformApiData } from './proxy-core.mjs';

export default {
    async fetch(request) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            if (url.pathname === '/' || url.pathname === '/health') {
                return new Response(JSON.stringify({
                    ok: true,
                    service: 'tmdb-proxy',
                    runtime: 'cloudflare-worker'
                }), {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        ...corsHeaders
                    }
                });
            }

            const fullPath = `${url.pathname}${url.search}`;
            const { isImageRoute, tvInfo, override, upstreamUrl } = resolveProxyRequest(fullPath, overrides);

            const headers = {};
            const authHeader = request.headers.get('Authorization');
            if (authHeader) {
                headers.Authorization = authHeader;
            }

            const response = await fetch(upstreamUrl, { headers });

            if (isImageRoute) {
                const responseHeaders = new Headers(response.headers);
                Object.entries(corsHeaders).forEach(([key, value]) => {
                    responseHeaders.set(key, value);
                });

                return new Response(response.body, {
                    status: response.status,
                    headers: responseHeaders
                });
            }

            const responseData = await response.json();
            const transformedData = transformApiData(responseData, response.ok, override, tvInfo);

            return new Response(JSON.stringify(transformedData), {
                status: response.status,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                }
            });
        }
    }
};
