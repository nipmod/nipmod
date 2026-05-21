#!/usr/bin/env node
import { runWitnessWorker } from "./witness-worker.mjs";

runWitnessWorker()
  .then((result) => {
    const statement = result.payload.statements[0];
    console.log(`witnessed ${statement.treeHead.rootHash} as ${statement.witness}`);
    console.log(`wrote ${result.outputPath}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
