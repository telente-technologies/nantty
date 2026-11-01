import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "services/scripts/browserE2e/package.json"));
const { chromium } = require(process.env.NANTTY_PLAYWRIGHT_MODULE ?? "@playwright/test");
const origin = process.env.NANTTY_DEMO_ORIGIN ?? "http://localhost:3500";
const output = path.resolve(root, process.env.NANTTY_DEMO_OUTPUT ?? "deliverables/nantty-app-walkthrough.webm");

const scenes = [
  ["/", "A social feed made for everyday life", "Follow people, discover ideas and keep the conversation moving."],
  ["/explore", "Find what matters to you", "Explore conversations, creators and what is trending."],
  ["/mart", "Discover products from real stores", "Browse offers and shop with escrow protection built into the journey."],
  ["/p/ankara-wrap-midi-dress-pr_f1", "From a post to a product", "Product details, seller information and buyer protections in one place."],
  ["/adaeze.styles", "People and businesses, together", "A creator profile can connect naturally to the store behind it."],
  ["/stories", "Stories keep the moment moving", "Quick updates from the people and businesses you follow."],
  ["/spaces", "Make room for live conversation", "Audio-first community sessions are easy to find and join."],
  ["/spaces/space_demo_live", "Listen in, voice only", "A sample live room preview. No broadcast is started in this walkthrough."],
  ["/chats", "Take the conversation to private messages", "Keep buyer and seller conversations alongside the rest of the experience."],
  ["/chats/c_2", "A clearer path from question to update", "An example buyer conversation using local sample data."],
  ["/creator", "Creators get a home for their work", "See audience, earnings and content performance in one dashboard."],
  ["/post/new", "Share the next idea", "Create a post, clip or live announcement. This demo leaves it unpublished."],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function installPresentation(page) {
  await page.addStyleTag({ content: `
    nextjs-portal { display: none !important; }
    #nantty-demo-hud { position: fixed; z-index: 2147483000; inset: 0; pointer-events: none; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    #nantty-demo-label { position: absolute; top: 22px; left: 50%; transform: translateX(-50%); border: 1px solid rgba(255,255,255,.23); border-radius: 999px; padding: 8px 15px; color: #fff; background: rgba(13,20,43,.76); backdrop-filter: blur(16px); font-size: 11px; font-weight: 750; letter-spacing: .12em; text-transform: uppercase; box-shadow: 0 8px 30px #1115; }
    #nantty-demo-lower { position: absolute; left: 5.5%; bottom: 6%; max-width: min(720px, 78vw); padding: 22px 28px 23px; color: white; border: 1px solid rgba(255,255,255,.24); border-radius: 18px; background: linear-gradient(110deg,rgba(13,20,43,.92),rgba(24,29,63,.78)); box-shadow: 0 18px 58px #10132655; backdrop-filter: blur(18px); opacity: 0; transform: translateY(14px); transition: opacity .48s ease,transform .48s ease; }
    #nantty-demo-lower.show { opacity: 1; transform: translateY(0); }
    #nantty-demo-kicker { color: #9da6ff; font-size: 11px; font-weight: 800; letter-spacing: .15em; text-transform: uppercase; margin-bottom: 8px; }
    #nantty-demo-title { margin: 0; font-size: 27px; line-height: 1.15; letter-spacing: -.03em; font-weight: 750; }
    #nantty-demo-copy { margin: 9px 0 0; color: rgba(255,255,255,.82); font-size: 14px; line-height: 1.5; }
    #nantty-demo-transition { position: absolute; inset: 0; display: grid; place-items: center; opacity: 0; background: radial-gradient(ellipse at 52% 46%,#5365ff 0%,#2633b7 25%,#141a3c 62%,#0d1229 100%); transition: opacity .6s ease; }
    #nantty-demo-transition.show { opacity: 1; }
    #nantty-demo-transition img { width: 82px; height: 82px; object-fit: contain; filter: drop-shadow(0 14px 34px #6877ff7a); animation: nantty-pulse 1.35s ease-in-out infinite alternate; }
    @keyframes nantty-pulse { to { transform: scale(1.08); filter: drop-shadow(0 18px 40px #aab2ffad); } }
    #nantty-demo-intro { position: absolute; inset: 0; display: grid; place-items: center; color: white; background: radial-gradient(ellipse at 50% 44%,#4755e9 0%,#252d9c 29%,#131a3a 65%,#0c1125 100%); opacity: 0; transition: opacity .7s ease; }
    #nantty-demo-intro.show { opacity: 1; }
    #nantty-demo-intro-inner { display:flex; flex-direction:column; align-items:center; text-align:center; transform: translateY(16px); transition: transform .8s ease; }
    #nantty-demo-intro.show #nantty-demo-intro-inner { transform: translateY(0); }
    #nantty-demo-intro img { width: 92px; height: 92px; object-fit: contain; margin-bottom: 25px; filter: drop-shadow(0 14px 34px #8791ff84); }
    #nantty-demo-intro h1 { margin:0; font-size:64px; line-height:1; letter-spacing:-.06em; font-weight:800; }
    #nantty-demo-intro p { margin:16px 0 0; color:#dfe3ff; font-size:18px; letter-spacing:.01em; }
    #nantty-demo-intro small { margin-top:40px; color:#c2c8ff; font-size:11px; letter-spacing:.18em; font-weight:700; text-transform:uppercase; }
    @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
  ` });
  await page.evaluate(() => {
    const hud = document.createElement("div");
    hud.id = "nantty-demo-hud";
    hud.innerHTML = `
      <div id="nantty-demo-label">Local preview · sample data · simulated actions</div>
      <div id="nantty-demo-lower"><div id="nantty-demo-kicker">Nantty · the social commerce experience</div><h2 id="nantty-demo-title"></h2><p id="nantty-demo-copy"></p></div>
      <div id="nantty-demo-transition"><img src="/brand/nantty-icon.png" alt="Nantty"></div>
      <div id="nantty-demo-intro"><div id="nantty-demo-intro-inner"><img src="/brand/nantty-icon.png" alt=""><h1>Nantty</h1><p>Where people, creators and commerce connect.</p><small>Product walkthrough · local preview</small></div></div>`;
    document.body.append(hud);
  });
}

async function showCaption(page, title, copy) {
  await page.evaluate(({ title, copy }) => {
    document.querySelector("#nantty-demo-title").textContent = title;
    document.querySelector("#nantty-demo-copy").textContent = copy;
    document.querySelector("#nantty-demo-lower").classList.add("show");
  }, { title, copy });
  await sleep(4600);
  await page.evaluate(() => document.querySelector("#nantty-demo-lower").classList.remove("show"));
  await sleep(500);
}

async function main() {
  if (!origin.startsWith("http://localhost:") && !origin.startsWith("http://127.0.0.1:")) {
    throw new Error("For safety, this demo recorder only accepts a local HTTP origin.");
  }
  await mkdir(path.dirname(output), { recursive: true });

  const browser = await chromium.launch({ headless: true, executablePath: process.env.NANTTY_DEMO_CHROMIUM || undefined });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", (error) => console.error(`[browser page error] ${error.message}`));
  let isRecording = false;

  try {
    await page.goto(`${origin}/login`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="identifier"]').waitFor({ state: "visible" });
    await installPresentation(page);
    await page.screencast.start({ path: output, size: { width: 1440, height: 900 }, fps: 30 });
    isRecording = true;
    await page.evaluate(() => document.querySelector("#nantty-demo-intro").classList.add("show"));
    await sleep(3200);
    await page.evaluate(() => document.querySelector("#nantty-demo-intro").classList.remove("show"));
    await sleep(700);
    await showCaption(page, "One connected place for your next chapter", "A preview of the Nantty app · no real account or purchase is used.");

    const rejectCookies = page.getByRole("button", { name: /reject optional/i });
    if (await rejectCookies.isVisible().catch(() => false)) await rejectCookies.click();
    await page.locator('input[name="identifier"]').fill("demo@nantty.com");
    await page.locator('input[name="password"]').fill("Local-preview-only-0000");
    await showCaption(page, "A sample sign-in, safely simulated", "This local mock accepts sample Nantty identities. Nothing is sent to a live service.");
    await page.getByRole("button", { name: "Log in" }).click();
    await page.waitForURL((url) => url.pathname === "/", { timeout: 12000 });
    await sleep(1800);
    const dismissNotice = page.getByRole("button", { name: /dismiss this notice/i });
    if (await dismissNotice.isVisible().catch(() => false)) await dismissNotice.click();
    await showCaption(page, ...scenes[0].slice(1));

    for (const [route, title, copy] of scenes.slice(1)) {
      await page.evaluate(() => document.querySelector("#nantty-demo-transition").classList.add("show"));
      await sleep(480);
      await page.goto(`${origin}${route}`, { waitUntil: "domcontentloaded" });
      await installPresentation(page);
      await page.waitForLoadState("networkidle", { timeout: 1800 }).catch(() => undefined);
      await sleep(3800);
      await page.evaluate(() => document.querySelector("#nantty-demo-transition").classList.remove("show"));
      await sleep(600);
      await showCaption(page, title, copy);
    }

    await page.evaluate(() => document.querySelector("#nantty-demo-transition").classList.add("show"));
    await sleep(550);
    await page.evaluate(() => {
      document.querySelector("#nantty-demo-intro-inner h1").textContent = "Nantty";
      document.querySelector("#nantty-demo-intro-inner p").textContent = "Discover. Connect. Create. Trade with confidence.";
      document.querySelector("#nantty-demo-intro-inner small").textContent = "A product walkthrough · prelaunch preview";
      document.querySelector("#nantty-demo-intro").classList.add("show");
      document.querySelector("#nantty-demo-transition").classList.remove("show");
    });
    await sleep(3600);
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
