package createdocumentuploadintent

type Command struct {
	AccountId   string
	Kind        string
	FileName    string
	ContentType string
	SizeBytes   int64
}

type Result struct {
	DocumentId string            `json:"documentId"`
	ObjectKey  string            `json:"objectKey"`
	UploadUrl  string            `json:"uploadUrl"`
	Headers    map[string]string `json:"headers"`
	ExpiresAt  string            `json:"expiresAt"`
}
