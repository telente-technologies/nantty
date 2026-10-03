package updatebusinessprofile

type Command struct {
	AccountId   string
	ProfileId   string
	DisplayName *string
	Description *string
	Website     *string
	ClearSite   bool
	IsPrivate   *bool
}
