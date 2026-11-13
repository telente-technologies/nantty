/** @jsxRuntime automatic @jsxImportSource react */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, it } from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { createConfirmationStore } from "../confirmation.store";
import { ConfirmDialogView } from "../confirmDialog";
import { Dialog, respondToNativeClose } from "../dialog";
import { nextTrappedFocus } from "../dialogFocus.util";
import { dialogIntents, dialogIntentTone } from "../dialogIntent";
import { shouldDismissSheetDrag } from "../sheetDrag.hook";

const noop = () => undefined;

describe("focus trap", () => {
  const [first, middle, last] = ["first", "middle", "last"];
  const focusable = [first, middle, last];

  it("wraps Tab from the last element to the first", () => assert.equal(nextTrappedFocus(focusable, last, false), first));
  it("wraps Shift+Tab from the first element to the last", () => assert.equal(nextTrappedFocus(focusable, first, true), last));
  it("pulls focus back in when it escaped the dialog", () => assert.equal(nextTrappedFocus(focusable, "outside", false), first));
  it("lets the browser move focus between inner elements", () => assert.equal(nextTrappedFocus(focusable, middle, false), null));
  it("keeps focus put when nothing inside can take it", () => assert.equal(nextTrappedFocus([], null, false), "stay"));
});

describe("Dialog markup", () => {
  it("is labelled by its title and described by its body", () => {
    const html = renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Delete post?" description="This can't be undone." intent="delete" />);
    const labelledBy = /aria-labelledby="([^"]+)"/.exec(html)?.[1];
    const describedBy = /aria-describedby="([^"]+)"/.exec(html)?.[1];
    assert.ok(labelledBy && html.includes(`<h2 id="${labelledBy}"`));
    assert.ok(describedBy && html.includes(`id="${describedBy}"`));
    assert.match(html, /aria-modal="true"/);
  });

  it("derives the danger tone and icon from a destructive intent", () => {
    const html = renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Delete post?" intent="delete" />);
    assert.match(html, /data-tone="danger"/);
    assert.match(html, /data-part="icon"/);
  });

  it("uses an explicitly provided brand mark without rendering the generic intent glyph", () => {
    const html = renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Sign in to Nantty" intent="signIn" icon={<span data-testid="nantty-brand">Nantty</span>} hideIntentIcon plainIcon />);
    assert.match(html, /data-testid="nantty-brand"/);
    assert.doesNotMatch(html, /data-icon="signIn"/);
    assert.match(html, /data-icon-presentation="plain"/);
    assert.match(html, /class="[^"]*iconPlain/);
  });

  it("renders the destructive action with the danger variant", () => {
    const html = renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Block Ada?" intent="block" actions={[{ label: "Block", variant: "danger", onClick: noop }, { label: "Cancel", onClick: noop }]} />);
    assert.match(html, /<button[^>]*data-variant="danger"/);
  });

  it("shows a close button only when dismissible", () => {
    assert.match(renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Info" />), /aria-label="Close"/);
    assert.doesNotMatch(renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Info" dismissible={false} />), /aria-label="Close"/);
  });

  it("locks every control while the primary action is loading", () => {
    const html = renderToStaticMarkup(
      <Dialog isOpen onClose={noop} title="Withdraw?" intent="stepUp" actions={[{ label: "Withdraw", variant: "primary", busy: true, onClick: noop }, { label: "Cancel", onClick: noop }]} />,
    );
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    assert.equal(buttons.length, 3);
    assert.ok(buttons.every((button) => button.includes("disabled")));
    assert.match(html, /aria-busy="true"/);
  });

  it("shows errors inline as an alert", () => {
    const html = renderToStaticMarkup(<Dialog isOpen onClose={noop} title="Remove?" errorMessage="Network down" />);
    assert.match(html, /role="alert"[^>]*>.*Network down/);
  });
});

describe("confirmation store", () => {
  it("resolves false when cancelled (Esc, scrim or Cancel)", async () => {
    const store = createConfirmationStore();
    const answer = store.request({ title: "Unfollow?", confirmLabel: "Unfollow", intent: "unfollow" });
    store.cancel();
    assert.equal(await answer, false);
    assert.equal(store.getSnapshot().isOpen, false);
  });

  it("runs onConfirm once even when pressed twice", async () => {
    const store = createConfirmationStore();
    let calls = 0;
    let release: () => void = noop;
    const answer = store.request({ title: "Delete?", confirmLabel: "Delete", onConfirm: () => new Promise<void>((resolve) => { calls += 1; release = resolve; }) });
    const firstPress = store.confirm();
    void store.confirm();
    assert.equal(store.getSnapshot().isSubmitting, true);
    store.cancel();
    assert.equal(store.getSnapshot().isOpen, true, "cannot be dismissed while submitting");
    release();
    await firstPress;
    assert.equal(calls, 1);
    assert.equal(await answer, true);
  });

  it("keeps the dialog open with an inline error when the action fails", async () => {
    const store = createConfirmationStore();
    void store.request({ title: "Remove?", confirmLabel: "Remove", onConfirm: () => Promise.reject(new Error("Network down")) });
    await store.confirm();
    const snapshot = store.getSnapshot();
    assert.equal(snapshot.isOpen, true);
    assert.equal(snapshot.isSubmitting, false);
    assert.equal(snapshot.errorMessage, "Network down");
    const html = renderToStaticMarkup(<ConfirmDialogView snapshot={snapshot} store={store} />);
    assert.match(html, /role="alertdialog"/);
    assert.match(html, /Network down/);
  });

  it("settles an older request as cancelled when a new one opens", async () => {
    const store = createConfirmationStore();
    const older = store.request({ title: "One", confirmLabel: "OK" });
    void store.request({ title: "Two", confirmLabel: "OK" });
    assert.equal(await older, false);
    assert.equal(store.getSnapshot().pending?.title, "Two");
  });
});

describe("intents and sheets", () => {
  it("maps destructive intents to the danger tone", () => {
    for (const intent of ["delete", "deleteAccount", "block", "unfollow"] as const) assert.equal(dialogIntentTone(intent), "danger");
    assert.equal(dialogIntentTone("stepUp"), "brand");
    assert.ok(dialogIntents.includes("share") && dialogIntents.includes("boost"));
  });

  it("dismisses a sheet on a long or fast drag only", () => {
    assert.equal(shouldDismissSheetDrag(120, 400), true);
    assert.equal(shouldDismissSheetDrag(40, 20), true);
    assert.equal(shouldDismissSheetDrag(40, 400), false);
  });
});

function loadJsdom(): { JSDOM: new (html: string, options?: object) => { window: Window & typeof globalThis } } | null {
  try {
    return createRequire(import.meta.url)("jsdom");
  } catch {
    return null;
  }
}

const jsdom = loadJsdom();

describe("Dialog in a DOM", { skip: jsdom ? false : "jsdom is not installed" }, () => {
  it("closes on Esc, traps Tab and restores focus on close", async () => {
    const { window } = new jsdom!.JSDOM("<!doctype html><button id='opener'>Open</button><div id='root'></div>", { pretendToBeVisual: true });
    Object.assign(globalThis, { window, document: window.document, HTMLElement: window.HTMLElement, IS_REACT_ACT_ENVIRONMENT: true });
    Object.defineProperty(window.HTMLElement.prototype, "offsetParent", { get: () => window.document.body });
    window.matchMedia = (() => ({ matches: true, addEventListener: noop, removeEventListener: noop })) as unknown as typeof window.matchMedia;
    try {
      const { act } = await import("react");
      const { createRoot } = await import("react-dom/client");
      const opener = window.document.getElementById("opener") as HTMLButtonElement;
      opener.focus();
      let closes = 0;
      const root = createRoot(window.document.getElementById("root") as HTMLElement);
      const render = (isOpen: boolean) => root.render(<Dialog isOpen={isOpen} onClose={() => (closes += 1)} title="Delete post?" intent="delete" actions={[{ label: "Delete", variant: "danger", onClick: noop }, { label: "Cancel", onClick: noop, isInitialFocus: true }]} />);
      await act(async () => render(true));
      const dialog = window.document.querySelector("dialog") as HTMLDialogElement;
      assert.equal(window.document.activeElement?.textContent, "Cancel", "initial focus lands on the safe action");
      const buttons = Array.from(dialog.querySelectorAll("button"));
      (buttons.at(-1) as HTMLButtonElement).focus();
      const tab = new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
      await act(async () => void dialog.dispatchEvent(tab));
      assert.equal(tab.defaultPrevented, true);
      assert.equal(window.document.activeElement, buttons[0]);
      await act(async () => void dialog.dispatchEvent(new window.Event("cancel", { cancelable: true })));
      assert.equal(closes, 1, "Esc (the dialog cancel event) asks to close");
      await act(async () => render(false));
      await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
      assert.equal(window.document.activeElement, opener, "focus returns to what opened it");
      await act(async () => root.unmount());
    } finally {
      window.close();
    }
  });
});

describe("native close (browser closes the dialog itself, e.g. a second Escape)", () => {
  it("reports the close to the owner when the dialog may be dismissed", () => assert.equal(respondToNativeClose(true, false, true), "close"));
  it("reopens a dialog that must not be dismissed so state and screen stay in sync", () => assert.equal(respondToNativeClose(true, false, false), "reopen"));
  it("ignores the close it triggered itself while animating out", () => {
    assert.equal(respondToNativeClose(false, true, true), "ignore");
    assert.equal(respondToNativeClose(true, true, false), "ignore");
  });
});
