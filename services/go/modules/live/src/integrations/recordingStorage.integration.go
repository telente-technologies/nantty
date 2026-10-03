package integrations

import (
	"context"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type S3RecordingStorage struct {
	bucket    string
	presigner *s3.PresignClient
}

func NewS3RecordingStorage(ctx context.Context, bucket, region, endpoint string) (*S3RecordingStorage, error) {
	awsConfig, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awsConfig, func(options *s3.Options) {
		if endpoint != "" {
			options.BaseEndpoint = aws.String(endpoint)
			options.UsePathStyle = true
		}
	})
	return &S3RecordingStorage{bucket: bucket, presigner: s3.NewPresignClient(client)}, nil
}

func (storage *S3RecordingStorage) PresignDownload(ctx context.Context, objectKey string, timeToLive time.Duration) (string, error) {
	request, err := storage.presigner.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: &storage.bucket, Key: &objectKey}, s3.WithPresignExpires(timeToLive))
	if err != nil {
		return "", err
	}
	return request.URL, nil
}
