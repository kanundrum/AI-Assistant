import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { closeBrowser } from "./browser.js";
import { scrapeFlights } from "./flights.js";
import { scrapeCars } from "./cars.js";
import { scrapeLodging } from "./lodging.js";
import { buildReport } from "./report.js";
import { DESTINATIONS, representativeStays } from "./config.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function progress(label) {
  return (done, total, item) => {
    const status = item.status ?? "?";
    console.log(`[${label}] ${done}/${total} (${status})`);
  };
}

async function main() {
  console.log("Scraping flights (this is the slow part — sequential, on purpose)...");
  const flights = await scrapeFlights({ onProgress: progress("flights") });

  console.log("Scraping rental cars (Turo + traditional)...");
  const stays = representativeStays();
  const routeCombos = DESTINATIONS.flatMap((dest) => stays.map((s) => ({ dest, depart: s.depart, ret: s.ret })));
  const cars = await scrapeCars(routeCombos, { onProgress: progress("cars") });

  console.log("Scraping lodging (Airbnb + Vrbo)...");
  const lodging = await scrapeLodging({ onProgress: progress("lodging") });

  await closeBrowser();

  const report = buildReport({ flights, cars, lodging });
  const outDir = path.join(__dirname, "..", "output");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `report-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.md`);
  fs.writeFileSync(outPath, report);

  console.log(`\nDone. Report written to ${outPath}`);
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await closeBrowser();
  process.exit(1);
});
