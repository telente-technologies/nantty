package events

import (
	"context"
	"fmt"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sns"
	snstypes "github.com/aws/aws-sdk-go-v2/service/sns/types"
)

const snsPublishBatchLimit = 10

type SnsDomainEventPublisher struct {
	client   *sns.Client
	topicArn string
}

func NewSnsDomainEventPublisher(awsConfig aws.Config, topicArn string) *SnsDomainEventPublisher {
	return &SnsDomainEventPublisher{client: sns.NewFromConfig(awsConfig), topicArn: topicArn}
}

func (publisher *SnsDomainEventPublisher) PublishDomainEvents(ctx context.Context, events []OutboxEvent) error {
	for start := 0; start < len(events); start += snsPublishBatchLimit {
		batch := events[start:min(start+snsPublishBatchLimit, len(events))]
		entries := make([]snstypes.PublishBatchRequestEntry, 0, len(batch))
		for _, event := range batch {
			entries = append(entries, snstypes.PublishBatchRequestEntry{
				Id:      aws.String(event.Id),
				Message: aws.String(string(event.Payload)),
				MessageAttributes: map[string]snstypes.MessageAttributeValue{
					"eventType": {DataType: aws.String("String"), StringValue: aws.String(event.EventType)},
				},
			})
		}
		output, err := publisher.client.PublishBatch(ctx, &sns.PublishBatchInput{TopicArn: aws.String(publisher.topicArn), PublishBatchRequestEntries: entries})
		if err != nil {
			return fmt.Errorf("publish domain events: %w", err)
		}
		if len(output.Failed) > 0 {
			return fmt.Errorf("publish domain events: %d of %d failed (first: %s)", len(output.Failed), len(entries), aws.ToString(output.Failed[0].Message))
		}
	}
	return nil
}

func (publisher *SnsDomainEventPublisher) VerifyTopicIsReachable(ctx context.Context) error {
	_, err := publisher.client.GetTopicAttributes(ctx, &sns.GetTopicAttributesInput{TopicArn: aws.String(publisher.topicArn)})
	return err
}
