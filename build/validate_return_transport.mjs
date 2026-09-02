#!/usr/bin/env node
// The return-validator bridge (`PLAN.md`, "The return-validator bridge").
//
// Imports the single implementation of the whole-file validation rule,
// `validateReturnTransport()`, from `web/ranking.js` — never reimplemented
// here. Reads the `venues_meta.json` path given as the sole argument and
// writes structured JSON and nothing else to stdout. Writes no file.
//
// Usage: node build/validate_return_transport.mjs <path-to-venues_meta.json>

import { readFileSync } from "node:fs";
import { validateReturnTransport } from "../web/ranking.js";

const metaPath = process.argv[2];
if (!metaPath) {
  process.stderr.write("usage: validate_return_transport.mjs <path-to-venues_meta.json>\n");
  process.exit(2);
}

let venuesMeta;
try {
  venuesMeta = JSON.parse(readFileSync(metaPath, "utf8"));
} catch (err) {
  process.stderr.write(`failed to read/parse ${metaPath}: ${err.message}\n`);
  process.exit(1);
}

const status = validateReturnTransport(venuesMeta);
process.stdout.write(JSON.stringify(status));
