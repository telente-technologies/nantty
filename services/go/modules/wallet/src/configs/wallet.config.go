package configs

import (
	"encoding/base64"
	"strconv"
	"strings"
	"time"

	"nantty/modules/ledger/src/loaders"
	platformconfig "nantty/platform/config"
)

type WalletSettings struct {
	InternalApiToken             string
	AdPrepaidRefundsEnabled      bool
	SellerReserveHoldDays        int
	Money                        loaders.MoneyModuleSettings
	CoinTransferFeeBps           int64
	CoinCashValueMinorByCurrency map[string]int64
	MinimumPayoutMinorByCurrency map[string]int64
	MinimumWithdrawalMinor       int64
	DataEncryptionKey            []byte
	DefaultCurrency              string
	WithdrawalsRequireReview     bool
	AccountDirectorySchema       string
	PayoutRunInterval            time.Duration
	SellerSettlementAdapter      string
	CreatorTransferMinimum       map[string]int64
	CoinNetValueMinorByCurrency  map[string]int64
	CoinChannelFeeBps            map[string]int64
	UsersSchema                  string
	CreatorsSchema               string
	EscrowSchema                 string
	SocialSchema                 string
	TrustedCountryHeader         string
	AdminInternalUrl             string
	AdminInternalToken           string
	WithdrawalLimits             WithdrawalLimits
}

const defaultCoinCashValues = "NGN:1000,GHS:10,KES:100,ZAR:15,GBP:1,EUR:1,USD:1"

func ReadWalletSettingsFromEnvironment(reader *platformconfig.EnvironmentReader) WalletSettings {
	settings := WalletSettings{
		Money:                        loaders.ReadMoneyModuleSettingsFromEnvironment(reader, "wallet"),
		CoinTransferFeeBps:           int64(reader.ReadIntegerOrDefault("COIN_TRANSFER_FEE_BPS", 200)),
		CoinCashValueMinorByCurrency: ParseCurrencyAmounts(reader.ReadStringOrDefault("COIN_CASH_VALUES", defaultCoinCashValues)),
		MinimumPayoutMinorByCurrency: ParseCurrencyAmounts(reader.ReadStringOrDefault("CREATOR_MINIMUM_PAYOUTS", "NGN:1000,GHS:1000,KES:1000,ZAR:1000,GBP:1000,EUR:1000,USD:1000")),
		MinimumWithdrawalMinor:       int64(reader.ReadIntegerOrDefault("WALLET_MINIMUM_WITHDRAWAL_MINOR", 100)),
		DataEncryptionKey:            readEncryptionKey(reader),
		DefaultCurrency:              reader.ReadStringOrDefault("WALLET_DEFAULT_CURRENCY", "USD"),
		WithdrawalsRequireReview:     reader.ReadStringOrDefault("WALLET_WITHDRAWALS_REQUIRE_REVIEW", "true") != "false",
		AccountDirectorySchema:       reader.ReadStringOrDefault("WALLET_ACCOUNT_DIRECTORY_SCHEMA", "auth"),
		PayoutRunInterval:            reader.ReadDurationOrDefault("WALLET_PAYOUT_RUN_INTERVAL", 24*time.Hour),
		SellerSettlementAdapter:      reader.ReadStringOrDefault("WALLET_SELLER_SETTLEMENT_ADAPTER", "providerTransfer"),
		CreatorTransferMinimum:       ParseCurrencyAmounts(reader.ReadStringOrDefault("CREATOR_TRANSFER_MINIMUMS", "NGN:10000,USD:100")),
		CoinNetValueMinorByCurrency:  ParseCurrencyAmounts(reader.ReadStringOrDefault("COIN_NET_VALUES", "NGN:1000,USD:1")),
		InternalApiToken:             reader.ReadStringOrDefault("MONEY_INTERNAL_API_TOKEN", ""),
		AdPrepaidRefundsEnabled:      reader.ReadStringOrDefault("ADS_PREPAID_REFUNDS_ENABLED", "false") == "true",
		SellerReserveHoldDays:        reader.ReadIntegerOrDefault("WALLET_SELLER_RESERVE_HOLD_DAYS", 90),
		CoinChannelFeeBps:            ParseChannelFees(reader.ReadStringOrDefault("COIN_CHANNEL_FEE_BPS", "web:300,ios:3000,android:1500")),
		UsersSchema:                  reader.ReadStringOrDefault("WALLET_USERS_SCHEMA", "users"),
		CreatorsSchema:               reader.ReadStringOrDefault("CREATORS_DATABASE_SCHEMA", "creators"),
		EscrowSchema:                 reader.ReadStringOrDefault("ESCROW_DATABASE_SCHEMA", "escrow"),
		SocialSchema:                 reader.ReadStringOrDefault("WALLET_SOCIAL_SCHEMA", "social"),
		TrustedCountryHeader:         reader.ReadStringOrDefault("PRICING_TRUSTED_COUNTRY_HEADER", "CloudFront-Viewer-Country"),
		AdminInternalUrl:             reader.ReadStringOrDefault("ADMIN_INTERNAL_URL", ""),
		AdminInternalToken:           reader.ReadStringOrDefault("ADMIN_INTERNAL_API_TOKEN", ""),
	}
	settings.WithdrawalLimits = ReadWithdrawalLimitsFromEnvironment(reader)
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

func ParseChannelFees(raw string) map[string]int64 {
	fees := map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		channel, value, found := strings.Cut(strings.TrimSpace(entry), ":")
		fee, err := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		channel = strings.ToLower(strings.TrimSpace(channel))
		if found && err == nil && fee >= 0 && fee < 10_000 && (channel == "web" || channel == "ios" || channel == "android") {
			fees[channel] = fee
		}
	}
	return fees
}
