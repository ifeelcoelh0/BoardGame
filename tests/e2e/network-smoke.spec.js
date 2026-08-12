import { test, expect } from "@playwright/test";

test.describe("PeerJS real", () => {
  test.skip(!process.env.RUN_REAL_PEERJS, "Executar apenas manualmente com RUN_REAL_PEERJS=1.");

  test("o host consegue abrir um reino usando o transporte real", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("create-realm").click();
    await page.getByTestId("mode-classico").click();
    await page.getByTestId("create-realm-submit").click();
    await expect(page.getByTestId("lobby-root")).toBeVisible({ timeout: 20_000 });
  });
});
