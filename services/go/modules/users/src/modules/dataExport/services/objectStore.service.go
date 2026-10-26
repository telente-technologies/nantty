package services

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"

	"nantty/modules/users/src/configs"
)

type ObjectStore interface {
	EnsureBucket(ctx context.Context) error
	Put(ctx context.Context, key string, body []byte, contentType string) error
	Delete(ctx context.Context, key string) error
	PresignGet(ctx context.Context, key string, timeToLive time.Duration) (string, error)
}

type S3ObjectStore struct {
	bucket    string
	client    *s3.Client
	presigner *s3.PresignClient
}

func NewS3ObjectStore(ctx context.Context, settings configs.PrivacySettings) (*S3ObjectStore, error) {
	awsConfig, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(settings.ExportRegion))
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awsConfig, func(options *s3.Options) {
		options.RequestChecksumCalculation = aws.RequestChecksumCalculationWhenRequired
		options.ResponseChecksumValidation = aws.ResponseChecksumValidationWhenRequired
		if settings.ExportObjectEndpoint != "" {
			options.BaseEndpoint = aws.String(settings.ExportObjectEndpoint)
			options.UsePathStyle = true
		}
	})
	return &S3ObjectStore{bucket: settings.ExportBucket, client: client, presigner: s3.NewPresignClient(client)}, nil
}

func (store *S3ObjectStore) EnsureBucket(ctx context.Context) error {
	if _, err := store.client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &store.bucket}); err == nil {
		return nil
	}
	_, err := store.client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &store.bucket})
	return err
}

func (store *S3ObjectStore) Put(ctx context.Context, key string, body []byte, contentType string) error {
	_, err := store.client.PutObject(ctx, &s3.PutObjectInput{Bucket: &store.bucket, Key: &key, Body: bytes.NewReader(body), ContentType: &contentType, ContentLength: aws.Int64(int64(len(body)))})
	return err
}

func (store *S3ObjectStore) Delete(ctx context.Context, key string) error {
	_, err := store.client.DeleteObject(ctx, &s3.DeleteObjectInput{Bucket: &store.bucket, Key: &key})
	return err
}

func (store *S3ObjectStore) PresignGet(ctx context.Context, key string, timeToLive time.Duration) (string, error) {
	request, err := store.presigner.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &store.bucket, Key: &key}, s3.WithPresignExpires(timeToLive))
	if err != nil {
		return "", err
	}
	return request.URL, nil
}

var (
	objectStoreMutex    sync.Mutex
	sharedObjectStore   ObjectStore
	errObjectStoreUnset = errors.New("object store is not configured")
)

func ObjectStoreFor(ctx context.Context, settings configs.PrivacySettings) (ObjectStore, error) {
	objectStoreMutex.Lock()
	defer objectStoreMutex.Unlock()
	if sharedObjectStore != nil {
		return sharedObjectStore, nil
	}
	store, err := NewS3ObjectStore(ctx, settings)
	if err != nil {
		return nil, errors.Join(errObjectStoreUnset, err)
	}
	if err := store.EnsureBucket(ctx); err != nil {
		return nil, err
	}
	sharedObjectStore = store
	return sharedObjectStore, nil
}

func UseObjectStoreForTests(store ObjectStore) {
	objectStoreMutex.Lock()
	sharedObjectStore = store
	objectStoreMutex.Unlock()
}
