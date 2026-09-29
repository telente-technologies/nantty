import { Command } from "@zudojs/cqrs";

export class RefreshExchangeRatesCommand extends Command<"currency.refreshExchangeRates"> {
  public constructor() {
    super("currency.refreshExchangeRates");
  }
}
