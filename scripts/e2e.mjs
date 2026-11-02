/**
 * `npm run test:e2e`: builds the app, starts it, runs Playwright, and always stops it.
 *
 * This replaces Playwright's own `webServer` option, which can't stop the server on
 * Windows: the test run hangs at the end and the server keeps port 3100 busy.
 * Extra arguments go to Playwright: npm run test:e2e -- tests/e2e/flow.spec.ts
 */
import { spawn, spawnSync } from "node:child_process";

const PORT = "3100";
const NEXT = "node_modules/next/dist/bin/next";
const PLAYWRIGHT = "node_modules/@playwright/test/cli.js";
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };

function inUse(url) {
  return fetch(url).then(
    () => true,
    () => false,
  );
}

const url = `http://localhost:${PORT}`;
if (await inUse(url)) {
  console.error(`Port ${PORT} is already in use. Stop whatever is running there, then try again.`);
  process.exit(1);
}

const build = spawnSync(process.execPath, [NEXT, "build"], { stdio: "inherit", env });
if (build.status !== 0) process.exit(build.status ?? 1);

const server = spawn(process.execPath, [NEXT, "start", "-p", PORT], { stdio: "ignore", env });

function stopServer() {
  if (server.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill();
}
process.on("exit", stopServer);

let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  ready = await inUse(url);
  if (!ready) await new Promise((r) => setTimeout(r, 500));
}
if (!ready) {
  console.error("The app didn't start within 30 seconds.");
  process.exit(1);
}

const tests = spawnSync(process.execPath, [PLAYWRIGHT, "test", ...process.argv.slice(2)], { stdio: "inherit", env });
process.exit(tests.status ?? 1);
