import type { FlashSaleInput, ProductBundleInput } from "@/types/marketing.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

const longestFlashSaleInMilliseconds = 7 * 86_400_000;

export function validateFlashSaleInput(input: FlashSaleInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.name.length < 3 || input.name.length > 80) issues.push({ path: "name", message: "Name needs 3–80 characters." });
  const startTime = new Date(input.startsAt).getTime();
  const endTime = new Date(input.endsAt).getTime();
  if (Number.isNaN(startTime)) issues.push({ path: "startsAt", message: "Choose when the flash sale starts." });
  if (Number.isNaN(endTime) || endTime <= startTime) issues.push({ path: "endsAt", message: "The end must be after the start." });
  else if (endTime - startTime > longestFlashSaleInMilliseconds) issues.push({ path: "endsAt", message: "Flash sales last at most 7 days." });
  if (input.items.length === 0 || input.items.length > 20) issues.push({ path: "items", message: "Add between 1 and 20 products." });
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) issues.push({ path: "items", message: "Each product can only appear once." });
  input.items.forEach((item, index) => {
    if (!Number.isSafeInteger(item.salePriceMinor) || item.salePriceMinor <= 0) issues.push({ path: `items.${index}.salePriceMinor`, message: "Enter a flash price above zero." });
    if (item.stockCap !== null && (!Number.isSafeInteger(item.stockCap) || item.stockCap < 1 || item.stockCap > 100_000)) issues.push({ path: `items.${index}.stockCap`, message: "Stock cap must be a whole number above zero." });
  });
  return issues;
}

export function validateProductBundleInput(input: ProductBundleInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (input.name.length < 3 || input.name.length > 80) issues.push({ path: "name", message: "Name needs 3–80 characters." });
  if (input.description.length > 300) issues.push({ path: "description", message: "Keep the description under 300 characters." });
  if (!Number.isSafeInteger(input.bundlePriceMinor) || input.bundlePriceMinor <= 0) issues.push({ path: "bundlePrice", message: "Enter a bundle price above zero." });
  const totalUnits = input.items.reduce((sum, item) => sum + item.quantity, 0);
  if (input.items.length === 0 || totalUnits < 2) issues.push({ path: "items", message: "A bundle needs at least two items in total." });
  if (input.items.length > 10) issues.push({ path: "items", message: "A bundle can have up to 10 different products." });
  if (new Set(input.items.map((item) => item.productId)).size !== input.items.length) issues.push({ path: "items", message: "Each product can only appear once — raise its quantity instead." });
  input.items.forEach((item, index) => {
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) issues.push({ path: `items.${index}.quantity`, message: "Quantity must be 1–20." });
  });
  return issues;
}
