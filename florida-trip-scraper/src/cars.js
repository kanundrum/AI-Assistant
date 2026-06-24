import { newPage } from "./browser.js";
import { dismissConsent } from "./browser.js";

const AIRPORT_LOCATIONS = {
  MLB: "Orlando Melbourne International Airport, FL",
  SFB: "Orlando Sanford International Airport, FL",
  MCO: "Orlando International Airport, FL",
};

function toMDY(isoDate) {
  const [y, m, d] = isoDate.split("-");
  return `${m}/${d}/${y}`;
}

function turoUrl(dest, depart, ret) {
  const params = new URLSearchParams({
    location: AIRPORT_LOCATIONS[dest],
    locationType: "AIRPORT",
    startDate: toMDY(depart),
    startTime: "10:00",
    endDate: toMDY(ret),
    endTime: "10:00",
  });
  return `https://turo.com/us/en/search?${params.toString()}`;
}

function kayakCarsUrl(dest, depart, ret) {
  // Kayak's path-based date format, defaults to a 10am pickup/dropoff.
  return `https://www.kayak.com/cars/${dest}/${depart}/${ret}/10am/10am`;
}

function parsePriceFromText(text) {
  const m = text.match(/\$([0-9][0-9,]*)/);
  return m ? Number(m[1].replace(/,/g, "")) : null;
}

async function scrapeTuro(dest, depart, ret) {
  const url = turoUrl(dest, depart, ret);
  const result = { source: "Turo", dest, depart, ret, url, status: "blocked", listings: [] };

  let page;
  try {
    page = await newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissConsent(page);
    await page.waitForTimeout(2500);

    // Turo's vehicle cards are anchor links into /us/en/rentals/... — grab their
    // text content rather than relying on a specific class name, which Turo
    // rotates often.
    const cards = await page.locator('a[href*="/rentals/"]').allInnerTexts();
    const listings = cards
      .map((text) => ({
        price: parsePriceFromText(text),
        airportPickup: /airport/i.test(text),
        raw: text.replace(/\s+/g, " ").trim().slice(0, 200),
      }))
      .filter((l) => l.price !== null);

    result.status = listings.length > 0 ? "ok" : "no-results";
    result.listings = listings.sort((a, b) => a.price - b.price);
  } catch (err) {
    result.status = "error";
    result.error = String(err.message || err).slice(0, 200);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return result;
}

async function scrapeKayakCars(dest, depart, ret) {
  const url = kayakCarsUrl(dest, depart, ret);
  const result = { source: "Kayak (Hertz/Enterprise/National/etc.)", dest, depart, ret, url, status: "blocked", listings: [] };

  let page;
  try {
    page = await newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await dismissConsent(page);
    await page.waitForTimeout(4000); // Kayak's car results stream in progressively.

    const cards = await page.locator('[data-testid="car-list-item"]').allInnerTexts();
    const listings = cards
      .map((text) => ({
        price: parsePriceFromText(text),
        raw: text.replace(/\s+/g, " ").trim().slice(0, 200),
      }))
      .filter((l) => l.price !== null);

    result.status = listings.length > 0 ? "ok" : "no-results";
    result.listings = listings.sort((a, b) => a.price - b.price);
  } catch (err) {
    result.status = "error";
    result.error = String(err.message || err).slice(0, 200);
  } finally {
    if (page) await page.close().catch(() => {});
  }

  return result;
}

// Checks Turo first (airport-pickup only, per the trip requirement) and a
// traditional-rental aggregator as the fallback comparison, for each
// destination airport x date combo actually worth checking.
export async function scrapeCars(routeCombos, { onProgress } = {}) {
  const results = [];
  const total = routeCombos.length * 2;
  let done = 0;

  for (const { dest, depart, ret } of routeCombos) {
    const turo = await scrapeTuro(dest, depart, ret);
    results.push(turo);
    done += 1;
    if (onProgress) onProgress(done, total, turo);

    const kayak = await scrapeKayakCars(dest, depart, ret);
    results.push(kayak);
    done += 1;
    if (onProgress) onProgress(done, total, kayak);
  }

  return results;
}
