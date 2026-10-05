package loaders

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/redis/go-redis/v9"

	"zudomart/modules/ads/src/configs"
	"zudomart/modules/ads/src/container"
	"zudomart/modules/ads/src/generated/ent"
	"zudomart/modules/ads/src/integrations"
	"zudomart/modules/ads/src/interfaces"
	"zudomart/modules/ads/src/services"
	platformevents "zudomart/platform/events"
	"zudomart/platform/idempotency"
	"zudomart/platform/jwtauth"
	"zudomart/platform/staffaudit"
	"zudomart/platform/staffauth"
)

type Collaborators struct {
	Publisher platformevents.DomainEventPublisher
	Funding   interfaces.FundingGateway
	Consent   interfaces.ConsentReader
	Stores    interfaces.StoreDirectory
	Pctr      interfaces.PctrScorer
	Fraud     interfaces.FraudModelScorer
	Counters  interfaces.CounterStore
	Users     interfaces.UserDirectory
	Signals   interfaces.ContentSignalReader
	Source    interfaces.AudienceMemberSource
	Identity  interfaces.IdentityMatcher
	Content   interfaces.ContentSourceDirectory
	Ownership interfaces.DestinationOwnership
	Storage   interfaces.ObjectStorage
	TopUps    interfaces.TopUpGateway
	History   interfaces.AuditHistoryReader
	Summaries interfaces.PlatformUserSummaries
	Audit     staffaudit.Recorder
	Jobs      platformevents.JobQueue
	Access    *jwtauth.AccessTokenVerifier
	Staff     *jwtauth.AccessTokenVerifier
	Now       func() time.Time
}

func AssembleContainer(ctx context.Context, settings configs.AdsSettings, collaborators Collaborators, client *ent.Client, database *sql.DB, logger *slog.Logger) (*container.Container, []func() error, error) {
	var closers []func() error
	now := collaborators.Now
	if now == nil {
		now = time.Now
	}
	accessVerifier, staffVerifier := collaborators.Access, collaborators.Staff
	var err error
	if accessVerifier == nil {
		if accessVerifier, err = jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.AccessTokenJwksUrl, settings.TokenIssuer, settings.TokenAudience); err != nil {
			return nil, nil, err
		}
	}
	if staffVerifier == nil {
		if staffVerifier, err = jwtauth.NewAccessTokenVerifierFromRemoteJwks(ctx, settings.StaffJwksUrl, settings.StaffTokenIssuer, staffauth.AccessAudience); err != nil {
			return nil, nil, err
		}
	}
	counters, idempotencyStore, redisClosers := openRedisBackedStores(settings, collaborators, now, logger)
	closers = append(closers, redisClosers...)
	keys := make(map[string][]byte, len(settings.AdTokenKeys))
	for id, secret := range settings.AdTokenKeys {
		keys[id] = []byte(secret)
	}
	spend := services.SpendCounters{Store: counters}
	platformSettings := integrations.NewPlatformSettingsSource(database, settings.AdminSchema, settings.PlatformSettingsTtl, logger)
	deployed := &container.Container{
		Client: client, Database: database, Settings: settings, Logger: logger, Now: now, AccessVerifier: accessVerifier, StaffVerifier: staffVerifier, IdempotencyStore: idempotencyStore,
		Counters: counters, Frequency: services.FrequencyGuard{Store: counters}, Spend: spend,
		Signer:     services.AdTokenSigner{ActiveKeyId: settings.AdTokenActiveKeyId, Keys: keys, TimeToLive: settings.AdTokenTimeToLive, Now: now},
		Policies:   &services.PolicySource{Client: client, Now: now, Settings: platformSettings, ShareBps: settings.CreatorShareBps},
		Pricing:    &services.RegionalAdPricing{Settings: platformSettings, Rates: integrations.NewCurrencyExchangeRates(database, settings.CurrencySchema, 5*time.Minute, logger), Population: settings.PopulationByCountry},
		Candidates: &services.CandidateIndex{Client: client, Spend: spend, Now: now, Refresh: settings.CandidateRefresh},
		Signals:    collaborators.Signals,
		Users:      collaborators.Users,
	}
	if deployed.Signals == nil {
		deployed.Signals = integrations.EntContentSignalReader{Client: client}
	}
	if deployed.Users == nil {
		deployed.Users = integrations.AuthSchemaUserDirectory{Database: database, Schema: "auth"}
	}
	completeCollaborators(deployed, collaborators, settings, database)
	completeStaffAndMoneyCollaborators(deployed, collaborators, settings)
	if err := completeStorageAndJobs(ctx, deployed, collaborators, settings); err != nil {
		return nil, nil, err
	}
	if err := refuseFakeFundingInProduction(deployed.Funding, settings); err != nil {
		return nil, nil, err
	}
	return deployed, closers, nil
}

func openRedisBackedStores(settings configs.AdsSettings, collaborators Collaborators, now func() time.Time, logger *slog.Logger) (interfaces.CounterStore, *idempotency.RedisStore, []func() error) {
	if collaborators.Counters != nil {
		return collaborators.Counters, nil, nil
	}
	if settings.RedisUrl == "" {
		logger.Warn("ADS_REDIS_URL is not set: caps and pacing counters live in this process only")
		return integrations.NewMemoryCounterStore(now), nil, nil
	}
	options, err := redis.ParseURL(settings.RedisUrl)
	if err != nil {
		logger.Warn("ADS_REDIS_URL is invalid: caps and pacing counters live in this process only")
		return integrations.NewMemoryCounterStore(now), nil, nil
	}
	redisClient := redis.NewClient(options)
	return integrations.RedisCounterStore{Client: redisClient, Prefix: "ads:"}, idempotency.NewRedisStore(redisClient, "ads:idempotency"), []func() error{redisClient.Close}
}

func completeCollaborators(deployed *container.Container, collaborators Collaborators, settings configs.AdsSettings, database *sql.DB) {
	deployed.Consent = collaborators.Consent
	if deployed.Consent == nil {
		deployed.Consent = integrations.UsersSchemaConsentReader{Database: database, Schema: settings.UsersSchema}
	}
	deployed.AudienceSource = collaborators.Source
	if deployed.AudienceSource == nil {
		deployed.AudienceSource = integrations.UnavailableAudienceSource{}
		if settings.ContentSourcesUrl != "" || settings.CommerceInternalUrl != "" {
			deployed.AudienceSource = integrations.NewHttpAudienceSource(integrations.InternalEndpoint{BaseUrl: settings.ContentSourcesUrl, Token: settings.ContentSourcesToken},
				integrations.InternalEndpoint{BaseUrl: settings.CommerceInternalUrl, Token: settings.CommerceInternalToken})
		}
	}
	deployed.Identity = collaborators.Identity
	if deployed.Identity == nil {
		deployed.Identity = integrations.AuthSchemaIdentityMatcher{Database: database, Schema: "auth"}
	}
	deployed.ContentSources = collaborators.Content
	if deployed.ContentSources == nil {
		deployed.ContentSources = integrations.NoContentSourceDirectory{}
		if settings.ContentSourcesUrl != "" {
			deployed.ContentSources = integrations.HttpContentSourceDirectory{BaseUrl: settings.ContentSourcesUrl, Token: settings.ContentSourcesToken, Timeout: 3 * time.Second, Http: &http.Client{}}
		}
	}
	deployed.Ownership = collaborators.Ownership
	if deployed.Ownership == nil {
		deployed.Ownership = selectDestinationOwnership(settings, deployed.Logger)
	}
	deployed.Stores = collaborators.Stores
	if deployed.Stores == nil {
		deployed.Stores = integrations.NoStoreDirectory{}
	}
	deployed.Funding = collaborators.Funding
	if deployed.Funding == nil {
		deployed.Funding = selectMoneyFundingGateway(settings, deployed.Logger)
	}
	if deployed.Funding == nil {
		deployed.Funding = integrations.UnconfiguredFundingGateway{}
		if settings.AllowInMemoryFunding {
			deployed.Logger.Warn("no money gateway is configured: wallet boosts use an in-memory fake that moves no real money")
			deployed.Funding = integrations.NewInMemoryFundingGateway()
		}
	}
	intelligence := &integrations.IntelligenceClient{BaseUrl: settings.IntelligenceUrl, Secret: settings.IntelligenceSecret, Timeout: settings.IntelligenceTimeout, Http: &http.Client{}, Now: deployed.Now}
	deployed.Pctr = collaborators.Pctr
	if deployed.Pctr == nil {
		deployed.Pctr = integrations.PctrWithFallbackScorer{Client: intelligence, Fallback: integrations.DeterministicPctrScorer{BaselinePpm: settings.BaselineCtrPpm}}
	}
	deployed.FraudModel = collaborators.Fraud
	if deployed.FraudModel == nil {
		deployed.FraudModel = integrations.IntelligenceFraudScorer{Client: intelligence}
	}
}

func completeStorageAndJobs(ctx context.Context, deployed *container.Container, collaborators Collaborators, settings configs.AdsSettings) error {
	deployed.Storage = collaborators.Storage
	if deployed.Storage == nil && settings.AssetsBucket != "" {
		storage, err := integrations.NewS3ObjectStorage(ctx, settings.AssetsBucket, settings.S3Endpoint)
		if err != nil {
			return err
		}
		deployed.Storage = storage
	}
	if deployed.Storage == nil && !settings.IsProduction() {
		deployed.Logger.Warn("ADS_ASSETS_BUCKET is not set: creative uploads and report files live in this process only")
		deployed.Storage = integrations.NewMemoryObjectStorage()
	}
	deployed.Jobs = collaborators.Jobs
	if deployed.Jobs == nil && settings.ReportQueueName != "" {
		jobs, consumer, err := platformevents.CreateJobQueueAndConsumerFromEnvironment(ctx, platformevents.MessageBusSelection{DeployableName: "go-ads", Logger: deployed.Logger, IsProduction: settings.IsProduction()})
		if err != nil {
			return err
		}
		if jobs != nil {
			deployed.Jobs, deployed.QueueConsumer = jobs, consumer
		}
	}
	return nil
}

func refuseFakeFundingInProduction(funding interfaces.FundingGateway, settings configs.AdsSettings) error {
	if _, fake := funding.(*integrations.InMemoryFundingGateway); fake && settings.IsProduction() {
		return errors.New("the in-memory funding gateway moves no real money and is refused in production")
	}
	return nil
}

func selectMoneyFundingGateway(settings configs.AdsSettings, logger *slog.Logger) interfaces.FundingGateway {
	var fallback *integrations.HttpMoneyFundingGateway
	if settings.MoneyHttpUrl != "" {
		fallback = &integrations.HttpMoneyFundingGateway{BaseUrl: settings.MoneyHttpUrl, Token: settings.MoneyInternalToken, Http: &http.Client{Timeout: 5 * time.Second}}
	}
	if settings.MoneyGrpcAddress != "" {
		gateway, err := integrations.DialGrpcMoneyFundingGateway(settings.MoneyGrpcAddress, settings.MoneyInternalToken, fallback)
		if err == nil {
			return gateway
		}
		logger.Warn("money gRPC dial failed, using the HTTP fallback", slog.Any("error", err))
	}
	if fallback != nil {
		return fallback
	}
	return nil
}

func selectDestinationOwnership(settings configs.AdsSettings, logger *slog.Logger) interfaces.DestinationOwnership {
	social := integrations.InternalEndpoint{BaseUrl: settings.ContentSourcesUrl, Token: settings.ContentSourcesToken}
	commerce := integrations.InternalEndpoint{BaseUrl: settings.CommerceInternalUrl, Token: settings.CommerceInternalToken}
	identity := integrations.InternalEndpoint{BaseUrl: settings.IdentityInternalUrl, Token: settings.IdentityInternalToken}
	if social.BaseUrl != "" || commerce.BaseUrl != "" || identity.BaseUrl != "" {
		return integrations.HttpDestinationOwnership{Social: social, Commerce: commerce, Identity: identity, Http: &http.Client{}}
	}
	if settings.IsProduction() {
		return integrations.DenyAllOwnership{}
	}
	logger.Warn("no ownership services are configured: any post, product, store or profile may be promoted in this environment")
	return integrations.AllowAllOwnership{}
}
