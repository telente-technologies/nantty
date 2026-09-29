import type { HttpRouter } from "@zudojs/http";

import type { WebKit } from "../../../loaders/web.loader.js";
import { describeRoute } from "../../../utils/openapi.util.js";
import type { CurrencyController } from "../controllers/currency.controller.js";

export function registerCurrencyRoutes(router: HttpRouter, controller: CurrencyController, web: WebKit): void {
  const { guard } = web;
  router.get("/api/v1/locale", controller.getViewerLocale, { ...guard.allowAnyone(), ...describeRoute("currency", "Get the viewer's country and display currency") });
  router.get("/api/v1/locale/countries", controller.listSupportedCountries, { ...guard.allowAnyone(), ...describeRoute("currency", "List supported countries and their currencies") });
  router.get("/api/v1/currencies", controller.listCurrencies, { ...guard.allowAnyone(), ...describeRoute("currency", "List supported currencies and rates into the display currency") });
  router.post("/api/v1/admin/exchange-rates/refresh", controller.refreshExchangeRates, { ...guard.requirePermission("exchange-rates:manage"), ...describeRoute("currency", "Refresh exchange rates now") });
}
