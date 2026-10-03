package addpayoutaccount

type Command struct {
	UserId        string
	CountryCode   string
	BankCode      string
	AccountNumber string
}
