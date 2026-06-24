// All trip parameters live here. Edit this file to change dates, party size, or airports
// instead of digging through the scraper code.

export const ORIGIN = "OMA"; // Omaha, NE

// Direct-flight destinations near Cape Canaveral, in priority order.
export const DESTINATIONS = ["MLB", "SFB", "MCO"];

// Earliest/latest acceptable outbound date (depart OMA).
export const OUTBOUND_DATE_RANGE = { earliest: "2026-07-26", latest: "2026-07-29" };

// Earliest/latest acceptable return date (depart Florida back to OMA).
export const RETURN_DATE_RANGE = { earliest: "2026-08-01", latest: "2026-08-02" };

export const PARTY = { min: 4, max: 8 };

// Used for lodging search radius + "beachfront" scoring.
export const LODGING_ANCHOR = {
  name: "Cape Canaveral National Cemetery",
  address: "5525 US-1, Scottsmoor, FL 32775",
  lat: 28.7592,
  lng: -80.8217,
  // Nearby beach towns to bias toward when scoring listings as "on the beach".
  beachTowns: ["Cocoa Beach", "Cape Canaveral", "Cocoa", "Titusville", "Mims", "Scottsmoor", "Port Canaveral"],
};

export const LODGING_MAX_DISTANCE_MILES = 30;

function dateRange(start, end) {
  const dates = [];
  let d = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (d <= last) {
    dates.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

// Every valid (outbound, return) pair, skipping any where return is before outbound.
export function tripCombinations() {
  const outbound = dateRange(OUTBOUND_DATE_RANGE.earliest, OUTBOUND_DATE_RANGE.latest);
  const inbound = dateRange(RETURN_DATE_RANGE.earliest, RETURN_DATE_RANGE.latest);
  const combos = [];
  for (const depart of outbound) {
    for (const ret of inbound) {
      if (ret > depart) combos.push({ depart, ret });
    }
  }
  return combos;
}

// Shortest stay, longest stay, and (if distinct) one in between — used to keep
// the lodging/car scrapes from having to check every single date combo.
export function representativeStays() {
  const combos = tripCombinations().map((c) => ({
    ...c,
    nights: (new Date(c.ret) - new Date(c.depart)) / 86400000,
  }));
  combos.sort((a, b) => a.nights - b.nights);
  const shortest = combos[0];
  const longest = combos[combos.length - 1];
  const unique = [shortest, longest];
  if (combos.length > 2) {
    const middle = combos[Math.floor(combos.length / 2)];
    const isDuplicate = [shortest, longest].some((c) => c.depart === middle.depart && c.ret === middle.ret);
    if (!isDuplicate) unique.push(middle);
  }
  return unique;
}
