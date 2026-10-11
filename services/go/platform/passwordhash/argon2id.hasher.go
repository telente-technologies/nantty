package passwordhash

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

type Argon2idParameters struct {
	MemoryKibibytes uint32
	Iterations      uint32
	Parallelism     uint8
	SaltLength      uint32
	KeyLength       uint32
}

var RecommendedArgon2idParameters = Argon2idParameters{MemoryKibibytes: 19 * 1024, Iterations: 2, Parallelism: 1, SaltLength: 16, KeyLength: 32}

var ErrMalformedPasswordHash = errors.New("malformed argon2id hash")

type PasswordHasher struct {
	parameters        Argon2idParameters
	dummyPasswordHash string
}

func NewPasswordHasher(parameters Argon2idParameters) *PasswordHasher {
	hasher := &PasswordHasher{parameters: parameters}
	hasher.dummyPasswordHash, _ = hasher.HashPasswordWithArgon2id(randomDummyPassword())
	return hasher
}

func (hasher *PasswordHasher) HashPasswordWithArgon2id(password string) (string, error) {
	salt := make([]byte, hasher.parameters.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key := argon2.IDKey([]byte(password), salt, hasher.parameters.Iterations, hasher.parameters.MemoryKibibytes, hasher.parameters.Parallelism, hasher.parameters.KeyLength)
	return fmt.Sprintf("$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s", argon2.Version, hasher.parameters.MemoryKibibytes, hasher.parameters.Iterations, hasher.parameters.Parallelism,
		base64.RawStdEncoding.EncodeToString(salt), base64.RawStdEncoding.EncodeToString(key)), nil
}

func (hasher *PasswordHasher) VerifyPasswordAgainstArgon2idHash(password, encodedHash string) (bool, error) {
	parameters, salt, expectedKey, err := decodeArgon2idHash(encodedHash)
	if err != nil {
		return false, err
	}
	actualKey := argon2.IDKey([]byte(password), salt, parameters.Iterations, parameters.MemoryKibibytes, parameters.Parallelism, uint32(len(expectedKey)))
	return subtle.ConstantTimeCompare(actualKey, expectedKey) == 1, nil
}

func (hasher *PasswordHasher) SpendEquivalentTimeWhenAccountIsMissing(password string) {
	_, _ = hasher.VerifyPasswordAgainstArgon2idHash(password, hasher.dummyPasswordHash)
}

func decodeArgon2idHash(encodedHash string) (Argon2idParameters, []byte, []byte, error) {
	parts := strings.Split(encodedHash, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return Argon2idParameters{}, nil, nil, ErrMalformedPasswordHash
	}
	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return Argon2idParameters{}, nil, nil, ErrMalformedPasswordHash
	}
	var parameters Argon2idParameters
	if _, err := fmt.Sscanf(parts[3], "m=%d,t=%d,p=%d", &parameters.MemoryKibibytes, &parameters.Iterations, &parameters.Parallelism); err != nil {
		return Argon2idParameters{}, nil, nil, ErrMalformedPasswordHash
	}
	salt, saltErr := base64.RawStdEncoding.DecodeString(parts[4])
	key, keyErr := base64.RawStdEncoding.DecodeString(parts[5])
	if saltErr != nil || keyErr != nil || len(key) == 0 {
		return Argon2idParameters{}, nil, nil, ErrMalformedPasswordHash
	}
	return parameters, salt, key, nil
}

func randomDummyPassword() string {
	random := make([]byte, 32)
	_, _ = rand.Read(random)
	return base64.RawStdEncoding.EncodeToString(random)
}
