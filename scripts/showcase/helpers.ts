/**
 * Shared helpers for CMMS E2E showcase scripts.
 * Provides login, navigation, and step-by-step visualization.
 */
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

export const API_BASE = process.env.API_URL || "http://localhost:3000";
export const GUI_BASE = process.env.GUI_URL || "http://localhost:3001";

// Test accounts from seed
export const ACCOUNTS = {
  admin:      { email: "admin@cmms.test",      password: "Password123!", role: "ADMINISTRATOR" },
  dispatcher: { email: "dispatcher@cmms.test",  password: "Password123!", role: "DISPATCHER" },
  tech:       { email: "tech@cmms.test",        password: "Password123!", role: "TECHNICIAN" },
  tech1:      { email: "technician1@cmms.test",  password: "Password123!", role: "TECHNICIAN" },
  qa:         { email: "qa@cmms.test",          password: "Password123!", role: "QA_REVIEWER" },
  ops:        { email: "ops@cmms.test",         password: "Password123!", role: "OPERATIONS_MANAGER" },
};

// Step delay for visual showcase (ms) — set env SHOWCASE_SPEED=fast to skip
const STEP_DELAY = process.env.SHOWCASE_SPEED === "fast" ? 300 : 1500;

export async function pause(ms?: number) {
  await new Promise((r) => setTimeout(r, ms ?? STEP_DELAY));
}

/** Login via the GUI login page */
export async function login(page: Page, account: { email: string; password: string }) {
  await page.goto(`${GUI_BASE}/login`);
  await pause(500);
  await page.fill('input[id="email"]', account.email);
  await page.fill('input[id="password"]', account.password);
  await pause(300);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(inspections|admin|tickets|dashboard|profile)/, { timeout: 10000 });
  await pause(500);
}

/** Direct API login — returns tokens */
export async function apiLogin(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.json() as Promise<{ accessToken: string; refreshToken: string; user: { id: string; role: string } }>;
}

/** Create a headed browser with viewport sized for showcase */
export async function createBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: false,
    args: ["--window-size=1280,900"],
  });
}

/** Print a step header to console */
export function step(n: number, total: number, label: string) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  Step ${n}/${total}: ${label}`);
  console.log(`${"─".repeat(60)}`);
}

/** Print chain header */
export function chainHeader(title: string, roles: string[]) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`  Roles: ${roles.join(" → ")}`);
  console.log(`${"═".repeat(60)}`);
}

const MOBILE_VIEWPORT = { width: 375, height: 812 };
const DESKTOP_VIEWPORT = { width: 1280, height: 900 };
const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function isTechAccount(account: { email: string }) {
  return account.email.startsWith("tech");
}

/** Create browser context + page, login, return page.
 *  Technician accounts get mobile viewport + user-agent, others get desktop. */
export async function openSession(
  browser: Browser,
  account: { email: string; password: string },
  viewport?: { width: number; height: number },
): Promise<{ context: BrowserContext; page: Page }> {
  const mobile = isTechAccount(account);
  const context = await browser.newContext({
    viewport: viewport ?? (mobile ? MOBILE_VIEWPORT : DESKTOP_VIEWPORT),
    userAgent: mobile ? MOBILE_USER_AGENT : undefined,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  await login(page, account);
  return { context, page };
}

/** Cleanup all contexts */
export async function cleanup(browser: Browser, contexts: BrowserContext[]) {
  for (const ctx of contexts) {
    await ctx.close().catch(() => {});
  }
  await browser.close().catch(() => {});
}
