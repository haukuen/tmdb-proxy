module.exports = async (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.status(200).json({
        ok: true,
        service: 'tmdb-proxy',
        runtime: 'vercel'
    });
};
