// npm run db:reset: replaces the database file with the sample data.
import { copyFile } from "node:fs/promises";
import { loadConfig } from "../config";

const config = loadConfig();
await copyFile(config.seedFile, config.dataFile);
console.log(`Reset ${config.dataFile} to the sample data.`);
