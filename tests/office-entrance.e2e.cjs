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
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
