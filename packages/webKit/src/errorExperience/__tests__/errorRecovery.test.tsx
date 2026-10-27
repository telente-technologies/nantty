/** @jsxRuntime automatic @jsxImportSource react */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

type JsdomModule = { JSDOM: new (html: string, options?: object) => { window: Window & typeof globalThis } };

function loadJsdom(): JsdomModule | null {
  try {
    return createRequire(import.meta.url)("jsdom") as JsdomModule;
  } catch {
    return null;
  }
}

const jsdom = loadJsdom();

async function withDom(run: (window: Window & typeof globalThis, online: { value: boolean }) => Promise<void>): Promise<void> {
  const { window } = new jsdom!.JSDOM("<!doctype html><div id='root'></div>", { pretendToBeVisual: true, url: "https://nantty.test/" });
  const online = { value: true };
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => online.value });
  Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: window.navigator });
  try {
    await run(window, online);
  } finally {
    window.close();
  }
}

describe("error recovery in a DOM", { skip: jsdom ? false : "jsdom is not installed" }, () => {
  it("retries automatically and says so when the connection comes back", async () => {
    await withDom(async (window, online) => {
      const { act } = await import("react");
      const { createRoot } = await import("react-dom/client");
      const { ErrorState } = await import("../errorState");
      online.value = false;
      let retries = 0;
      const root = createRoot(window.document.getElementById("root") as HTMLElement);
      await act(async () => root.render(<ErrorState error={{ status: 0, code: "NETWORK_UNAVAILABLE" }} onRetry={() => (retries += 1)} />));
      assert.match(window.document.body.textContent ?? "", /You're offline/);
      online.value = true;
      await act(async () => void window.dispatchEvent(new window.Event("online")));
      assert.equal(retries, 1);
      assert.match(window.document.querySelector('[role="status"]')?.textContent ?? "", /back online/);
      await act(async () => root.unmount());
    });
  });

  it("shows a back-online toast after an offline spell", async () => {
    await withDom(async (window, online) => {
      const { act } = await import("react");
      const { createRoot } = await import("react-dom/client");
      const { ConnectionStatus } = await import("../../network/offlineBanner");
      online.value = false;
      const root = createRoot(window.document.getElementById("root") as HTMLElement);
      await act(async () => root.render(<ConnectionStatus />));
      assert.match(window.document.body.textContent ?? "", /You're offline/);
      online.value = true;
      await act(async () => void window.dispatchEvent(new window.Event("online")));
      assert.match(window.document.body.textContent ?? "", /You're back online/);
      await act(async () => root.unmount());
    });
  });

  it("re-enables retry when the Retry-After countdown ends", async () => {
    await withDom(async (window) => {
      const { act } = await import("react");
      const { createRoot } = await import("react-dom/client");
      const { ErrorState } = await import("../errorState");
      const root = createRoot(window.document.getElementById("root") as HTMLElement);
      await act(async () => root.render(<ErrorState error={{ status: 429, code: "RATE_LIMITED", retryAfterSeconds: 1 }} onRetry={() => undefined} />));
      const button = () => window.document.querySelector("button") as HTMLButtonElement;
      assert.equal(button().disabled, true);
      assert.match(button().textContent ?? "", /Try again in 0:01/);
      await act(async () => new Promise((resolve) => setTimeout(resolve, 1300)));
      assert.equal(button().disabled, false);
      assert.equal(button().textContent, "Try again");
      await act(async () => root.unmount());
    });
  });

  it("moves focus to the title of a full-page error", async () => {
    await withDom(async (window) => {
      const { act } = await import("react");
      const { createRoot } = await import("react-dom/client");
      const { ErrorScreen } = await import("../errorState");
      const root = createRoot(window.document.getElementById("root") as HTMLElement);
      await act(async () => root.render(<ErrorScreen kind="notFound" />));
      assert.equal(window.document.activeElement?.tagName, "H1");
      await act(async () => root.unmount());
    });
  });
});
