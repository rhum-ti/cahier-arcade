import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOCAB_JSON_PATH = path.join(__dirname, "..", "data", "vocab.json");
const ALL_VOCAB = JSON.parse(readFileSync(VOCAB_JSON_PATH, "utf-8"));

import { LEVELS, levelName, STARTER_VOCAB, THEME_SESSIONS, loadAllVocab } from "../js/data.js";

describe("data/vocab.json (endless-mode vocabulary)", () => {
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

  it("covers every level from A1 to C1 (0..4)", () => {
    const levels = new Set(ALL_VOCAB.map(v => v.lvl));
    for (let lvl = 0; lvl <= 4; lvl++) {
      expect(levels.has(lvl)).toBe(true);
    }
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

  it("has no HTML-unsafe characters (data is injected via innerHTML, unescaped)", () => {
    const unsafe = ALL_VOCAB.filter(v => /[<>&]/.test(v.fr) || /[<>&]/.test(v.ko));
    expect(unsafe).toEqual([]);
  });

  it("has no leftover placeholder values from the generation pipeline", () => {
    const placeholders = ALL_VOCAB.filter(v => v.fr === "SKIP" || v.ko === "SKIP");
    expect(placeholders).toEqual([]);
  });

  it("has exactly 8000 words split 1000/1000/1500/1500/3000 across A1-C1", () => {
    expect(ALL_VOCAB).toHaveLength(8000);
    const counts = [0, 1, 2, 3, 4].map(lvl => ALL_VOCAB.filter(v => v.lvl === lvl).length);
    expect(counts).toEqual([1000, 1000, 1500, 1500, 3000]);
  });

  it("cardinal numbers don't leak the Arabic digit in their own translation", () => {
    // Month names, fractions ("4분의 1") and approximations ("40세가량") legitimately use
    // digits in Korean — but a number word like "onze" spelling out "11" next to "열하나"
    // just hands the answer to anyone who can read Arabic numerals.
    const CARDINALS = [
      "zéro","un","une","deux","trois","quatre","cinq","six","sept","huit","neuf","dix",
      "onze","douze","treize","quatorze","quinze","seize","dix-sept","dix-huit","dix-neuf",
      "vingt","trente","quarante","cinquante","soixante","cent","mille",
    ];
    const byFr = new Map(ALL_VOCAB.map(v => [v.fr, v.ko]));
    const leaky = CARDINALS
      .filter(fr => byFr.has(fr))
      .map(fr => ({ fr, ko: byFr.get(fr) }))
      .filter(({ ko }) => /[0-9]/.test(ko));
    expect(leaky).toEqual([]);
  });
});

describe("STARTER_VOCAB (Débutant level, below A1)", () => {
  it("every entry has a non-empty fr, ko, and lvl:-1", () => {
    STARTER_VOCAB.forEach(v => {
      expect(typeof v.fr).toBe("string");
      expect(v.fr.length).toBeGreaterThan(0);
      expect(typeof v.ko).toBe("string");
      expect(v.ko.length).toBeGreaterThan(0);
      expect(v.lvl).toBe(-1);
    });
  });

  it("has enough words for 4-way multiple choice", () => {
    expect(STARTER_VOCAB.length).toBeGreaterThanOrEqual(4);
  });

  it("has no duplicate French entries", () => {
    const seen = new Set();
    const dupes = STARTER_VOCAB.filter(v => {
      if (seen.has(v.fr)) return true;
      seen.add(v.fr);
      return false;
    });
    expect(dupes).toEqual([]);
  });

  it("has no HTML-unsafe characters", () => {
    const unsafe = STARTER_VOCAB.filter(v => /[<>&]/.test(v.fr) || /[<>&]/.test(v.ko));
    expect(unsafe).toEqual([]);
  });

  it("number words don't leak the Arabic digit (e.g. 'deux' -> '둘', not '둘, 2')", () => {
    const leaky = STARTER_VOCAB.filter(v => /[0-9]/.test(v.ko));
    expect(leaky).toEqual([]);
  });
});

describe("LEVELS / levelName", () => {
  it("starts one level below A1 (lvl:-1) and ends at C1 (lvl:4)", () => {
    expect(LEVELS[0]).toEqual({ lvl: -1, name: "Débutant" });
    expect(LEVELS[LEVELS.length - 1]).toEqual({ lvl: 4, name: "C1" });
  });

  it("has a unique, contiguous lvl for every entry", () => {
    const lvls = LEVELS.map(l => l.lvl);
    expect(new Set(lvls).size).toBe(lvls.length);
    for (let i = 1; i < lvls.length; i++) {
      expect(lvls[i]).toBe(lvls[i - 1] + 1);
    }
  });

  it("levelName resolves every level in LEVELS, including negative ones", () => {
    LEVELS.forEach(l => expect(levelName(l.lvl)).toBe(l.name));
  });

  it("levelName falls back gracefully for an unknown level", () => {
    expect(levelName(99)).toBe("?");
  });
});

describe("loadAllVocab", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("fetches data/vocab.json and returns the parsed array", async () => {
    const fakeData = [{ fr: "a", ko: "가", lvl: 0 }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeData),
    });
    const { loadAllVocab: freshLoad } = await import("../js/data.js?fresh1");
    const result = await freshLoad();
    expect(result).toEqual(fakeData);
    expect(global.fetch).toHaveBeenCalledWith("data/vocab.json");
  });

  it("caches the result: a second call does not fetch again", async () => {
    const fakeData = [{ fr: "a", ko: "가", lvl: 0 }];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeData),
    });
    const { loadAllVocab: freshLoad } = await import("../js/data.js?fresh2");
    await freshLoad();
    await freshLoad();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects and allows a retry (does not cache failures) on a non-OK response", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    const { loadAllVocab: freshLoad } = await import("../js/data.js?fresh3");
    await expect(freshLoad()).rejects.toThrow();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ fr: "a", ko: "가", lvl: 0 }]),
    });
    await expect(freshLoad()).resolves.toEqual([{ fr: "a", ko: "가", lvl: 0 }]);
  });

  it("rejects and allows a retry on a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("network error"));
    const { loadAllVocab: freshLoad } = await import("../js/data.js?fresh4");
    await expect(freshLoad()).rejects.toThrow();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ fr: "a", ko: "가", lvl: 0 }]),
    });
    await expect(freshLoad()).resolves.toEqual([{ fr: "a", ko: "가", lvl: 0 }]);
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
