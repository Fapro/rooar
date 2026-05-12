"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cache = __importStar(require("../cache"));
const router = (0, express_1.Router)();
const BASE = 'https://api.sportmonks.com/v3/football';
async function fetchFromSportMonks(url) {
    const res = await fetch(url, {
        headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
        throw new Error(`SportMonks ${res.status}: ${await res.text()}`);
    }
    return res.json();
}
function isDnsResolutionError(err) {
    if (!(err instanceof Error)) {
        return false;
    }
    const cause = err.cause;
    return cause?.code === 'ENOTFOUND';
}
/**
 * GET /api/groups/standings/:seasonId
 * Returns team group assignments from SportMonks standings
 * Response: { groupsByTeamId: Record<teamId, groupLetter> }
 */
router.get('/standings/:seasonId', async (req, res) => {
    const seasonId = Number(req.params.seasonId) || Number(process.env.SPORTMONKS_SEASON_ID) || 26618;
    const cacheKey = `groups:standings:${seasonId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return res.json({ data: cached, source: 'cache' });
    }
    const apiKey = process.env.SPORTMONKS_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: 'API key not configured' });
    }
    try {
        // Fetch standings for the season which includes group info
        const url = `${BASE}/standings?seasons=${seasonId}&api_token=${apiKey}&include=standings.team`;
        const body = (await fetchFromSportMonks(url));
        const groupsByTeamId = {};
        // Parse standings and extract group letters
        if (body.data) {
            for (const stageData of body.data) {
                const groupName = stageData.group_name || '';
                // Extract letter from group name (e.g., "Group A" -> "A")
                const letterMatch = groupName.match(/([A-L])/i);
                const groupLetter = letterMatch?.[1]?.toUpperCase() || '';
                if (!groupLetter || !stageData.standings?.data) {
                    continue;
                }
                for (const row of stageData.standings.data) {
                    if (row.team?.name && row.team_id) {
                        groupsByTeamId[String(row.team_id)] = groupLetter;
                    }
                }
            }
        }
        cache.set(cacheKey, groupsByTeamId);
        return res.json({ data: groupsByTeamId, source: 'api' });
    }
    catch (err) {
        console.error('[groups standings]', err);
        if (isDnsResolutionError(err)) {
            return res.status(503).json({
                error: 'Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.',
            });
        }
        // Return empty data instead of 502 to allow fallback to hardcoded mapping
        return res.json({ data: {}, source: 'fallback' });
    }
});
exports.default = router;
