const axios = require('axios');
const overrides = require('../src/overrides.json');

module.exports = async (req, res) => {
    const { corsHeaders, resolveProxyRequest, transformApiData } = await import('../src/proxy-core.mjs');

    Object.entries(corsHeaders).forEach(([key, value]) => {
        res.setHeader(key, value);
    });

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const fullPath = req.url;
        const { tvInfo, override, upstreamUrl } = resolveProxyRequest(fullPath, overrides);

        const config = {};
        const authHeader = req.headers.authorization;
        if (authHeader) {
            config.headers = { Authorization: authHeader };
        }

        const response = await axios.get(upstreamUrl, config);
        const transformedData = transformApiData(response.data, response.status === 200, override, tvInfo);

        res.status(response.status).json(transformedData);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: error.message,
            details: error.response?.data
        });
    }
};
