package integrations

import (
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"math/big"
	"strings"
	"time"

	"nantty/modules/payments/src/interfaces"
)

var (
	appleLeafCertificateMarkerOid         = asn1.ObjectIdentifier{1, 2, 840, 113635, 100, 6, 11, 1}
	appleIntermediateCertificateMarkerOid = asn1.ObjectIdentifier{1, 2, 840, 113635, 100, 6, 2, 1}
)

type AppleSignedDataVerifier struct {
	roots *x509.CertPool
	Now   func() time.Time
}

func NewAppleSignedDataVerifier(rootCertificatesPem []byte) (*AppleSignedDataVerifier, error) {
	roots, added := x509.NewCertPool(), 0
	for block, rest := pem.Decode(rootCertificatesPem); block != nil; block, rest = pem.Decode(rest) {
		certificate, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		roots.AddCert(certificate)
		added++
	}
	if added == 0 {
		return nil, errors.New("apple: no root certificate configured")
	}
	return &AppleSignedDataVerifier{roots: roots, Now: time.Now}, nil
}

func (verifier *AppleSignedDataVerifier) VerifyAndDecode(signed string, destination any) error {
	parts := strings.Split(signed, ".")
	if len(parts) != 3 {
		return interfaces.ErrStoreReceiptInvalid
	}
	var header struct {
		Algorithm    string   `json:"alg"`
		Certificates []string `json:"x5c"`
	}
	if err := decodeJwsSegment(parts[0], &header); err != nil || header.Algorithm != "ES256" || len(header.Certificates) < 2 {
		return interfaces.ErrStoreReceiptInvalid
	}
	leaf, err := verifier.verifyCertificateChain(header.Certificates)
	if err != nil {
		return interfaces.ErrStoreReceiptInvalid
	}
	publicKey, isEcdsa := leaf.PublicKey.(*ecdsa.PublicKey)
	signature, decodeErr := base64.RawURLEncoding.DecodeString(parts[2])
	if !isEcdsa || decodeErr != nil || len(signature) != 64 {
		return interfaces.ErrStoreReceiptInvalid
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if !ecdsa.Verify(publicKey, digest[:], new(big.Int).SetBytes(signature[:32]), new(big.Int).SetBytes(signature[32:])) {
		return interfaces.ErrStoreReceiptInvalid
	}
	if err := decodeJwsSegment(parts[1], destination); err != nil {
		return interfaces.ErrStoreReceiptInvalid
	}
	return nil
}

func (verifier *AppleSignedDataVerifier) verifyCertificateChain(encoded []string) (*x509.Certificate, error) {
	certificates := make([]*x509.Certificate, 0, len(encoded))
	for _, value := range encoded {
		raw, err := base64.StdEncoding.DecodeString(value)
		if err != nil {
			return nil, err
		}
		certificate, err := x509.ParseCertificate(raw)
		if err != nil {
			return nil, err
		}
		certificates = append(certificates, certificate)
	}
	if !hasExtension(certificates[0], appleLeafCertificateMarkerOid) || !hasExtension(certificates[1], appleIntermediateCertificateMarkerOid) {
		return nil, errors.New("apple: certificate chain is missing the App Store markers")
	}
	intermediates := x509.NewCertPool()
	for _, certificate := range certificates[1:] {
		intermediates.AddCert(certificate)
	}
	_, err := certificates[0].Verify(x509.VerifyOptions{Roots: verifier.roots, Intermediates: intermediates, CurrentTime: verifier.Now(), KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageAny}})
	return certificates[0], err
}

func hasExtension(certificate *x509.Certificate, oid asn1.ObjectIdentifier) bool {
	for _, extension := range certificate.Extensions {
		if extension.Id.Equal(oid) {
			return true
		}
	}
	return false
}

func decodeJwsSegment(segment string, destination any) error {
	raw, err := base64.RawURLEncoding.DecodeString(segment)
	if err != nil {
		return err
	}
	return json.Unmarshal(raw, destination)
}
