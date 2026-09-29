import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { CameraBolt24Icon } from "@/components/icons";
import { pickSquareOrWideImageFromLibrary } from "@/components/profile/pickImage.util";
import { ProductFormFields, type ProductFormValues } from "@/components/seller/productFormFields";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { SettingsCenteredAction } from "@/components/settings/settingsGroup";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { colors } from "@/constants/colors.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { mediaService } from "@/services/media.service";
import { sellerService } from "@/services/seller.service";
import { useLocaleStore } from "@/store/locale.store";
import type { StoreProductInput } from "@/types/account.type";

const EMPTY_FORM: ProductFormValues = { name: "", description: "", priceInMajorUnits: "", stock: "", sizes: "", colors: "" };
const splitCommaSeparatedList = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);
const convertMajorUnitTextToMinorUnits = (value: string) => Math.round(Number.parseFloat(value || "0") * 100);

export function ProductFormScreen({ navigation, route }: MainScreenProps<"ProductForm">) {
  const productId = route.params?.productId;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>(EMPTY_FORM);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
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
        imageUrls,
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
    Alert.alert("Delete product?", "Buyers will no longer see this product.", [
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

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 24 },
  images: { gap: 8 },
  image: { width: 96, height: 96, borderRadius: 8, backgroundColor: colors.chip, overflow: "hidden" },
  addImage: { alignItems: "center", justifyContent: "center", gap: 4 },
});
