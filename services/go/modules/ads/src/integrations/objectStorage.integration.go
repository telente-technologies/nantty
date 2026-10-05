package integrations

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/smithy-go"

	"zudomart/modules/ads/src/interfaces"
)

type S3ObjectStorage struct {
	bucket    string
	client    *s3.Client
	presigner *s3.PresignClient
}

func NewS3ObjectStorage(ctx context.Context, bucket, endpoint string) (*S3ObjectStorage, error) {
	awsConfig, err := awsconfig.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awsConfig, func(options *s3.Options) {
		options.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		options.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
		if endpoint != "" {
			options.BaseEndpoint = aws.String(endpoint)
			options.UsePathStyle = true
		}
	})
	return &S3ObjectStorage{bucket: bucket, client: client, presigner: s3.NewPresignClient(client)}, nil
}

func (storage *S3ObjectStorage) PresignUpload(ctx context.Context, key, contentType string, sizeBytes int64, timeToLive time.Duration) (interfaces.ObjectUploadTicket, error) {
	request, err := storage.presigner.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: &storage.bucket, Key: &key, ContentType: &contentType, ContentLength: aws.Int64(sizeBytes)}, s3.WithPresignExpires(timeToLive))
	if err != nil {
		return interfaces.ObjectUploadTicket{}, err
	}
	headers := map[string]string{}
	for name, values := range request.SignedHeader {
		if len(values) > 0 && name != "Host" {
			headers[name] = values[0]
		}
	}
	return interfaces.ObjectUploadTicket{Url: request.URL, Headers: headers}, nil
}

func (storage *S3ObjectStorage) PresignDownload(ctx context.Context, key string, timeToLive time.Duration) (string, error) {
	request, err := storage.presigner.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &storage.bucket, Key: &key}, s3.WithPresignExpires(timeToLive))
	if err != nil {
		return "", err
	}
	return request.URL, nil
}

func (storage *S3ObjectStorage) PutObject(ctx context.Context, key, contentType string, body []byte) error {
	_, err := storage.client.PutObject(ctx, &s3.PutObjectInput{Bucket: &storage.bucket, Key: &key, ContentType: &contentType, Body: bytes.NewReader(body)})
	return err
}

func (storage *S3ObjectStorage) Exists(ctx context.Context, key string) (bool, int64, error) {
	head, err := storage.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &storage.bucket, Key: &key})
	var apiError smithy.APIError
	if errors.As(err, &apiError) && (apiError.ErrorCode() == "NotFound" || apiError.ErrorCode() == "NoSuchKey") {
		return false, 0, nil
	}
	if err != nil {
		return false, 0, err
	}
	return true, aws.ToInt64(head.ContentLength), nil
}

type MemoryObjectStorage struct {
	mutex   sync.Mutex
	Objects map[string][]byte
}

func NewMemoryObjectStorage() *MemoryObjectStorage {
	return &MemoryObjectStorage{Objects: map[string][]byte{}}
}

func (storage *MemoryObjectStorage) PresignUpload(_ context.Context, key, _ string, _ int64, _ time.Duration) (interfaces.ObjectUploadTicket, error) {
	return interfaces.ObjectUploadTicket{Url: "memory://upload/" + key, Headers: map[string]string{}}, nil
}

func (storage *MemoryObjectStorage) PresignDownload(_ context.Context, key string, _ time.Duration) (string, error) {
	return "memory://download/" + key, nil
}

func (storage *MemoryObjectStorage) PutObject(_ context.Context, key, _ string, body []byte) error {
	storage.mutex.Lock()
	defer storage.mutex.Unlock()
	storage.Objects[key] = body
	return nil
}

func (storage *MemoryObjectStorage) Exists(_ context.Context, key string) (bool, int64, error) {
	storage.mutex.Lock()
	defer storage.mutex.Unlock()
	body, found := storage.Objects[key]
	return found, int64(len(body)), nil
}
