import { newPage } from "./browser.js";
import { ORIGIN, DESTINATIONS, tripCombinations } from "./config.js";

const AIRPORT_NAMES = {
  OMA: "Omaha",
  MLB: "Melbourne FL",
  SFB: "Orlando Sanford",
  MCO: "Orlando",
};

function buildSearchUrl(origin, dest, depart, ret) {
  const q = `Nonstop flights from ${AIRPORT_NAMES[origin]} (${origin}) to ${AIRPORT_NAMES[dest]} (${dest}) on ${depart} returning ${ret}`;
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}&hl=en&curr=USD`;
}

function manualLink(origin, dest, depart, ret) {
  return buildSearchUrl(origin, dest, depart, ret);
}

async function applyNonstopFilter(page) {
  try {
    await page.getByRole("button", { name: /Stops/i }).first().click({ timeout: 5000 });
    await page.getByRole("radio", { name: /Nonstop only/i }).click({ timeout: 5000 });
    // Close the dropdown so the results list re-renders fully.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500);
    return true;
  } catch {
    return false;
  }
}

function parseFlightCard(text) {
  const priceMatch = text.match(/\$([0-9][0-9,]*)/);
  const durationMatch = text.match(/(\d+ hr(?:\s\d+ min)?|\d+ min)\b/);
  const nonstop = /nonstop/i.test(text);
  return {
    price: priceMatch ? Number(priceMatch[1].replace(/,/g, "")) : null,
    duration: durationMatch ? durationMatch[1] : null,
    nonstop,
    raw: text.replace(/\s+/g, " ").trim().slice(0, 300),
  };
}

async function scrapeOneRoute(origin, dest, depart, ret) {
  const url = buildSearchUrl(origin, dest, depart, ret);
  const result = {
    origin,
    dest,
    depart,
    ret,
    url,
    status: "blocked", // optimistic default flipped to "ok" or "no-results" below
    flights: [],
  };

  let page;
  try {
    page = await newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(2000);

    await applyNonstopFilter(page);

    await page.waitForSelector('[role="listitem"]', { timeout: 15000 });
    const cards = await page.locator('[role="listitem"]').allInnerTexts();

    const flights = cards
      .map(parseFlightCard)
      .filter((f) => f.price !== null);

    if (flights.length > 0) {
      result.status = "ok";
      result.flights = flights.sort((a, b) => a.price - b.price);
    } else {
      result.status = "no-results";
    }
  } catch (err) {
    result.status = "error";
    result.error = String(err.message || err).slice(0, 200);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return result;
}

// Scrapes every (destination x outbound x return) combination allowed by config.js.
// Runs sequentially and on purpose: Google Flights rate-limits/blocks bursts of
// concurrent automated requests from the same IP much faster than slow serial ones.
export async function scrapeFlights({ onProgress } = {}) {
  const combos = tripCombinations();
  const results = [];
  const total = DESTINATIONS.length * combos.length;
  let done = 0;

  for (const dest of DESTINATIONS) {
    for (const { depart, ret } of combos) {
      const r = await scrapeOneRoute(ORIGIN, dest, depart, ret);
      results.push(r);
      done += 1;
      if (onProgress) onProgress(done, total, r);
    }
  }

  return results;
}

export { manualLink as flightSearchLink };
