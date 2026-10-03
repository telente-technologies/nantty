import type { MediaConfig } from "../configs/media.config.js";
import type { Clock } from "../interfaces/clock.interface.js";
import type { MediaUrlSigner } from "../interfaces/mediaUrlSigner.interface.js";
import type { ObjectStorage } from "../interfaces/objectStorage.interface.js";
import { signCloudFrontUrl } from "../utils/cloudFrontSigner.util.js";

export function createMediaUrlSigner(options: { readonly config: MediaConfig; readonly storage: ObjectStorage; readonly clock: Clock }): MediaUrlSigner {
  const { config, storage, clock } = options;
  const { storage: storageConfig, cdn } = config;
  const objectStoreBase = (storageConfig.publicEndpoint ?? storageConfig.endpoint ?? `https://s3.${storageConfig.region}.amazonaws.com`).replace(/\/$/, "");
  const publicBase = (cdn.baseUrl ?? `${objectStoreBase}/${storageConfig.publicBucket}`).replace(/\/$/, "");
  const privateCdnSigning = cdn.privateBaseUrl !== undefined && cdn.keyPairId !== undefined && cdn.privateKeyPem !== undefined;
  return {
    publicUrl: (key) => `${publicBase}/${key}`,
    async privateUrl(bucket, key, expiresInSeconds, urlOptions) {
      if (privateCdnSigning && urlOptions?.allowCdn === true) {
        return signCloudFrontUrl({ url: `${(cdn.privateBaseUrl as string).replace(/\/$/, "")}/${key}`, keyPairId: cdn.keyPairId as string, privateKeyPem: cdn.privateKeyPem as string, expiresAt: new Date(clock.now().getTime() + expiresInSeconds * 1000) });
      }
      return storage.signGetUrl(bucket, key, expiresInSeconds);
    },
  };
}
