package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	commonv1 "zudomart/contracts/gen/go/zudomart/common/v1"
	moneyv1 "zudomart/contracts/gen/go/zudomart/money/v1"
	adserrors "zudomart/modules/ads/src/errors"
)

type GrpcMoneyFundingGateway struct {
	connection *grpc.ClientConn
	service    moneyv1.AdsMoneyServiceClient
	Token      string
	Timeout    time.Duration
	Fallback   *HttpMoneyFundingGateway
}

func DialGrpcMoneyFundingGateway(address, token string, fallback *HttpMoneyFundingGateway) (*GrpcMoneyFundingGateway, error) {
	connection, err := grpc.NewClient(address, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, err
	}
	return &GrpcMoneyFundingGateway{connection: connection, service: moneyv1.NewAdsMoneyServiceClient(connection), Token: token, Timeout: 5 * time.Second, Fallback: fallback}, nil
}

func (gateway *GrpcMoneyFundingGateway) Close() error { return gateway.connection.Close() }

func (gateway *GrpcMoneyFundingGateway) outgoing(ctx context.Context) (context.Context, context.CancelFunc) {
	ctx, cancel := context.WithTimeout(ctx, gateway.Timeout)
	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+gateway.Token), cancel
}

func (gateway *GrpcMoneyFundingGateway) ChargeUserWalletForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error {
	attempt, cancel := gateway.outgoing(ctx)
	defer cancel()
	_, err := gateway.service.DebitWalletForBoost(attempt, &moneyv1.DebitWalletForBoostRequest{UserId: userId, Amount: &commonv1.Money{AmountMinor: amountMinor, Currency: currency}, IdempotencyKey: idempotencyKey})
	if status.Code(err) == codes.Unavailable && gateway.Fallback != nil {
		return gateway.Fallback.ChargeUserWalletForBoost(ctx, userId, currency, amountMinor, idempotencyKey)
	}
	return translateMoneyFundingError(err)
}

func (gateway *GrpcMoneyFundingGateway) ChargeEarningsForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error {
	if gateway.Fallback == nil {
		return adserrors.UpstreamUnavailable
	}
	return gateway.Fallback.ChargeEarningsForBoost(ctx, userId, currency, amountMinor, idempotencyKey)
}

func (gateway *GrpcMoneyFundingGateway) RefundBoostCharge(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey, debitIdempotencyKey string) error {
	attempt, cancel := gateway.outgoing(ctx)
	defer cancel()
	_, err := gateway.service.RefundBoostRemainder(attempt, &moneyv1.RefundBoostRemainderRequest{UserId: userId, Amount: &commonv1.Money{AmountMinor: amountMinor, Currency: currency}, IdempotencyKey: idempotencyKey, DebitIdempotencyKey: debitIdempotencyKey})
	if status.Code(err) == codes.Unavailable && gateway.Fallback != nil {
		return gateway.Fallback.RefundBoostCharge(ctx, userId, currency, amountMinor, idempotencyKey, debitIdempotencyKey)
	}
	return translateMoneyFundingError(err)
}

func translateMoneyFundingError(err error) error {
	if err == nil {
		return nil
	}
	described, _ := status.FromError(err)
	for _, detail := range described.Details() {
		if info, isInfo := detail.(*errdetails.ErrorInfo); isInfo {
			switch info.GetReason() {
			case "INSUFFICIENT_FUNDS":
				return adserrors.InsufficientBalance
			case "IDEMPOTENCY_KEY_REUSED":
				return adserrors.IdempotencyKeyReused
			case "WALLET_DEBT_OUTSTANDING":
				return adserrors.WalletDebtOutstanding
			case "WALLET_DAILY_LIMIT":
				return adserrors.WalletDailyLimitReached
			}
		}
	}
	return adserrors.UpstreamUnavailable
}

type HttpMoneyFundingGateway struct {
	BaseUrl string
	Token   string
	Http    *http.Client
}

func (gateway *HttpMoneyFundingGateway) ChargeUserWalletForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error {
	return gateway.post(ctx, "/api/v1/internal/ads/boost-debits", map[string]any{"userId": userId, "amount": map[string]any{"amountMinor": amountMinor, "currency": currency}, "idempotencyKey": idempotencyKey})
}

func (gateway *HttpMoneyFundingGateway) ChargeEarningsForBoost(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey string) error {
	return gateway.post(ctx, "/api/v1/internal/ads/boost-earnings-debits", map[string]any{"userId": userId, "amount": map[string]any{"amountMinor": amountMinor, "currency": currency}, "idempotencyKey": idempotencyKey})
}

func (gateway *HttpMoneyFundingGateway) RefundBoostCharge(ctx context.Context, userId, currency string, amountMinor int64, idempotencyKey, debitIdempotencyKey string) error {
	return gateway.post(ctx, "/api/v1/internal/ads/boost-refunds", map[string]any{"userId": userId, "amount": map[string]any{"amountMinor": amountMinor, "currency": currency}, "idempotencyKey": idempotencyKey, "debitIdempotencyKey": debitIdempotencyKey})
}

func (gateway *HttpMoneyFundingGateway) post(ctx context.Context, path string, body any) error {
	encoded, err := json.Marshal(body)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(gateway.BaseUrl, "/")+path, bytes.NewReader(encoded))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Internal-Token", gateway.Token)
	response, err := gateway.Http.Do(request)
	if err != nil {
		return adserrors.UpstreamUnavailable
	}
	defer response.Body.Close()
	if response.StatusCode >= 200 && response.StatusCode < 300 {
		return nil
	}
	var failure struct {
		Code string `json:"code"`
	}
	_ = json.NewDecoder(response.Body).Decode(&failure)
	switch failure.Code {
	case "INSUFFICIENT_FUNDS":
		return adserrors.InsufficientBalance
	case "IDEMPOTENCY_KEY_REUSED":
		return adserrors.IdempotencyKeyReused
	case "WALLET_DEBT_OUTSTANDING":
		return adserrors.WalletDebtOutstanding
	case "WALLET_DAILY_LIMIT":
		return adserrors.WalletDailyLimitReached
	case "VERIFICATION_REQUIRED":
		return adserrors.VerificationRequired
	case "VERIFICATION_UNAVAILABLE":
		return adserrors.VerificationUnavailable
	}
	return adserrors.UpstreamUnavailable
}
