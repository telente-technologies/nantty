import { unprocessable } from "../../../errors/domain.error.js";
import type { AdRevenueShareCredit, AdvertiserAccount, AdvertiserBilling, AdvertiserCharge } from "../../../interfaces/advertiserBilling.interface.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import { Money } from "../../../utils/money.util.js";
import { MonetizationLedgerAccounts } from "../constants/monetizationLedgerAccounts.constant.js";
import type { LedgerAccountSpecification } from "../models/wallets.model.js";
import { LedgerAccounts, type LedgerService } from "./ledger.service.js";

function findAdvertiserWalletAccount(advertiser: AdvertiserAccount, currency: Money["currency"]): LedgerAccountSpecification {
  return advertiser.type === "store" ? LedgerAccounts.storeWallet(advertiser.id, currency) : LedgerAccounts.userWallet(advertiser.id, currency);
}

function assertPositiveAmount(amount: Money): void {
  if (amount.amountMinor <= 0) throw unprocessable("Advertising amounts must be positive.");
}

export class LedgerAdvertiserBilling implements AdvertiserBilling {
  public constructor(private readonly ledger: LedgerService, private readonly audit: AuditRecorder) {}

  public async chargeAdvertiserWallet(charge: AdvertiserCharge): Promise<void> {
    assertPositiveAmount(charge.amount);
    const { amountMinor, currency } = charge.amount;
    const posted = await this.ledger.postLedgerTransaction({
      reference: `ads-charge:${charge.reference}`,
      kind: "ads_charge",
      description: charge.description,
      lines: [
        { account: findAdvertiserWalletAccount(charge.advertiser, currency), direction: "debit", amount: amountMinor, currency },
        { account: MonetizationLedgerAccounts.adsRevenue(currency), direction: "credit", amount: amountMinor, currency },
      ],
    });
    if (posted.created) await this.recordAudit("ads.advertiser_charged", charge);
  }

  public async refundAdvertiserWallet(charge: AdvertiserCharge): Promise<void> {
    assertPositiveAmount(charge.amount);
    const { amountMinor, currency } = charge.amount;
    const posted = await this.ledger.postLedgerTransaction({
      reference: `ads-refund:${charge.reference}`,
      kind: "ads_refund",
      description: charge.description,
      lines: [
        { account: MonetizationLedgerAccounts.adsRevenue(currency), direction: "debit", amount: amountMinor, currency },
        { account: findAdvertiserWalletAccount(charge.advertiser, currency), direction: "credit", amount: amountMinor, currency },
      ],
    });
    if (posted.created) await this.recordAudit("ads.advertiser_refunded", charge);
  }

  public async findAdvertiserWalletBalance(advertiser: AdvertiserAccount, currency: Money["currency"]): Promise<Money> {
    return Money.of(await this.ledger.readAccountBalance(findAdvertiserWalletAccount(advertiser, currency)), currency);
  }

  public async creditCreatorAdRevenueShare(credit: AdRevenueShareCredit): Promise<void> {
    assertPositiveAmount(credit.amount);
    const { amountMinor, currency } = credit.amount;
    const posted = await this.ledger.postLedgerTransaction({
      reference: `ads-revenue-share:${credit.reference}`,
      kind: "ads_revenue_share",
      description: "Creator share of advertising revenue",
      lines: [
        { account: MonetizationLedgerAccounts.adsRevenue(currency), direction: "debit", amount: amountMinor, currency },
        { account: LedgerAccounts.userWallet(credit.creatorUserId, currency), direction: "credit", amount: amountMinor, currency },
      ],
    });
    if (posted.created) {
      await this.audit.record({
        actorId: null, action: "ads.creator_revenue_share_credited", entityType: "user", entityId: credit.creatorUserId, metadata: { reference: credit.reference, amount: amountMinor, currency },
      });
    }
  }

  private async recordAudit(action: string, charge: AdvertiserCharge): Promise<void> {
    await this.audit.record({
      actorId: null,
      action,
      entityType: charge.advertiser.type,
      entityId: charge.advertiser.id,
      metadata: { reference: charge.reference, amount: charge.amount.amountMinor, currency: charge.amount.currency },
    });
  }
}
