package creators

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"log/slog"
	"net"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/grpc/test/bufconn"

	moneyv1 "nantty/contracts/gen/go/zudomart/money/v1"
	"nantty/modules/creators/src"
	"nantty/modules/creators/src/configs"
	programservices "nantty/modules/creators/src/modules/creatorProgram/services"
	"nantty/modules/ledger/src/databases"
	moneytesting "nantty/modules/ledger/src/databases/moneyTesting"
	"nantty/modules/ledger/src/loaders"
	ledgermigrations "nantty/modules/ledger/src/migrations"
	ledgermodels "nantty/modules/ledger/src/modules/journal/models"
	ledgerservices "nantty/modules/ledger/src/modules/journal/services"
	"nantty/platform/events"
	"nantty/platform/health"
	"nantty/platform/servicemodule"
)

const internalToken = "internal-test-token-0123456789abcdef"

type creatorsHarness struct {
	t        *testing.T
	database *sql.DB
	ledger   *ledgerservices.Ledger
	module   *src.Module
	client   moneyv1.LiveMoneyServiceClient
}

func startCreatorsHarness(t *testing.T) *creatorsHarness {
	t.Helper()
	database := moneytesting.OpenTestDatabaseOrSkip(t)
	ledgerSchema := moneytesting.CreateFreshSchemaWithMigrations(t, database, "ledger", ledgermigrations.Files)
	tokens := moneytesting.NewTestTokenAuthority(t)
	settings := configs.CreatorsSettings{Money: moneytesting.MoneyModuleSettingsForTests("creators", moneytesting.CreateEmptySchema(t, database, "creators"), ledgerSchema), DefaultTierId: "starter"}
	dependencies := servicemodule.Dependencies{Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Health: health.NewRegistryForService("creators-test")}
	module, err := src.StartCreatorsModuleWithSettings(context.Background(), settings, dependencies, loaders.MoneyModuleOverrides{
		Publisher: &events.RecordingPublisher{}, AccessVerifier: tokens.UserVerifier(), StaffVerifiers: tokens.StaffVerifiers(),
	})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = module.Close(context.Background()) })
	listener := bufconn.Listen(1 << 20)
	server := loaders.NewMoneyGrpcServer(internalToken, module.RegisterGrpcServices)
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(server.Stop)
	connection, err := grpc.NewClient("passthrough:///bufnet", grpc.WithContextDialer(func(context.Context, string) (net.Conn, error) { return listener.Dial() }),
		grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	return &creatorsHarness{t: t, database: database, ledger: ledgerservices.NewLedgerInSchema(ledgerSchema), module: module, client: moneyv1.NewLiveMoneyServiceClient(connection)}
}

func (harness *creatorsHarness) authorized() context.Context {
	return metadata.AppendToOutgoingContext(context.Background(), "authorization", "Bearer "+internalToken)
}

func (harness *creatorsHarness) makeCreator(userId, tier string) {
	if _, err := harness.module.Program.SetCreatorProgramMembership(context.Background(), programservices.MembershipChange{StaffId: "staff", UserId: userId, TierId: tier, Status: "approved"}); err != nil {
		harness.t.Fatal(err)
	}
}

func (harness *creatorsHarness) issueCoins(userId string, coins int64) {
	err := databases.RunInMoneyTransaction(context.Background(), harness.database, func(ctx context.Context, transaction *sql.Tx) error {
		_, err := harness.ledger.PostBalancedJournalEntry(ctx, transaction, ledgermodels.JournalEntryRequest{Reference: "issue-" + userId, Kind: "test.issue", Lines: []ledgermodels.JournalLineRequest{
			{Account: ledgermodels.CoinsInCirculationAccount(), Direction: ledgermodels.Debit, AmountMinor: coins},
			{Account: ledgermodels.UserSpendableCoinsAccount(userId), Direction: ledgermodels.Credit, AmountMinor: coins},
		}})
		return err
	})
	if err != nil {
		harness.t.Fatal(err)
	}
}

func (harness *creatorsHarness) balance(account ledgermodels.AccountRef) int64 {
	balance, err := harness.ledger.ReadAccountBalance(context.Background(), harness.database, account)
	if err != nil {
		harness.t.Fatal(err)
	}
	return balance
}

func gift(sender, receiver, host, key string, quantity int32, price int64, battleId string) *moneyv1.ChargeGiftAndCreditCreatorRequest {
	request := &moneyv1.ChargeGiftAndCreditCreatorRequest{SenderUserId: sender, ReceiverUserId: receiver, HostUserId: host, LiveId: "live-1", GiftId: "gift_rose", Quantity: quantity, UnitPriceCoins: price, IdempotencyKey: key}
	if battleId != "" {
		request.BattleId = &battleId
	}
	return request
}

func errorReason(err error) (codes.Code, string, map[string]string) {
	converted := status.Convert(err)
	for _, detail := range converted.Details() {
		if information, isInformation := detail.(*errdetails.ErrorInfo); isInformation {
			return converted.Code(), information.Reason, information.Metadata
		}
	}
	return converted.Code(), "", nil
}

func TestGiftsSplitByTierSettleNonMembersToTheHostAndAreIdempotent(t *testing.T) {
	harness := startCreatorsHarness(t)
	viewer, partner, guest, host := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.makeCreator(partner, "partner")
	harness.makeCreator(host, "top")
	harness.issueCoins(viewer, 1_000)
	ctx := harness.authorized()
	if _, err := harness.client.ChargeGiftAndCreditCreator(context.Background(), gift(viewer, partner, host, "unauthenticated-1", 1, 1, "")); status.Code(err) != codes.Unauthenticated {
		t.Fatalf("missing internal token: %v", err)
	}
	first, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, partner, host, "gift-key-0001", 2, 50, ""))
	if err != nil || first.GiftTransaction.CreatorAmountCoins != 60 || first.GiftTransaction.PlatformFeeCoins != 40 || first.SenderCoinBalance != 900 || first.Replayed {
		t.Fatalf("partner gift: %+v %v", first, err)
	}
	replay, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, partner, host, "gift-key-0001", 2, 50, ""))
	if err != nil || !replay.Replayed || replay.GiftTransaction.GiftTransactionId != first.GiftTransaction.GiftTransactionId || replay.SenderCoinBalance != 900 {
		t.Fatalf("replay: %+v %v", replay, err)
	}
	if _, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, partner, host, "gift-key-0001", 3, 50, "")); status.Code(err) != codes.AlreadyExists {
		t.Fatalf("key reuse: %v", err)
	}
	toGuest, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, guest, host, "gift-key-0002", 1, 100, ""))
	if err != nil || toGuest.GiftTransaction.CreditedUserId != host || toGuest.GiftTransaction.CreatorAmountCoins != 70 {
		t.Fatalf("non-member receiver: %+v %v", toGuest, err)
	}
	if _, reason, _ := errorReason(func() error {
		_, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, viewer, host, "gift-key-0003", 1, 1, ""))
		return err
	}()); reason != "CANNOT_GIFT_SELF" {
		t.Fatalf("self gift reason %q", reason)
	}
	if _, reason, _ := errorReason(func() error {
		_, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, guest, uuid.NewString(), "gift-key-0004", 1, 1, ""))
		return err
	}()); reason != "RECIPIENT_CANNOT_RECEIVE_GIFTS" {
		t.Fatalf("no creator reason %q", reason)
	}
	_, err = harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, partner, host, "gift-key-0005", 100, 100, ""))
	if code, reason, details := errorReason(err); code != codes.FailedPrecondition || reason != "INSUFFICIENT_COINS" || details["coinBalance"] != "800" {
		t.Fatalf("insufficient: %v %s %v", code, reason, details)
	}
	if harness.balance(ledgermodels.CreatorEarnedCoinsAccount(partner)) != 60 || harness.balance(ledgermodels.CreatorEarnedCoinsAccount(host)) != 70 || harness.balance(ledgermodels.PlatformGiftRevenueCoinsAccount()) != 70 {
		t.Fatal("gift ledger split wrong")
	}
	var giftEvents int
	_ = harness.database.QueryRow(`SELECT count(*) FROM "` + harness.module.Container.Settings.Money.DatabaseSchema + `".outbox_events WHERE event_type = 'giftTransaction.committed'`).Scan(&giftEvents)
	if giftEvents != 2 {
		t.Fatalf("giftTransaction.committed events = %d", giftEvents)
	}
	assertHealthy(t, harness)
}

func TestConcurrentGiftsFromOneWalletNeverOverdraw(t *testing.T) {
	harness := startCreatorsHarness(t)
	viewer, host := uuid.NewString(), uuid.NewString()
	harness.makeCreator(host, "top")
	harness.issueCoins(viewer, 100)
	var succeeded, refused atomic.Int64
	var group sync.WaitGroup
	for attempt := range 60 {
		group.Add(1)
		go func() {
			defer group.Done()
			_, err := harness.client.ChargeGiftAndCreditCreator(harness.authorized(), gift(viewer, host, host+"x", fmt.Sprintf("burst-%04d", attempt), 1, 5, ""))
			if err == nil {
				succeeded.Add(1)
			} else if _, reason, _ := errorReason(err); reason == "INSUFFICIENT_COINS" {
				refused.Add(1)
			} else {
				t.Errorf("unexpected: %v", err)
			}
		}()
	}
	group.Wait()
	if succeeded.Load() != 20 || refused.Load() != 40 || harness.balance(ledgermodels.UserSpendableCoinsAccount(viewer)) != 0 {
		t.Fatalf("succeeded=%d refused=%d", succeeded.Load(), refused.Load())
	}
	assertHealthy(t, harness)
}

func assertHealthy(t *testing.T, harness *creatorsHarness) {
	t.Helper()
	report, err := harness.ledger.VerifyTrialBalanceAndCachedBalances(context.Background(), harness.database)
	if err != nil || !report.Healthy() {
		t.Fatalf("ledger unhealthy: %+v %v", report, err)
	}
}

func TestAdminGiftShareTiersRaiseTheShareByMonthlyVolumeAndNeverLowerAMemberTier(t *testing.T) {
	harness := startCreatorsHarness(t)
	adminSchema := moneytesting.CreateEmptySchema(t, harness.database, "admin")
	table := pgx.Identifier{adminSchema, "platform_settings"}.Sanitize()
	for _, statement := range []string{
		`CREATE TABLE ` + table + ` (key text PRIMARY KEY, value jsonb NOT NULL)`,
		`INSERT INTO ` + table + ` VALUES ('gift.shareTiers', '{"tiers":[{"minimumMonthlyGiftCoins":0,"creatorShareBps":5000},{"minimumMonthlyGiftCoins":100,"creatorShareBps":6500}]}')`,
	} {
		if _, err := harness.database.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	harness.module.Container.Resources.Platform = loaders.NewPlatformSettingsSource(harness.database, adminSchema, 0, slog.New(slog.NewTextHandler(io.Discard, nil)))
	viewer, starter, partner, host := uuid.NewString(), uuid.NewString(), uuid.NewString(), uuid.NewString()
	harness.makeCreator(starter, "starter")
	harness.makeCreator(partner, "partner")
	harness.makeCreator(host, "top")
	harness.issueCoins(viewer, 1_000)
	ctx := harness.authorized()
	first, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, starter, host, "tier-key-0001", 1, 100, ""))
	if err != nil || first.GiftTransaction.CreatorAmountCoins != 50 {
		t.Fatalf("below the threshold the starter share applies: %+v %v", first, err)
	}
	second, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, starter, host, "tier-key-0002", 1, 100, ""))
	if err != nil || second.GiftTransaction.CreatorAmountCoins != 65 {
		t.Fatalf("after 100 monthly coins the admin tier applies: %+v %v", second, err)
	}
	fromPartner, err := harness.client.ChargeGiftAndCreditCreator(ctx, gift(viewer, partner, host, "tier-key-0003", 1, 100, ""))
	if err != nil || fromPartner.GiftTransaction.CreatorAmountCoins != 60 {
		t.Fatalf("a staff-granted tier is never lowered by the admin tiers: %+v %v", fromPartner, err)
	}
}
