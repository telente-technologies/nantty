import type { MonetizationSettings } from "../../../configs/monetization.config.js";
import { unprocessable } from "../../../errors/domain.error.js";
import type { AuditRecorder } from "../../../interfaces/audit.interface.js";
import type { SocialGraph } from "../../../interfaces/socialGraph.interface.js";
import type { UserDirectory } from "../../../interfaces/userDirectory.interface.js";
import type { Page, PageRequest } from "../../../types/pagination.type.js";
import type { LedgerEntryRecord } from "../../wallets/models/wallets.model.js";
import { splitCoinsByBasisPoints, type CoinLedgerService, type CoinTransferPosted } from "./coinLedger.service.js";

export interface CoinTransferRequest {
  readonly senderUserId: string;
  readonly recipientUserId: string;
  readonly coins: number;
  readonly note: string | undefined;
  readonly idempotencyKey: string;
}

export interface CoinTransferQuote {
  readonly coins: number;
  readonly feeCoins: number;
  readonly netCoins: number;
  readonly feePercent: number;
}

export interface CoinBalanceView {
  readonly coins: number;
  readonly earnedCoins: number;
}

export class CoinWalletService {
  public constructor(
    private readonly coinLedger: CoinLedgerService,
    private readonly socialGraph: SocialGraph,
    private readonly userDirectory: UserDirectory,
    private readonly audit: AuditRecorder,
    private readonly settings: MonetizationSettings,
  ) {}

  public async findBalance(userId: string): Promise<CoinBalanceView> {
    const [coins, earnedCoins] = await Promise.all([this.coinLedger.readCoinBalance(userId), this.coinLedger.readEarnedCoinBalance(userId)]);
    return { coins, earnedCoins };
  }

  public listTransactions(userId: string, page: PageRequest): Promise<Page<LedgerEntryRecord>> {
    return this.coinLedger.listCoinEntries(userId, page);
  }

  public quoteTransfer(coins: number): CoinTransferQuote {
    const { share: feeCoins, remainder: netCoins } = splitCoinsByBasisPoints(coins, this.settings.coins.transferFeeBps);
    return { coins, feeCoins, netCoins, feePercent: this.settings.coins.transferFeeBps / 100 };
  }

  public async transferCoins(request: CoinTransferRequest): Promise<CoinTransferPosted> {
    if (request.senderUserId === request.recipientUserId) throw unprocessable("You cannot send coins to yourself.");
    const [recipient] = await this.userDirectory.findUserSummaries([request.recipientUserId]);
    if (recipient === undefined) throw unprocessable("This person cannot receive coins.");
    if (await this.socialGraph.isBlockedEitherWay(request.senderUserId, request.recipientUserId)) throw unprocessable("You cannot send coins to this person.");
    const posted = await this.coinLedger.transferCoins({
      reference: `coin-transfer:${request.senderUserId}:${request.idempotencyKey}`,
      senderUserId: request.senderUserId,
      recipientUserId: request.recipientUserId,
      coins: request.coins,
      feeBasisPoints: this.settings.coins.transferFeeBps,
      description: request.note === undefined ? "Coin transfer" : `Coin transfer: ${request.note}`,
    });
    if (posted.created) {
      await this.audit.record({
        actorId: request.senderUserId, action: "coins.transferred", entityType: "user", entityId: request.recipientUserId,
        metadata: { coins: posted.coins, feeCoins: posted.feeCoins, netCoins: posted.netCoins, transactionId: posted.transactionId },
      });
    }
    return posted;
  }
}
