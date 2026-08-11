import { test, expect } from "@playwright/test";

const appUrl = "/?transport=mock";

async function openApp(page) {
  await page.goto(appUrl);
  await expect(page.getByTestId("lobby-experience")).toBeVisible();
  await page.getByRole("button", { name: "Abrir o códice" }).click();
  await expect(page.getByTestId("lobby-codex")).toBeVisible();
  await expect(page.getByTestId("create-realm")).toBeVisible();
}

async function createRealm(page, mode = "classico") {
  await openApp(page);
  await page.getByTestId("create-realm").click();
  await page.getByTestId(`mode-${mode}`).click();
  await expect(page.getByTestId("lobby-root")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Galeria das casas" })).toBeVisible();
  await expect(page.locator(".rd-lobby-scene canvas")).toBeVisible();
  await expect(page.getByTestId("lobby-root")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.getByTestId("lobby-root")).toHaveCSS("pointer-events", "none");
}

async function joinRealm(page, code) {
  await openApp(page);
  await page.getByTestId("join-realm").click();
  await page.getByTestId("room-code-input").fill(code);
  await page.getByTestId("join-submit").click();
  await expect(page.getByTestId("lobby-root")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Galeria das casas" })).toBeVisible();
}

async function chooseFirstAvailableCharacter(page) {
  const choice = page.getByRole("button", { name: /^Ver / }).first();
  await expect(choice).toBeVisible();
  await choice.click();
  const seal = page.getByRole("button", { name: /^Selar o pacto com / });
  await expect(seal).toBeVisible();
  await seal.click();
  await expect(page.getByRole("heading", { name: "Galeria das casas" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Abrir o códice" })).toBeVisible();
}

async function openCodex(page) {
  const openButton = page.getByRole("button", { name: "Abrir o códice" });
  if (await openButton.isVisible().catch(() => false)) await openButton.click();
  await expect(page.getByTestId("lobby-codex")).toBeVisible();
}

async function roomCode(page) {
  await openCodex(page);
  return (await page.getByTestId("room-code").locator("strong").innerText()).trim();
}

test("o jogo abre diretamente no salão com o livro como entrada", async ({ page }) => {
  await openApp(page);
  await expect(page.getByTestId("lobby-experience")).toHaveAttribute("data-stage", "title");
  await page.getByTestId("create-realm").click();
  await expect(page.getByRole("heading", { name: "Escolhe o Modo de Jogo" })).toBeVisible();
});

test("quatro páginas reservam lugares e escolhem casas distintas", async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await createRealm(host, "dragao");
  await chooseFirstAvailableCharacter(host);
  const code = await roomCode(host);
  expect(code).toMatch(/^[A-Z]{6}$/);

  const guests = [];
  for (let index = 0; index < 3; index += 1) {
    const guest = await context.newPage();
    await joinRealm(guest, code);
    await chooseFirstAvailableCharacter(guest);
    guests.push(guest);
  }

  await expect(host.getByTestId("lobby-player-row")).toHaveCount(4);
  const sessions = await Promise.all(
    [host, ...guests].map((page) => page.evaluate(() => sessionStorage.getItem("reinos_dragao_player_sessions_v1"))),
  );
  expect(sessions.every(Boolean)).toBe(true);
  expect(new Set(sessions).size).toBe(4);
  await context.close();
});

test("refresh recupera lugar, casa e etapa correta", async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await createRealm(host);
  await chooseFirstAvailableCharacter(host);
  const code = await roomCode(host);

  const guest = await context.newPage();
  await joinRealm(guest, code);
  await chooseFirstAvailableCharacter(guest);
  const before = await guest.evaluate(() => sessionStorage.getItem("reinos_dragao_player_sessions_v1"));

  await guest.reload();
  await expect(guest.getByTestId("lobby-root")).toBeVisible();
  await expect(guest.getByRole("heading", { name: "Galeria das casas" })).toBeHidden();
  await expect(guest.getByRole("button", { name: "Abrir o códice" })).toBeVisible();
  const after = await guest.evaluate(() => sessionStorage.getItem("reinos_dragao_player_sessions_v1"));
  expect(after).toBe(before);
  await context.close();
});

test("jogadores confirmados ficam prontos e o anfitrião inicia", async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await createRealm(host, "rapido");
  await chooseFirstAvailableCharacter(host);
  const code = await roomCode(host);

  const guest = await context.newPage();
  await joinRealm(guest, code);
  await chooseFirstAvailableCharacter(guest);

  await openCodex(host);
  await host.getByTestId("ready-toggle").click();
  await openCodex(guest);
  await guest.getByTestId("ready-toggle").click();

  await expect(host.getByTestId("start-game")).toBeEnabled();
  await host.getByTestId("start-game").click();
  await expect(host.getByText("OS REINOS ESTÃO REUNIDOS")).toBeVisible();
  await context.close();
});

test("expulsão confirmada liberta o lugar e permite reentrada", async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  await createRealm(host);
  await chooseFirstAvailableCharacter(host);
  const code = await roomCode(host);

  const guest = await context.newPage();
  await joinRealm(guest, code);
  await chooseFirstAvailableCharacter(guest);
  await openCodex(host);

  await host.getByRole("button", { name: "Expulsar" }).click();
  await host.getByRole("button", { name: "Confirmar expulsão" }).click();
  await expect(host.getByTestId("lobby-player-row")).toHaveCount(1);
  await expect(guest.getByTestId("join-realm")).toBeVisible();

  await guest.getByTestId("join-realm").click();
  await guest.getByTestId("room-code-input").fill(code);
  await guest.getByTestId("join-submit").click();
  await expect(guest.getByRole("heading", { name: "Galeria das casas" })).toBeVisible();
  await context.close();
});
