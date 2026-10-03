package constants

type SupportedCurrency struct {
	Code       string
	Name       string
	MinorUnits int
	DefaultE8  int64
}

const FixedBaseCurrency = "USD"

var supportedCurrencies = []SupportedCurrency{
	{"USD", "US dollar", 2, 100_000_000},
	{"NGN", "Nigerian naira", 2, 155_000_000_000},
	{"GHS", "Ghanaian cedi", 2, 1_550_000_000},
	{"KES", "Kenyan shilling", 2, 12_900_000_000},
	{"ZAR", "South African rand", 2, 1_820_000_000},
	{"GBP", "British pound", 2, 79_000_000},
	{"EUR", "Euro", 2, 92_000_000},
}

func SupportedCurrencies() []SupportedCurrency {
	return append([]SupportedCurrency(nil), supportedCurrencies...)
}

func FindSupportedCurrency(code string) (SupportedCurrency, bool) {
	for _, candidate := range supportedCurrencies {
		if candidate.Code == code {
			return candidate, true
		}
	}
	return SupportedCurrency{}, false
}
