export interface MediaUrlSigner {
  publicUrl(key: string): string;
  privateUrl(bucket: string, key: string, expiresInSeconds: number, options?: { readonly allowCdn: boolean }): Promise<string>;
}
