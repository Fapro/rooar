import type { Config, Context } from "@netlify/functions";

const BASE = "https://api.sportmonks.com/v3/football";

const APP_TO_SPORTMONKS_TEAM_ID: Record<string, number> = {
  ger: 18660, fra: 496, esp: 738, eng: 462, por: 737, ned: 1010, bel: 729,
  ita: 735, aut: 730, sui: 739, hun: 734, sco: 1161, cze: 731, tur: 18716,
  srb: 741, alb: 1025, bra: 6, arg: 951, col: 110, uru: 744, ecu: 732,
  ven: 742, usa: 18571, mex: 454, can: 108, pan: 1028, crc: 1024, jam: 1027,
  mar: 489, sen: 498, egy: 733, nga: 493, cmr: 109, civ: 1033, drc: 18552,
  gnb: 1038, tun: 500, jpn: 487, kor: 18567, aus: 18730, irn: 736, sau: 497,
  qat: 1044, uzb: 1051, jor: 1042, irq: 1041, nzl: 1049, bih: 18559,
  hai: 1026, zaf: 18715, par: 1048, cuw: 18573, swe: 499, cpv: 18572,
  nor: 491, alg: 1030, cro: 1023, gha: 485,
};

const APP_TEAM_NAME: Record<string, string> = {
  ger: "Germany", fra: "France", esp: "Spain", eng: "England", por: "Portugal",
  ned: "Netherlands", bel: "Belgium", ita: "Italy", aut: "Austria",
  sui: "Switzerland", hun: "Hungary", sco: "Scotland", cze: "Czech Republic",
  tur: "Turkey", srb: "Serbia", alb: "Albania", bra: "Brazil", arg: "Argentina",
  col: "Colombia", uru: "Uruguay", ecu: "Ecuador", ven: "Venezuela",
  usa: "United States", mex: "Mexico", can: "Canada", pan: "Panama",
  crc: "Costa Rica", jam: "Jamaica", mar: "Morocco", sen: "Senegal",
  egy: "Egypt", nga: "Nigeria", cmr: "Cameroon", civ: "Cote d'Ivoire",
  drc: "DR Congo", gnb: "Guinea-Bissau", tun: "Tunisia", jpn: "Japan",
  kor: "South Korea", aus: "Australia", irn: "Iran", sau: "Saudi Arabia",
  qat: "Qatar", uzb: "Uzbekistan", jor: "Jordan", irq: "Iraq",
  nzl: "New Zealand", bih: "Bosnia and Herzegovina", hai: "Haiti",
  zaf: "South Africa", par: "Paraguay", cuw: "Curacao", swe: "Sweden",
  cpv: "Cape Verde", nor: "Norway", alg: "Algeria", cro: "Croatia",
  gha: "Ghana",
};

const APP_TEAM_GROUP_BY_ID: Record<string, string> = {
  cze: "A", kor: "A", mex: "A", zaf: "A",
  can: "B", qat: "B", sui: "B", bih: "B",
  bra: "C", mar: "C", sco: "C", hai: "C",
  aus: "D", tur: "D", usa: "D", par: "D",
  civ: "E", ecu: "E", ger: "E", cuw: "E",
  jpn: "F", ned: "F", tun: "F", swe: "F",
  bel: "G", egy: "G", irn: "G", nzl: "G",
  cpv: "H", sau: "H", esp: "H", uru: "H",
  fra: "I", irq: "I", nor: "I", sen: "I",
  arg: "J", aut: "J", jor: "J", alg: "J",
  col: "K", drc: "K", por: "K", uzb: "K",
  eng: "L", pan: "L", cro: "L", gha: "L",
};

const TEAM_NAME_TO_APP_ID: Record<string, string> = {
  germany: "ger", france: "fra", spain: "esp", england: "eng",
  portugal: "por", netherlands: "ned", belgium: "bel", austria: "aut",
  switzerland: "sui", norway: "nor", sweden: "swe", scotland: "sco",
  "czech republic": "cze", czechia: "cze", croatia: "cro",
  "bosnia and herzegovina": "bih", turkey: "tur", turkiye: "tur",
  brazil: "bra", argentina: "arg", colombia: "col", paraguay: "par",
  uruguay: "uru", ecuador: "ecu", usa: "usa", "united states": "usa",
  mexico: "mex", canada: "can", panama: "pan", haiti: "hai", curacao: "cuw",
  algeria: "alg", morocco: "mar", senegal: "sen", egypt: "egy", ghana: "gha",
  "south africa": "zaf", "cape verde": "cpv", "cote d'ivoire": "civ",
  "côte d'ivoire": "civ", "ivory coast": "civ", "dr congo": "drc",
  "congo dr": "drc", japan: "jpn", "korea republic": "kor",
  "south korea": "kor", australia: "aus", iran: "irn", "ir iran": "irn",
  "saudi arabia": "sau", qatar: "qat", uzbekistan: "uzb", jordan: "jor",
  iraq: "irq", "new zealand": "nzl",
};

const FIXTURE_INCLUDES =
  "fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage";

const runtimeTeamIdByAppId: Record<string, number> = {};
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function cacheGet<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function cacheSet(key: string, value: unknown) {
  cache.set(key, { data: value, ts: Date.now() });
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

async function fetchFromSportMonks(url: string): Promise<any> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`SportMonks ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getCurrentGoals(raw: any, participantId?: number): number {
  if (!participantId) return 0;
  const current = raw.scores?.find(
    (s: any) => s.participant_id === participantId && s.description === "CURRENT"
  );
  return Number(current?.score?.goals ?? 0);
}

function normaliseFixture(raw: any, appTeamId: string, groupLetter?: string) {
  const home = raw.participants?.find((p: any) => p.meta.location === "home");
  const away = raw.participants?.find((p: any) => p.meta.location === "away");
  const kickoffUtc = raw.starting_at.includes("T")
    ? raw.starting_at
    : raw.starting_at.replace(" ", "T");
  return {
    id: String(raw.id),
    stage: raw.stage?.name ?? "Group Stage",
    round: raw.round?.name ?? "",
    groupLetter,
    kickoffUtc: kickoffUtc.endsWith("Z") ? kickoffUtc : kickoffUtc + "Z",
    homeScore: getCurrentGoals(raw, home?.id),
    awayScore: getCurrentGoals(raw, away?.id),
    homeTeam: {
      id: String(home?.id ?? appTeamId),
      name: home?.name ?? "TBD",
      flag: home?.image_path ?? "",
    },
    awayTeam: {
      id: String(away?.id ?? appTeamId),
      name: away?.name ?? "TBD",
      flag: away?.image_path ?? "",
    },
    venue: {
      name: raw.venue?.name ?? "TBD",
      city: raw.venue?.city_name ?? "TBD",
      country: raw.venue?.country?.name ?? "TBD",
      timeZone: raw.venue?.timezone ?? "America/New_York",
      image: raw.venue?.image_path ?? "",
    },
  };
}

function deriveGroupLetterFromTeamNames(teamNames: string[]): string | undefined {
  for (const name of teamNames) {
    const appId =
      TEAM_NAME_TO_APP_ID[normalizeName(name)] ??
      TEAM_NAME_TO_APP_ID[name.toLowerCase()];
    if (!appId) continue;
    const group = APP_TEAM_GROUP_BY_ID[appId];
    if (group) return group;
  }
  return undefined;
}

function deriveGroupLetterFromFixture(raw: any): string | undefined {
  const home = raw.participants?.find((p: any) => p.meta.location === "home");
  const away = raw.participants?.find((p: any) => p.meta.location === "away");
  const teamNames: string[] = [];
  if (home?.name) teamNames.push(home.name);
  if (away?.name) teamNames.push(away.name);
  if (teamNames.length > 0) return deriveGroupLetterFromTeamNames(teamNames);
  return undefined;
}

async function resolveTeamIdByName(
  appTeamName: string,
  apiKey: string
): Promise<number | null> {
  const url = `${BASE}/teams/search/${encodeURIComponent(appTeamName)}?api_token=${apiKey}`;
  const body = await fetchFromSportMonks(url);
  const teams: any[] = body.data ?? [];
  if (!teams.length) return null;
  const nationals = teams.filter((t: any) => t.type === "national");
  const candidates = nationals.length ? nationals : teams;
  const target = normalizeName(appTeamName);
  const exact = candidates.find((t: any) => normalizeName(t.name) === target);
  if (exact) return exact.id;
  const close = candidates.find((t: any) => {
    const candidate = normalizeName(t.name);
    return candidate.includes(target) || target.includes(candidate);
  });
  return (close ?? candidates[0])?.id ?? null;
}

async function fetchTeamFixtures(teamId: number, apiKey: string): Promise<any[]> {
  const url =
    `${BASE}/teams/${teamId}?api_token=${apiKey}&include=${encodeURIComponent(FIXTURE_INCLUDES)}`;
  const body = await fetchFromSportMonks(url);
  return body.data?.fixtures ?? [];
}

function normalizeVenueToken(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function fetchWikipediaImageForQuery(query: string): Promise<string | null> {
  const searchUrl =
    "https://en.wikipedia.org/w/api.php" +
    `?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
    "&srlimit=1&format=json&utf8=1";
  const searchBody = await fetchFromSportMonks(searchUrl);
  const title = searchBody.query?.search?.[0]?.title;
  if (!title) return null;
  const summaryUrl =
    "https://en.wikipedia.org/api/rest_v1/page/summary/" +
    encodeURIComponent(title.replace(/\s+/g, "_"));
  const summary = await fetchFromSportMonks(summaryUrl);
  return summary.originalimage?.source ?? summary.thumbnail?.source ?? null;
}

async function resolveVenueImage(
  venueName: string,
  city: string,
  country: string
): Promise<string> {
  const imageCacheKey = `venue-image:${normalizeVenueToken(venueName)}:${normalizeVenueToken(city)}`;
  const cached = cacheGet<string>(imageCacheKey);
  if (cached !== undefined) return cached;

  const queries = [
    `${venueName} ${city} stadium`,
    `${venueName} stadium`,
    `${venueName} ${country}`,
  ];
  for (const query of queries) {
    try {
      const image = await fetchWikipediaImageForQuery(query);
      if (image) {
        cacheSet(imageCacheKey, image);
        return image;
      }
    } catch {
      // Try next query candidate.
    }
  }
  cacheSet(imageCacheKey, "");
  return "";
}

async function attachVenueImages(fixtures: any[]): Promise<any[]> {
  return Promise.all(
    fixtures.map(async (fixture) => {
      if (fixture.venue.image) return fixture;
      const image = await resolveVenueImage(
        fixture.venue.name,
        fixture.venue.city,
        fixture.venue.country
      );
      if (!image) return fixture;
      return { ...fixture, venue: { ...fixture.venue, image } };
    })
  );
}

// ── Players helpers ──────────────────────────────────────────────────────────

function isExcludedNationalVariant(name: string): boolean {
  const normalized = normalizeName(name);
  return /u\d{2}|women|wnt|olympic|futsal|beachsoccer/.test(normalized);
}

function isNameCloseMatch(candidateName: string, appTeamName: string): boolean {
  const candidate = normalizeName(candidateName);
  const target = normalizeName(appTeamName);
  return candidate === target || candidate.includes(target) || target.includes(candidate);
}

function scoreNameMatch(candidateName: string, appTeamName: string): number {
  const candidate = normalizeName(candidateName);
  const target = normalizeName(appTeamName);
  if (candidate === target) return 100;
  if (candidate.startsWith(target) || target.startsWith(candidate)) return 80;
  if (candidate.includes(target) || target.includes(candidate)) return 60;
  return 0;
}

function isTrainerPosition(positionName: string): boolean {
  const normalized = positionName.toLowerCase();
  if (!/(coach|manager|trainer)/.test(normalized)) return false;
  return !/(assistant|goalkeeping|fitness|analyst|director|doctor|physio)/.test(normalized);
}

function isStaffPosition(positionName: string): boolean {
  return /(coach|manager|trainer|assistant|director|analyst|doctor|physio|staff|scout)/i.test(
    positionName
  );
}

async function resolveTeamIdByNameForPlayers(
  appTeamName: string,
  apiKey: string
): Promise<number | null> {
  const url = `${BASE}/teams/search/${encodeURIComponent(appTeamName)}?api_token=${apiKey}`;
  const body = await fetchFromSportMonks(url);
  const teams: any[] = body.data ?? [];
  if (!teams.length) return null;
  const nationals = teams.filter(
    (t: any) => t.type === "national" && !isExcludedNationalVariant(t.name)
  );
  const candidates = nationals.length ? nationals : teams;
  const exact = candidates.find((t: any) => isNameCloseMatch(t.name, appTeamName));
  if (exact) return exact.id;
  const ranked = [...candidates].sort(
    (a, b) => scoreNameMatch(b.name, appTeamName) - scoreNameMatch(a.name, appTeamName)
  );
  return ranked[0]?.id ?? null;
}

async function fetchPlayersByTeamId(teamId: number, apiKey: string): Promise<any[]> {
  const hasUsableName = (player: any) => {
    const fullFromParts = [player.firstname, player.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    return Boolean(
      player.common_name || player.name || player.display_name || fullFromParts
    );
  };

  const candidateUrls = [
    `${BASE}/teams/${teamId}?api_token=${apiKey}&include=${encodeURIComponent(
      "players;players.player;players.position;players.player.position"
    )}`,
    `${BASE}/players?team_id=${teamId}&api_token=${apiKey}&include=position`,
    `${BASE}/players?filters=${encodeURIComponent(
      `teamId:${teamId}`
    )}&api_token=${apiKey}&include=position`,
  ];

  let lastError: unknown = null;
  for (const url of candidateUrls) {
    try {
      const body = await fetchFromSportMonks(url);
      if (Array.isArray(body.data) && body.data.length > 0) {
        const namedPlayers = body.data.filter(hasUsableName);
        if (namedPlayers.length > 0) return namedPlayers;
      }
      if (!Array.isArray(body.data) && body.data?.players?.length) {
        const normalizedPlayers = body.data.players.map((row: any) => {
          const player = row.player;
          if (player) {
            return {
              ...player,
              id: player.id,
              jersey_number: row.jersey_number ?? player.jersey_number,
              position: player.position ?? row.position,
            };
          }
          return {
            id: row.player_id ?? row.id,
            common_name: row.common_name,
            name: row.name,
            display_name: row.display_name,
            firstname: row.firstname,
            lastname: row.lastname,
            jersey_number: row.jersey_number,
            shirt_number: row.shirt_number,
            number: row.number,
            position: row.position,
            date_of_birth: row.date_of_birth,
          };
        });
        const namedPlayers = normalizedPlayers.filter(hasUsableName);
        if (namedPlayers.length > 0) return namedPlayers;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  if (lastError) throw lastError;
  return [];
}

async function fetchTeamMetaById(teamId: number, apiKey: string): Promise<any> {
  const url = `${BASE}/teams/${teamId}?api_token=${apiKey}`;
  const body = await fetchFromSportMonks(url);
  return body.data ?? null;
}

async function fetchTrainerByTeamId(
  teamId: number,
  apiKey: string
): Promise<string | null> {
  const url = `${BASE}/teams/${teamId}?api_token=${apiKey}&include=${encodeURIComponent(
    "coaches;coaches.coach"
  )}`;
  const body = await fetchFromSportMonks(url);
  const coaches: any[] = body.data?.coaches ?? [];
  const preferredOrder = [
    ...coaches.filter((c: any) => c.active),
    ...coaches.filter((c: any) => !c.active),
  ];
  for (const row of preferredOrder) {
    const coach = row.coach;
    if (!coach) continue;
    const fallbackNameFromParts = [coach.firstname, coach.lastname]
      .filter(Boolean)
      .join(" ")
      .trim();
    const trainerName =
      coach.common_name || coach.display_name || coach.name || fallbackNameFromParts;
    if (trainerName) return trainerName;
  }
  return null;
}

async function resolveWorkingTeamIdForPlayers(
  appTeamName: string,
  currentTeamId: number,
  apiKey: string
): Promise<number> {
  const searchUrl = `${BASE}/teams/search/${encodeURIComponent(appTeamName)}?api_token=${apiKey}`;
  const searchBody = await fetchFromSportMonks(searchUrl);
  const rankedFromSearch = (searchBody.data ?? [])
    .filter((t: any) => t.type === "national")
    .filter((t: any) => !isExcludedNationalVariant(t.name))
    .filter((t: any) => isNameCloseMatch(t.name, appTeamName))
    .sort(
      (a: any, b: any) =>
        scoreNameMatch(b.name, appTeamName) - scoreNameMatch(a.name, appTeamName)
    )
    .map((t: any) => t.id)
    .filter((id: number, index: number, arr: number[]) => arr.indexOf(id) === index)
    .slice(0, 6);
  const candidates = [...rankedFromSearch, currentTeamId]
    .filter((id: number, index: number, arr: number[]) => arr.indexOf(id) === index)
    .slice(0, 8);
  for (const candidateId of candidates) {
    const meta = await fetchTeamMetaById(candidateId, apiKey);
    if (!meta) continue;
    if (meta.type !== "national") continue;
    if (isExcludedNationalVariant(meta.name)) continue;
    if (!isNameCloseMatch(meta.name, appTeamName)) continue;
    const players = await fetchPlayersByTeamId(candidateId, apiKey);
    if (players.length > 0) return candidateId;
  }
  return currentTeamId;
}

// ── Route handlers ───────────────────────────────────────────────────────────

async function handleFixturesBySportMonks(sportTeamIdStr: string): Promise<Response> {
  const sportTeamId = Number(sportTeamIdStr);
  const seasonId = Netlify.env.get("SPORTMONKS_SEASON_ID");
  if (!Number.isFinite(sportTeamId) || sportTeamId <= 0) {
    return json({ error: "Invalid SportMonks team id" }, 400);
  }
  const cacheKey = `fixtures:sport:${sportTeamId}:${seasonId ?? "all"}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return json({ data: cached, source: "cache" });

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  const rawFixtures = await fetchTeamFixtures(sportTeamId, apiKey);
  const seasonIdNum = seasonId ? Number(seasonId) : null;
  const filteredBySeason =
    seasonIdNum && !Number.isNaN(seasonIdNum)
      ? rawFixtures.filter((raw: any) => raw.season_id === seasonIdNum)
      : rawFixtures;
  const selected = filteredBySeason.length
    ? filteredBySeason
    : rawFixtures.slice(0, 8);
  const fixtures = await attachVenueImages(
    selected.map((raw: any) => {
      const groupLetter = deriveGroupLetterFromFixture(raw);
      return normaliseFixture(raw, String(sportTeamId), groupLetter);
    })
  );
  if (fixtures.length) cacheSet(cacheKey, fixtures);
  return json({ data: fixtures, source: "api" });
}

async function handleFixturesByAppTeam(appTeamId: string): Promise<Response> {
  const seasonId = Netlify.env.get("SPORTMONKS_SEASON_ID");
  const cacheKey = `fixtures:${appTeamId}:${seasonId ?? "all"}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return json({ data: cached, source: "cache" });

  const appTeamName = APP_TEAM_NAME[appTeamId];
  if (!appTeamName) return json({ error: `Unknown team id: ${appTeamId}` }, 404);

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  let sportMonksId =
    runtimeTeamIdByAppId[appTeamId] ?? APP_TO_SPORTMONKS_TEAM_ID[appTeamId];
  if (!sportMonksId) {
    const resolvedId = await resolveTeamIdByName(appTeamName, apiKey);
    if (!resolvedId)
      return json({ error: `No SportMonks team found for ${appTeamId}` }, 404);
    sportMonksId = resolvedId;
    runtimeTeamIdByAppId[appTeamId] = resolvedId;
  }
  let rawFixtures = await fetchTeamFixtures(sportMonksId, apiKey);
  if (!rawFixtures.length) {
    const resolvedId = await resolveTeamIdByName(appTeamName, apiKey);
    if (resolvedId && resolvedId !== sportMonksId) {
      sportMonksId = resolvedId;
      runtimeTeamIdByAppId[appTeamId] = resolvedId;
      rawFixtures = await fetchTeamFixtures(sportMonksId, apiKey);
    }
  }
  const seasonIdNum = seasonId ? Number(seasonId) : null;
  const filteredBySeason =
    seasonIdNum && !Number.isNaN(seasonIdNum)
      ? rawFixtures.filter((raw: any) => raw.season_id === seasonIdNum)
      : rawFixtures;
  const selected = filteredBySeason.length
    ? filteredBySeason
    : rawFixtures.slice(0, 8);
  const fixtures = await attachVenueImages(
    selected.map((raw: any) => {
      const groupLetter = deriveGroupLetterFromFixture(raw);
      return normaliseFixture(raw, appTeamId, groupLetter);
    })
  );
  if (fixtures.length) cacheSet(cacheKey, fixtures);
  return json({ data: fixtures, source: "api" });
}

async function handleGroupStageAll(): Promise<Response> {
  const seasonId = Netlify.env.get("SPORTMONKS_SEASON_ID");
  const cacheKey = `fixtures:group-stage:${seasonId ?? "all"}`;
  const cached = cacheGet<any[]>(cacheKey);
  if (cached) return json({ data: cached, source: "cache" });

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  const seasonIdNum = seasonId ? Number(seasonId) : 26618;
  const fixtureIncludes =
    "fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage";
  const url =
    `${BASE}/seasons/${seasonIdNum}?api_token=${apiKey}&include=${encodeURIComponent(fixtureIncludes)}`;
  const body = await fetchFromSportMonks(url);
  const allFixtures: any[] = body.data?.fixtures ?? [];
  const groupStageMatches = allFixtures.filter((raw: any) => {
    const stage = raw.stage?.name ?? "";
    return stage.toLowerCase().includes("group");
  });
  const fixtures = await attachVenueImages(
    groupStageMatches.map((raw: any) =>
      normaliseFixture(raw, "all-group-stage")
    )
  );
  if (fixtures.length) cacheSet(cacheKey, fixtures);
  return json({ data: fixtures, source: "api" });
}

async function handleMatchDetail(matchId: string): Promise<Response> {
  const seasonId = Netlify.env.get("SPORTMONKS_SEASON_ID");
  const cacheKey = `match:${matchId}`;
  const cached = cacheGet<any>(cacheKey);
  if (cached) return json({ data: cached, source: "cache" });

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  const seasonIdNum = seasonId ? Number(seasonId) : 26618;
  const fixtureIncludes =
    "fixtures;fixtures.participants;fixtures.scores;fixtures.venue;fixtures.venue.country;fixtures.round;fixtures.stage";
  const url =
    `${BASE}/seasons/${seasonIdNum}?api_token=${apiKey}&include=${encodeURIComponent(fixtureIncludes)}`;
  const body = await fetchFromSportMonks(url);
  const allFixtures: any[] = body.data?.fixtures ?? [];
  const match = allFixtures.find((f: any) => String(f.id) === matchId);
  if (!match) return json({ error: `Match not found: ${matchId}` }, 404);

  const groupLetter = deriveGroupLetterFromFixture(match);
  const fixture = normaliseFixture(match, "match-detail", groupLetter);
  const withImage = (await attachVenueImages([fixture]))[0];
  cacheSet(cacheKey, withImage);
  return json({ data: withImage, source: "api" });
}

async function handlePlayers(appTeamId: string): Promise<Response> {
  const cacheKey = `players:v7:${appTeamId}`;
  const cached = cacheGet<{ data: any[]; trainer: string | null }>(cacheKey);
  if (cached && cached.data.length > 0) {
    return json({ ...cached, source: "cache" });
  }

  const appTeamName = APP_TEAM_NAME[appTeamId];
  if (!appTeamName) return json({ error: `Unknown team id: ${appTeamId}` }, 404);

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  const mappedTeamId = APP_TO_SPORTMONKS_TEAM_ID[appTeamId];
  const resolvedByName = await resolveTeamIdByNameForPlayers(appTeamName, apiKey);
  const sportMonksTeamId = resolvedByName ?? mappedTeamId;
  if (!sportMonksTeamId) {
    return json({ error: `Could not resolve team: ${appTeamName}` }, 404);
  }

  const workingTeamId = await resolveWorkingTeamIdForPlayers(
    appTeamName,
    sportMonksTeamId,
    apiKey
  );
  const explicitTrainer = await fetchTrainerByTeamId(workingTeamId, apiKey);
  const rawPlayers = await fetchPlayersByTeamId(workingTeamId, apiKey);

  const positionOrder: Record<string, number> = {
    Goalkeeper: 1, Defender: 2, Midfielder: 3, Forward: 4, Attacker: 4,
  };

  const normalizedRows = rawPlayers
    .map((p: any) => {
      const birthDate = p.date_of_birth ? new Date(p.date_of_birth) : null;
      const age = birthDate
        ? new Date().getFullYear() - birthDate.getFullYear()
        : undefined;
      const fallbackNameFromParts = [p.firstname, p.lastname]
        .filter(Boolean)
        .join(" ")
        .trim();
      const normalizedName =
        p.common_name || p.display_name || p.name || fallbackNameFromParts || "Unknown";
      const rawNumber = p.jersey_number ?? p.shirt_number ?? p.number;
      const number =
        typeof rawNumber === "number" && Number.isFinite(rawNumber) ? rawNumber : 0;
      const positionName = p.position?.name || "Unknown";
      return { id: String(p.id), name: normalizedName, number, position: positionName, age };
    })
    .filter(Boolean);

  const inferredTrainer =
    normalizedRows.find((p: any) => isTrainerPosition(p.position))?.name ?? null;
  const trainer = explicitTrainer ?? inferredTrainer;

  const players = normalizedRows
    .filter((p: any) => !isStaffPosition(p.position))
    .sort((a: any, b: any) => {
      const aPos = positionOrder[a.position] ?? 99;
      const bPos = positionOrder[b.position] ?? 99;
      if (aPos !== bPos) return aPos - bPos;
      return a.name.localeCompare(b.name);
    });

  if (players.length > 0) cacheSet(cacheKey, { data: players, trainer });
  return json({ data: players, trainer });
}

async function handleGroupStandings(seasonIdParam?: string): Promise<Response> {
  const seasonId =
    Number(seasonIdParam) ||
    Number(Netlify.env.get("SPORTMONKS_SEASON_ID")) ||
    26618;
  const cacheKey = `groups:standings:${seasonId}`;
  const cached = cacheGet<Record<string, string>>(cacheKey);
  if (cached) return json({ data: cached, source: "cache" });

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey) return json({ error: "API key not configured" }, 500);

  const url = `${BASE}/standings?seasons=${seasonId}&api_token=${apiKey}&include=standings.team`;
  const body = await fetchFromSportMonks(url);
  const groupsByTeamId: Record<string, string> = {};
  if (body.data) {
    for (const stageData of body.data) {
      const groupName = stageData.group_name || "";
      const letterMatch = groupName.match(/([A-L])/i);
      const groupLetter = letterMatch?.[1]?.toUpperCase() || "";
      if (!groupLetter || !stageData.standings?.data) continue;
      for (const row of stageData.standings.data) {
        if (row.team?.name && row.team_id) {
          groupsByTeamId[String(row.team_id)] = groupLetter;
        }
      }
    }
  }
  cacheSet(cacheKey, groupsByTeamId);
  return json({ data: groupsByTeamId, source: "api" });
}

async function proxyToUpstreamBackend(path: string): Promise<Response> {
  const upstream = Netlify.env.get("EXPO_PUBLIC_BACKEND");
  if (!upstream) {
    return json(
      { error: "API key not configured and no upstream backend available" },
      500
    );
  }
  const target = `${upstream.replace(/\/+$/, "")}${path}`;
  const res = await fetch(target, {
    headers: { Accept: "application/json" },
  });
  const body = await res.text();
  return new Response(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async (req: Request, context: Context) => {
  const url = new URL(req.url);
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);

  const apiKey = Netlify.env.get("SPORTMONKS_API_KEY");
  if (!apiKey && path !== "/api/health") {
    return proxyToUpstreamBackend(path);
  }

  try {
    // GET /api/health
    if (path === "/api/health") {
      return json({ ok: true });
    }

    // GET /api/fixtures/group-stage/all
    if (
      segments[0] === "api" &&
      segments[1] === "fixtures" &&
      segments[2] === "group-stage" &&
      segments[3] === "all"
    ) {
      return await handleGroupStageAll();
    }

    // GET /api/fixtures/by-sportmonks/:sportTeamId
    if (
      segments[0] === "api" &&
      segments[1] === "fixtures" &&
      segments[2] === "by-sportmonks" &&
      segments[3]
    ) {
      return await handleFixturesBySportMonks(segments[3]);
    }

    // GET /api/fixtures/match/:matchId
    if (
      segments[0] === "api" &&
      segments[1] === "fixtures" &&
      segments[2] === "match" &&
      segments[3]
    ) {
      return await handleMatchDetail(segments[3]);
    }

    // GET /api/fixtures/:appTeamId
    if (segments[0] === "api" && segments[1] === "fixtures" && segments[2]) {
      return await handleFixturesByAppTeam(segments[2]);
    }

    // GET /api/players/:appTeamId
    if (segments[0] === "api" && segments[1] === "players" && segments[2]) {
      return await handlePlayers(segments[2]);
    }

    // GET /api/groups/standings/:seasonId?
    if (
      segments[0] === "api" &&
      segments[1] === "groups" &&
      segments[2] === "standings"
    ) {
      return await handleGroupStandings(segments[3]);
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[api function]", message);
    const isDns =
      err instanceof Error && (err.cause as any)?.code === "ENOTFOUND";
    if (isDns) {
      return json(
        {
          error:
            "Could not resolve SportMonks host (api.sportmonks.com). Check DNS/network and retry.",
        },
        503
      );
    }
    return json({ error: `API error: ${message}` }, 502);
  }
};

export const config: Config = {
  path: "/api/*",
};
