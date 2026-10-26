package integrations

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"

	"nantty/modules/users/src/configs"
)

type UploadTicket struct {
	Url     string
	Headers map[string]string
}

type DocumentStorage interface {
	PresignUpload(ctx context.Context, key, contentType string, sizeBytes int64, timeToLive time.Duration) (UploadTicket, error)
	PresignView(ctx context.Context, key string, timeToLive time.Duration) (string, error)
	Exists(ctx context.Context, key string) (bool, error)
}

type S3DocumentStorage struct {
	bucket    string
	client    *s3.Client
	presigner *s3.PresignClient
}

func NewS3DocumentStorage(ctx context.Context, settings configs.PrivacySettings) (*S3DocumentStorage, error) {
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
	storage := &S3DocumentStorage{bucket: settings.DocumentsBucket, client: client, presigner: s3.NewPresignClient(client)}
	if _, err := client.HeadBucket(ctx, &s3.HeadBucketInput{Bucket: &storage.bucket}); err != nil {
		if _, createErr := client.CreateBucket(ctx, &s3.CreateBucketInput{Bucket: &storage.bucket}); createErr != nil {
			return nil, createErr
		}
	}
	return storage, nil
}

func (storage *S3DocumentStorage) PresignUpload(ctx context.Context, key, contentType string, sizeBytes int64, timeToLive time.Duration) (UploadTicket, error) {
	request, err := storage.presigner.PresignPutObject(ctx, &s3.PutObjectInput{Bucket: &storage.bucket, Key: &key, ContentType: &contentType, ContentLength: aws.Int64(sizeBytes)}, s3.WithPresignExpires(timeToLive))
	if err != nil {
		return UploadTicket{}, err
	}
	headers := map[string]string{}
	for name, values := range request.SignedHeader {
		if len(values) > 0 && name != "Host" {
			headers[name] = values[0]
		}
	}
	return UploadTicket{Url: request.URL, Headers: headers}, nil
}

func (storage *S3DocumentStorage) PresignView(ctx context.Context, key string, timeToLive time.Duration) (string, error) {
	request, err := storage.presigner.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &storage.bucket, Key: &key}, s3.WithPresignExpires(timeToLive))
	if err != nil {
		return "", err
	}
	return request.URL, nil
}

func (storage *S3DocumentStorage) Exists(ctx context.Context, key string) (bool, error) {
	_, err := storage.client.HeadObject(ctx, &s3.HeadObjectInput{Bucket: &storage.bucket, Key: &key})
	var notFound *s3types.NotFound
	if errors.As(err, &notFound) {
		return false, nil
	}
	return err == nil, err
}

var (
	documentStorageMutex  sync.Mutex
	sharedDocumentStorage DocumentStorage
	errDocumentsUnset     = errors.New("document storage is not configured")
)

func DocumentStorageFor(ctx context.Context, settings configs.PrivacySettings) (DocumentStorage, error) {
	documentStorageMutex.Lock()
	defer documentStorageMutex.Unlock()
	if sharedDocumentStorage != nil {
		return sharedDocumentStorage, nil
	}
	storage, err := NewS3DocumentStorage(ctx, settings)
	if err != nil {
		return nil, errors.Join(errDocumentsUnset, err)
	}
	sharedDocumentStorage = storage
	return sharedDocumentStorage, nil
}

func UseDocumentStorageForTests(storage DocumentStorage) {
	documentStorageMutex.Lock()
	sharedDocumentStorage = storage
	documentStorageMutex.Unlock()
}
