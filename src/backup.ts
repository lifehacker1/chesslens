import { engineUrl } from "./engine";
import {
  archiveUrl,
  collections,
  storeCollection,
  type Collection,
} from "./archiveLibrary";
import { withBackgroundJob } from "./backgroundJobs";
import {
  emptyLearning,
  loadLearning,
  saveLearning,
  validateLearning,
  type LearningData,
} from "./learningStorage";
import {
  cacheGameAnalysis,
  canonicalPgn,
  listAnalysisBackups,
  listSavedGames,
  saveGame,
  mergeSavedAnalysis,
  sameOptions,
  validOptions,
  validateSession,
  type ReviewSession,
  type SavedGame,
} from "./reviewStorage";

export const BACKUP_LIMIT = 50 * 1024 * 1024;
export const preferenceKeys = [
  "chesslens-analysis-v1",
  "chesslens-board",
  "chesslens-touch",
  "chesslens-engines",
  "chesslens-arrows-v1",
  "chesslens-critical-v1",
  "chesslens-settings-page-v1",
  "chesslens_cc_user",
  "chesslens-engine-name-draft",
  "chesslens-engine-path-draft",
  ...["player", "time", "phase", "colour", "since", "engine"].map(
    (k) => "chesslens-dashboard-" + k,
  ),
  ...["section", "username", "month"].map((k) => "chesslens-games-" + k),
  ...["query", "filter", "sort"].map((k) => "chesslens-library-" + k),
  ...["query", "speed", "outcome"].map((k) => "chesslens-online-" + k),
];
export interface Backup {
  format: "chesslens-backup";
  version: 1;
  createdAt: string;
  games: SavedGame[];
  current: ReviewSession | null;
  analyses: ReviewSession[];
  learning: LearningData;
  collections: Collection[];
  preferences: Record<string, string>;
}
function fail(message: string): never {
  throw new Error("Invalid backup: " + message);
}
function session(value: unknown): ReviewSession {
  const raw = value as ReviewSession;
  const clean = validateSession(raw);
  if (
    !clean ||
    !raw.options ||
    !sameOptions(raw.options, validOptions(raw.options))
  )
    return fail("unsupported or corrupt review.");
  engineUrl(clean.options.engine.url, "https://chesslens.invalid/");
  if (
    Object.keys(raw.evaluations || {}).length !==
    Object.keys(clean.evaluations).length
  )
    return fail("corrupt analysis.");
  return { ...clean, running: false };
}
function collection(value: unknown): Collection {
  const c = value as Collection;
  if (
    !c ||
    c.version !== 1 ||
    typeof c.username !== "string" ||
    !/^[a-z0-9_-]{1,100}$/i.test(c.username) ||
    c.id !== c.username.toLowerCase() ||
    !Array.isArray(c.archives) ||
    !Array.isArray(c.finished)
  )
    return fail("corrupt download collection.");
  const archives = [
    ...new Set(c.archives.map((url) => archiveUrl(url, c.username))),
  ];
  const finished = [
    ...new Set(c.finished.map((url) => archiveUrl(url, c.username))),
  ];
  if (finished.some((url) => !archives.includes(url)))
    return fail("unknown completed archive.");
  return {
    version: 1,
    id: c.id,
    username: c.username,
    archives,
    finished,
    state: "paused",
    analysis: "paused",
    updatedAt: Date.now(),
    error: "",
    skipped: Number.isInteger(c.skipped) && c.skipped >= 0 ? c.skipped : 0,
  };
}
function settings(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("corrupt preferences.");
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (
      !preferenceKeys.includes(key) ||
      typeof raw !== "string" ||
      raw.length > 100000
    )
      return fail("unsupported preference.");
    if (key === "chesslens_cc_user") {
      if (raw && !/^[a-z0-9_-]{1,100}$/i.test(raw))
        return fail("invalid username.");
    } else {
      const parsed = JSON.parse(raw);
      const objects = [
        "chesslens-analysis-v1",
        "chesslens-board",
        "chesslens-touch",
        "chesslens-settings-page-v1",
      ];
      if (
        objects.includes(key) &&
        (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      )
        return fail("invalid preference object.");
      if (
        ["chesslens-arrows-v1", "chesslens-critical-v1"].includes(key) &&
        typeof parsed !== "boolean"
      )
        return fail("invalid boolean preference.");
      if (
        !objects.includes(key) &&
        ![
          "chesslens-engines",
          "chesslens-arrows-v1",
          "chesslens-critical-v1",
        ].includes(key) &&
        (typeof parsed !== "string" || parsed.length > 2000)
      )
        return fail("invalid text preference.");
      if (
        key === "chesslens-board" &&
        (![
          "classic",
          "jade",
          "walnut",
          "blue",
          "midnight",
          "contrast",
        ].includes(parsed.theme) ||
          typeof parsed.badges !== "boolean" ||
          !["flat", "sculpted"].includes(parsed.pieceFinish))
      )
        return fail("invalid board preferences.");
      if (
        key === "chesslens-touch" &&
        !["haptics", "sounds", "reducedMotion"].every(
          (k) => typeof parsed[k] === "boolean",
        )
      )
        return fail("invalid touch preferences.");
      if (
        key === "chesslens-settings-page-v1" &&
        (!Number.isFinite(parsed.scroll) ||
          parsed.scroll < 0 ||
          !parsed.sections ||
          typeof parsed.sections !== "object" ||
          !Object.values(parsed.sections).every((v) => typeof v === "boolean"))
      )
        return fail("invalid page preferences.");
      if (key === "chesslens-analysis-v1") {
        if (!parsed || !sameOptions(parsed, validOptions(parsed)))
          return fail("invalid engine settings.");
        engineUrl(parsed.engine.url, "https://chesslens.invalid/");
      }
      if (key === "chesslens-engines") {
        if (!Array.isArray(parsed) || parsed.length > 100)
          return fail("invalid engines.");
        for (const engine of parsed) {
          if (
            typeof engine?.id !== "string" ||
            typeof engine?.name !== "string"
          )
            return fail("invalid engine.");
          engineUrl(engine.url, "https://chesslens.invalid/");
        }
      }
    }
    result[key] = raw;
  }
  return result;
}
export function parseBackup(text: string): Backup {
  if (text.length > BACKUP_LIMIT) return fail("file exceeds 50 MB.");
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    return fail("not valid JSON.");
  }
  // Accept the earlier Downloads > Export backup JSON format too.
  if (
    raw?.version === 1 &&
    !raw.format &&
    raw.collection &&
    Array.isArray(raw.games)
  )
    raw = {
      ...raw,
      format: "chesslens-backup",
      createdAt: new Date().toISOString(),
      collections: [raw.collection],
      current: null,
      analyses: [],
      learning: emptyLearning(),
      preferences: {},
    };
  if (raw?.format !== "chesslens-backup" || raw.version !== 1)
    return fail("unsupported format or version.");
  if (
    !Array.isArray(raw.games) ||
    raw.games.length > 20000 ||
    !Array.isArray(raw.analyses) ||
    raw.analyses.length > 20000 ||
    !Array.isArray(raw.collections) ||
    raw.collections.length > 1000
  )
    return fail("invalid record lists.");
  const groups = raw.collections.map(collection);
  const games = raw.games.map((g: any): SavedGame => {
    if (!g || typeof g.name !== "string" || g.name.length > 1000)
      return fail("invalid game name.");
    const review = session(g.session);
    const memberships = g.collections ?? [];
    if (
      !Array.isArray(memberships) ||
      memberships.some((id: unknown) => typeof id !== "string")
    )
      return fail("invalid game collections.");
    return {
      id: canonicalPgn(review.pgn),
      name: g.name,
      session: review,
      collections: memberships,
      downloadOnly: g.downloadOnly === true,
      sourceUrl: typeof g.sourceUrl === "string" ? g.sourceUrl : undefined,
      playedAt: Number.isFinite(g.playedAt) ? g.playedAt : undefined,
      timeClass: typeof g.timeClass === "string" ? g.timeClass : undefined,
    };
  });
  const learning = validateLearning(raw.learning);
  if (
    learning.puzzles.length !== raw.learning.puzzles.length ||
    learning.completed.length !== new Set(raw.learning.completed).size
  )
    return fail("unsupported or corrupt practice records.");
  return {
    format: "chesslens-backup",
    version: 1,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : "Unknown",
    games,
    current: raw.current ? session(raw.current) : null,
    analyses: raw.analyses.map(session),
    learning,
    collections: groups,
    preferences: settings(raw.preferences),
  };
}
export async function createBackup(current: ReviewSession): Promise<Backup> {
  return withBackgroundJob(new AbortController().signal, async () => {
    const [games, analyses, learning, groups] = await Promise.all([
      listSavedGames(),
      listAnalysisBackups(),
      loadLearning(),
      collections(),
    ]);
    const preferences: Record<string, string> = {};
    for (const key of preferenceKeys) {
      const value = localStorage.getItem(key);
      if (value !== null) preferences[key] = value;
    }
    return parseBackup(
      JSON.stringify({
        format: "chesslens-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        games,
        current,
        analyses,
        learning,
        collections: groups,
        preferences,
      }),
    );
  });
}
export async function restoreBackup(
  backup: Backup,
  restoreSettings: boolean,
  progress: (message: string) => void,
) {
  return withBackgroundJob(new AbortController().signal, async () => {
    // Revalidate immediately before writing. Existing records are merged, never cleared.
    const data = parseBackup(JSON.stringify(backup));
    const existingLearning = await loadLearning();
    const existingGames = new Map(
      (await listSavedGames()).map((g) => [g.id, g]),
    );
    const existingCollections = new Map(
      (await collections()).map((c) => [c.id, c]),
    );
    const puzzles = new Map(data.learning.puzzles.map((p) => [p.id, p]));
    existingLearning.puzzles.forEach((p) => puzzles.set(p.id, p));
    const games = [...data.games];
    if (data.current) {
      const id = canonicalPgn(data.current.pgn),
        index = games.findIndex((g) => g.id === id);
      if (index >= 0)
        games[index] = {
          ...games[index],
          session: mergeSavedAnalysis(games[index].session, data.current),
        };
      else
        games.push({
          id,
          name: "Recovered review",
          session: data.current,
          downloadOnly: false,
        });
    }
    for (let i = 0; i < games.length; i++) {
      const g = games[i],
        existing = existingGames.get(g.id);
      // Preserve the local engine configuration for duplicate games; cache the imported one separately.
      await cacheGameAnalysis(g.session);
      const review =
        existing && !sameOptions(existing.session.options, g.session.options)
          ? existing.session
          : g.session;
      await saveGame(review, existing?.name || g.name, {
        collections: g.collections,
        sourceUrl: existing?.sourceUrl || g.sourceUrl,
        playedAt: existing?.playedAt || g.playedAt,
        timeClass: existing?.timeClass || g.timeClass,
        downloadOnly: g.downloadOnly,
      });
      progress("Restoring games " + (i + 1) + "/" + games.length);
    }
    for (const review of data.analyses) await cacheGameAnalysis(review);
    for (const c of data.collections) {
      const old = existingCollections.get(c.id);
      await storeCollection(
        old
          ? {
              ...old,
              archives: [...new Set([...old.archives, ...c.archives])].sort(),
              finished: [...new Set([...old.finished, ...c.finished])],
            }
          : c,
      );
    }
    await saveLearning({
      version: 1,
      puzzles: [...puzzles.values()],
      completed: [
        ...new Set([...existingLearning.completed, ...data.learning.completed]),
      ],
    });
    if (restoreSettings)
      for (const [key, value] of Object.entries(data.preferences))
        localStorage.setItem(key, value);
    progress("Restore complete. Your current board is unchanged.");
  });
}
