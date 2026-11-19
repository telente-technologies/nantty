package addpayoutaccount

type Command struct {
	UserId        string
	CountryCode   string
	BankCode      string
	BranchCode    string
	AccountNumber string
}
