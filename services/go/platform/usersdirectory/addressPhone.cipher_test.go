package usersdirectory

import (
	"bytes"
	"encoding/base64"
	"errors"
	"testing"
)

func TestAddressPhoneSealsOpensAndFallsBackToPlaintext(t *testing.T) {
	key := bytes.Repeat([]byte{9}, 32)
	plain, sealed, err := SealAddressPhone(key, "+2348000000000")
	if err != nil || plain != "" || len(sealed) == 0 || bytes.Contains(sealed, []byte("8000000000")) {
		t.Fatalf("unexpected seal %q %v %v", plain, sealed, err)
	}
	if opened, err := OpenAddressPhone(key, plain, sealed); err != nil || opened != "+2348000000000" {
		t.Fatalf("unexpected open %q %v", opened, err)
	}
	if _, err := OpenAddressPhone(nil, "", sealed); !errors.Is(err, ErrAddressPhoneKeyMissing) {
		t.Fatalf("a sealed phone needs the key: %v", err)
	}
	if _, err := OpenAddressPhone(bytes.Repeat([]byte{1}, 32), "", sealed); err == nil {
		t.Fatal("a wrong key must not open the phone")
	}
	if plain, sealed, _ := SealAddressPhone(nil, "+2348000000000"); plain != "+2348000000000" || sealed != nil {
		t.Fatal("without a key the phone stays as given")
	}
	if opened, _ := OpenAddressPhone(nil, "+2348000000000", nil); opened != "+2348000000000" {
		t.Fatal("legacy plaintext rows still read")
	}
	if _, err := DecodeAddressPhoneKey("c2hvcnQ="); err == nil {
		t.Fatal("a short key is rejected")
	}
	if decoded, err := DecodeAddressPhoneKey(base64.StdEncoding.EncodeToString(key)); err != nil || !bytes.Equal(decoded, key) {
		t.Fatalf("a 32 byte key decodes: %v", err)
	}
}
