import { describe, it, expect } from "vitest";
import { ALL_VOCAB, LEVEL_NAMES, THEME_SESSIONS } from "../js/data.js";

describe("ALL_VOCAB", () => {
  it("every entry has a non-empty fr, ko, and a numeric lvl", () => {
    ALL_VOCAB.forEach(v => {
      expect(typeof v.fr).toBe("string");
      expect(v.fr.length).toBeGreaterThan(0);
      expect(typeof v.ko).toBe("string");
      expect(v.ko.length).toBeGreaterThan(0);
      expect(typeof v.lvl).toBe("number");
    });
  });

  it("has enough words per level for 4-way multiple choice (>= 4 each)", () => {
    const levels = [...new Set(ALL_VOCAB.map(v => v.lvl))];
    levels.forEach(lvl => {
      const count = ALL_VOCAB.filter(v => v.lvl === lvl).length;
      expect(count).toBeGreaterThanOrEqual(4);
    });
  });

  it("covers every level referenced by LEVEL_NAMES (0..4)", () => {
    const levels = new Set(ALL_VOCAB.map(v => v.lvl));
    for (let lvl = 0; lvl <= 4; lvl++) {
      expect(levels.has(lvl)).toBe(true);
    }
    expect(LEVEL_NAMES.length).toBeGreaterThanOrEqual(5);
  });

  it("has no duplicate French entries", () => {
    const seen = new Set();
    const dupes = ALL_VOCAB.filter(v => {
      if (seen.has(v.fr)) return true;
      seen.add(v.fr);
      return false;
    });
    expect(dupes).toEqual([]);
  });
});

describe("THEME_SESSIONS", () => {
  it("has unique ids", () => {
    const ids = THEME_SESSIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every session has a title, emoji, and at least 4 words", () => {
    THEME_SESSIONS.forEach(s => {
      expect(typeof s.title).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.emoji).toBe("string");
      expect(s.words.length).toBeGreaterThanOrEqual(4);
    });
  });

  it("every word in a session has non-empty fr and ko", () => {
    THEME_SESSIONS.forEach(s => {
      s.words.forEach(w => {
        expect(typeof w.fr).toBe("string");
        expect(w.fr.length).toBeGreaterThan(0);
        expect(typeof w.ko).toBe("string");
        expect(w.ko.length).toBeGreaterThan(0);
      });
    });
  });

  it("has no duplicate French entries within a single session", () => {
    THEME_SESSIONS.forEach(s => {
      const seen = new Set();
      const dupes = s.words.filter(w => {
        if (seen.has(w.fr)) return true;
        seen.add(w.fr);
        return false;
      });
      expect(dupes, `duplicate words in theme "${s.id}"`).toEqual([]);
    });
  });
});
