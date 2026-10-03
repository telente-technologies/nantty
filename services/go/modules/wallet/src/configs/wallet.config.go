package configs

import (
	"encoding/base64"
	"strconv"
	"strings"
	"time"

	"zudomart/modules/ledger/src/loaders"
	platformconfig "zudomart/platform/config"
)

type WalletSettings struct {
	Money                        loaders.MoneyModuleSettings
	CoinTransferFeeBps           int64
	CoinCashValueMinorByCurrency map[string]int64
	MinimumPayoutMinorByCurrency map[string]int64
	MinimumWithdrawalMinor       int64
	DataEncryptionKey            []byte
	DefaultPayoutProvider        string
	DefaultCurrency              string
	WithdrawalsRequireReview     bool
	AccountDirectorySchema       string
	PayoutRunInterval            time.Duration
	SellerSettlementAdapter      string
}

const defaultCoinCashValues = "NGN:1000,GHS:10,KES:100,ZAR:15,GBP:1,EUR:1,USD:1"

func ReadWalletSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) WalletSettings {
	settings := WalletSettings{
		Money:                        loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "wallet"),
		CoinTransferFeeBps:           int64(reader.ReadIntegerOrDefault("COIN_TRANSFER_FEE_BPS", 2500)),
		CoinCashValueMinorByCurrency: ParseCurrencyAmounts(reader.ReadStringOrDefault("COIN_CASH_VALUES", defaultCoinCashValues)),
		MinimumPayoutMinorByCurrency: ParseCurrencyAmounts(reader.ReadStringOrDefault("CREATOR_MINIMUM_PAYOUTS", "NGN:1000,GHS:1000,KES:1000,ZAR:1000,GBP:1000,EUR:1000,USD:1000")),
		MinimumWithdrawalMinor:       int64(reader.ReadIntegerOrDefault("WALLET_MINIMUM_WITHDRAWAL_MINOR", 100)),
		DataEncryptionKey:            readEncryptionKey(reader),
		DefaultPayoutProvider:        reader.ReadStringOrDefault("WALLET_PAYOUT_PROVIDER", "paystack"),
		DefaultCurrency:              reader.ReadStringOrDefault("WALLET_DEFAULT_CURRENCY", "USD"),
		WithdrawalsRequireReview:     reader.ReadStringOrDefault("WALLET_WITHDRAWALS_REQUIRE_REVIEW", "true") != "false",
		AccountDirectorySchema:       reader.ReadStringOrDefault("WALLET_ACCOUNT_DIRECTORY_SCHEMA", "auth"),
		PayoutRunInterval:            reader.ReadDurationOrDefault("WALLET_PAYOUT_RUN_INTERVAL", 24*time.Hour),
		SellerSettlementAdapter:      reader.ReadStringOrDefault("WALLET_SELLER_SETTLEMENT_ADAPTER", "paystackTransfer"),
	}
	if settings.CoinTransferFeeBps < 0 || settings.CoinTransferFeeBps >= 10_000 {
		reader.ReadRequiredString("COIN_TRANSFER_FEE_BPS_BETWEEN_0_AND_9999")
	}
	return settings
}

func readEncryptionKey(reader *platformconfig.EnvironmentReader) []byte {
	encoded := reader.ReadRequiredString("DATA_ENCRYPTION_KEY")
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if encoded != "" && (err != nil || len(decoded) != 32) {
		reader.ReadRequiredString("DATA_ENCRYPTION_KEY_AS_BASE64_OF_32_BYTES")
		return nil
	}
	return decoded
}

func ParseCurrencyAmounts(raw string) map[string]int64 {
	amounts := map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		currency, value, found := strings.Cut(strings.TrimSpace(entry), ":")
		amount, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		if found && err == nil && amount > 0 && len(strings.TrimSpace(currency)) == 3 {
			amounts[strings.ToUpper(strings.TrimSpace(currency))] = amount
		}
	}
	return amounts
}
