import { describe, expect, it } from "vitest";
import { pickDailyItem, dailyWeight, neverRevisited } from "@/core/schedule/daily";
import { newProgress, review, reviewQueue } from "@/core/schedule/srs";
import { findDuplicates } from "@/core/dedupe/dedupe";
import { parseQuery, searchItems } from "@/core/search/search";
import { buildReminderCalendar, dueReminders, suggestedReminderTime } from "@/core/schedule/reminders";
import { makeItem, verse } from "./helpers";

describe("spaced repetition", () => {
  const now = new Date("2026-10-25T09:00:00Z");

  it("new cards are due immediately and start as learning", () => {
    const p = newProgress("a", now);
    expect(p.state).toBe("learning");
    expect(reviewQueue([p], now)).toHaveLength(1);
  });

  it("intervals grow with familiar/memorized ratings and reset on learning", () => {
    let p = newProgress("a", now);
    p = review(p, "familiar", now);
    expect(p.intervalDays).toBe(2);
    const second = review(p, "memorized", now);
    expect(second.state).toBe("memorized");
    expect(second.intervalDays).toBeGreaterThanOrEqual(7);
    const reset = review(second, "learning", now);
    expect(reset.intervalDays).toBe(1);
    expect(reset.repetitions).toBe(0);
    expect(reset.ease).toBeLessThan(second.ease);
  });

  it("review queue excludes cards that are not due", () => {
    const p = review(newProgress("a", now), "memorized", now);
    expect(reviewQueue([p], now)).toHaveLength(0);
  });
});

describe("daily pick", () => {
  const now = new Date("2026-10-25T13:00:00");
  const items = [
    makeItem({ id: "a", lastReviewedAt: "2026-10-24T10:00:00Z" }),
    makeItem({ id: "b", lastReviewedAt: null }),
    makeItem({ id: "c", lastReviewedAt: "2026-09-01T10:00:00Z" }),
    makeItem({ id: "k", contentType: "knowledge" }),
  ];

  it("is deterministic for the same day", () => {
    expect(pickDailyItem(items, now)?.id).toBe(pickDailyItem([...items].reverse(), now)?.id);
  });

  it("never picks knowledge items, and 'show another' gives a different item", () => {
    const first = pickDailyItem(items, now);
    const second = pickDailyItem(items, now, 1);
    expect(first?.contentType).not.toBe("knowledge");
    expect(second?.id).not.toBe(first?.id);
  });

  it("weights never-revisited and long-unseen items above recently seen ones", () => {
    expect(dailyWeight(items[1], now)).toBeGreaterThan(dailyWeight(items[0], now));
    expect(dailyWeight(items[2], now)).toBeGreaterThan(dailyWeight(items[0], now));
  });

  it("returns null with no items", () => {
    expect(pickDailyItem([], now)).toBeNull();
  });

  it("lists never-revisited items", () => {
    expect(neverRevisited(items).map((i) => i.id)).toEqual(["b", "k"]);
  });
});

describe("duplicate detection", () => {
  it("flags the same Arabic with a different translation", () => {
    const existing = [makeItem({ id: "x", title: "Existing", arabicText: verse(20, 25).text, englishText: "My Lord, expand my chest" })];
    const dupes = findDuplicates({ arabicText: verse(20, 25).text, englishText: "O my Lord! Open for me my chest" }, existing);
    expect(dupes[0]?.id).toBe("x");
    expect(dupes[0].similarity).toBeGreaterThan(0.7);
  });

  it("does not flag unrelated content", () => {
    const existing = [makeItem({ arabicText: verse(1, 2).text, englishText: "Praise be to Allah" })];
    expect(findDuplicates({ arabicText: verse(94, 5).text, englishText: "With hardship comes ease" }, existing)).toEqual([]);
  });
});

describe("Find What You Need", () => {
  const items = [
    makeItem({ id: "anx", title: "Dua for anxiety", contentType: "dua", subcategory: "hardship", tags: ["hardship"], englishText: "O Allah, I seek refuge in You from worry and grief" }),
    makeItem({ id: "study", title: "Dua for knowledge", contentType: "dua", subcategory: "knowledge", tags: ["knowledge"], englishText: "My Lord, increase me in knowledge" }),
    makeItem({ id: "trust", title: "Tawakkul reminder", contentType: "reminder", subcategory: "tawakkul", tags: ["tawakkul"], englishText: "Allah's plan is better than your plan" }),
  ];

  it("maps feelings to topics", () => {
    const q = parseQuery("I'm feeling overwhelmed");
    expect(q.topics.map((t) => t.slug)).toEqual(expect.arrayContaining(["hardship", "tawakkul"]));
    expect(searchItems(items, "I'm feeling overwhelmed")[0].item.id).toMatch(/anx|trust/);
  });

  it("finds study duas", () => {
    expect(searchItems(items, "Dua before studying")[0].item.id).toBe("study");
  });

  it("respects the requested content type", () => {
    const hits = searchItems(items, "Something about trusting Allah");
    expect(hits[0].item.id).toBe("trust");
    const q = parseQuery("reminders about patience");
    expect(q.contentType).toBe("reminder");
  });

  it("returns nothing for an empty query", () => {
    expect(searchItems(items, "   ")).toEqual([]);
  });
});

describe("time-of-day reminders", () => {
  it("suggests morning/evening/sleep times from the content", () => {
    expect(suggestedReminderTime(makeItem({ contentType: "adhkar", subcategory: "morning" }))).toBe("07:00");
    expect(suggestedReminderTime(makeItem({ contentType: "adhkar", subcategory: "evening" }))).toBe("17:30");
    expect(suggestedReminderTime(makeItem({ contentType: "dua", tags: ["sleep"] }))).toBe("22:00");
    expect(suggestedReminderTime(makeItem({ contentType: "dua", tags: ["forgiveness"] }))).toBeNull();
  });

  it("is due after the reminder time until practiced, within a window", () => {
    const item = makeItem({ id: "m", reminderTime: "07:00", lastReviewedAt: "2026-10-24T08:00:00" });
    expect(dueReminders([item], new Date("2026-10-25T06:30:00"))).toHaveLength(0);
    expect(dueReminders([item], new Date("2026-10-25T07:05:00"))).toHaveLength(1);
    expect(dueReminders([{ ...item, lastReviewedAt: "2026-10-25T07:10:00" }], new Date("2026-10-25T07:30:00"))).toHaveLength(0);
    expect(dueReminders([item], new Date("2026-10-25T13:00:00"))).toHaveLength(0);
  });

  it("handles reminder windows that cross midnight", () => {
    const item = makeItem({ id: "s", reminderTime: "22:00", lastReviewedAt: "2026-10-24T09:00:00" });
    expect(dueReminders([item], new Date("2026-10-25T00:30:00"))).toHaveLength(1);
  });

  it("builds a daily repeating calendar with an alert", () => {
    const ics = buildReminderCalendar(
      [makeItem({ id: "abc", title: "Morning adhkar, part 1", reminderTime: "07:00" }), makeItem({ id: "x" })],
      "https://duavault.example",
      new Date("2026-10-25T10:00:00"),
    );
    expect(ics).toContain("RRULE:FREQ=DAILY");
    expect(ics).toContain("DTSTART:20261025T070000");
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("Morning adhkar\\, part 1");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });
});
