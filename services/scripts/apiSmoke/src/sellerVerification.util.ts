import { execFileSync } from "node:child_process";

import type { StaffActor, UserActor } from "./actors.util.js";
import { callApi, describeResponse, waitFor } from "./apiClient.util.js";

const businessDocumentKinds = ["cac_certificate", "identity", "address_proof"] as const;
const samplePdf = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");

function isSellerVerifiedInMoney(accountId: string): boolean {
  const output = execFileSync("docker", ["exec", "zudomart-backend-postgres-1", "psql", "-U", "zudomart", "-d", "zudomart", "-At", "-c", `select count(*) from payments.seller_verifications where account_id = '${accountId}' and revoked_at is null`], { encoding: "utf8" });
  return output.trim() === "1";
}

async function uploadBusinessDocument(seller: UserActor, kind: string): Promise<void> {
  const intent = await callApi("POST", `/api/v1/seller/business-documents/${kind}/upload-intents`, { token: seller.accessToken, body: { fileName: `${kind}.pdf`, contentType: "application/pdf", sizeBytes: samplePdf.length } });
  if (intent.status !== 201) throw new Error(`${kind} upload intent: ${describeResponse(intent)}`);
  const put = await fetch(intent.body.uploadUrl, { method: "PUT", body: new Uint8Array(samplePdf), headers: { ...(intent.body.headers ?? {}), "content-type": "application/pdf" } });
  if (put.status !== 200) throw new Error(`${kind} S3 PUT ${put.status}: ${(await put.text()).slice(0, 300)}`);
  const confirmed = await callApi("PUT", `/api/v1/seller/business-documents/${kind}`, { token: seller.accessToken, body: { documentId: intent.body.documentId } });
  if (confirmed.status !== 200) throw new Error(`${kind} confirm: ${describeResponse(confirmed)}`);
}

export async function verifySellerBusiness(staff: StaffActor, seller: UserActor): Promise<void> {
  for (const kind of businessDocumentKinds) await uploadBusinessDocument(seller, kind);
  const queue = await callApi("GET", `/api/v1/admin/business-documents?status=PENDING&search=${encodeURIComponent(seller.username)}`, { token: staff.accessToken });
  const submission = (queue.body?.data ?? []).find((candidate: { id: string }) => candidate.id === seller.accountId);
  if (submission === undefined) throw new Error(`business documents never reached the review queue: ${describeResponse(queue)}`);
  for (const document of submission.documents as Array<{ id: string; status: string }>) {
    const approved = await callApi("POST", `/api/v1/admin/business-documents/${seller.accountId}/documents/${document.id}/approve`, { token: staff.accessToken, body: { reason: "Smoke business verification" } });
    if (approved.status !== 200) throw new Error(`approve ${document.id}: ${describeResponse(approved)}`);
  }
  const recorded = await waitFor(async () => (isSellerVerifiedInMoney(seller.accountId) ? true : undefined), 30_000, 500);
  if (recorded === undefined) throw new Error(`go-money never recorded the business verification for ${seller.accountId}`);
}

export async function revokeSellerBusinessVerification(staff: StaffActor, seller: UserActor, reason: string): Promise<void> {
  const queue = await callApi("GET", `/api/v1/admin/business-documents?status=APPROVED&search=${encodeURIComponent(seller.username)}`, { token: staff.accessToken });
  const submission = (queue.body?.data ?? []).find((candidate: { id: string }) => candidate.id === seller.accountId);
  const document = submission?.documents?.[0];
  if (document === undefined) throw new Error(`no approved business documents to revoke: ${describeResponse(queue)}`);
  const rejected = await callApi("POST", `/api/v1/admin/business-documents/${seller.accountId}/documents/${document.id}/reject`, { token: staff.accessToken, body: { reason } });
  if (rejected.status !== 200) throw new Error(`revoke ${document.id}: ${describeResponse(rejected)}`);
  const cleared = await waitFor(async () => (isSellerVerifiedInMoney(seller.accountId) ? undefined : true), 30_000, 500);
  if (cleared === undefined) throw new Error(`go-money never cleared the business verification for ${seller.accountId}`);
}
