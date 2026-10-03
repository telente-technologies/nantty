export interface ZipArchiveEntry {
  readonly path: string;
  readonly content: Uint8Array;
}

const crc32LookupTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function calculateCrc32Checksum(bytes: Uint8Array): number {
  let checksum = 0xffffffff;
  for (const byte of bytes) checksum = (crc32LookupTable[(checksum ^ byte) & 0xff] as number) ^ (checksum >>> 8);
  return (checksum ^ 0xffffffff) >>> 0;
}

function convertDateToDosTimeAndDate(date: Date): { dosTime: number; dosDate: number } {
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosTime, dosDate };
}

function writeLittleEndianFields(fields: readonly (readonly [number, 2 | 4])[]): Uint8Array {
  const totalLength = fields.reduce((sum, [, size]) => sum + size, 0);
  const view = new DataView(new ArrayBuffer(totalLength));
  let offset = 0;
  for (const [value, size] of fields) {
    if (size === 2) view.setUint16(offset, value, true);
    else view.setUint32(offset, value, true);
    offset += size;
  }
  return new Uint8Array(view.buffer);
}

function concatenateByteArrays(parts: readonly Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function buildStoredZipArchive(entries: readonly ZipArchiveEntry[], modifiedAt = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = convertDateToDosTimeAndDate(modifiedAt);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.path);
    const checksum = calculateCrc32Checksum(entry.content);
    const size = entry.content.length;
    const localHeader = writeLittleEndianFields([[0x04034b50, 4], [20, 2], [0x0800, 2], [0, 2], [dosTime, 2], [dosDate, 2], [checksum, 4], [size, 4], [size, 4], [nameBytes.length, 2], [0, 2]]);
    localParts.push(localHeader, nameBytes, entry.content);
    const centralHeader = writeLittleEndianFields([[0x02014b50, 4], [20, 2], [20, 2], [0x0800, 2], [0, 2], [dosTime, 2], [dosDate, 2], [checksum, 4], [size, 4], [size, 4], [nameBytes.length, 2], [0, 2], [0, 2], [0, 2], [0, 2], [0, 4], [localOffset, 4]]);
    centralParts.push(centralHeader, nameBytes);
    localOffset += localHeader.length + nameBytes.length + size;
  }
  const centralDirectory = concatenateByteArrays(centralParts);
  const endRecord = writeLittleEndianFields([[0x06054b50, 4], [0, 2], [0, 2], [entries.length, 2], [entries.length, 2], [centralDirectory.length, 4], [localOffset, 4], [0, 2]]);
  return concatenateByteArrays([...localParts, centralDirectory, endRecord]);
}
