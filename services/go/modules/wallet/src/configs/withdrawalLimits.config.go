package configs

import (
	"strconv"
	"strings"
	"time"

	platformconfig "zudomart/platform/config"
)

type WithdrawalLimits struct {
	MaximumPerDay        int
	MinimumGap           time.Duration
	NewAccountCooldown   time.Duration
	BlockWhileProcessing bool
	DailyCapMinor        map[int]map[string]int64
}

func ReadWithdrawalLimitsFromEnvironment(reader *platformconfig.EnvironmentReader) WithdrawalLimits {
	return WithdrawalLimits{
		MaximumPerDay:        reader.ReadIntegerOrDefault("WALLET_WITHDRAWALS_PER_DAY", 3),
		MinimumGap:           reader.ReadDurationOrDefault("WALLET_WITHDRAWAL_MINIMUM_GAP", 10*time.Minute),
		NewAccountCooldown:   reader.ReadDurationOrDefault("NEW_PAYOUT_ACCOUNT_COOLDOWN", 48*time.Hour),
		BlockWhileProcessing: reader.ReadStringOrDefault("WALLET_BLOCK_WITHDRAWAL_WHILE_PROCESSING", "true") != "false",
		DailyCapMinor:        ParseLevelCurrencyCaps(reader.ReadStringOrDefault("WALLET_WITHDRAWAL_DAILY_CAPS", "1:NGN:50000000,2:NGN:500000000")),
	}
}

func ParseLevelCurrencyCaps(raw string) map[int]map[string]int64 {
	caps := map[int]map[string]int64{}
	for _, entry := range strings.Split(raw, ",") {
		parts := strings.Split(strings.TrimSpace(entry), ":")
		if len(parts) != 3 {
			continue
		}
		level, levelErr := strconv.Atoi(parts[0])
		amount, amountErr := strconv.ParseInt(parts[2], 10, 64)
		if levelErr != nil || amountErr != nil || amount <= 0 || len(parts[1]) != 3 {
			continue
		}
		if caps[level] == nil {
			caps[level] = map[string]int64{}
		}
		caps[level][strings.ToUpper(parts[1])] = amount
	}
	return caps
}

func (limits WithdrawalLimits) DailyCapFor(level int, currency string) (int64, bool) {
	chosenLevel, amount := -1, int64(0)
	for capLevel, byCurrency := range limits.DailyCapMinor {
		if value, exists := byCurrency[currency]; exists && capLevel <= level && capLevel > chosenLevel {
			chosenLevel, amount = capLevel, value
		}
	}
	return amount, chosenLevel >= 0
}
