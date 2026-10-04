package integrations

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
)

var ErrLiveSafetyStorageUnavailable = errors.New("live safety storage is not configured")

type EvidenceVault interface {
	PreserveFrameAsEvidence(ctx context.Context, frameKey, incidentId string) (string, error)
}

type FramePreviewSigner interface {
	PresignFramePreview(ctx context.Context, frameKey string, lifetime time.Duration) (string, error)
}

type LiveSafetyStorageOptions struct {
	FramesBucket     string
	Region           string
	Endpoint         string
	EvidenceBucket   string
	EvidenceKmsKeyId string
	EvidencePrefix   string
}

type S3LiveSafetyStorage struct {
	client    *s3.Client
	presigner *s3.PresignClient
	options   LiveSafetyStorageOptions
}

func NewS3LiveSafetyStorage(ctx context.Context, options LiveSafetyStorageOptions) (*S3LiveSafetyStorage, error) {
	awsConfig, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(options.Region))
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(awsConfig, func(s3Options *s3.Options) {
		if options.Endpoint != "" {
			s3Options.BaseEndpoint = aws.String(options.Endpoint)
			s3Options.UsePathStyle = true
		}
	})
	return &S3LiveSafetyStorage{client: client, presigner: s3.NewPresignClient(client), options: options}, nil
}

func (storage *S3LiveSafetyStorage) PresignFramePreview(ctx context.Context, frameKey string, lifetime time.Duration) (string, error) {
	if storage.options.FramesBucket == "" || frameKey == "" {
		return "", ErrLiveSafetyStorageUnavailable
	}
	request, err := storage.presigner.PresignGetObject(ctx, &s3.GetObjectInput{Bucket: aws.String(storage.options.FramesBucket), Key: aws.String(frameKey)}, s3.WithPresignExpires(lifetime))
	if err != nil {
		return "", err
	}
	return request.URL, nil
}

func (storage *S3LiveSafetyStorage) PreserveFrameAsEvidence(ctx context.Context, frameKey, incidentId string) (string, error) {
	if storage.options.EvidenceBucket == "" || storage.options.FramesBucket == "" || frameKey == "" {
		return "", ErrLiveSafetyStorageUnavailable
	}
	evidenceKey := storage.options.EvidencePrefix + incidentId + "/" + frameKey[strings.LastIndex(frameKey, "/")+1:]
	input := &s3.CopyObjectInput{
		Bucket: aws.String(storage.options.EvidenceBucket), Key: aws.String(evidenceKey),
		CopySource:                aws.String(url.PathEscape(storage.options.FramesBucket + "/" + frameKey)),
		ServerSideEncryption:      types.ServerSideEncryptionAwsKms,
		ObjectLockLegalHoldStatus: types.ObjectLockLegalHoldStatusOn,
		TaggingDirective:          types.TaggingDirectiveReplace,
		Tagging:                   aws.String("classification=restricted-legal&incident=" + url.QueryEscape(incidentId)),
	}
	if storage.options.EvidenceKmsKeyId != "" {
		input.SSEKMSKeyId = aws.String(storage.options.EvidenceKmsKeyId)
	}
	if _, err := storage.client.CopyObject(ctx, input); err != nil {
		return "", err
	}
	return evidenceKey, nil
}

type UnconfiguredLiveSafetyStorage struct{}

func (UnconfiguredLiveSafetyStorage) PresignFramePreview(context.Context, string, time.Duration) (string, error) {
	return "", ErrLiveSafetyStorageUnavailable
}

func (UnconfiguredLiveSafetyStorage) PreserveFrameAsEvidence(context.Context, string, string) (string, error) {
	return "", ErrLiveSafetyStorageUnavailable
}
