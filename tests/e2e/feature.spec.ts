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

    await expect(audience.locator(".ts-feed")).toContainText("to mesh");
    await audience.getByRole("button", { name: "react clink", exact: true }).first().click();
    await toaster.waitForTimeout(400);
    await expect(toaster.locator(".ts-feed")).toContainText("🥂");
  } finally {
    await cleanup();
  }
});
