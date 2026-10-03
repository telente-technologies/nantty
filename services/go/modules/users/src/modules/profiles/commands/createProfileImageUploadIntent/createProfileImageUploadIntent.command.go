package createprofileimageuploadintent

type Command struct {
	AccountId   string
	Purpose     string
	ContentType string
	SizeBytes   int64
}

type Result struct {
	MediaId     string            `json:"mediaId"`
	UploadUrl   string            `json:"uploadUrl"`
	Method      string            `json:"method"`
	Headers     map[string]string `json:"headers"`
	PublicUrl   string            `json:"publicUrl"`
	ExpiresAt   string            `json:"expiresAt"`
	MaximumSize int64             `json:"maximumSizeBytes"`
	Placeholder bool              `json:"placeholder"`
}
