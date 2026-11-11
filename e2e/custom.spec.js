import { test, expect } from "@playwright/test";
import { startMode } from "./helpers.js";

test("custom: build £0.30 from 20p and 10p, Check shows success", async ({ page }) => {
  await startMode(page, "Custom", { difficulty: "easy" });
  await page.locator("#custom-input").fill("0.30");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.locator("#play-target")).toHaveText("£0.30");

  await page.getByRole("button", { name: "Add 20p", exact: true }).click();
  await page.getByRole("button", { name: "Add 10p", exact: true }).click();
  await expect(page.locator("#play-total")).toHaveText("Your total: £0.30");
  await page.locator("#btn-check").click();
  await expect(page.locator("#play-message")).toHaveText("Correct! You made exactly £0.30.");
  await expect(page.locator("#play-message")).toHaveClass(/success/);
});
