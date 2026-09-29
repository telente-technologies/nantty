import type { HttpMiddleware, HttpRouterContext } from "@zudojs/http";

import { FALLBACK_CURRENCY_CODE } from "../configs/currency.config.js";
import type { Principal } from "../interfaces/principal.interface.js";
import type { ViewerLocale, ViewerLocaleResolver } from "../interfaces/viewerLocale.interface.js";

const VIEWER_LOCALE = "viewerLocale";

export const UNKNOWN_VIEWER_LOCALE: ViewerLocale = {
  countryCode: null,
  currency: FALLBACK_CURRENCY_CODE,
  isCountrySupported: false,
  source: "unknown",
};

export function createViewerLocaleMiddleware(resolver: ViewerLocaleResolver): HttpMiddleware {
  return async (context, next) => {
    const principal = context.state.get<Principal>("principal");
    const locale = await resolver.resolveViewerLocale({
      userId: principal?.userId,
      remoteAddress: context.request.remoteAddress,
      readHeader: (name) => context.request.getHeader(name),
    });
    context.state.set(VIEWER_LOCALE, locale);
    return next();
  };
}

export function findViewerLocale(ctx: HttpRouterContext): ViewerLocale {
  return (ctx.state.get(VIEWER_LOCALE) as ViewerLocale | undefined) ?? UNKNOWN_VIEWER_LOCALE;
}
