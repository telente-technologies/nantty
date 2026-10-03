package events

const (
	DataExportRequestedType = "dataExport.requested"
	DataExportCompletedType = "dataExport.completed"
)

type DataExportRequestedData struct {
	AccountId   string `json:"accountId"`
	ExportId    string `json:"exportId"`
	RequestedAt string `json:"requestedAt"`
}

type DataExportCompletedData struct {
	AccountId   string `json:"accountId"`
	ExportId    string `json:"exportId"`
	CompletedAt string `json:"completedAt"`
	ExpiresAt   string `json:"expiresAt"`
	SizeBytes   int64  `json:"sizeBytes"`
}
