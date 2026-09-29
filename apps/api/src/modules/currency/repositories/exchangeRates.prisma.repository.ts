import { isSupportedCurrencyCode } from "../../../enums/currency.enum.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { ExchangeRateRecord } from "../models/currency.model.js";
import type { ExchangeRatesRepository } from "./exchangeRates.repository.js";

export class PrismaExchangeRatesRepository implements ExchangeRatesRepository {
  public async listAll(): Promise<readonly ExchangeRateRecord[]> {
    const rows = await prisma().exchangeRate.findMany();
    return rows.flatMap((row) =>
      isSupportedCurrencyCode(row.currency)
        ? [{ currency: row.currency, scaledUnitsPerUsDollar: row.unitsPerUsDollar, source: row.source, fetchedAt: row.fetchedAt }]
        : [],
    );
  }

  public async replaceRates(rates: readonly ExchangeRateRecord[]): Promise<void> {
    await prisma().$transaction(
      rates.map((rate) =>
        prisma().exchangeRate.upsert({
          where: { currency: rate.currency },
          create: { currency: rate.currency, unitsPerUsDollar: rate.scaledUnitsPerUsDollar, source: rate.source, fetchedAt: rate.fetchedAt },
          update: { unitsPerUsDollar: rate.scaledUnitsPerUsDollar, source: rate.source, fetchedAt: rate.fetchedAt },
        }),
      ),
    );
  }
}
