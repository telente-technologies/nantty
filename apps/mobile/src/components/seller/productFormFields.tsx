import { StyleSheet, View } from "react-native";

import { ProductOptionsEditor } from "@/components/seller/productOptionsEditor";
import { ProductVariantsPreview } from "@/components/seller/productVariantsPreview";
import { TextField } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { useTheme } from "@/theme";
import type { CatalogProduct } from "@/types/sellerCatalog.type";
import { countVariantCombinations, PRODUCT_OPTION_LIMITS, type OptionGroupDraft } from "@/utils/productOptions.util";
import { describeOptionRemovalImpact, matchExistingVariants } from "@/utils/sellerProductForm.util";

export interface ProductFormValues {
  readonly name: string;
  readonly description: string;
  readonly priceInMajorUnits: string;
  readonly stock: string;
  readonly optionGroups: readonly OptionGroupDraft[];
}

export type ProductFormPatch = Partial<ProductFormValues> | ((current: ProductFormValues) => Partial<ProductFormValues>);

export interface ProductFormFieldsProps {
  readonly values: ProductFormValues;
  readonly currency: string;
  readonly stockEditable?: boolean;
  readonly existingProduct?: CatalogProduct | null;
  readonly onChange: (patch: ProductFormPatch) => void;
}

export function ProductFormFields({ values, currency, stockEditable = true, existingProduct = null, onChange }: ProductFormFieldsProps) {
  const { colors } = useTheme();
  const priceLabel = values.priceInMajorUnits ? `${currency} ${values.priceInMajorUnits}` : null;
  return (
    <View style={styles.fields}>
      <TextField label="Product name" placeholder="e.g. Custom Mechanical Keyboard" value={values.name} onChangeText={(name) => onChange({ name })} maxLength={80} />
      <TextField label="Description" placeholder="Describe your product" value={values.description} onChangeText={(description) => onChange({ description })} multiline boxStyle={styles.multiline} />
      <View style={styles.row}>
        <TextField label={`Price (${currency})`} placeholder="0.00" keyboardType="decimal-pad" value={values.priceInMajorUnits} onChangeText={(priceInMajorUnits) => onChange({ priceInMajorUnits: priceInMajorUnits.replace(/[^\d.]/g, "") })} style={styles.half} />
        <TextField label={stockEditable ? "Stock" : "In stock"} placeholder="0" keyboardType="number-pad" value={values.stock} editable={stockEditable} onChangeText={(stock) => onChange({ stock: stock.replace(/\D/g, "") })} style={styles.half} />
      </View>
      <Text size={12} lineHeight={16.8} color={colors.textSubtle}>
        {stockEditable ? "If you add options, this stock is for each variant." : "Change stock from your inventory in the seller dashboard."}
      </Text>
      <ProductOptionsEditor
        groups={values.optionGroups}
        onGroupsChange={(update) => onChange((current) => ({ optionGroups: update(current.optionGroups) }))}
        describeRemovalImpact={(optionGroups) => describeOptionRemovalImpact(values, { ...values, optionGroups }, existingProduct)}
      />
      <ProductVariantsPreview rows={countVariantCombinations(values.optionGroups) <= PRODUCT_OPTION_LIMITS.maxVariants ? matchExistingVariants(values, existingProduct) : []} priceLabel={priceLabel} stockPerVariant={stockEditable ? values.stock : null} />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 16 },
  row: { flexDirection: "row", gap: 12 },
  half: { flex: 1 },
  multiline: { height: 96, alignItems: "flex-start", paddingVertical: 12 },
});
