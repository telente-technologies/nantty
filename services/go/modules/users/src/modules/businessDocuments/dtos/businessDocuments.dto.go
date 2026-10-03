package dtos

type UploadIntentRequest struct {
	FileName    string `json:"fileName"`
	ContentType string `json:"contentType"`
	SizeBytes   int64  `json:"sizeBytes"`
}

type ConfirmRequest struct {
	DocumentId string `json:"documentId"`
	FileUrl    string `json:"fileUrl"`
}

type ReviewRequest struct {
	Reason string `json:"reason"`
}
