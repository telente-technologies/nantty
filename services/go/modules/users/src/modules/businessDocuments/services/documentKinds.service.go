package services

var DocumentKindLabels = map[string]string{"cac_certificate": "CAC certificate", "identity": "Government ID", "address_proof": "Proof of address"}

var DocumentKindOrder = []string{"cac_certificate", "identity", "address_proof"}

var AdminKindNames = map[string]string{"cac_certificate": "CAC_CERTIFICATE", "identity": "ID", "address_proof": "PROOF_OF_ADDRESS"}

var allowedContentTypes = map[string]string{"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}

const MaximumDocumentBytes = 10 * 1024 * 1024

func ExtensionForContentType(contentType string) (string, bool) {
	extension, allowed := allowedContentTypes[contentType]
	return extension, allowed
}
