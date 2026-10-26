import assert from "node:assert/strict";
import { register } from "node:module";
import { resolve } from "node:path";
import { before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { createElement, type ComponentType, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type Screens = {
  readonly NotFoundPage: ComponentType;
  readonly SectionNotFound: ComponentType;
  readonly RootRouteError: ComponentType<{ readonly error: Error & { readonly digest?: string }; readonly retry: () => void }>;
  readonly withExperience: (child: ReactElement) => ReactElement;
};

let screens: Screens;

before(async () => {
  register(pathToFileURL(resolve(process.cwd(), "../../packages/webKit/src/dialog/__tests__/cssStub.loader.mjs")).href);
  const { ErrorExperienceProvider } = await import("@nantty/web-kit");
  const { adminErrorExperience } = await import("@/components/errors/errorExperience.provider");
  screens = {
    NotFoundPage: (await import("@/app/not-found")).default,
    SectionNotFound: (await import("@/app/(console)/not-found")).default,
    RootRouteError: (await import("@/app/error")).default,
    withExperience: (child) => createElement(ErrorExperienceProvider, { value: adminErrorExperience }, child),
  };
});

describe("error screens", () => {
  it("renders the 404 page with a focused title, hero and dashboard destinations", () => {
    const html = renderToStaticMarkup(screens.withExperience(createElement(screens.NotFoundPage)));
    assert.match(html, /<h1[^>]*tabindex="-1"[^>]*>This console page doesn&#x27;t exist<\/h1>/);
    assert.match(html, />404</);
    assert.match(html, /href="\/users"/);
    assert.doesNotMatch(html, /something went wrong/i);
  });

  it("renders the section not-found inside the workspace", () => {
    assert.match(renderToStaticMarkup(screens.withExperience(createElement(screens.SectionNotFound))), /We couldn&#x27;t find that/);
  });

  it("shows a crashed route as a server error with its reference, not the raw message", () => {
    const error = Object.assign(new Error("secret stack detail"), { digest: "abc123" });
    const html = renderToStaticMarkup(screens.withExperience(createElement(screens.RootRouteError, { error, retry: () => undefined })));
    assert.match(html, /Something broke on our side/);
    assert.match(html, /Ref abc123/);
    assert.doesNotMatch(html, /secret stack detail/);
  });
});
