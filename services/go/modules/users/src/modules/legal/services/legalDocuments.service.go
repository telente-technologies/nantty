package services

import (
	"context"

	"zudomart/modules/users/src/generated/ent"
	"zudomart/modules/users/src/generated/ent/legaldocument"
)

type DocumentDefinition struct {
	Key        string
	Title      string
	PublicPath string
}

var DocumentDefinitions = []DocumentDefinition{
	{"terms", "Terms of Service", "/terms"},
	{"privacy", "Privacy Policy", "/privacy"},
	{"cookies", "Cookie Policy", "/cookies"},
	{"community-guidelines", "Community Guidelines", "/community-guidelines"},
	{"seller-terms", "Seller Terms", "/seller-terms"},
	{"creator-terms", "Creator Program Terms", "/creator-terms"},
	{"ads-policy", "Ads Policy", "/ads-policy"},
	{"refund-escrow-policy", "Refund and Escrow Policy", "/refund-escrow-policy"},
	{"copyright-policy", "Copyright and IP Policy", "/copyright-policy"},
	{"data-rights", "Data Rights Requests", "/data-rights"},
}

func DefinitionOf(key string) (DocumentDefinition, bool) {
	for _, definition := range DocumentDefinitions {
		if definition.Key == key {
			return definition, true
		}
	}
	return DocumentDefinition{}, false
}

func SeedLegalDocumentsIfMissing(ctx context.Context, client *ent.Client) error {
	for _, definition := range DocumentDefinitions {
		exists, err := client.LegalDocument.Query().Where(legaldocument.Key(definition.Key)).Exist(ctx)
		if err != nil {
			return err
		}
		if exists {
			continue
		}
		if err := client.LegalDocument.Create().SetKey(definition.Key).SetTitle(definition.Title).SetPublicPath(definition.PublicPath).Exec(ctx); err != nil && !ent.IsConstraintError(err) {
			return err
		}
	}
	return nil
}

func EventKindFor(documentKey string) string {
	switch documentKey {
	case "privacy":
		return "privacy_policy"
	case "cookies":
		return "cookie_policy"
	}
	return documentKey
}
