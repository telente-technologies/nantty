import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CameraBolt24Icon } from "@/components/icons";
import { pickSquareOrWideImageFromLibrary } from "@/components/profile/pickImage.util";
import { BrandPickerField } from "@/components/seller/brandPickerField";
import { ProductFormFields, type ProductFormValues } from "@/components/seller/productFormFields";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { SettingsCenteredAction } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { mediaService } from "@/services/media/media.service";
import { sellerService } from "@/services/sellers/seller.service";
import { useLocaleStore } from "@/store/locale.store";
import type { StoreProductInput } from "@/types/account.type";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { RoleGateScreen } from "@/components/roleGate/roleGateScreen";
import { useCreateMenuAccess } from "@/hooks/useCreateMenuAccess.hook";

const EMPTY_FORM: ProductFormValues = { name: "", description: "", priceInMajorUnits: "", stock: "", sizes: "", colors: "", variants: [] };
const splitCommaSeparatedList = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);
const toVariantGroups = (variants: ProductFormValues["variants"]) =>
  variants
    .map((variant) => ({ name: variant.name.trim(), options: splitCommaSeparatedList(variant.options) }))
    .filter((variant) => variant.name.length > 0 && variant.options.length > 0);
const convertMajorUnitTextToMinorUnits = (value: string) => Math.round(Number.parseFloat(value || "0") * 100);

export function ProductFormScreen(props: MainScreenProps<"ProductForm">) {
  const access = useCreateMenuAccess();
  if (access.isSellerStatusLoading) return <Screen><ActivityIndicator style={{ flex: 1 }} /></Screen>;
  if (!access.isApprovedSeller) return <RoleGateScreen kind="seller" />;
  return <ProductFormEditor {...props} />;
}

function ProductFormEditor({ navigation, route }: MainScreenProps<"ProductForm">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const productId = route.params?.productId;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [brand, setBrand] = useState<{ id: string; name: string } | null>(null);
  const viewerCurrency = useLocaleStore((s) => s.currency);
  const { data: existing } = useQuery({
    queryKey: sellerQueryKeys.product(productId ?? "new"),
    queryFn: () => sellerService.fetchStoreProductById(productId!),
    enabled: !!productId,
  });

  const currency = existing?.price.currency ?? viewerCurrency;

  useEffect(() => {
    if (!existing) return;
    setForm({
      name: existing.name,
      description: existing.description,
      priceInMajorUnits: (existing.price.amountMinor / 100).toFixed(2),
      stock: String(existing.stock),
      sizes: existing.sizes.join(", "),
      colors: existing.colors.join(", "),
      variants: (existing.variants ?? existing.variantGroups ?? []).map((variant) => ({ name: variant.name, options: variant.options.join(", ") })),
    });
    setImageUrls([...existing.imageUrls]);
  }, [existing]);

  const finishAndGoBack = () => {
    queryClient.invalidateQueries({ queryKey: ["seller"] });
    navigation.goBack();
  };

  const saveProduct = useMutation({
    mutationFn: () => {
      const input: StoreProductInput = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: { amountMinor: convertMajorUnitTextToMinorUnits(form.priceInMajorUnits), currency },
        stock: Number.parseInt(form.stock || "0", 10),
        sizes: splitCommaSeparatedList(form.sizes),
        colors: splitCommaSeparatedList(form.colors),
        variants: toVariantGroups(form.variants),
        imageUrls,
        brandId: brand?.id ?? null,
      };
      return productId ? sellerService.updateStoreProduct(productId, input) : sellerService.createStoreProduct(input);
    },
    onSuccess: finishAndGoBack,
  });
  const deleteProduct = useMutation({ mutationFn: () => sellerService.deleteStoreProduct(productId!), onSuccess: finishAndGoBack });

  const pickAndUploadProductImage = async () => {
    const picked = await pickSquareOrWideImageFromLibrary([1, 1]);
    if (!picked) return;
    setUploading(true);
    try {
      const url = await mediaService.uploadLocalImageAndReturnPublicUrl(picked.uri, picked.contentType, "product");
      setImageUrls((urls) => [...urls, url]);
    } finally {
      setUploading(false);
    }
  };

  const confirmAndDeleteProduct = () =>
    showAlertWithButtons("Delete product?", "Buyers will no longer see this product.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteProduct.mutate() },
    ]);

  const canSave = form.name.trim().length > 0 && convertMajorUnitTextToMinorUnits(form.priceInMajorUnits) > 0 && form.stock.length > 0;

  return (
    <Screen>
      <Header title={productId ? "Edit product" : "New product"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {imageUrls.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.image} contentFit="cover" />
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="Add product photo" onPress={pickAndUploadProductImage} disabled={uploading} style={[styles.image, styles.addImage]}>
            <CameraBolt24Icon />
            <Text size={12} lineHeight={16.8} color={colors.textMuted}>
              {uploading ? "Uploading…" : "Add photo"}
            </Text>
          </Pressable>
        </ScrollView>
        <BrandPickerField selectedBrandName={brand?.name ?? null} onSelectBrand={(chosen) => setBrand(chosen ? { id: chosen.id, name: chosen.name } : null)} />
        <ProductFormFields values={form} currency={currency} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        {saveProduct.isError ? (
          <Text size={12} lineHeight={14.4} color={colors.error}>
            {saveProduct.error.message}
          </Text>
        ) : null}
        <Button title={productId ? "Save changes" : "Publish product"} disabled={!canSave || uploading} loading={saveProduct.isPending} onPress={() => saveProduct.mutate()} />
        {productId ? <SettingsCenteredAction label="Delete product" onPress={confirmAndDeleteProduct} /> : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 24 },
  images: { gap: 8 },
  image: { width: 96, height: 96, borderRadius: 8, backgroundColor: colors.chip, overflow: "hidden" },
  addImage: { alignItems: "center", justifyContent: "center", gap: 4 },
}));
