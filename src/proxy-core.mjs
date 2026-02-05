const TMDB_BASE_URL = 'https://api.themoviedb.org';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function parseTvPath(path) {
    const pathWithoutQuery = path.split('?')[0];

    const patterns = {
        episode: /^\/3\/tv\/(\d+)\/season\/(\d+)\/episode\/(\d+)$/,
        season: /^\/3\/tv\/(\d+)\/season\/(\d+)$/,
        series: /^\/3\/tv\/(\d+)$/
    };

    let match = pathWithoutQuery.match(patterns.episode);
    if (match) {
        return {
            type: 'episode',
            seriesId: match[1],
            seasonNumber: parseInt(match[2], 10),
            episodeNumber: parseInt(match[3], 10)
        };
    }

    match = pathWithoutQuery.match(patterns.season);
    if (match) {
        return {
            type: 'season',
            seriesId: match[1],
            seasonNumber: parseInt(match[2], 10)
        };
    }

    match = pathWithoutQuery.match(patterns.series);
    if (match) {
        return {
            type: 'series',
            seriesId: match[1]
        };
    }

    return null;
}

function findSeasonConfig(override, seasonNumber) {
    return override.seasons.find((season) => season.season_number === seasonNumber);
}

function getOriginalEpisodeNumber(seasonConfig, episodeNumber) {
    return seasonConfig.episode_start + episodeNumber - 1;
}

function transformSeriesResponse(data, override) {
    const result = { ...data };

    result.seasons = override.seasons.map((customSeason) => {
        const originalSeason = data.seasons?.find((season) => season.season_number === customSeason.originalSeason);
        const episodeCount = customSeason.episode_end - customSeason.episode_start + 1;

        return {
            air_date: originalSeason?.air_date || null,
            episode_count: episodeCount,
            id: originalSeason?.id ? originalSeason.id * 100 + customSeason.season_number : customSeason.season_number,
            name: customSeason.name,
            overview: originalSeason?.overview || '',
            poster_path: originalSeason?.poster_path || null,
            season_number: customSeason.season_number,
            vote_average: originalSeason?.vote_average || 0
        };
    });

    const specialSeason = data.seasons?.find((season) => season.season_number === 0);
    if (specialSeason) {
        result.seasons.unshift(specialSeason);
    }

    result.number_of_seasons = override.seasons.length;

    return result;
}

function transformSeasonResponse(data, override, seasonNumber) {
    const seasonConfig = findSeasonConfig(override, seasonNumber);
    if (!seasonConfig) {
        return data;
    }

    const result = { ...data };
    const filteredEpisodes = (data.episodes || []).filter((episode) => (
        episode.episode_number >= seasonConfig.episode_start
        && episode.episode_number <= seasonConfig.episode_end
    ));

    result.episodes = filteredEpisodes.map((episode, index) => ({
        ...episode,
        episode_number: index + 1,
        season_number: seasonNumber
    }));
    result.season_number = seasonNumber;
    result.name = seasonConfig.name;

    return result;
}

function transformEpisodeResponse(data, override, seasonNumber, episodeNumber) {
    const seasonConfig = findSeasonConfig(override, seasonNumber);
    if (!seasonConfig) {
        return data;
    }

    return {
        ...data,
        season_number: seasonNumber,
        episode_number: episodeNumber
    };
}

function resolveProxyRequest(fullPath, overrides) {
    const pathname = fullPath.split('?')[0];
    const isImageRoute = pathname.startsWith('/t/p/');
    const tvInfo = parseTvPath(fullPath);
    const override = tvInfo ? overrides[tvInfo.seriesId] : null;

    let actualPath = fullPath;
    if (override && (tvInfo.type === 'season' || tvInfo.type === 'episode')) {
        const seasonConfig = findSeasonConfig(override, tvInfo.seasonNumber);
        if (seasonConfig) {
            const queryString = fullPath.includes('?') ? fullPath.split('?')[1] : '';
            if (tvInfo.type === 'season') {
                actualPath = `/3/tv/${tvInfo.seriesId}/season/${seasonConfig.originalSeason}${queryString ? `?${queryString}` : ''}`;
            } else {
                const originalEpisode = getOriginalEpisodeNumber(seasonConfig, tvInfo.episodeNumber);
                actualPath = `/3/tv/${tvInfo.seriesId}/season/${seasonConfig.originalSeason}/episode/${originalEpisode}${queryString ? `?${queryString}` : ''}`;
            }
        }
    }

    const upstreamBaseUrl = isImageRoute ? TMDB_IMAGE_BASE_URL : TMDB_BASE_URL;

    return {
        isImageRoute,
        tvInfo,
        override,
        upstreamUrl: `${upstreamBaseUrl}${actualPath}`
    };
}

function transformApiData(responseData, responseOk, override, tvInfo) {
    if (!responseOk || !override || !tvInfo) {
        return responseData;
    }

    if (tvInfo.type === 'series') {
        return transformSeriesResponse(responseData, override);
    }

    if (tvInfo.type === 'season') {
        return transformSeasonResponse(responseData, override, tvInfo.seasonNumber);
    }

    if (tvInfo.type === 'episode') {
        return transformEpisodeResponse(responseData, override, tvInfo.seasonNumber, tvInfo.episodeNumber);
    }

    return responseData;
}

export {
    corsHeaders,
    resolveProxyRequest,
    transformApiData
};
