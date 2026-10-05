package updatecountrypreference

type Command struct {
	AccountId   string
	CountryCode *string
	Theme       *string
}
