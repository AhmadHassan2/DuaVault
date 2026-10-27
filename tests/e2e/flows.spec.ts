import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Verbatim Tanzil subset (see `pnpm fetch:quran --fixture`). Verification needs public/data/quran/quran.json.
const fixture = JSON.parse(readFileSync(join(process.cwd(), "tests/fixtures/quran-subset.json"), "utf8")) as {
  verses: Array<{ surah: number; ayah: number; text: string; translation?: string }>;
};
const verse = (s: number, a: number) => fixture.verses.find((v) => v.surah === s && v.ayah === a)!;

async function freshVault(page: Page) {
  await page.goto("/home");
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase("duavault");
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
  );
  await page.reload();
}

async function saveTypedText(page: Page, text: string) {
  await page.goto("/add");
  await page.getByRole("tab", { name: /Type or paste text/ }).click();
  await page.getByTestId("manual-text").fill(text);
  await page.getByRole("button", { name: /Organize this text/ }).click();
  await expect(page.getByTestId("draft-editor")).toBeVisible();
}

test.describe("core flows (on-device mode)", () => {
  test.beforeEach(async ({ page }) => freshVault(page));

  test("typed text → verified → saved → library → detail → practice → memorize → collection", async ({ page }) => {
    const v = verse(20, 25);
    await saveTypedText(page, `${v.text}\n\nMy Lord, expand for me my breast\nSurah Taha 20:25`);

    const panel = page.getByTestId("verification-panel");
    await expect(panel).toContainText("Verified reference match");
    await expect(panel).toContainText("20:25");
    await page.getByRole("button", { name: /Save to library/ }).click();
    await expect(page.getByText("Saved to your library")).toBeVisible();

    await page.goto("/library");
    const card = page.getByTestId("library-grid").getByRole("link").first();
    await expect(card).toContainText("Verified match");
    await card.click();

    await expect(page.getByTestId("reading-card")).toContainText("My Lord, expand for me my breast");
    await page.getByRole("button", { name: /^Favorite$/ }).click();
    await expect(page.getByRole("button", { name: /Favorited/ })).toBeVisible();
    await page.getByRole("button", { name: /Mark as practiced/ }).click();
    await expect(page.getByRole("button", { name: /Practiced today/ })).toBeVisible();

    await page.getByRole("combobox", { name: "Memorization status" }).click();
    await page.getByRole("option", { name: "Learning" }).click();

    await page.getByRole("button", { name: /Add to collection/ }).click();
    await page.getByPlaceholder("New collection").fill("Duas before exams");
    await page.getByRole("button", { name: "Create collection" }).click();
    await expect(page.getByRole("button", { name: /In 1 collection/ })).toBeVisible();

    await page.goto("/practice/memorize");
    await expect(page.getByTestId("flashcard")).toBeVisible();
    await page.getByRole("button", { name: /Reveal answer/ }).click();
    await page.getByRole("button", { name: /Familiar/ }).click();
    await expect(page.getByText(/Session complete/)).toBeVisible();

    await page.goto("/home");
    await expect(page.getByTestId("daily-card")).toContainText("Dua for");
  });

  test("flags a claimed reference that does not match, and finds items by situation", async ({ page }) => {
    await saveTypedText(page, `${verse(94, 5).text}\nFor indeed, with hardship will be ease.\n(Quran 2:255)`);
    await expect(page.getByTestId("verification-panel")).toContainText("Review required");
    await page.getByRole("button", { name: /Save to library/ }).click();
    await expect(page.getByText("Saved to your library")).toBeVisible();

    await saveTypedText(page, "Reminder: when you feel overwhelmed, trust Allah's plan and be patient. Allah is with the patient.");
    await expect(page.getByTestId("verification-panel")).toContainText("Unverified");
    await page.getByRole("button", { name: /Save to library/ }).click();
    await expect(page.getByText("Saved to your library").first()).toBeVisible();

    await page.goto("/find");
    await page.getByRole("textbox", { name: "Describe what you need" }).fill("I'm feeling overwhelmed");
    await expect(page.getByTestId("find-results")).toContainText("Reminder: when you feel overwhelmed");
  });

  test("morning adhkar get a morning reminder and show up on Home in the morning", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-10-26T07:30:00"));
    await freshVault(page);
    await saveTypedText(page, "Morning adhkar — recite once in the morning after Fajr.\nأصبحنا وأصبح الملك لله");
    await expect(page.getByTestId("reminder-control")).toContainText("Remind me every morning");
    await expect(page.getByLabel("Reminder time")).toHaveValue("07:00");
    await page.getByRole("button", { name: /Save to library/ }).click();
    await expect(page.getByText("Saved to your library")).toBeVisible();

    await page.goto("/home");
    const due = page.getByTestId("due-reminders");
    await expect(due).toContainText("Morning adhkar time");
    await due.getByRole("button", { name: /Done/ }).click();
    await expect(due).toHaveCount(0);
  });

  test("journal entries are private and separate", async ({ page }) => {
    await page.goto("/journal/new");
    await page.getByRole("textbox", { name: "Title" }).fill("For my mother");
    await page.getByRole("textbox", { name: "Entry" }).fill("O Allah, grant her health and ease.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Saved privately")).toBeVisible();
    await page.goto("/journal");
    await expect(page.getByText("For my mother")).toBeVisible();
    await page.goto("/library");
    await expect(page.getByText("For my mother")).toHaveCount(0);
  });

  test("navigation works", async ({ page }) => {
    await page.goto("/home");
    const nav = page.getByRole("navigation", { name: "Main" }).filter({ visible: true });
    await nav.getByRole("link", { name: "Library" }).click();
    await expect(page).toHaveURL(/\/library/);
    await nav.getByRole("link", { name: "Add new" }).click();
    await expect(page.getByRole("heading", { name: "Add to your vault" })).toBeVisible();
    await nav.getByRole("link", { name: "Practice" }).click();
    await expect(page.getByRole("heading", { name: "Practice", exact: true })).toBeVisible();
    await nav.getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("heading", { name: /Profile/ })).toBeVisible();
  });
});

test.describe("real OCR", () => {
  // Downloads Tesseract + language data from the CDN on first run.
  test.setTimeout(240_000);

  test("reads a rendered screenshot with Tesseract and lets the user review it", async ({ page, browser, isMobile }) => {
    test.skip(isMobile, "OCR is covered once on desktop to keep the suite fast");
    const v = verse(1, 2);
    const shotPage = await browser.newPage({ viewport: { width: 900, height: 600 } });
    await shotPage.setContent(`
      <html><body style="margin:0;background:#fff;font-family:Arial,sans-serif;padding:48px">
        <p dir="rtl" style="font-size:44px;font-family:'Geeza Pro','Noto Naskh Arabic','Arial',serif;margin:0 0 32px">${v.text}</p>
        <p style="font-size:30px;margin:0 0 16px">All praise is due to Allah, Lord of the worlds.</p>
        <p style="font-size:24px;color:#444">Quran 1:2</p>
      </body></html>`);
    const png = await shotPage.screenshot();
    await shotPage.close();

    await freshVault(page);
    await page.goto("/add");
    await page.getByTestId("file-input").setInputFiles({ name: "screenshot.png", mimeType: "image/png", buffer: png });
    await expect(page.getByTestId("draft-editor")).toBeVisible({ timeout: 200_000 });
    await expect(page.getByLabel("Translation / text")).toHaveValue(/praise is due to Allah/i);
    await expect(page.getByLabel("Source as written on the post")).toHaveValue(/1:2/);
    await page.getByRole("button", { name: /Save to library/ }).click();
    await expect(page.getByText("Saved to your library")).toBeVisible();
    await page.goto("/library");
    await page.getByTestId("library-grid").getByRole("link").first().click();
    await page.getByRole("tab", { name: /Original/ }).click();
    await expect(page.getByRole("img", { name: /Original screenshot/ })).toBeVisible();
  });
});
