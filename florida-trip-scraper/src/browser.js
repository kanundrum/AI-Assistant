import { chromium } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let browserPromise;

export async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

export async function newPage() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
  });
  return context.newPage();
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
  }
}

// Most of these sites show a cookie/consent modal on first load. Click through
// any button whose text matches, ignoring failures since not every site shows one.
export async function dismissConsent(page, texts = ["Accept all", "I agree", "Accept", "Got it"]) {
  for (const text of texts) {
    try {
      const btn = page.getByRole("button", { name: text, exact: false }).first();
      await btn.click({ timeout: 2000 });
      return true;
    } catch {
      // no-op: that button wasn't present, try the next label
    }
  }
  return false;
}
