package logistics

import (
	"reflect"
	"strings"
	"testing"
)

func TestProviderContractKeepsEmailsOut(t *testing.T) {
	requestTypes := []reflect.Type{
		reflect.TypeOf(Address{}),
		reflect.TypeOf(QuoteRequest{}),
		reflect.TypeOf(BookRequest{}),
		reflect.TypeOf(RedeliveryQuoteRequest{}),
		reflect.TypeOf(RedeliveryRequest{}),
	}
	for _, requestType := range requestTypes {
		assertNoEmailFields(t, requestType, requestType.Name())
	}
}

func assertNoEmailFields(t *testing.T, requestType reflect.Type, path string) {
	t.Helper()
	for index := 0; index < requestType.NumField(); index++ {
		field := requestType.Field(index)
		fieldPath := path + "." + field.Name
		if strings.Contains(strings.ToLower(field.Name), "email") {
			t.Errorf("%s must not carry email addresses", fieldPath)
		}
		fieldType := field.Type
		if fieldType.Kind() == reflect.Pointer {
			fieldType = fieldType.Elem()
		}
		if fieldType.Kind() == reflect.Struct {
			assertNoEmailFields(t, fieldType, fieldPath)
		}
	}
}
