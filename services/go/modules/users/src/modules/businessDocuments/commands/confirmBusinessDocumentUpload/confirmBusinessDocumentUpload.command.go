package confirmbusinessdocumentupload

type Command struct {
	AccountId  string
	Kind       string
	DocumentId string
	FileUrl    string
}
