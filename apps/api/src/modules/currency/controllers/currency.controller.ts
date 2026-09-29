import type { CommandBus, QueryBus } from "@zudojs/cqrs";
import type { HttpResponseContext, HttpRouterContext } from "@zudojs/http";

import { COUNTRY_CURRENCY_CODES, FALLBACK_CURRENCY_CODE } from "../../../configs/currency.config.js";
import { SUPPORTED_CURRENCY_CODES } from "../../../enums/currency.enum.js";
import type { LockedExchangeRate } from "../../../interfaces/currencyConverter.interface.js";
import { findViewerLocale } from "../../../middlewares/viewerLocale.middleware.js";
import { json } from "../../../utils/http.util.js";
import { RefreshExchangeRatesCommand } from "../commands/refreshExchangeRates/refreshExchangeRates.command.js";
import { convertExchangeRateToDto, convertViewerLocaleToDto } from "../dtos/currency.dto.js";
import type { ExchangeRateRecord } from "../models/currency.model.js";
import { ListExchangeRatesQuery } from "../queries/listExchangeRates/listExchangeRates.query.js";

export class CurrencyController {
  public constructor(private readonly commands: CommandBus, private readonly queries: QueryBus) {}

  public readonly getViewerLocale = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    return json(200, convertViewerLocaleToDto(findViewerLocale(ctx)));
  };

  public readonly listSupportedCountries = async (): Promise<HttpResponseContext> => {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    const countries = Object.entries(COUNTRY_CURRENCY_CODES)
      .map(([countryCode, currency]) => ({ countryCode, name: regionNames.of(countryCode) ?? countryCode, currency }))
      .sort((left, right) => left.name.localeCompare(right.name));
    return json(200, { countries, fallbackCurrency: FALLBACK_CURRENCY_CODE });
  };

  public readonly listCurrencies = async (ctx: HttpRouterContext): Promise<HttpResponseContext> => {
    const displayCurrency = findViewerLocale(ctx).currency;
    const rates = await this.queries.execute<ListExchangeRatesQuery, readonly LockedExchangeRate[]>(new ListExchangeRatesQuery(displayCurrency));
    return json(200, { displayCurrency, supportedCurrencies: SUPPORTED_CURRENCY_CODES, rates: rates.map(convertExchangeRateToDto) });
  };

  public readonly refreshExchangeRates = async (): Promise<HttpResponseContext> => {
    const records = await this.commands.execute<RefreshExchangeRatesCommand, readonly ExchangeRateRecord[]>(new RefreshExchangeRatesCommand());
    return json(200, { refreshed: records.length });
  };
}
