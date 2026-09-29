import { objectStorage } from "../../../integrations/storage.integration.js";

export interface MediaBlobStore {
  write(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  read(key: string): Promise<Uint8Array | undefined>;
  remove(key: string): Promise<void>;
}

export class InMemoryMediaBlobStore implements MediaBlobStore {
  private readonly blobs = new Map<string, Uint8Array>();

  public async write(key: string, bytes: Uint8Array): Promise<void> {
    this.blobs.set(key, bytes);
  }

  public async read(key: string): Promise<Uint8Array | undefined> {
    return this.blobs.get(key);
  }

  public async remove(key: string): Promise<void> {
    this.blobs.delete(key);
  }
}

export class ObjectStorageMediaBlobStore implements MediaBlobStore {
  public async write(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await objectStorage().put(key, bytes, { contentType });
  }

  public async read(key: string): Promise<Uint8Array | undefined> {
    const object = await objectStorage().get(key);
    return object === null ? undefined : new Uint8Array(await object.arrayBuffer());
  }

  public async remove(key: string): Promise<void> {
    await objectStorage().delete(key);
  }
}
