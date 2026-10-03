package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/url"
	"slices"
	"strings"

	"zudomart/modules/moderation/src/container"
	ingestsuspensioncase "zudomart/modules/moderation/src/modules/suspensionCases/commands/ingestSuspensionCase"
	platformevents "zudomart/platform/events"
)

type advisoryMessage struct {
	SuggestionId string  `json:"suggestionId"`
	SubjectType  string  `json:"subjectType"`
	SubjectId    string  `json:"subjectId"`
	Source       string  `json:"source"`
	Score        float64 `json:"score"`
	Evidence     []struct {
		Code   string  `json:"code"`
		Weight float64 `json:"weight"`
	} `json:"evidence"`
	AdvisoryOnly bool   `json:"advisoryOnly"`
	GeneratedAt  string `json:"generatedAt"`
}

func QueueNameFromUrl(queueUrl string) string {
	parsed, err := url.Parse(queueUrl)
	if err != nil {
		return ""
	}
	return parsed.Path[strings.LastIndex(parsed.Path, "/")+1:]
}

func HandleAdvisoryMessage(application *container.Container) platformevents.MessageHandler {
	return func(ctx context.Context, body []byte) error {
		var message advisoryMessage
		if err := json.Unmarshal(body, &message); err != nil {
			return fmt.Errorf("%w: advisory message is not JSON", platformevents.ErrPoisonMessage)
		}
		if !message.AdvisoryOnly || message.SubjectType != "account" || message.SuggestionId == "" {
			return nil
		}
		evidence := message.Evidence
		slices.SortFunc(evidence, func(left, right struct {
			Code   string  `json:"code"`
			Weight float64 `json:"weight"`
		}) int {
			return int(math.Round((right.Weight - left.Weight) * 1000))
		})
		signals, top := []json.RawMessage{}, []string{}
		for _, item := range evidence {
			entry, _ := json.Marshal(map[string]any{"label": item.Code, "weight": item.Weight, "detail": "Reported by the intelligence service (" + message.Source + ")"})
			signals = append(signals, entry)
			if len(top) < 5 {
				top = append(top, item.Code)
			}
		}
		_, err := ingestsuspensioncase.Handler{Container: application}.Execute(ctx, ingestsuspensioncase.Command{
			AccountId: message.SubjectId, Source: "python_suggestion", RiskScore: min(100, max(0, int(math.Round(message.Score*100)))), TopSignals: top, Signals: signals,
			ModelVersion: message.Source, ExternalReference: message.SuggestionId,
		})
		return err
	}
}

type AdvisoryConsumer struct {
	Container *container.Container
	Queues    platformevents.QueueConsumer
}

func (consumer AdvisoryConsumer) RunUntilContextDone(ctx context.Context) error {
	queueName := consumer.Container.Settings.AdvisoryQueueName
	if queueName == "" {
		return errors.New("INTELLIGENCE_TRUST_ADVISORY_QUEUE is not set")
	}
	return consumer.Queues.ConsumeQueueUntilContextDone(ctx, queueName, HandleAdvisoryMessage(consumer.Container), consumer.Container.Logger)
}
