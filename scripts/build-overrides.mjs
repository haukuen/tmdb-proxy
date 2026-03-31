import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourceDir = path.resolve('src/overrides');
const outputFile = path.resolve('src/overrides.generated.json');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function validateSeason(season, filePath, index) {
    const prefix = `[${filePath}] seasons[${index}]`;

    assert(Number.isInteger(season.season_number), `${prefix}.season_number must be an integer`);
    assert(typeof season.name === 'string' && season.name.length > 0, `${prefix}.name is required`);
    assert(Number.isInteger(season.originalSeason), `${prefix}.originalSeason must be an integer`);
    assert(Number.isInteger(season.episode_start), `${prefix}.episode_start must be an integer`);
    assert(Number.isInteger(season.episode_end), `${prefix}.episode_end must be an integer`);
    assert(season.episode_start > 0, `${prefix}.episode_start must be > 0`);
    assert(season.episode_end >= season.episode_start, `${prefix}.episode_end must be >= episode_start`);
}

function validateSeries(data, filePath) {
    assert(typeof data.series_id === 'string' && /^\d+$/.test(data.series_id), `[${filePath}] series_id must be a numeric string`);
    assert(typeof data.name === 'string' && data.name.length > 0, `[${filePath}] name is required`);
    assert(Array.isArray(data.seasons) && data.seasons.length > 0, `[${filePath}] seasons must be a non-empty array`);

    const seasonNumbers = new Set();

    data.seasons.forEach((season, index) => {
        validateSeason(season, filePath, index);
        assert(!seasonNumbers.has(season.season_number), `[${filePath}] duplicated season_number: ${season.season_number}`);
        seasonNumbers.add(season.season_number);
    });

    const byOriginalSeason = new Map();
    for (const season of data.seasons) {
        const list = byOriginalSeason.get(season.originalSeason) || [];
        list.push(season);
        byOriginalSeason.set(season.originalSeason, list);
    }

    for (const [originalSeason, seasons] of byOriginalSeason) {
        const sorted = [...seasons].sort((a, b) => a.episode_start - b.episode_start);
        for (let i = 1; i < sorted.length; i += 1) {
            const prev = sorted[i - 1];
            const curr = sorted[i];
            assert(curr.episode_start > prev.episode_end, `[${filePath}] originalSeason ${originalSeason} has overlapping ranges: ${prev.episode_start}-${prev.episode_end} and ${curr.episode_start}-${curr.episode_end}`);
        }
    }
}

async function collectJsonFiles(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectJsonFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.json')) {
            files.push(fullPath);
        }
    }

    return files;
}

async function build() {
    const files = (await collectJsonFiles(sourceDir)).sort();
    assert(files.length > 0, `No source files found under ${sourceDir}`);

    const output = {};

    for (const file of files) {
        const raw = await readFile(file, 'utf8');
        const parsed = JSON.parse(raw);
        const filePath = path.relative(process.cwd(), file);

        validateSeries(parsed, filePath);
        assert(!output[parsed.series_id], `[${filePath}] duplicated series_id: ${parsed.series_id}`);

        output[parsed.series_id] = {
            name: parsed.name,
            seasons: parsed.seasons
        };
    }

    const pretty = `${JSON.stringify(output, null, 2)}\n`;
    await writeFile(outputFile, pretty, 'utf8');

    console.log(`Built ${path.relative(process.cwd(), outputFile)} from ${files.length} files.`);
}

build().catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
});
