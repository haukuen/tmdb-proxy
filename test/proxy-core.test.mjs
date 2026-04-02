import { describe, expect, test } from 'bun:test';

import {
    buildJsonResponseHeaders,
    resolveProxyRequest,
    transformApiData
} from '../src/proxy-core.mjs';

const dandadanOverride = {
    name: '胆大党',
    seasons: [
        { season_number: 1, name: '胆大党', originalSeason: 1, episode_start: 1, episode_end: 12 },
        { season_number: 2, name: '胆大党 第二季', originalSeason: 1, episode_start: 13, episode_end: 24 }
    ]
};

const overrides = {
    240411: dandadanOverride
};

describe('resolveProxyRequest', () => {
    test('rewrites season subresource paths to the original season', () => {
        const result = resolveProxyRequest('/3/tv/240411/season/2/credits?language=zh-CN', overrides);

        expect(result.override).toEqual(dandadanOverride);
        expect(result.upstreamUrl).toBe('https://api.themoviedb.org/3/tv/240411/season/1/credits?language=zh-CN');
    });

    test('rewrites episode subresource paths to the original episode', () => {
        const result = resolveProxyRequest('/3/tv/240411/season/2/episode/3/images', overrides);

        expect(result.upstreamUrl).toBe('https://api.themoviedb.org/3/tv/240411/season/1/episode/15/images');
    });
});

describe('transformApiData', () => {
    test('transforms series seasons to custom split seasons', () => {
        const data = {
            seasons: [
                { season_number: 0, name: 'Specials', id: 99 },
                { season_number: 1, name: 'Season 1', id: 123, air_date: '2024-10-04', overview: 'Merged', poster_path: '/poster.jpg', vote_average: 8.6 }
            ]
        };

        const transformed = transformApiData(data, true, dandadanOverride, {
            type: 'series',
            seriesId: '240411'
        });

        expect(transformed.number_of_seasons).toBe(2);
        expect(transformed.seasons).toHaveLength(3);
        expect(transformed.seasons[1]).toEqual({
            air_date: '2024-10-04',
            episode_count: 12,
            id: 12301,
            name: '胆大党',
            overview: 'Merged',
            poster_path: '/poster.jpg',
            season_number: 1,
            vote_average: 8.6
        });
        expect(transformed.seasons[2].episode_count).toBe(12);
        expect(transformed.seasons[2].season_number).toBe(2);
    });

    test('renumbers split-season episodes', () => {
        const data = {
            season_number: 1,
            name: 'Season 1',
            episodes: [
                { episode_number: 12, season_number: 1, name: 'Episode 12' },
                { episode_number: 13, season_number: 1, name: 'Episode 13' },
                { episode_number: 14, season_number: 1, name: 'Episode 14' }
            ]
        };

        const transformed = transformApiData(data, true, dandadanOverride, {
            type: 'season',
            seriesId: '240411',
            seasonNumber: 2,
            subresourcePath: ''
        });

        expect(transformed.name).toBe('胆大党 第二季');
        expect(transformed.season_number).toBe(2);
        expect(transformed.episodes.map((episode) => episode.episode_number)).toEqual([1, 2]);
        expect(transformed.episodes.map((episode) => episode.season_number)).toEqual([2, 2]);
    });

    test('skips body transformation for season subresources', () => {
        const data = { id: 1, cast: [] };

        const transformed = transformApiData(data, true, dandadanOverride, {
            type: 'season',
            seriesId: '240411',
            seasonNumber: 2,
            subresourcePath: '/credits'
        });

        expect(transformed).toBe(data);
    });
});

describe('buildJsonResponseHeaders', () => {
    test('keeps safe upstream headers and drops body-coupled headers', () => {
        const upstreamHeaders = new Headers({
            'cache-control': 'public, max-age=60',
            etag: '"abc123"',
            'content-length': '999',
            'x-ratelimit-limit': '40'
        });

        const headers = buildJsonResponseHeaders(upstreamHeaders);

        expect(headers.get('content-type')).toBe('application/json');
        expect(headers.get('access-control-allow-origin')).toBe('*');
        expect(headers.get('cache-control')).toBe('public, max-age=60');
        expect(headers.get('x-ratelimit-limit')).toBe('40');
        expect(headers.get('etag')).toBeNull();
        expect(headers.get('content-length')).toBeNull();
    });
});
