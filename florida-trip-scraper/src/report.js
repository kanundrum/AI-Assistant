import { ORIGIN, OUTBOUND_DATE_RANGE, RETURN_DATE_RANGE, PARTY, LODGING_ANCHOR } from "./config.js";

function statusNote(r) {
  if (r.status === "ok") return null;
  if (r.status === "no-results") return `_No matching results found._ [Check manually](${r.url})`;
  if (r.status === "error") return `_Scrape failed (${r.error || "unknown error"})._ [Check manually](${r.url})`;
  return `_Could not load this search (likely blocked by the site)._ [Check manually](${r.url})`;
}

function flightsSection(flightResults) {
  const byDest = {};
  for (const r of flightResults) {
    byDest[r.dest] ??= [];
    byDest[r.dest].push(r);
  }

  let out = `## Flights (nonstop, ${ORIGIN} round-trip)\n\n`;
  for (const [dest, routes] of Object.entries(byDest)) {
    out += `### To ${dest}\n\n`;
    const ranked = routes
      .filter((r) => r.status === "ok")
      .flatMap((r) => r.flights.map((f) => ({ ...f, depart: r.depart, ret: r.ret, url: r.url })))
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);

    if (ranked.length === 0) {
      out += "_No nonstop fares found for any date combination yet — check the links below manually._\n\n";
    } else {
      out += "| Price | Depart | Return | Duration | Details |\n|---|---|---|---|---|\n";
      for (const f of ranked) {
        out += `| $${f.price} | ${f.depart} | ${f.ret} | ${f.duration ?? "?"} | [link](${f.url}) |\n`;
      }
      out += "\n";
    }

    const broken = routes.filter((r) => r.status !== "ok");
    if (broken.length > 0) {
      out += "<details><summary>Searches that didn't return results</summary>\n\n";
      for (const r of broken) {
        out += `- ${r.depart} → ${r.ret}: ${statusNote(r)}\n`;
      }
      out += "\n</details>\n\n";
    }
  }
  return out;
}

function carsSection(carResults) {
  let out = `## Rental Cars (Turo airport pickup preferred, else traditional rental)\n\n`;
  const byDest = {};
  for (const r of carResults) {
    byDest[r.dest] ??= [];
    byDest[r.dest].push(r);
  }

  for (const [dest, sources] of Object.entries(byDest)) {
    out += `### ${dest} airport\n\n`;
    for (const r of sources) {
      out += `**${r.source}** (${r.depart} → ${r.ret}): `;
      if (r.status === "ok") {
        const cheapest = r.listings.slice(0, 3);
        out += cheapest.map((l) => `$${l.price}`).join(", ");
        out += ` — [view search](${r.url})\n\n`;
      } else {
        out += `${statusNote(r)}\n\n`;
      }
    }
  }
  return out;
}

function lodgingSection(lodgingResults) {
  let out = `## Lodging near ${LODGING_ANCHOR.name}\n\n`;
  out += `Party size: ${PARTY.min}-${PARTY.max} guests. Searched towns ringing the cemetery, biased toward beachfront listings.\n\n`;

  const byStay = {};
  for (const r of lodgingResults) {
    const key = `${r.depart} -> ${r.ret}`;
    byStay[key] ??= [];
    byStay[key].push(r);
  }

  for (const [stay, sources] of Object.entries(byStay)) {
    out += `### Stay: ${stay}\n\n`;
    const ranked = sources
      .filter((r) => r.status === "ok")
      .flatMap((r) => r.listings.map((l) => ({ ...l, source: r.source, town: r.town, url: r.url })))
      .sort((a, b) => (b.beachy - a.beachy) || (a.price - b.price))
      .slice(0, 8);

    if (ranked.length === 0) {
      out += "_No listings scraped for this stay — check the links below manually._\n\n";
    } else {
      out += "| Price | Beachfront? | Town | Source | Listing |\n|---|---|---|---|---|\n";
      for (const l of ranked) {
        out += `| $${l.price} | ${l.beachy ? "likely" : "—"} | ${l.town} | ${l.source} | ${l.raw.slice(0, 80)}… |\n`;
      }
      out += "\n";
    }

    const broken = sources.filter((r) => r.status !== "ok");
    if (broken.length > 0) {
      out += "<details><summary>Searches that didn't return results</summary>\n\n";
      for (const r of broken) {
        out += `- ${r.source} / ${r.town}: ${statusNote(r)}\n`;
      }
      out += "\n</details>\n\n";
    }
  }
  return out;
}

export function buildReport({ flights, cars, lodging }) {
  const header =
    `# Florida Trip Scrape Report\n\n` +
    `Generated ${new Date().toISOString()}\n\n` +
    `- Origin: ${ORIGIN}\n` +
    `- Outbound window: ${OUTBOUND_DATE_RANGE.earliest} to ${OUTBOUND_DATE_RANGE.latest}\n` +
    `- Return window: ${RETURN_DATE_RANGE.earliest} to ${RETURN_DATE_RANGE.latest}\n` +
    `- Party size: ${PARTY.min}-${PARTY.max}\n\n` +
    `Note: live-site scraping is best-effort. Sections marked "blocked"/"error" include a direct link — open it in your own browser to check by hand.\n\n---\n\n`;

  return header + flightsSection(flights) + "\n---\n\n" + carsSection(cars) + "\n---\n\n" + lodgingSection(lodging);
}
