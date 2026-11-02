import { it, expect, vi, afterEach } from "vitest";
import { readPgnDraft, storePgnDraft, PGN_DRAFT_LIMIT } from "./pgnDraft";
afterEach(() => vi.unstubAllGlobals());
it("persists a draft and removes it explicitly", () => {
  let value: string | null = null;
  vi.stubGlobal("localStorage", {
    getItem: () => value,
    setItem: (_: string, v: string) => (value = v),
    removeItem: () => (value = null),
  });
  storePgnDraft("1. e4");
  expect(readPgnDraft()).toBe("1. e4");
  storePgnDraft("");
  expect(readPgnDraft()).toBe("");
});
it("bounds drafts and handles unreadable storage", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => {
      throw Error("denied");
    },
  });
  expect(readPgnDraft()).toBe("");
  expect(() => storePgnDraft("x".repeat(PGN_DRAFT_LIMIT + 1))).toThrow(
    "too large",
  );
});
