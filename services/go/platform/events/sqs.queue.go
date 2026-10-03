package events

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sqs"
)

type SqsQueues struct {
	client    *sqs.Client
	mutex     sync.Mutex
	queueUrls map[string]string
}

func NewSqsQueues(awsConfig aws.Config) *SqsQueues {
	return &SqsQueues{client: sqs.NewFromConfig(awsConfig), queueUrls: map[string]string{}}
}

func (queues *SqsQueues) EnqueueJob(ctx context.Context, queueName string, job Job) error {
	queueUrl, err := queues.resolveQueueUrl(ctx, queueName)
	if err != nil {
		return err
	}
	body, err := json.Marshal(job)
	if err != nil {
		return err
	}
	_, err = queues.client.SendMessage(ctx, &sqs.SendMessageInput{QueueUrl: aws.String(queueUrl), MessageBody: aws.String(string(body))})
	return err
}

func (queues *SqsQueues) ConsumeQueueUntilContextDone(ctx context.Context, queueName string, handler MessageHandler, logger *slog.Logger) error {
	queueUrl, err := queues.resolveQueueUrl(ctx, queueName)
	if err != nil {
		return err
	}
	for ctx.Err() == nil {
		output, err := queues.client.ReceiveMessage(ctx, &sqs.ReceiveMessageInput{QueueUrl: aws.String(queueUrl), MaxNumberOfMessages: 10, WaitTimeSeconds: 20})
		if err != nil {
			if ctx.Err() == nil {
				logger.WarnContext(ctx, "receive from queue failed", slog.String("queue", queueName), slog.Any("error", err))
			}
			continue
		}
		for _, message := range output.Messages {
			if err := handler(ctx, []byte(aws.ToString(message.Body))); err != nil {
				logger.WarnContext(ctx, "message handling failed; it will be redelivered and dead-lettered after the redrive limit", slog.String("queue", queueName), slog.Any("error", err))
				continue
			}
			if _, err := queues.client.DeleteMessage(ctx, &sqs.DeleteMessageInput{QueueUrl: aws.String(queueUrl), ReceiptHandle: message.ReceiptHandle}); err != nil {
				logger.WarnContext(ctx, "delete message failed", slog.String("queue", queueName), slog.Any("error", err))
			}
		}
	}
	return nil
}

func (queues *SqsQueues) resolveQueueUrl(ctx context.Context, queueName string) (string, error) {
	queues.mutex.Lock()
	defer queues.mutex.Unlock()
	if queueUrl, known := queues.queueUrls[queueName]; known {
		return queueUrl, nil
	}
	output, err := queues.client.GetQueueUrl(ctx, &sqs.GetQueueUrlInput{QueueName: aws.String(queueName)})
	if err != nil {
		return "", fmt.Errorf("resolve queue %s: %w", queueName, err)
	}
	queues.queueUrls[queueName] = aws.ToString(output.QueueUrl)
	return queues.queueUrls[queueName], nil
}
