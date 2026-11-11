import { test, expect } from "@playwright/test";
import { seedRandom, startMode } from "./helpers.js";
import { addFromTray, parsePounds } from "./tray.js";

test("End and Back in a scored round ask before leaving", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seedRandom(page);
  await startMode(page, "Endless");

  // End asks first; keeping on playing closes the dialog and stays in the round
  await page.locator("#btn-end").click();
  await expect(page.locator("#confirm-title")).toHaveText("End the session and save your score?");
  await page.getByRole("button", { name: "Keep playing" }).click();
  await expect(page.locator("#confirm-dialog")).not.toHaveAttribute("open", "");
  await expect(page.locator("#screen-play")).toBeVisible();

  // once a round is scored, Back asks too, and leaving without saving goes Home
  const target = (await page.locator("#play-target").textContent()).trim();
  await addFromTray(page, parsePounds(target));
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-rounds")).toHaveText("Rounds completed: 1");
  await page.locator("#btn-back").click();
  await expect(page.locator("#confirm-title")).toHaveText("Leave without saving your score?");
  await page.getByRole("button", { name: "Leave without saving" }).click();
  await expect(page.locator("#screen-home")).toBeVisible();

  expect(errors).toEqual([]);
});
