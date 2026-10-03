package events

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type EventEnvelope struct {
	Id            string          `json:"id"`
	Type          string          `json:"type"`
	Source        string          `json:"source"`
	Subject       string          `json:"subject"`
	SchemaVersion int             `json:"schemaVersion"`
	OccurredAt    time.Time       `json:"occurredAt"`
	Data          json.RawMessage `json:"data"`
}

type OutboxEvent struct {
	Id        string
	EventType string
	Subject   string
	Payload   []byte
}

func BuildOutboxEventWithEnvelope(eventType, source, subject string, schemaVersion int, occurredAt time.Time, data any) (OutboxEvent, error) {
	encodedData, err := json.Marshal(data)
	if err != nil {
		return OutboxEvent{}, fmt.Errorf("encode event data: %w", err)
	}
	identifier, err := uuid.NewV7()
	if err != nil {
		return OutboxEvent{}, err
	}
	envelope := EventEnvelope{
		Id:            identifier.String(),
		Type:          eventType,
		Source:        source,
		Subject:       subject,
		SchemaVersion: schemaVersion,
		OccurredAt:    occurredAt.UTC(),
		Data:          encodedData,
	}
	payload, err := json.Marshal(envelope)
	if err != nil {
		return OutboxEvent{}, fmt.Errorf("encode event envelope: %w", err)
	}
	return OutboxEvent{Id: envelope.Id, EventType: eventType, Subject: subject, Payload: payload}, nil
}
