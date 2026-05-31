import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("current toaster's toast syncs + audience react syncs back", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(800);

    await a.getByRole("button", { name: "start", exact: true }).click();
    await a.waitForTimeout(400);

    const current = (await a.locator(".ts-current").innerText()).toLowerCase();
    const toaster = current.includes("alice") ? a : b;
    const audience = current.includes("alice") ? b : a;

    await toaster.getByPlaceholder("your toast").fill("to mesh");
    await toaster.getByRole("button", { name: "give toast", exact: true }).click();
    await audience.waitForTimeout(400);

    // The advertised toast propagates to the OTHER peer.
    await expect(audience.locator(".ts-feed")).toContainText("to mesh");

    // The audience reacts 🥂 (clink). The reaction must cross the mesh: the
    // toaster sees the tally go 0 → 1 (the static 🥂 button label is always
    // present, so asserting on it proved nothing — assert the synced count).
    await expect(toaster.locator(".ts-feed .ts-tally").first()).toHaveText("0");
    await audience.getByRole("button", { name: "react clink", exact: true }).first().click();
    await expect(toaster.locator(".ts-feed .ts-tally").first()).toHaveText("1");

    // The cumulative leaderboard (third advertised feature) is derived from
    // synced clink counts. The toaster earned 1 clink → both peers must show
    // the toaster scoring 1 on the leaderboard. Assert on the OPPOSITE peer
    // (the audience) so this proves the score crossed the mesh, not a local echo.
    const toasterName = current.includes("alice") ? "alice" : "bob";
    const lbRow = audience
      .locator(".mesh-leaderboard-row")
      .filter({ has: audience.locator(".mesh-leaderboard-name", { hasText: toasterName }) });
    await expect(lbRow.locator(".mesh-leaderboard-score")).toHaveText("1");
  } finally {
    await cleanup();
  }
});
