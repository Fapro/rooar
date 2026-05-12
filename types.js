"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseFixture = normaliseFixture;
function getCurrentGoals(raw, participantId) {
    if (!participantId) {
        return 0;
    }
    const current = raw.scores?.find((s) => s.participant_id === participantId && s.description === 'CURRENT');
    return Number(current?.score?.goals ?? 0);
}
/** Converts a SportMonks fixture into the app's simplified shape. */
function normaliseFixture(raw, appTeamId, groupLetter) {
    const home = raw.participants?.find((p) => p.meta.location === 'home');
    const away = raw.participants?.find((p) => p.meta.location === 'away');
    const kickoffUtc = raw.starting_at.includes('T')
        ? raw.starting_at
        : raw.starting_at.replace(' ', 'T');
    return {
        id: String(raw.id),
        stage: raw.stage?.name ?? 'Group Stage',
        round: raw.round?.name ?? '',
        groupLetter,
        kickoffUtc: kickoffUtc.endsWith('Z') ? kickoffUtc : kickoffUtc + 'Z',
        homeScore: getCurrentGoals(raw, home?.id),
        awayScore: getCurrentGoals(raw, away?.id),
        homeTeam: {
            id: String(home?.id ?? appTeamId),
            name: home?.name ?? 'TBD',
            flag: home?.image_path ?? '',
        },
        awayTeam: {
            id: String(away?.id ?? appTeamId),
            name: away?.name ?? 'TBD',
            flag: away?.image_path ?? '',
        },
        venue: {
            name: raw.venue?.name ?? 'TBD',
            city: raw.venue?.city_name ?? 'TBD',
            country: raw.venue?.country?.name ?? 'TBD',
            timeZone: raw.venue?.timezone ?? 'America/New_York',
            image: raw.venue?.image_path ?? '',
        },
    };
}
