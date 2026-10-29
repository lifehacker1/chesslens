import { useEffect, useState } from "react";
import { listSavedGames, type SavedGame } from "./reviewStorage";
export function useLibrary() {
  const [games, setGames] = useState<SavedGame[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true,
      timer: ReturnType<typeof setTimeout>,
      generation = 0;
    const refresh = () => {
      const id = ++generation;
      void listSavedGames()
        .then((g) => {
          if (alive && id === generation) {
            setGames(g);
            setError("");
            setLoading(false);
          }
        })
        .catch(() => {
          if (alive) {
            setError(
              "Could not load saved games. Retry when browser storage is available.",
            );
            setLoading(false);
          }
        });
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 300);
    };
    refresh();
    window.addEventListener("chesslens-library-changed", schedule);
    return () => {
      alive = false;
      clearTimeout(timer);
      window.removeEventListener("chesslens-library-changed", schedule);
    };
  }, []);
  return { games, loading, error };
}
export function headers(pgn: string): Record<string, string> {
  return Object.fromEntries(
    [...pgn.matchAll(/^\[(\w+)\s+"((?:\\.|[^"\\])*)"\]\s*$/gm)].map((m) => [
      m[1],
      m[2].replace(/\\"/g, '"'),
    ]),
  );
}
