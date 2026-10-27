import { useEffect, useState } from "react";
import {
  deleteSavedGame,
  exportPgn,
  listSavedGames,
  saveGame,
  type ReviewSession,
  type SavedGame,
} from "./reviewStorage";
import { parseGame } from "./game";
export function SavedGames({
  current,
  onOpen,
  onError,
}: {
  current: ReviewSession;
  onOpen: (s: ReviewSession) => void;
  onError: (message: string) => void;
}) {
  const [games, setGames] = useState<SavedGame[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = () => listSavedGames().then(setGames);
  useEffect(() => {
    void refresh().catch(() =>
      onError("Saved games are unavailable in this browser."),
    );
  }, []);
  const run = async (work: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await work();
      await refresh();
      setMessage(message);
    } catch {
      onError(
        "Could not save this change. Check browser storage space; existing saved games have not been cleared.",
      );
    } finally {
      setBusy(false);
    }
  };
  const game = parseGame(current.pgn);
  return (
    <section className="panel saved-games" aria-label="Saved games">
      <p className="eyebrow">YOUR LIBRARY</p>
      <h2>Saved games</h2>
      <p className="muted">
        Stored on this device. Export PGN files for a portable backup.
      </p>
      <div className="saved-game-current">
        <strong>
          {game.headers.White || "White"} vs {game.headers.Black || "Black"}
        </strong>
        <span>
          Move {Math.ceil(current.ply / 2)} ·{" "}
          {Object.keys(current.evaluations).length}/{game.fens.length} positions
          analysed
        </span>
        <div className="saved-game-actions">
          <button onClick={() => onOpen(current)}>Continue reviewing</button>
          <button
            disabled={busy}
            onClick={() =>
              void run(
                () => saveGame(current),
                "Game saved. Saving again updates this game.",
              )
            }
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>{" "}
            Save game
          </button>
          <button onClick={() => exportPgn(current)}>Export PGN</button>
        </div>
      </div>
      <p role="status">{message}</p>
      {!games.length && (
        <p className="muted">
          No saved games yet. Save your current review to keep it in this
          library.
        </p>
      )}
      {games.map((g) => (
        <article key={g.id} className="saved-game-card">
          <h3>{g.name}</h3>
          <p className="muted">
            {parseGame(g.session.pgn).headers.Result || "*"} · Last reviewed{" "}
            {new Date(g.session.updatedAt).toLocaleString()}
          </p>
          <p>
            {Object.keys(g.session.evaluations).length}/
            {parseGame(g.session.pgn).fens.length} positions analysed
          </p>
          <div className="saved-game-actions">
            <button disabled={busy} onClick={() => onOpen(g.session)}>
              Open review
            </button>
            <button onClick={() => exportPgn(g.session)}>Export PGN</button>
            <button
              disabled={busy}
              onClick={() => {
                const name = window.prompt("Game name", g.name);
                if (name?.trim())
                  void run(
                    () => saveGame(g.session, name.trim()),
                    "Game renamed.",
                  );
              }}
            >
              Rename
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove “${g.name}” from saved games? Your active review stays available.`,
                  )
                )
                  void run(() => deleteSavedGame(g.id), "Game removed.");
              }}
            >
              Delete
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
