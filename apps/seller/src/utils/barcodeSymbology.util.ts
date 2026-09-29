import { isValidEan13 } from "@/utils/ean13.util";

const ean13LeftOddCodes = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const ean13LeftEvenCodes = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const ean13RightCodes = ["1110010", "1100110", "1101100", "1000010", "1011100", "1001110", "1010000", "1000100", "1001000", "1110100"];
const ean13ParityPatterns = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

const code128Patterns = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const code128StartB = 104;
const code128Stop = 106;

export interface BarcodeModules {
  readonly symbology: "EAN-13" | "Code 128";
  readonly modules: string;
  readonly humanReadableText: string;
}

export function encodeEan13AsModules(ean13: string): string {
  if (!isValidEan13(ean13)) throw new Error("Not a valid EAN-13.");
  const digits = ean13.split("").map(Number);
  const parityPattern = ean13ParityPatterns[digits[0] ?? 0] ?? "LLLLLL";
  const leftHalf = digits.slice(1, 7).map((digit, index) => (parityPattern[index] === "L" ? ean13LeftOddCodes : ean13LeftEvenCodes)[digit]).join("");
  const rightHalf = digits.slice(7).map((digit) => ean13RightCodes[digit]).join("");
  return `101${leftHalf}01010${rightHalf}101`;
}

function convertWidthPatternToModules(widthPattern: string): string {
  return widthPattern.split("").map((width, index) => (index % 2 === 0 ? "1" : "0").repeat(Number(width))).join("");
}

export function isEncodableAsCode128B(text: string): boolean {
  return text.length > 0 && text.length <= 48 && [...text].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) <= 126);
}

export function encodeCode128BAsModules(text: string): string {
  if (!isEncodableAsCode128B(text)) throw new Error("Code 128-B supports printable ASCII up to 48 characters.");
  const values = [...text].map((character) => character.charCodeAt(0) - 32);
  const checksum = values.reduce((sum, value, index) => sum + value * (index + 1), code128StartB) % 103;
  return [code128StartB, ...values, checksum, code128Stop].map((value) => convertWidthPatternToModules(code128Patterns[value] ?? "")).join("");
}

export function encodeProductBarcode(barcode: string | null, sku: string): BarcodeModules | null {
  if (barcode && isValidEan13(barcode)) return { symbology: "EAN-13", modules: encodeEan13AsModules(barcode), humanReadableText: barcode };
  const code128Text = barcode ?? sku;
  if (isEncodableAsCode128B(code128Text)) return { symbology: "Code 128", modules: encodeCode128BAsModules(code128Text), humanReadableText: code128Text };
  return null;
}
