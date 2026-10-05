import { sendRequestToDashboardServer, sendSellerApiRequest, SellerApiRequestError } from "@/services/clientApi.service";
import type { BusinessDocumentKind, BusinessDocumentsResponse, BusinessDocumentUploadIntent } from "@/types/businessDocuments.type";

async function sendFileToUploadUrl(intent: BusinessDocumentUploadIntent, file: File): Promise<void> {
  if (intent.uploadUrl.startsWith("/")) {
    await sendRequestToDashboardServer(intent.uploadUrl, { method: "PUT", rawBody: file, headers: intent.headers });
    return;
  }
  let response: Response;
  try {
    response = await fetch(intent.uploadUrl, { method: "PUT", headers: intent.headers, body: file, credentials: "omit" });
  } catch {
    throw new SellerApiRequestError(0, "NETWORK_UNAVAILABLE", "The file could not be sent. Check your connection and try again.");
  }
  if (!response.ok) throw new SellerApiRequestError(response.status, "UPLOAD_FAILED", "The file could not be uploaded. Try again.");
}

export async function uploadBusinessDocument(kind: BusinessDocumentKind, file: File): Promise<BusinessDocumentsResponse> {
  const documentPath = `/seller/business-documents/${encodeURIComponent(kind)}`;
  const intent = await sendSellerApiRequest<BusinessDocumentUploadIntent>(`${documentPath}/upload-intents`, { method: "POST", body: { fileName: file.name, contentType: file.type, sizeBytes: file.size } });
  await sendFileToUploadUrl(intent, file);
  return sendSellerApiRequest<BusinessDocumentsResponse>(documentPath, { method: "PUT", body: { documentId: intent.documentId } });
}
