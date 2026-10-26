package utils

import "nantty/platform/passwordhash"

type Argon2idParameters = passwordhash.Argon2idParameters

type PasswordHasher = passwordhash.PasswordHasher

var RecommendedArgon2idParameters = passwordhash.RecommendedArgon2idParameters

var ErrMalformedPasswordHash = passwordhash.ErrMalformedPasswordHash

func NewPasswordHasher(parameters Argon2idParameters) *PasswordHasher {
	return passwordhash.NewPasswordHasher(parameters)
}
