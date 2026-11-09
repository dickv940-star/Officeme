const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const root = path.resolve(__dirname, "..");
const mime = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".png":"image/png", ".css":"text/css; charset=utf-8" };
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + pathname);
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control":"no-store" });
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-webgl", "--ignore-gpu-blocklist", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  try {
    for (const viewport of [{width:1365,height:900},{width:390,height:844}]) {
      const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto("http://127.0.0.1:" + address.port + "/tests/fixtures/office-entrance.html");
      await page.waitForSelector("#officeMeEntrance");
      assert.equal(await page.locator(".ome-worker").count(), 8, "Entrance must show eight agent portraits");
      assert.equal(await page.locator(".ome-door").getAttribute("role"), "button", "Door must be keyboard/click accessible");
      const imgs = await page.locator(".ome-worker img").evaluateAll(nodes => nodes.map(img => ({ complete:img.complete, width:img.naturalWidth })));
      assert.equal(imgs.length, 8);
      assert.ok(imgs.every(img => img.complete && img.width > 0), "All eight agent portraits must load");
      if (viewport.width > 600) {
        await page.locator(".ome-door").click();
      } else {
        await page.locator(".ome-enter").click();
      }
      await page.waitForFunction(() => document.querySelector("#officeMeEntrance")?.classList.contains("is-opening"));
      await page.waitForFunction(() => !document.getElementById("officeMeEntrance"), null, { timeout: 5000 });
      assert.equal(await page.locator("#roomView").isVisible(), true, "The existing 3D room view must be revealed");
      assert.equal(await page.locator("#roomTitle").textContent(), "AI Agent Workspace");
      assert.match(await page.locator("#roomDescription").textContent(), /simulasi visual/);
      const order = await page.evaluate(() => {
        const ids = ["roomSection","affiliateWorkflowPanel","affiliateLinkManager"];
        return ids.map(id => [...document.body.querySelectorAll("*")].findIndex(el => el.id === id));
      });
      assert.ok(order[0] < order[1] && order[1] < order[2], "Workspace must precede affiliate workflow and link manager");
      assert.deepEqual(await page.evaluate(() => window.__openedRooms), ["workers"], "The 3D workers room must open exactly once");
      assert.deepEqual(errors, [], "Entrance must not throw browser errors");
      await page.close();
      console.log("PASS entrance flow at " + viewport.width + "x" + viewport.height);
    }

    // Full integration: use the real Three.js virtual-office module, not a mocked room opener.
    const realPage = await browser.newPage({ viewport: { width: 1365, height: 900 } });
    const realErrors = [];
    realPage.on("pageerror", error => realErrors.push(error.message));
    await realPage.goto("http://127.0.0.1:" + address.port + "/tests/fixtures/office-entrance-3d.html");
    await realPage.waitForSelector("#officeMeEntrance");
    await realPage.locator(".ome-enter").click();
    await realPage.waitForFunction(() => !document.getElementById("officeMeEntrance"), null, { timeout: 6000 });
    await realPage.waitForFunction(() => {
      const host = document.getElementById("virtualOffice3d");
      return host?.dataset.agentCount === "8" || /gagal dibuat/i.test(document.getElementById("virtualOfficeStatus")?.textContent || "");
    }, null, { timeout: 20000 });
    const roomState = await realPage.evaluate(() => ({
      count: document.getElementById("virtualOffice3d")?.dataset.agentCount || "0",
      room: document.getElementById("virtualOffice3d")?.dataset.room || "",
      canvas: Boolean(document.querySelector("#virtualOffice3d canvas")),
      status: document.getElementById("virtualOfficeStatus")?.textContent || ""
    }));
    assert.equal(roomState.count, "8", "Real 3D room must create all eight agents. Status: " + roomState.status);
    assert.equal(roomState.room, "workers");
    assert.equal(roomState.canvas, true, "Real Three.js renderer must create a canvas");
    assert.deepEqual(realErrors, [], "Real 3D integration must not throw browser errors");
    await realPage.close();
    console.log("PASS real Three.js workers room: " + roomState.count + " agents");

    // End-to-end against the real OfficeMe index, including its existing scripts and injected affiliate panel.
    const appPage = await browser.newPage({ viewport: { width: 1440, height: 960 } });
    const appErrors = [];
    appPage.on("pageerror", error => appErrors.push(error.message));
    await appPage.goto("http://127.0.0.1:" + address.port + "/index.html", { waitUntil: "domcontentloaded" });
    await appPage.waitForSelector("#officeMeEntrance", { timeout: 15000 });
    await appPage.locator(".ome-enter").click();
    await appPage.waitForFunction(() => !document.getElementById("officeMeEntrance"), null, { timeout: 7000 });
    await appPage.waitForFunction(() => {
      const host = document.getElementById("virtualOffice3d");
      return host?.dataset.agentCount === "8" || /gagal dibuat/i.test(document.getElementById("virtualOfficeStatus")?.textContent || "");
    }, null, { timeout: 25000 });
    const appState = await appPage.evaluate(() => {
      const host = document.getElementById("virtualOffice3d");
      const section = document.getElementById("roomView")?.closest("section");
      const workflow = document.getElementById("affiliateWorkflowPanel");
      const links = document.getElementById("affiliateLinkManager");
      return {
        roomVisible: Boolean(document.getElementById("roomView") && !document.getElementById("roomView").hidden && document.getElementById("roomView").getClientRects().length),
        room: host?.dataset.room || "",
        agentCount: host?.dataset.agentCount || "0",
        canvas: Boolean(host?.querySelector("canvas")),
        workflowAfterRoom: Boolean(section && workflow && section.compareDocumentPosition(workflow) & Node.DOCUMENT_POSITION_FOLLOWING),
        linksAfterWorkflow: Boolean(workflow && links && workflow.compareDocumentPosition(links) & Node.DOCUMENT_POSITION_FOLLOWING),
        status: document.getElementById("virtualOfficeStatus")?.textContent || ""
      };
    });
    assert.equal(appState.roomVisible, true, "Real OfficeMe index must reveal its existing room. " + appState.status);
    assert.equal(appState.room, "workers");
    assert.equal(appState.agentCount, "8", "Real OfficeMe page must instantiate eight agents");
    assert.equal(appState.canvas, true, "Real OfficeMe page must render the 3D canvas");
    assert.equal(appState.workflowAfterRoom, true, "Affiliate workflow must follow the room");
    assert.equal(appState.linksAfterWorkflow, true, "Affiliate links must follow the workflow");
    await appPage.waitForSelector("#officeGlobalAffiliate", { timeout: 10000 });
    assert.equal(await appPage.locator("#ofwNav button").count(), 8, "Unified affiliate workspace must expose all eight feature areas");
    await appPage.locator("#ofwBatch").fill("https://shopee.co.id/product-test");
    await appPage.locator("#ofwBatchAdd").click();
    assert.equal(await appPage.locator("#ofwStatProducts").textContent(), "1", "Affiliate batch import must add a product candidate");
    await appPage.locator('#ofwNav button[data-page="products"]').click();
    assert.equal(await appPage.locator("#ofwProducts").innerText().then(t => t.includes("Perlu riset produk")), true, "Product Research must display imported candidate");
    await appPage.locator('#ofwNav button[data-page="content"]').click();
    await appPage.locator("#ofwBriefProduct").fill("Portable blender");
    await appPage.locator("#ofwMakePrompt").click();
    assert.match(await appPage.locator("#ofwPrompt").inputValue(), /Portable blender/, "Content Studio must generate a product-specific prompt");
    await appPage.locator("#ofwSaveBrief").click();
    assert.equal(await appPage.locator("#ofwStatContent").textContent(), "1", "Content brief must be saved");
    await appPage.locator('#ofwNav button[data-page="approval"]').click();
    assert.equal(await appPage.locator("#ofwApprovalList").innerText(), "Antrean persetujuan kosong.", "Drafts must not bypass approval");
    assert.deepEqual(appErrors, [], "Real OfficeMe page must not throw JavaScript errors");
    await appPage.close();
    console.log("PASS real OfficeMe index: entrance → 3D workspace → affiliate workflow");
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
