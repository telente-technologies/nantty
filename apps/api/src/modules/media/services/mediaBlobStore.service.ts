import { objectStorage } from "../../../integrations/storage.integration.js";

export interface BlobWriteOptions {
  readonly contentType: string;
  readonly cacheControl?: string;
}

export interface StoredBlob {
  readonly bytes: Uint8Array;
  readonly contentType: string | undefined;
}

export interface MediaBlobStore {
  write(key: string, bytes: Uint8Array, options: BlobWriteOptions): Promise<void>;
  writeStream(key: string, stream: ReadableStream<Uint8Array>, options: BlobWriteOptions): Promise<void>;
  read(key: string): Promise<StoredBlob | undefined>;
  remove(key: string): Promise<void>;
  removeAllWithPrefix(prefix: string): Promise<void>;
}

export class InMemoryMediaBlobStore implements MediaBlobStore {
  private readonly blobs = new Map<string, StoredBlob>();

  public async write(key: string, bytes: Uint8Array, options: BlobWriteOptions): Promise<void> {
    this.blobs.set(key, { bytes: new Uint8Array(bytes), contentType: options.contentType });
  }

  public async writeStream(key: string, stream: ReadableStream<Uint8Array>, options: BlobWriteOptions): Promise<void> {
    const parts: Uint8Array[] = [];
    for await (const part of stream) parts.push(part);
    await this.write(key, new Uint8Array(Buffer.concat(parts)), options);
  }

  public async read(key: string): Promise<StoredBlob | undefined> {
    return this.blobs.get(key);
  }

  public async remove(key: string): Promise<void> {
    this.blobs.delete(key);
  }

  public async removeAllWithPrefix(prefix: string): Promise<void> {
    for (const key of [...this.blobs.keys()]) if (key.startsWith(prefix)) this.blobs.delete(key);
  }

  public listKeys(prefix = ""): readonly string[] {
    return [...this.blobs.keys()].filter((key) => key.startsWith(prefix));
  }
}

export class ObjectStorageMediaBlobStore implements MediaBlobStore {
  public async write(key: string, bytes: Uint8Array, options: BlobWriteOptions): Promise<void> {
    await objectStorage().put(key, bytes, options);
  }

  public async writeStream(key: string, stream: ReadableStream<Uint8Array>, options: BlobWriteOptions): Promise<void> {
    await objectStorage().put(key, stream, options);
  }

  public async read(key: string): Promise<StoredBlob | undefined> {
    const object = await objectStorage().get(key);
    if (object === null) return undefined;
    return { bytes: new Uint8Array(await object.arrayBuffer()), contentType: object.metadata.contentType };
  }

  public async remove(key: string): Promise<void> {
    await objectStorage().delete(key);
  }

  public async removeAllWithPrefix(prefix: string): Promise<void> {
    for (let round = 0; round < 1_000; round += 1) {
      const page = await objectStorage().list(prefix, { maxKeys: 500 });
      if (page.objects.length === 0) return;
      for (const object of page.objects) await objectStorage().delete(object.key);
    }
  }
}
