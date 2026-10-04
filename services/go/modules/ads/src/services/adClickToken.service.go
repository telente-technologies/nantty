package services

import (
	"crypto/hmac"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
)

var ErrClickTokenInvalid = errors.New("click token is invalid")

const clickTokenVersion = "c1"

type ClickClaims struct {
	ImpressionToken string `json:"t"`
	ImpressionId    string `json:"i"`
	AdId            string `json:"a"`
	UserId          string `json:"u"`
	CardIndex       int    `json:"ci"`
	ExpiresAtUnix   int64  `json:"exp"`
}

func (signer AdTokenSigner) SignClick(claims ClickClaims) (string, error) {
	key, found := signer.Keys[signer.ActiveKeyId]
	if !found {
		return "", errors.New("active ad token key is not configured")
	}
	claims.ExpiresAtUnix = signer.Now().Add(signer.TimeToLive).Unix()
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	head := clickTokenVersion + "." + signer.ActiveKeyId + "." + base64.RawURLEncoding.EncodeToString(payload)
	return head + "." + base64.RawURLEncoding.EncodeToString(computeAdTokenSignature(key, head)), nil
}

func (signer AdTokenSigner) VerifyClick(token string) (ClickClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 4 || parts[0] != clickTokenVersion {
		return ClickClaims{}, ErrClickTokenInvalid
	}
	key, found := signer.Keys[parts[1]]
	supplied, decodeErr := base64.RawURLEncoding.DecodeString(parts[3])
	if !found || decodeErr != nil || !hmac.Equal(supplied, computeAdTokenSignature(key, strings.Join(parts[:3], "."))) {
		return ClickClaims{}, ErrClickTokenInvalid
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[2])
	var claims ClickClaims
	if err != nil || json.Unmarshal(payload, &claims) != nil || signer.Now().Unix() >= claims.ExpiresAtUnix {
		return ClickClaims{}, ErrClickTokenInvalid
	}
	return claims, nil
}
