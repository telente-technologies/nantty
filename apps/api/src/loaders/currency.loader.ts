import type { IpCountryLookup } from "../interfaces/viewerLocale.interface.js";
import type { UserDirectory } from "../interfaces/userDirectory.interface.js";
import type { ScheduledJob } from "../jobs/scheduledJobs.job.js";
import { createViewerLocaleMiddleware } from "../middlewares/viewerLocale.middleware.js";
import { CurrencyController } from "../modules/currency/controllers/currency.controller.js";
import { registerCurrencyCommandAndQueryHandlers } from "../modules/currency/currency.module.js";
import { PrismaExchangeRatesRepository } from "../modules/currency/repositories/exchangeRates.prisma.repository.js";
import { InMemoryExchangeRatesRepository } from "../modules/currency/repositories/exchangeRates.repository.js";
import {
  OpenExchangeRatesApiProvider,
  StaticExchangeRateProvider,
  type ExchangeRateProvider,
} from "../modules/currency/services/exchangeRateProvider.service.js";
import { ExchangeRatesService } from "../modules/currency/services/exchangeRates.service.js";
import { LayeredViewerLocaleResolver } from "../modules/currency/services/viewerLocale.service.js";
import type { Core } from "./core.loader.js";

export interface CurrencyExternalServices {
  readonly exchangeRateProvider?: ExchangeRateProvider;
  readonly ipCountryLookup?: IpCountryLookup;
}

export function createCurrencyModule(core: Core, userDirectory: UserDirectory, external: CurrencyExternalServices) {
  const provider =
    external.exchangeRateProvider ??
    (core.settings.exchangeRates.provider === "open-exchange-rates-api" ? new OpenExchangeRatesApiProvider() : new StaticExchangeRateProvider());
  const repository = core.persistence === "prisma" ? new PrismaExchangeRatesRepository() : new InMemoryExchangeRatesRepository();
  const exchangeRates = new ExchangeRatesService(repository, provider, core.clock);
  registerCurrencyCommandAndQueryHandlers(core.commands, core.queries, exchangeRates);
  const localeResolver = new LayeredViewerLocaleResolver(userDirectory, core.settings.locale.trustedCountryHeader, external.ipCountryLookup);
  const refreshJob: ScheduledJob = {
    id: "exchange-rate-refresh",
    every: `${Math.max(1, core.settings.exchangeRates.refreshIntervalMinutes)}m`,
    run: async () => {
      await exchangeRates.refreshExchangeRatesFromProvider();
    },
  };
  return {
    currencyConverter: exchangeRates,
    resolveViewerLocale: createViewerLocaleMiddleware(localeResolver),
    scheduledJobs: [refreshJob] as readonly ScheduledJob[],
    currencyController: new CurrencyController(core.commands, core.queries),
  };
}
