# Florida Trip Scraper

One-shot Node.js script that checks nonstop flights, rental cars, and beach
lodging for a specific trip from Omaha (OMA) to the Space Coast, then writes
everything to a single Markdown report.

**This is a personal-use tool, not a production scraper.** It automates a
real Chromium browser against Google Flights, Turo, Kayak, Airbnb, and Vrbo.
Those sites don't offer free APIs for this and actively discourage
scraping, so:

- It runs fully sequentially and slowly on purpose, to look less like a bot.
- It will still get blocked, rate-limited, or shown a CAPTCHA sometimes —
  when that happens the report just notes it and gives you a direct link to
  check that search by hand in your own browser.
- Run it on your own machine with your own residential internet connection,
  not a cloud server or VPN — those get blocked far more aggressively.
- Don't run it in a tight loop. It's meant for the occasional manual check,
  not continuous monitoring.

## Trip parameters (edit `src/config.js` to change these)

- Origin: OMA (Omaha)
- Destinations: MLB (Melbourne), SFB (Orlando Sanford), MCO (Orlando) — nonstop only
- Depart OMA: between 2026-07-26 and 2026-07-29
- Return to OMA: between 2026-08-01 and 2026-08-02
- Party size: 4-8 people
- Car: Turo with airport pickup preferred, traditional rental (via Kayak) as the comparison
- Lodging: Airbnb/Vrbo near Cape Canaveral National Cemetery, beachfront preferred, sleeps up to 8

## Setup

Requires Node.js 18+.

```bash
cd florida-trip-scraper
npm install            # also downloads a Chromium build for Playwright
```

## Run

```bash
npm start
```

This takes a while (often 10-20 minutes) because it works through every
valid departure/return date combination for each destination, plus car and
lodging searches, one at a time. Progress prints to the console as it goes.

When it finishes, open the newest file in `output/` — it's a Markdown
report with:

- The cheapest nonstop fares found per destination, by date combo
- Turo (airport pickup) vs. traditional rental prices per airport
- The best beachfront-leaning Airbnb/Vrbo listings per stay length

Any search that got blocked or returned nothing still shows up in the
report with a direct link so you can finish that check manually in a
couple of clicks.

## If selectors break

These sites change their markup periodically, which will make a section
come back empty even when the site itself has results. Each scraper module
(`src/flights.js`, `src/cars.js`, `src/lodging.js`) isolates one site's logic
and fails independently — a broken Airbnb selector won't stop the flight or
car sections from working. If a section keeps coming back empty, open its
search link manually, then update the corresponding `locator(...)` selector
in that file to match what's actually on the page now.
