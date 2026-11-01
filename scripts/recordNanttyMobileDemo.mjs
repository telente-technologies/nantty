import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "services/scripts/browserE2e/package.json"));
const { chromium } = require(process.env.NANTTY_PLAYWRIGHT_MODULE ?? "@playwright/test");
const origin = process.env.NANTTY_MOBILE_DEMO_ORIGIN ?? "http://127.0.0.1:8092";
const output = path.resolve(root, process.env.NANTTY_MOBILE_DEMO_OUTPUT ?? "deliverables/nantty-mobile-app-walkthrough.webm");
const logoPath = path.join(root, "apps/mobile/assets/nantty-icon.png");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function installPresentation(page, logoDataUri) {
  await page.addStyleTag({ content: `
    nextjs-portal { display: none !important; }
    #nantty-mobile-demo { position: fixed; z-index: 2147483000; inset: 0; pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    #nantty-mobile-demo-badge { position: absolute; top: 11px; left: 50%; transform: translateX(-50%); border: 1px solid rgba(255,255,255,.24); border-radius: 999px; padding: 6px 11px; color: #fff; background: rgba(15,20,45,.72); backdrop-filter: blur(14px); font-size: 9px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; white-space: nowrap; }
    #nantty-mobile-demo-caption { position: absolute; left: 5%; right: 5%; bottom: 11%; padding: 12px 14px; color: white; border: 1px solid rgba(255,255,255,.2); border-radius: 14px; background: linear-gradient(110deg,rgba(13,20,43,.94),rgba(24,29,63,.82)); box-shadow: 0 12px 34px #10132644; backdrop-filter: blur(14px); opacity: 0; transform: translateY(9px); transition: opacity .32s ease,transform .32s ease; }
    #nantty-mobile-demo-caption.show { opacity: 1; transform: translateY(0); }
    #nantty-mobile-demo-kicker { color: #aab1ff; font-size: 8px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
    #nantty-mobile-demo-title { margin: 0; font-size: 17px; line-height: 1.12; letter-spacing: -.03em; font-weight: 750; }
    #nantty-mobile-demo-copy { margin: 4px 0 0; color: rgba(255,255,255,.84); font-size: 10px; line-height: 1.35; }
    #nantty-mobile-demo-transition { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; background: radial-gradient(ellipse at 52% 46%,#5365ff 0%,#2633b7 25%,#141a3c 62%,#0d1229 100%); transition: opacity .42s ease; }
    #nantty-mobile-demo-transition.show { opacity: 1; }
    #nantty-mobile-demo-transition img { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 12px 28px #6877ff7a); animation: nantty-mobile-pulse 1.2s ease-in-out infinite alternate; }
    @keyframes nantty-mobile-pulse { to { transform: scale(1.08); filter: drop-shadow(0 14px 32px #aab2ffad); } }
    #nantty-mobile-demo-intro { position: absolute; inset: 0; display: grid; place-items: center; color: white; background: radial-gradient(ellipse at 50% 44%,#4755e9 0%,#252d9c 29%,#131a3a 65%,#0c1125 100%); opacity: 0; transition: opacity .55s ease; }
    #nantty-mobile-demo-intro.show { opacity: 1; }
    #nantty-mobile-demo-intro-inner { display:flex; flex-direction:column; align-items:center; text-align:center; transform: translateY(12px); transition: transform .6s ease; padding: 22px; }
    #nantty-mobile-demo-intro.show #nantty-mobile-demo-intro-inner { transform: translateY(0); }
    #nantty-mobile-demo-intro img { width: 78px; height: 78px; object-fit: contain; margin-bottom: 20px; filter: drop-shadow(0 12px 30px #8791ff84); }
    #nantty-mobile-demo-intro h1 { margin:0; font-size:54px; line-height:1; letter-spacing:-.06em; font-weight:800; }
    #nantty-mobile-demo-intro p { margin:13px 0 0; color:#dfe3ff; font-size:14px; line-height:1.45; }
    #nantty-mobile-demo-intro small { margin-top:30px; color:#c2c8ff; font-size:9px; letter-spacing:.15em; font-weight:700; text-transform:uppercase; }
    @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  ` });
  await page.evaluate((logo) => {
    const overlay = document.createElement("div");
    overlay.id = "nantty-mobile-demo";
    overlay.innerHTML = `
      <div id="nantty-mobile-demo-badge">Mobile app · local preview · sample data</div>
      <div id="nantty-mobile-demo-caption"><div id="nantty-mobile-demo-kicker">Nantty · Mobile experience</div><h2 id="nantty-mobile-demo-title"></h2><p id="nantty-mobile-demo-copy"></p></div>
      <div id="nantty-mobile-demo-transition"><img src="${logo}" alt="Nantty"></div>
      <div id="nantty-mobile-demo-intro"><div id="nantty-mobile-demo-intro-inner"><img src="${logo}" alt=""><h1>Nantty</h1><p>People, creators and commerce<br>in one connected app.</p><small>Mobile product walkthrough · prelaunch preview</small></div></div>`;
    document.body.append(overlay);
  }, logoDataUri);
}

async function caption(page, title, copy, duration = 3000) {
  await page.evaluate(({ title, copy }) => {
    document.querySelector("#nantty-mobile-demo-title").textContent = title;
    document.querySelector("#nantty-mobile-demo-copy").textContent = copy;
    document.querySelector("#nantty-mobile-demo-caption").classList.add("show");
  }, { title, copy });
  await sleep(duration);
  await page.evaluate(() => document.querySelector("#nantty-mobile-demo-caption").classList.remove("show"));
  await sleep(300);
}

async function transition(page, action) {
  await page.evaluate(() => document.querySelector("#nantty-mobile-demo-transition").classList.add("show"));
  await sleep(420);
  await action();
  await sleep(800);
  await page.evaluate(() => document.querySelector("#nantty-mobile-demo-transition").classList.remove("show"));
  await sleep(450);
}

async function main() {
  if (!origin.startsWith("http://localhost:") && !origin.startsWith("http://127.0.0.1:")) {
    throw new Error("For safety, the mobile demo recorder only accepts a local HTTP origin.");
  }
  await mkdir(path.dirname(output), { recursive: true });
  const logo = await readFile(logoPath);
  const logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;
  const browser = await chromium.launch({ headless: true, executablePath: process.env.NANTTY_DEMO_CHROMIUM || undefined });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    reducedMotion: "no-preference",
    locale: "en-NG",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => console.error(`[mobile preview page error] ${error.message}`));
  let isRecording = false;

  try {
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Use email" }).waitFor({ state: "visible" });
    await installPresentation(page, logoDataUri);
    await page.screencast.start({ path: output, size: { width: 390, height: 844 }, fps: 24 });
    isRecording = true;
    await page.evaluate(() => document.querySelector("#nantty-mobile-demo-intro").classList.add("show"));
    await sleep(2200);
    await page.evaluate(() => document.querySelector("#nantty-mobile-demo-intro").classList.remove("show"));
    await sleep(500);
    await caption(page, "Your day, connected", "A mobile-first home for discovery, conversations and commerce.", 2400);

    await page.getByText("Log in", { exact: true }).click();
    await page.getByRole("button", { name: "Use email" }).click();
    await caption(page, "A sample sign-in", "This walkthrough uses the app’s local mock services only.", 1800);
    await page.locator("input").nth(0).fill("founder@nantty.com");
    await page.locator("input").nth(1).fill("sample-only");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.getByRole("tab", { name: "Home" }).waitFor({ state: "visible" });
    await sleep(1800);
    const dismissNotice = page.getByRole("button", { name: /dismiss this notice/i });
    if (await dismissNotice.isVisible().catch(() => false)) await dismissNotice.click();
    await caption(page, "A live, personalized feed", "Stories, posts and community Spaces meet in one scroll.", 3600);

    await transition(page, () => page.getByRole("tab", { name: "Mart" }).click({ force: true }));
    await caption(page, "Shop without leaving the app", "Discover stores and products with buyer protections built into checkout.", 3300);
    await transition(page, () => page.getByRole("button", { name: "Explore Nantty Spaces" }).click({ force: true }));
    await caption(page, "Find the conversation", "Browse creator-hosted, voice-only Spaces and upcoming sessions.", 3300);
    await transition(page, () => page.getByRole("button", { name: /The creative check-in, join live Space/ }).click({ force: true }));
    await caption(page, "Listen in, voice first", "A sample listener view. The audio room is mocked; no microphone or live broadcast starts.", 3500);
    await transition(page, () => page.getByRole("button", { name: "Back" }).click({ force: true }));
    await transition(page, () => page.getByRole("button", { name: "Back" }).click({ force: true }));
    await transition(page, () => page.getByRole("tab", { name: "Clips" }).click({ force: true }));
    await caption(page, "Short-form video", "Explore clips and creator stories in a full-screen mobile flow.", 3000);
    await transition(page, () => page.getByRole("tab", { name: "Chats" }).click({ force: true }));
    await caption(page, "Conversations that stay close", "Keep community and buyer–seller messages within easy reach.", 3000);
    await transition(page, () => page.getByRole("tab", { name: "Profile" }).click({ force: true }));
    await caption(page, "Your profile, your identity", "Personal presence and creator tools are part of the same app.", 3000);
    await transition(page, () => page.getByRole("tab", { name: "Create" }).click({ force: true }));
    await caption(page, "Create when inspiration hits", "The post composer opens from the central create action. This draft stays unpublished.", 3400);

    await page.evaluate(() => {
      document.querySelector("#nantty-mobile-demo-intro-inner h1").textContent = "Nantty";
      document.querySelector("#nantty-mobile-demo-intro-inner p").innerHTML = "Discover. Connect. Create.<br>All from your phone.";
      document.querySelector("#nantty-mobile-demo-intro-inner small").textContent = "Mobile app walkthrough · local preview";
      document.querySelector("#nantty-mobile-demo-intro").classList.add("show");
    });
    await sleep(2500);
  } finally {
    if (isRecording) await page.screencast.stop().catch((error) => console.error(`[capture stop] ${error.message}`));
    await context.close();
    await browser.close();
  }
  console.log(`Saved ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
