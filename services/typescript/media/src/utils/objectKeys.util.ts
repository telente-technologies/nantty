export const quarantineKeyFor = (ownerId: string, mediaId: string) => `${ownerId}/${mediaId}/original`;
export const derivativePrefixFor = (mediaId: string, isPrivate: boolean) => `${isPrivate ? "p" : "m"}/${mediaId}/`;
export const derivativeKeyFor = (mediaId: string, isPrivate: boolean, name: string) => `${derivativePrefixFor(mediaId, isPrivate)}${name}`;
