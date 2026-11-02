export const PGN_DRAFT_KEY = "chesslens-pgn-draft-v1";
export const PGN_DRAFT_LIMIT = 100000;
export function readPgnDraft(): string {
  try {
    const value = localStorage.getItem(PGN_DRAFT_KEY) || "";
    return value.length <= PGN_DRAFT_LIMIT ? value : "";
  } catch {
    return "";
  }
}
export function storePgnDraft(value: string) {
  if (value.length > PGN_DRAFT_LIMIT)
    throw new Error(
      "Draft is too large to keep automatically. Use a PGN file for large games.",
    );
  if (value) localStorage.setItem(PGN_DRAFT_KEY, value);
  else localStorage.removeItem(PGN_DRAFT_KEY);
}
