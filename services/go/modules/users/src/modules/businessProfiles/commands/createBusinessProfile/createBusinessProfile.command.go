package createbusinessprofile

type CategorySelection struct {
	CategoryId    *string
	SubcategoryId *string
	CustomName    *string
}

type Command struct {
	AccountId    string
	DisplayName  string
	Handle       string
	Description  string
	Website      *string
	BusinessType string
	Purpose      string
	Categories   []CategorySelection
}
