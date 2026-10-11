package services

import (
	"context"
	"sync"
	"time"

	"zudomart/modules/payments/src/interfaces"
)

const bankListCacheLifetime = 12 * time.Hour

var fallbackBanksByCountry = map[string][]interfaces.Bank{
	"NG": {
		{Code: "044", Name: "Access Bank"}, {Code: "023", Name: "Citibank Nigeria"}, {Code: "050", Name: "Ecobank Nigeria"},
		{Code: "070", Name: "Fidelity Bank"}, {Code: "011", Name: "First Bank of Nigeria"}, {Code: "214", Name: "First City Monument Bank"},
		{Code: "058", Name: "Guaranty Trust Bank"}, {Code: "030", Name: "Heritage Bank"}, {Code: "082", Name: "Keystone Bank"},
		{Code: "50211", Name: "Kuda Bank"}, {Code: "50515", Name: "Moniepoint MFB"}, {Code: "999992", Name: "OPay"},
		{Code: "999991", Name: "PalmPay"}, {Code: "076", Name: "Polaris Bank"}, {Code: "221", Name: "Stanbic IBTC Bank"},
		{Code: "232", Name: "Sterling Bank"}, {Code: "032", Name: "Union Bank of Nigeria"}, {Code: "033", Name: "United Bank for Africa"},
		{Code: "035", Name: "Wema Bank"}, {Code: "057", Name: "Zenith Bank"},
	},
}

type cachedBankList struct {
	banks     []interfaces.Bank
	fetchedAt time.Time
}

type BankDirectory struct {
	Provider interfaces.PaymentProvider
	Now      func() time.Time
	mutex    sync.Mutex
	cache    map[string]cachedBankList
}

func (directory *BankDirectory) ListBanksForCountry(ctx context.Context, countryCode string) []interfaces.Bank {
	directory.mutex.Lock()
	if directory.cache == nil {
		directory.cache = map[string]cachedBankList{}
	}
	cached, found := directory.cache[countryCode]
	directory.mutex.Unlock()
	if found && directory.Now().Sub(cached.fetchedAt) < bankListCacheLifetime {
		return cached.banks
	}
	identity, supported := directory.Provider.(interfaces.IdentityVerifier)
	if !supported {
		return withCountryCode(fallbackBanksByCountry[countryCode], countryCode)
	}
	banks, err := identity.ListBanks(ctx, countryCode)
	if err != nil || len(banks) == 0 {
		return withCountryCode(fallbackBanksByCountry[countryCode], countryCode)
	}
	directory.mutex.Lock()
	directory.cache[countryCode] = cachedBankList{banks: banks, fetchedAt: directory.Now()}
	directory.mutex.Unlock()
	return banks
}

func (directory *BankDirectory) ResolveAccountName(ctx context.Context, bankCode, accountNumber string) (string, error) {
	identity, supported := directory.Provider.(interfaces.IdentityVerifier)
	if !supported {
		return "", interfaces.ErrCapabilityNotSupported
	}
	return identity.ResolveBankAccountName(ctx, bankCode, accountNumber)
}

func withCountryCode(banks []interfaces.Bank, countryCode string) []interfaces.Bank {
	converted := make([]interfaces.Bank, len(banks))
	for index, bank := range banks {
		bank.CountryCode = countryCode
		converted[index] = bank
	}
	return converted
}

func IsBankKnownInCountry(banks []interfaces.Bank, bankCode string) (interfaces.Bank, bool) {
	for _, bank := range banks {
		if bank.Code == bankCode {
			return bank, true
		}
	}
	return interfaces.Bank{}, false
}
