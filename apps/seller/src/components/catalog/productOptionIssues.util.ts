import type { OptionDraft, VariantDraft } from "@/components/catalog/productEditorDraft.util";
import { countOptionCombinations, describeOptionGroupProblem, productOptionLimits } from "@/components/catalog/productOptions.util";
import type { ProductVariant } from "@/types/catalog.type";
import type { ValidationIssue } from "@/utils/formValidation.util";

export function describeRemovedVariantsWithStock(savedVariants: readonly ProductVariant[], draftVariants: readonly VariantDraft[]): string | null {
  const keptIds = new Set(draftVariants.map((variant) => variant.id).filter(Boolean));
  const blocked = savedVariants.filter((variant) => !keptIds.has(variant.id) && variant.stock.some((level) => level.onHand !== 0));
  if (blocked.length === 0) return null;
  const names = blocked.slice(0, 2).map((variant) => variant.title).join(", ");
  return `${names}${blocked.length > 2 ? ` and ${blocked.length - 2} more` : ""} still ${blocked.length === 1 ? "has" : "have"} stock. Adjust it to zero in inventory, or keep the value, before saving.`;
}

export function describeOptionIssues(options: readonly OptionDraft[], savedVariants: readonly ProductVariant[], draftVariants: readonly VariantDraft[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (options.length > productOptionLimits.maxGroups) issues.push({ path: "options", message: `Use up to ${productOptionLimits.maxGroups} options, such as Size and Colour.` });
  options.forEach((option, index) => {
    const problem = describeOptionGroupProblem(option, options);
    if (problem) issues.push({ path: option.name.trim() ? `options.${index}.values` : `options.${index}.name`, message: problem });
  });
  const combinations = countOptionCombinations(options);
  if (combinations > productOptionLimits.maxVariants) issues.push({ path: "options", message: `These options make ${combinations} variants. The limit is ${productOptionLimits.maxVariants}.` });
  const blocked = describeRemovedVariantsWithStock(savedVariants, draftVariants);
  if (blocked) issues.push({ path: "options", message: blocked });
  return issues;
}
