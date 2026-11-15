package admin_test

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"testing"

	"github.com/go-webauthn/webauthn/protocol/webauthncbor"
	"github.com/go-webauthn/webauthn/protocol/webauthncose"
)

const passkeyOrigin = "http://localhost:3400"

type softPasskey struct {
	t            *testing.T
	key          *ecdsa.PrivateKey
	credentialId []byte
	userHandle   string
	signCount    uint32
}

func newSoftPasskey(t *testing.T) *softPasskey {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	credentialId := make([]byte, 32)
	_, _ = rand.Read(credentialId)
	return &softPasskey{t: t, key: key, credentialId: credentialId}
}

func encodeBase64Url(raw []byte) string { return base64.RawURLEncoding.EncodeToString(raw) }

func clientData(t *testing.T, ceremony string, options map[string]any) []byte {
	encoded, err := json.Marshal(map[string]any{"type": ceremony, "challenge": options["challenge"], "origin": passkeyOrigin, "crossOrigin": false})
	if err != nil {
		t.Fatal(err)
	}
	return encoded
}

func (passkey *softPasskey) authenticatorData(flags byte, attested []byte) []byte {
	rpIdHash := sha256.Sum256([]byte("localhost"))
	data := append([]byte{}, rpIdHash[:]...)
	data = append(data, flags)
	data = binary.BigEndian.AppendUint32(data, passkey.signCount)
	return append(data, attested...)
}

func (passkey *softPasskey) register(options map[string]any) map[string]any {
	passkey.t.Helper()
	passkey.userHandle = options["user"].(map[string]any)["id"].(string)
	publicKey, err := webauthncbor.Marshal(webauthncose.EC2PublicKeyData{
		PublicKeyData: webauthncose.PublicKeyData{KeyType: int64(webauthncose.EllipticKey), Algorithm: int64(webauthncose.AlgES256)},
		Curve:         1, XCoord: passkey.key.PublicKey.X.FillBytes(make([]byte, 32)), YCoord: passkey.key.PublicKey.Y.FillBytes(make([]byte, 32)),
	})
	if err != nil {
		passkey.t.Fatal(err)
	}
	attested := make([]byte, 16)
	attested = binary.BigEndian.AppendUint16(attested, uint16(len(passkey.credentialId)))
	attested = append(append(attested, passkey.credentialId...), publicKey...)
	attestation, err := webauthncbor.Marshal(map[string]any{"fmt": "none", "attStmt": map[string]any{}, "authData": passkey.authenticatorData(0x45, attested)})
	if err != nil {
		passkey.t.Fatal(err)
	}
	return map[string]any{
		"id": encodeBase64Url(passkey.credentialId), "rawId": encodeBase64Url(passkey.credentialId), "type": "public-key",
		"response": map[string]any{"clientDataJSON": encodeBase64Url(clientData(passkey.t, "webauthn.create", options)), "attestationObject": encodeBase64Url(attestation), "transports": []string{"internal"}},
	}
}

func (passkey *softPasskey) assert(options map[string]any) map[string]any {
	passkey.t.Helper()
	passkey.signCount++
	data := passkey.authenticatorData(0x05, nil)
	client := clientData(passkey.t, "webauthn.get", options)
	clientHash := sha256.Sum256(client)
	digest := sha256.Sum256(append(append([]byte{}, data...), clientHash[:]...))
	signature, err := ecdsa.SignASN1(rand.Reader, passkey.key, digest[:])
	if err != nil {
		passkey.t.Fatal(err)
	}
	return map[string]any{
		"id": encodeBase64Url(passkey.credentialId), "rawId": encodeBase64Url(passkey.credentialId), "type": "public-key",
		"response": map[string]any{"clientDataJSON": encodeBase64Url(client), "authenticatorData": encodeBase64Url(data), "signature": encodeBase64Url(signature), "userHandle": passkey.userHandle},
	}
}
