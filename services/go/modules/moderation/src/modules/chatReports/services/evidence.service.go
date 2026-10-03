package services

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
)

type EvidenceAttachment struct {
	Type            string  `json:"type"`
	MimeType        *string `json:"mimeType"`
	FileName        *string `json:"fileName"`
	SizeBytes       *int64  `json:"sizeBytes"`
	DurationSeconds *int    `json:"durationSeconds"`
}

type EvidenceMessage struct {
	MessageId   string               `json:"messageId"`
	SenderId    string               `json:"senderId"`
	SenderName  string               `json:"senderName"`
	SentAt      string               `json:"sentAt"`
	Text        string               `json:"text"`
	Attachments []EvidenceAttachment `json:"attachments"`
}

func HashEvidenceExactlyAsSent(rawEvidence json.RawMessage) string {
	var compact bytes.Buffer
	if json.Compact(&compact, rawEvidence) != nil {
		return ""
	}
	digest := sha256.Sum256(compact.Bytes())
	return hex.EncodeToString(digest[:])
}

func ParseEvidence(rawEvidence json.RawMessage) ([]EvidenceMessage, error) {
	if len(rawEvidence) == 0 || string(rawEvidence) == "null" {
		return []EvidenceMessage{}, nil
	}
	var messages []EvidenceMessage
	decoder := json.NewDecoder(bytes.NewReader(rawEvidence))
	if err := decoder.Decode(&messages); err != nil {
		return nil, err
	}
	return messages, nil
}
