#!/usr/bin/env node
// The outbound-validator bridge (`PLAN.md`, "Getting there: outbound-mirror
// transport" — "Validation: diagnostics only, never a runtime gate").
//
// Imports the single implementation of the whole-file validation rule,
// `validateOutboundTransport()`, from `web/ranking.js` — never reimplemented
// here. Reads the `venues_meta.json` path given as the sole argument and
// writes structured JSON and nothing else to stdout. Writes no file.
//
// Usage: node build/validate_outbound_transport.mjs <path-to-venues_meta.json>

import { readFileSync } from "node:fs";
import { validateOutboundTransport } from "../web/ranking.js";

const metaPath = process.argv[2];
if (!metaPath) {
  process.stderr.write("usage: validate_outbound_transport.mjs <path-to-venues_meta.json>\n");
  process.exit(2);
}

let venuesMeta;
try {
  venuesMeta = JSON.parse(readFileSync(metaPath, "utf8"));
} catch (err) {
  process.stderr.write(`failed to read/parse ${metaPath}: ${err.message}\n`);
  process.exit(1);
}

const status = validateOutboundTransport(venuesMeta);
process.stdout.write(JSON.stringify(status));
