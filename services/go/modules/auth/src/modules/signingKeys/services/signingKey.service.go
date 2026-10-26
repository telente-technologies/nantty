package services

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/lestrrat-go/jwx/v3/jwa"
	"github.com/lestrrat-go/jwx/v3/jwk"

	"nantty/modules/auth/src/generated/ent"
	"nantty/modules/auth/src/generated/ent/signingkey"
	"nantty/modules/auth/src/utils"
)

type Settings struct {
	EncryptionKey         []byte
	RotationInterval      time.Duration
	AccessTokenTimeToLive time.Duration
}

type SigningKeyService struct {
	client           *ent.Client
	settings         Settings
	now              func() time.Time
	mutex            sync.RWMutex
	activePrivateKey jwk.Key
	activeKeyId      string
	activeCreatedAt  time.Time
	publishedKeySet  jwk.Set
}

var ErrNoActiveSigningKey = errors.New("no active signing key")

func NewSigningKeyService(client *ent.Client, settings Settings, now func() time.Time) *SigningKeyService {
	return &SigningKeyService{client: client, settings: settings, now: now, publishedKeySet: jwk.NewSet()}
}

func (service *SigningKeyService) CurrentSigningKey() (jwk.Key, error) {
	service.mutex.RLock()
	defer service.mutex.RUnlock()
	if service.activePrivateKey == nil {
		return nil, ErrNoActiveSigningKey
	}
	return service.activePrivateKey, nil
}

func (service *SigningKeyService) PublishedPublicKeySet(context.Context) (jwk.Set, error) {
	service.mutex.RLock()
	defer service.mutex.RUnlock()
	return service.publishedKeySet, nil
}

const keyActivationDelayCoveringJwksCaches = 20 * time.Minute

func (service *SigningKeyService) RotateSigningKeyWhenDueAndReloadKeys(ctx context.Context) error {
	newest, err := service.client.SigningKey.Query().Where(signingkey.RetiredAtIsNil()).Order(ent.Desc(signingkey.FieldCreatedAt)).First(ctx)
	if err != nil && !ent.IsNotFound(err) {
		return fmt.Errorf("load newest signing key: %w", err)
	}
	if newest == nil || service.now().Sub(newest.CreatedAt) >= service.settings.RotationInterval {
		if err := service.RotateSigningKey(ctx); err != nil {
			return err
		}
	}
	if err := service.ReloadSigningKeysFromDatabase(ctx); err != nil {
		return err
	}
	return service.retireKeysSupersededByActiveKey(ctx)
}

func (service *SigningKeyService) retireKeysSupersededByActiveKey(ctx context.Context) error {
	service.mutex.RLock()
	activeKeyId := service.activeKeyId
	activeCreatedAt := service.activeCreatedAt
	service.mutex.RUnlock()
	if activeKeyId == "" {
		return nil
	}
	now := service.now()
	return service.client.SigningKey.Update().
		Where(signingkey.RetiredAtIsNil(), signingkey.IDNEQ(activeKeyId), signingkey.CreatedAtLT(activeCreatedAt)).
		SetRetiredAt(now).
		SetPublishedUntil(now.Add(service.settings.AccessTokenTimeToLive + 5*time.Minute)).
		Exec(ctx)
}

func (service *SigningKeyService) RotateSigningKey(ctx context.Context) error {
	_, privateKey, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return err
	}
	keyId, err := utils.GenerateOpaqueUrlSafeToken()
	if err != nil {
		return err
	}
	keyId = keyId[:22]
	publicJwk, err := buildJwk(privateKey.Public(), keyId)
	if err != nil {
		return err
	}
	encodedPublicJwk, err := json.Marshal(publicJwk)
	if err != nil {
		return err
	}
	privateDer, err := x509.MarshalPKCS8PrivateKey(privateKey)
	if err != nil {
		return err
	}
	sealedPrivateKey, err := utils.SealWithAesGcm(service.settings.EncryptionKey, privateDer)
	if err != nil {
		return err
	}
	now := service.now()
	return service.client.SigningKey.Create().SetID(keyId).SetAlgorithm(jwa.EdDSA().String()).SetPublicKeyJwk(encodedPublicJwk).
		SetEncryptedPrivateKey(sealedPrivateKey).SetCreatedAt(now).SetPublishedUntil(now.Add(100 * 365 * 24 * time.Hour)).Exec(ctx)
}

func (service *SigningKeyService) ReloadSigningKeysFromDatabase(ctx context.Context) error {
	keys, err := service.client.SigningKey.Query().Where(signingkey.PublishedUntilGT(service.now())).Order(ent.Desc(signingkey.FieldCreatedAt)).All(ctx)
	if err != nil {
		return fmt.Errorf("load signing keys: %w", err)
	}
	publishedSet := jwk.NewSet()
	for _, stored := range keys {
		publicKey, err := jwk.ParseKey(stored.PublicKeyJwk)
		if err != nil {
			return fmt.Errorf("parse public key %s: %w", stored.ID, err)
		}
		if err := publishedSet.AddKey(publicKey); err != nil {
			return err
		}
	}
	activeStored := ChooseActiveSigningKey(keys, service.now(), keyActivationDelayCoveringJwksCaches)
	var activePrivateKey jwk.Key
	if activeStored != nil {
		if activePrivateKey, err = service.decryptPrivateKey(activeStored); err != nil {
			return err
		}
	}
	service.mutex.Lock()
	defer service.mutex.Unlock()
	service.publishedKeySet = publishedSet
	service.activePrivateKey = activePrivateKey
	if activeStored != nil {
		service.activeKeyId, service.activeCreatedAt = activeStored.ID, activeStored.CreatedAt
	}
	return nil
}

func (service *SigningKeyService) RunRotationAndReloadLoopUntilContextDone(ctx context.Context, onError func(error)) error {
	reloadTicker := time.NewTicker(time.Minute)
	defer reloadTicker.Stop()
	rotationTicker := time.NewTicker(time.Hour)
	defer rotationTicker.Stop()
	for {
		var err error
		select {
		case <-ctx.Done():
			return nil
		case <-reloadTicker.C:
			err = service.ReloadSigningKeysFromDatabase(ctx)
		case <-rotationTicker.C:
			err = service.RotateSigningKeyWhenDueAndReloadKeys(ctx)
		}
		if err != nil && ctx.Err() == nil {
			onError(err)
		}
	}
}

func (service *SigningKeyService) decryptPrivateKey(stored *ent.SigningKey) (jwk.Key, error) {
	privateDer, err := utils.OpenWithAesGcm(service.settings.EncryptionKey, stored.EncryptedPrivateKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt signing key %s: %w", stored.ID, err)
	}
	privateKey, err := x509.ParsePKCS8PrivateKey(privateDer)
	if err != nil {
		return nil, err
	}
	return buildJwk(privateKey, stored.ID)
}

func ChooseActiveSigningKey(keysNewestFirst []*ent.SigningKey, now time.Time, activationDelay time.Duration) *ent.SigningKey {
	var oldestUnretired *ent.SigningKey
	for _, stored := range keysNewestFirst {
		if stored.RetiredAt != nil {
			continue
		}
		if !stored.CreatedAt.Add(activationDelay).After(now) {
			return stored
		}
		oldestUnretired = stored
	}
	return oldestUnretired
}

func buildJwk(raw any, keyId string) (jwk.Key, error) {
	key, err := jwk.Import(raw)
	if err != nil {
		return nil, err
	}
	if err := key.Set(jwk.KeyIDKey, keyId); err != nil {
		return nil, err
	}
	if err := key.Set(jwk.AlgorithmKey, jwa.EdDSA()); err != nil {
		return nil, err
	}
	if err := key.Set(jwk.KeyUsageKey, "sig"); err != nil {
		return nil, err
	}
	return key, nil
}
