import assert from "node:assert/strict";
import { lstat, readFile } from "node:fs/promises";

const outputRoot = new URL("../.vercel/output/", import.meta.url);
const config = JSON.parse(await readFile(new URL("config.json", outputRoot), "utf8"));
const serverEntry = await readFile(
  new URL("functions/__server.func/index.mjs", outputRoot),
  "utf8",
);

for (const route of ["/api/scientific-pilot", "/api/scientific-topic-dry-run"]) {
  assert.ok(
    config.routes.some((entry) => entry.src === route && entry.dest === route),
    `${route} is missing from the Vercel route manifest`,
  );
  assert.match(serverEntry, new RegExp(`route: ${JSON.stringify(route)}`));

  const functionName = route.slice(1);
  const functionPath = new URL(`functions/${functionName}.func`, outputRoot);
  const functionStats = await lstat(functionPath);
  assert.ok(
    functionStats.isDirectory() || functionStats.isSymbolicLink(),
    `${route} has no Vercel function`,
  );
}

console.log("Scientific API routes are registered in the Vercel build output.");
