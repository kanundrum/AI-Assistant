import { newPage, dismissConsent } from "./browser.js";
import { PARTY, LODGING_ANCHOR, representativeStays } from "./config.js";

// Airbnb/Vrbo search-by-place is far more reliable than lat/lng bounding boxes
// (which Airbnb rotates often), so we search known towns ringing the cemetery
// and rank results by how "beachy" their listing text reads.
const SEARCH_TOWNS = [
  { slug: "Cocoa-Beach--FL", vrbo: "Cocoa Beach, FL", label: "Cocoa Beach" },
  { slug: "Cape-Canaveral--FL", vrbo: "Cape Canaveral, FL", label: "Cape Canaveral" },
  { slug: "Titusville--FL", vrbo: "Titusville, FL", label: "Titusville" },
];

const BEACH_WORDS = /(beach|oceanfront|ocean front|on the sand|steps to the beach|seaside)/i;

function airbnbUrl(town, depart, ret) {
  const params = new URLSearchParams({
    checkin: depart,
    checkout: ret,
    adults: String(PARTY.max),
  });
  return `https://www.airbnb.com/s/${town.slug}/homes?${params.toString()}`;
}

function vrboUrl(town, depart, ret) {
  const params = new URLSearchParams({
    destination: town.vrbo,
    startDate: depart,
    endDate: ret,
    adults: String(PARTY.max),
  });
  return `https://www.vrbo.com/search?${params.toString()}`;
}

function parsePriceFromText(text) {
  const m = text.match(/\$([0-9][0-9,]*)\s*(?:total|night)?/i);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

async function scrapeAirbnb(town, depart, ret) {
  const url = airbnbUrl(town, depart, ret);
  const result = { source: "Airbnb", town: town.label, depart, ret, url, status: "blocked", listings: [] };

  let page;
  try {
    page = await newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissConsent(page);
    await page.waitForTimeout(3000);

    const cards = await page.locator('[itemprop="itemListElement"]').allInnerTexts();
    const listings = cards.map((text) => ({
      price: parsePriceFromText(text),
      beachy: BEACH_WORDS.test(text),
      raw: text.replace(/\s+/g, " ").trim().slice(0, 250),
    })).filter((l) => l.price !== null);

    result.status = listings.length > 0 ? "ok" : "no-results";
    result.listings = listings.sort((a, b) => (b.beachy - a.beachy) || (a.price - b.price));
  } catch (err) {
    result.status = "error";
    result.error = String(err.message || err).slice(0, 200);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return result;
}

async function scrapeVrbo(town, depart, ret) {
  const url = vrboUrl(town, depart, ret);
  const result = { source: "Vrbo", town: town.label, depart, ret, url, status: "blocked", listings: [] };

  let page;
  try {
    page = await newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissConsent(page);
    await page.waitForTimeout(3000);

    const cards = await page.locator('[data-stid="lodging-card-responsive"]').allInnerTexts();
    const listings = cards.map((text) => ({
      price: parsePriceFromText(text),
      beachy: BEACH_WORDS.test(text),
      raw: text.replace(/\s+/g, " ").trim().slice(0, 250),
    })).filter((l) => l.price !== null);

    result.status = listings.length > 0 ? "ok" : "no-results";
    result.listings = listings.sort((a, b) => (b.beachy - a.beachy) || (a.price - b.price));
  } catch (err) {
    result.status = "error";
    result.error = String(err.message || err).slice(0, 200);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return result;
}

// Searches the shortest and longest possible stays (plus a midpoint, if distinct)
// across beach towns ringing the cemetery, on both Airbnb and Vrbo.
export async function scrapeLodging({ onProgress } = {}) {
  const stays = representativeStays();
  const results = [];
  const total = stays.length * SEARCH_TOWNS.length * 2;
  let done = 0;

  for (const stay of stays) {
    for (const town of SEARCH_TOWNS) {
      const airbnb = await scrapeAirbnb(town, stay.depart, stay.ret);
      results.push(airbnb);
      done += 1;
      if (onProgress) onProgress(done, total, airbnb);

      const vrbo = await scrapeVrbo(town, stay.depart, stay.ret);
      results.push(vrbo);
      done += 1;
      if (onProgress) onProgress(done, total, vrbo);
    }
  }

  return results;
}

export { representativeStays, LODGING_ANCHOR };
