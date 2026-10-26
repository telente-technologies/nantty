package secrettokens

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net/mail"
	"strings"
	"unicode/utf8"

	"nantty/platform/httpserver"
)

func GenerateOpaqueUrlSafeToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func HashOpaqueTokenForStorage(token string) string {
	digest := sha256.Sum256([]byte(token))
	return hex.EncodeToString(digest[:])
}

func NormalizeStaffEmail(raw string) (string, bool) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	if len(trimmed) < 3 || len(trimmed) > 254 {
		return "", false
	}
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil || parsed.Address != trimmed || !strings.Contains(trimmed[strings.LastIndex(trimmed, "@"):], ".") {
		return "", false
	}
	return trimmed, true
}

const (
	StaffPasswordMinimumLength = 12
	StaffPasswordMaximumLength = 128
)

func FindStaffPasswordProblems(password, email, name string) []string {
	problems := []string{}
	length := utf8.RuneCountInString(password)
	if length < StaffPasswordMinimumLength || length > StaffPasswordMaximumLength {
		problems = append(problems, fmt.Sprintf("Use %d-%d characters.", StaffPasswordMinimumLength, StaffPasswordMaximumLength))
	}
	var hasLower, hasUpper, hasDigit, hasSymbol bool
	for _, character := range password {
		switch {
		case character >= 'a' && character <= 'z':
			hasLower = true
		case character >= 'A' && character <= 'Z':
			hasUpper = true
		case character >= '0' && character <= '9':
			hasDigit = true
		default:
			hasSymbol = true
		}
	}
	if !hasLower || !hasUpper {
		problems = append(problems, "Mix upper and lower case letters.")
	}
	if !hasDigit {
		problems = append(problems, "Include a number.")
	}
	if !hasSymbol {
		problems = append(problems, "Include a symbol.")
	}
	if containsPersonalPart(strings.ToLower(password), email, name) {
		problems = append(problems, "Do not use your name or email in the password.")
	}
	if hasRepeatedCharacterRun(password, 4) {
		problems = append(problems, "Avoid repeating the same character.")
	}
	return problems
}

func containsPersonalPart(loweredPassword, email, name string) bool {
	localPart, _, _ := strings.Cut(email, "@")
	parts := append([]string{strings.ToLower(localPart)}, strings.Fields(strings.ToLower(name))...)
	for _, part := range parts {
		if utf8.RuneCountInString(part) >= 4 && strings.Contains(loweredPassword, part) {
			return true
		}
	}
	return false
}

func hasRepeatedCharacterRun(password string, runLength int) bool {
	var previous rune
	run := 0
	for _, character := range password {
		if run > 0 && character == previous {
			run++
		} else {
			previous, run = character, 1
		}
		if run >= runLength {
			return true
		}
	}
	return false
}

func AssertStaffPasswordMeetsPolicy(password, email, name string) error {
	problems := FindStaffPasswordProblems(password, email, name)
	if len(problems) == 0 {
		return nil
	}
	issues := make([]httpserver.ValidationIssue, 0, len(problems))
	for _, problem := range problems {
		issues = append(issues, httpserver.ValidationIssue{Path: "password", Message: problem})
	}
	failure := httpserver.NewValidationFailedError(issues)
	failure.Message = "Choose a stronger password."
	return failure
}
