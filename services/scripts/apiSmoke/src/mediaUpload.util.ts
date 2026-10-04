import { callApi, describeResponse, waitFor } from "./apiClient.util.js";
import { createSamplePng, sha256Hex } from "./sampleMedia.util.js";

export interface UploadedMedia {
  readonly mediaId: string;
  readonly asset: { readonly status: string; readonly width: number; readonly height: number; readonly variants: ReadonlyArray<{ readonly url: string }> };
}

export async function uploadSampleImage(accessToken: string, purpose = "post"): Promise<UploadedMedia> {
  const png = createSamplePng();
  const plan = await callApi("POST", "/api/v1/media/uploads", { token: accessToken, body: { fileName: "smoke.png", mimeType: "image/png", sizeBytes: png.length, purpose, sha256: sha256Hex(png) } });
  if (plan.status !== 201) throw new Error(`upload plan: ${describeResponse(plan)}`);
  const put = await fetch(plan.body.url, { method: "PUT", body: new Uint8Array(png), headers: { ...(plan.body.headers ?? {}), "content-type": "image/png" } });
  if (put.status !== 200) throw new Error(`S3 PUT ${put.status}: ${(await put.text()).slice(0, 300)}`);
  const completed = await callApi("POST", `/api/v1/media/uploads/${plan.body.uploadId}/complete`, { token: accessToken, body: {} });
  if (completed.status !== 200) throw new Error(`upload complete: ${describeResponse(completed)}`);
  const asset = await waitFor(async () => {
    const response = await callApi("GET", `/api/v1/media/${plan.body.mediaId}`, { token: accessToken });
    return response.body?.status === "ready" || response.body?.status === "failed" ? response.body : undefined;
  }, 30_000, 300);
  if (asset?.status !== "ready") throw new Error(`media ${plan.body.mediaId} never became ready: ${JSON.stringify(asset)}`);
  return { mediaId: plan.body.mediaId, asset };
}
