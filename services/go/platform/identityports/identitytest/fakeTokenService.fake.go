package identitytest

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"
	"github.com/lestrrat-go/jwx/v3/jwt"

	"nantty/platform/identityports"
	"nantty/platform/staffauth"
)

const (
	FakeIssuer          = "https://auth.nantty.test"
	FakeAccountAudience = "nantty-api"
)

type FakeTokenService struct {
	signingKey jwk.Key
	publicSet  jwk.Set
}

func NewFakeTokenService(t testing.TB) *FakeTokenService {
	t.Helper()
	publicKey, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	signingKey, err := jwk.Import(privateKey)
	if err != nil {
		t.Fatal(err)
	}
	_ = signingKey.Set(jwk.KeyIDKey, "fake-key")
	_ = signingKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	verifyKey, err := jwk.Import(publicKey)
	if err != nil {
		t.Fatal(err)
	}
	_ = verifyKey.Set(jwk.KeyIDKey, "fake-key")
	_ = verifyKey.Set(jwk.AlgorithmKey, jwa.EdDSA())
	set := jwk.NewSet()
	_ = set.AddKey(verifyKey)
	return &FakeTokenService{signingKey: signingKey, publicSet: set}
}

func (service *FakeTokenService) sign(audience string, subject, sessionId string, roles []string, timeToLive time.Duration, ageBracket ...string) (string, error) {
	now := time.Now()
	builder := jwt.NewBuilder().Issuer(FakeIssuer).Audience([]string{audience}).Subject(subject).JwtID(uuid.NewString()).
		IssuedAt(now).NotBefore(now).Expiration(now.Add(timeToLive)).Claim("sid", sessionId).Claim("roles", roles)
	if audience == FakeAccountAudience || audience == "nantty-user-step-up" {
		age := "adult"
		if len(ageBracket) > 0 {
			age = ageBracket[0]
		}
		builder = builder.Claim("age", age)
	}
	token, err := builder.Build()
	if err != nil {
		return "", err
	}
	signed, err := jwt.Sign(token, jwt.WithKey(jwa.EdDSA(), service.signingKey))
	return string(signed), err
}

func (service *FakeTokenService) SignStaffAccessToken(claims identityports.StaffTokenClaims) (string, int, error) {
	token, err := service.sign(staffauth.AccessAudience, claims.StaffId, claims.SessionId, claims.Roles, 10*time.Minute)
	return token, 600, err
}

func (service *FakeTokenService) SignStaffStepUpToken(claims identityports.StaffTokenClaims, timeToLive time.Duration) (string, error) {
	return service.sign(staffauth.StepUpAudience, claims.StaffId, claims.SessionId, claims.Roles, timeToLive)
}

func (service *FakeTokenService) PublishedKeySet(context.Context) (jwk.Set, error) {
	return service.publicSet, nil
}

func (service *FakeTokenService) StaffTokenIssuer() string { return FakeIssuer }

func (service *FakeTokenService) SignAccountAccessToken(t testing.TB, accountId string) string {
	t.Helper()
	token, err := service.sign(FakeAccountAudience, accountId, uuid.NewString(), []string{"buyer"}, 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func (service *FakeTokenService) SignAccountAccessTokenWithAgeForTest(t testing.TB, accountId, ageBracket string) string {
	t.Helper()
	token, err := service.sign(FakeAccountAudience, accountId, uuid.NewString(), []string{"buyer"}, 15*time.Minute, ageBracket)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func (service *FakeTokenService) SignAccountTokensWithStepUpForTest(t testing.TB, accountId string) (accessToken, stepUpToken string) {
	t.Helper()
	sessionId := uuid.NewString()
	accessToken, err := service.sign(FakeAccountAudience, accountId, sessionId, []string{"buyer"}, 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	stepUpToken, err = service.sign("nantty-user-step-up", accountId, sessionId, []string{"buyer"}, 5*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	return accessToken, stepUpToken
}

func (service *FakeTokenService) SignStaffTokensForTest(t testing.TB, role string, permissions []string) (accessToken, stepUpToken, staffId string) {
	t.Helper()
	staffId, sessionId := uuid.NewString(), uuid.NewString()
	claims := identityports.StaffTokenClaims{StaffId: staffId, SessionId: sessionId, Roles: staffauth.RolesClaimForStaff(role, permissions)}
	accessToken, _, err := service.SignStaffAccessToken(claims)
	if err != nil {
		t.Fatal(err)
	}
	stepUpToken, err = service.SignStaffStepUpToken(claims, 5*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	return accessToken, stepUpToken, staffId
}

type FakeAccountDirectory struct {
	mutex           sync.Mutex
	accounts        map[uuid.UUID]identityports.AccountSummary
	Bans            []identityports.BanDetails
	RevokedSessions int
}

func NewFakeAccountDirectory() *FakeAccountDirectory {
	return &FakeAccountDirectory{accounts: map[uuid.UUID]identityports.AccountSummary{}}
}

func (directory *FakeAccountDirectory) AddAccount(username, name string) identityports.AccountSummary {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	email := username + "@example.com"
	summary := identityports.AccountSummary{ID: uuid.New(), Username: username, Name: name, Email: &email, Roles: []string{"buyer"}, EmailVerified: true, Active: true, Status: "active", CreatedAt: time.Now().Add(-90 * 24 * time.Hour)}
	directory.accounts[summary.ID] = summary
	return summary
}

func (directory *FakeAccountDirectory) FindAccountSummary(_ context.Context, accountId uuid.UUID) (identityports.AccountSummary, bool, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	summary, found := directory.accounts[accountId]
	return summary, found, nil
}

func (directory *FakeAccountDirectory) FindAccountSummaryByUsername(_ context.Context, username string) (identityports.AccountSummary, bool, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	for _, existing := range directory.accounts {
		if existing.Username == username {
			return existing, true, nil
		}
	}
	return identityports.AccountSummary{}, false, nil
}

func (directory *FakeAccountDirectory) IsUsernameTaken(_ context.Context, username string, excludingAccountId uuid.UUID) (bool, error) {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	for _, existing := range directory.accounts {
		if existing.Username == username && existing.ID != excludingAccountId {
			return true, nil
		}
	}
	return false, nil
}

func (directory *FakeAccountDirectory) RenameAccountUsername(_ context.Context, accountId uuid.UUID, username string) error {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	for _, existing := range directory.accounts {
		if existing.Username == username && existing.ID != accountId {
			return identityports.ErrUsernameAlreadyTaken
		}
	}
	summary := directory.accounts[accountId]
	summary.Username = username
	directory.accounts[accountId] = summary
	return nil
}

func (directory *FakeAccountDirectory) DeactivateAccountAndRevokeSessions(_ context.Context, accountId uuid.UUID) error {
	directory.mutex.Lock()
	defer directory.mutex.Unlock()
	summary := directory.accounts[accountId]
	summary.Active, summary.Status = false, "deactivated"
	directory.accounts[accountId] = summary
	return nil
}
