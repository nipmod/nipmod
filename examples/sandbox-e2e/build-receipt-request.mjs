#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const [decisionPath = "decision.json", receiptPath = "sandbox-receipt.json", outputPath = "receipt-request.json"] = process.argv.slice(2);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Could not read JSON from ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const decision = readJson(decisionPath);
const receiptText = readFileSync(receiptPath, "utf8");

writeFileSync(
  outputPath,
  `${JSON.stringify(
    {
      decision,
      receiptText,
      targetConfirmed: true
    },
    null,
    2
  )}\n`
);

console.log(`Wrote ${outputPath}`);

