import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  shuffle, sample, buildPool, createDirectionPicker, pickDistractorPool,
  genTranslationQuestion, buildSessionPool,
  loadBest, saveBest, loadStreak, loadDone, markDone,
  STORE_BEST, STORE_STREAK, STORE_DONE,
} from "../js/game.js";

function multiset(arr){ return [...arr].sort(); }

describe("shuffle", () => {
  it("returns a permutation of the input (same multiset)", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input);
    expect(multiset(result)).toEqual(multiset(input));
  });

  it("does not mutate the original array", () => {
    const input = [1, 2, 3];
    const copy = [...input];
    shuffle(input);
    expect(input).toEqual(copy);
  });

  it("returns a new array reference", () => {
    const input = [1, 2, 3];
    expect(shuffle(input)).not.toBe(input);
  });
});

describe("sample", () => {
  it("returns exactly n elements", () => {
    const input = [1, 2, 3, 4, 5, 6];
    expect(sample(input, 3)).toHaveLength(3);
  });

  it("only returns elements present in the source array", () => {
    const input = ["a", "b", "c", "d"];
    const result = sample(input, 2);
    result.forEach(v => expect(input).toContain(v));
  });
});

describe("buildPool", () => {
  const vocab = [
    { fr: "a", ko: "가", lvl: 0 },
    { fr: "b", ko: "나", lvl: 0 },
    { fr: "c", ko: "다", lvl: 1 },
    { fr: "d", ko: "라", lvl: 2 },
    { fr: "e", ko: "마", lvl: 3 },
  ];

  it("includes only words at or above startLevel, up to maxLevel", () => {
    const pool = buildPool(1, vocab, 2);
    expect(pool.map(v => v.fr).sort()).toEqual(["c", "d"]);
  });

  it("includes every word in range exactly once", () => {
    const pool = buildPool(0, vocab, 3);
    expect(pool).toHaveLength(vocab.length);
  });

  it("returns an empty pool when startLevel exceeds maxLevel", () => {
    expect(buildPool(4, vocab, 3)).toEqual([]);
  });

  it("caps words per level when perLevel is given, instead of including every word", () => {
    const bigVocab = [
      ...Array.from({ length: 50 }, (_, i) => ({ fr: `a${i}`, ko: `${i}`, lvl: 0 })),
      ...Array.from({ length: 50 }, (_, i) => ({ fr: `b${i}`, ko: `${i}`, lvl: 1 })),
    ];
    const pool = buildPool(0, bigVocab, 1, 10);
    expect(pool).toHaveLength(20);
    expect(pool.filter(v => v.lvl === 0)).toHaveLength(10);
    expect(pool.filter(v => v.lvl === 1)).toHaveLength(10);
  });

  it("with perLevel, still returns every word when a level has fewer than the cap", () => {
    const pool = buildPool(0, vocab, 0, 10);
    expect(pool).toHaveLength(2); // only 2 words at lvl 0 in the fixture
  });
});

describe("createDirectionPicker", () => {
  it("flips direction after two consecutive picks of the same direction", () => {
    const picker = createDirectionPicker();
    // Force Math.random to always yield the "toKorean = true" branch (< 0.5).
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);

    const first = picker.pick();   // random -> true, streak=1
    const second = picker.pick();  // random -> true, streak=2
    const third = picker.pick();   // streak>=2 -> forced flip

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(false);

    randomSpy.mockRestore();
  });

  it("reset() clears streak state so the next pick can repeat", () => {
    const picker = createDirectionPicker();
    vi.spyOn(Math, "random").mockReturnValue(0.1);
    picker.pick();
    picker.pick();
    picker.reset();
    // Right after reset, streak is back to 0 so a forced flip should not happen.
    const afterReset = picker.pick();
    expect(afterReset).toBe(true);
    vi.restoreAllMocks();
  });
});

describe("pickDistractorPool", () => {
  const pool = [
    { fr: "a", ko: "가", lvl: 2 },
    { fr: "b", ko: "나", lvl: 2 },
    { fr: "c", ko: "다", lvl: 3 },
    { fr: "d", ko: "라", lvl: 1 },
  ];

  it("prefers same-level candidates when there are enough", () => {
    const wideningPool = [
      ...pool,
      { fr: "e", ko: "바", lvl: 2 },
      { fr: "f", ko: "사", lvl: 2 },
    ];
    const item = { fr: "a", ko: "가", lvl: 2 };
    const candidates = pickDistractorPool(item, wideningPool);
    expect(candidates.every(v => v.lvl === 2)).toBe(true);
    expect(candidates.find(v => v.fr === "a")).toBeUndefined();
  });

  it("widens to adjacent levels when same-level pool is too small", () => {
    const item = { fr: "a", ko: "가", lvl: 2 };
    const candidates = pickDistractorPool(item, pool);
    expect(candidates.every(v => Math.abs(v.lvl - 2) <= 1)).toBe(true);
  });

  it("falls back to the entire pool (minus the item) as a last resort", () => {
    const tinyPool = [
      { fr: "a", ko: "가", lvl: 2 },
      { fr: "z", ko: "힣", lvl: 9 },
    ];
    const item = { fr: "a", ko: "가", lvl: 2 };
    const candidates = pickDistractorPool(item, tinyPool);
    expect(candidates.map(v => v.fr)).toEqual(["z"]);
  });
});

describe("genTranslationQuestion", () => {
  const sourcePool = [
    { fr: "chat", ko: "고양이", lvl: 0 },
    { fr: "chien", ko: "개", lvl: 0 },
    { fr: "oiseau", ko: "새", lvl: 0 },
    { fr: "poisson", ko: "물고기", lvl: 0 },
  ];
  const item = sourcePool[0];

  it("produces 4 unique options including the correct answer", () => {
    const picker = createDirectionPicker();
    const q = genTranslationQuestion(item, sourcePool, picker);
    expect(q.options).toHaveLength(4);
    expect(new Set(q.options).size).toBe(4);
    expect(q.options).toContain(q.correct);
  });

  it("asks FR → KO with the French word as prompt when direction is toKorean", () => {
    const picker = { pick: () => true };
    const q = genTranslationQuestion(item, sourcePool, picker);
    expect(q.dir).toBe("FR → KO");
    expect(q.word).toBe(item.fr);
    expect(q.correct).toBe(item.ko);
  });

  it("asks KO → FR with the Korean word as prompt when direction is not toKorean", () => {
    const picker = { pick: () => false };
    const q = genTranslationQuestion(item, sourcePool, picker);
    expect(q.dir).toBe("KO → FR");
    expect(q.word).toBe(item.ko);
    expect(q.correct).toBe(item.fr);
  });
});

describe("buildSessionPool", () => {
  it("defaults missing lvl to 2", () => {
    const words = [{ fr: "a", ko: "가" }];
    const pool = buildSessionPool(words);
    expect(pool[0].lvl).toBe(2);
  });

  it("preserves an explicit lvl", () => {
    const words = [{ fr: "a", ko: "가", lvl: 5 }];
    const pool = buildSessionPool(words);
    expect(pool[0].lvl).toBe(5);
  });

  it("keeps every word (shuffled, not filtered)", () => {
    const words = [{ fr: "a", ko: "가" }, { fr: "b", ko: "나" }, { fr: "c", ko: "다" }];
    const pool = buildSessionPool(words);
    expect(pool.map(w => w.fr).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("storage helpers", () => {
  beforeEach(() => { localStorage.clear(); });
  afterEach(() => { vi.useRealTimers(); });

  it("loadBest defaults to 0 when nothing is stored", () => {
    expect(loadBest()).toBe(0);
  });

  it("saveBest/loadBest round-trip", () => {
    saveBest(1234);
    expect(loadBest()).toBe(1234);
    expect(localStorage.getItem(STORE_BEST)).toBe("1234");
  });

  it("loadDone defaults to an empty array", () => {
    expect(loadDone()).toEqual([]);
  });

  it("markDone adds an id once and loadDone reflects it", () => {
    markDone("theme-a");
    markDone("theme-a");
    markDone("theme-b");
    expect(loadDone().sort()).toEqual(["theme-a", "theme-b"]);
    expect(JSON.parse(localStorage.getItem(STORE_DONE)).sort()).toEqual(["theme-a", "theme-b"]);
  });

  it("loadStreak starts at 1 on first ever call", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    expect(loadStreak()).toBe(1);
  });

  it("loadStreak stays the same when called again the same day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T09:00:00Z"));
    expect(loadStreak()).toBe(1);
    vi.setSystemTime(new Date("2026-01-10T20:00:00Z"));
    expect(loadStreak()).toBe(1);
  });

  it("loadStreak increments on a consecutive day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    expect(loadStreak()).toBe(1);
    vi.setSystemTime(new Date("2026-01-11T12:00:00Z"));
    expect(loadStreak()).toBe(2);
  });

  it("loadStreak resets to 1 when a day is skipped", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-10T12:00:00Z"));
    expect(loadStreak()).toBe(1);
    vi.setSystemTime(new Date("2026-01-13T12:00:00Z"));
    expect(loadStreak()).toBe(1);
  });
});
