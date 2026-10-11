import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { Cancel20Icon, CameraBolt24Icon } from "@/components/icons";
import { pickSquareOrWideImageFromLibrary } from "@/components/profile/pickImage.util";
import { BrandPickerField } from "@/components/seller/brandPickerField";
import { ProductFormFields, type ProductFormValues } from "@/components/seller/productFormFields";
import { sellerQueryKeys } from "@/components/seller/sellerQueries.hook";
import { SettingsCenteredAction } from "@/components/settings/settingsGroup";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { makeThemedStyles, useTheme } from "@/theme";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { mediaService } from "@/services/media/media.service";
import { sellerService } from "@/services/sellers/seller.service";
import { useLocaleStore } from "@/store/locale.store";
import { generateIdempotencyKey } from "@/services/core/apiClient.service";
import type { CatalogProductImage } from "@/types/sellerCatalog.type";
import {
  buildCatalogProductUpsertRequest, EMPTY_PRODUCT_FORM, formValuesFromCatalogProduct, lowestVariantPrice, MAXIMUM_PRODUCT_IMAGES, validateProductForm, type ChosenBrand,
} from "@/utils/sellerProductForm.util";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import { RoleGateScreen } from "@/components/roleGate/roleGateScreen";
import { useCreateMenuAccess } from "@/hooks/useCreateMenuAccess.hook";


export function ProductFormScreen(props: MainScreenProps<"ProductForm">) {
  const access = useCreateMenuAccess();
  if (access.isSellerStatusLoading) return <Screen><BrandLoader size="lg" style={{ flex: 1 }} /></Screen>;
  if (!access.isApprovedSeller) return <RoleGateScreen kind="seller" />;
  return <ProductFormEditor {...props} />;
}

function ProductFormEditor({ navigation, route }: MainScreenProps<"ProductForm">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const productId = route.params?.productId;
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProductFormValues>(EMPTY_PRODUCT_FORM);
  const [images, setImages] = useState<CatalogProductImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [brand, setBrand] = useState<ChosenBrand | null>(null);
  const createKey = useRef(generateIdempotencyKey());
  const skuSeed = useRef(createKey.current.replace(/[^A-Za-z0-9]/g, "").slice(-8).toUpperCase());
  const viewerCurrency = useLocaleStore((s) => s.currency);
  const { data: existing } = useQuery({
    queryKey: sellerQueryKeys.product(productId ?? "new"),
    queryFn: () => sellerService.fetchStoreProductById(productId!),
    enabled: !!productId,
  });

  const locations = useQuery({ queryKey: ["seller", "locations"], queryFn: sellerService.listMyStoreLocations, enabled: !productId });
  const defaultLocationId = locations.data?.find((location) => location.isDefault && location.active)?.id ?? locations.data?.find((location) => location.active)?.id ?? null;
  const currency = (existing ? lowestVariantPrice(existing)?.currency : undefined) ?? viewerCurrency;

  useEffect(() => {
    if (!existing) return;
    setForm(formValuesFromCatalogProduct(existing));
    setImages([...existing.images]);
    setBrand(existing.brand ? { id: existing.brand.brandId, name: existing.brand.name ?? "Brand", relationship: existing.brand.relationship } : null);
  }, [existing]);

  const finishAndGoBack = () => {
    queryClient.invalidateQueries({ queryKey: ["seller"] });
    navigation.goBack();
  };

  const saveProduct = useMutation({
    mutationFn: () => {
      if (!productId && Number(form.stock) > 0 && !defaultLocationId) throw new Error("Add a store location in your seller dashboard before adding stock.");
      const input = buildCatalogProductUpsertRequest({ form, images, brand, existing: existing ?? null, defaultLocationId, skuSeed: skuSeed.current });
      return productId ? sellerService.updateStoreProduct(productId, input) : sellerService.createStoreProduct(input, createKey.current);
    },
    onSuccess: finishAndGoBack,
  });
  const deleteProduct = useMutation({ mutationFn: () => sellerService.archiveStoreProduct(productId!), onSuccess: finishAndGoBack });

  const pickAndUploadProductImage = async () => {
    const picked = await pickSquareOrWideImageFromLibrary([1, 1]);
    if (!picked) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await mediaService.uploadLocalImageAndReturnMediaImage(picked.uri, picked.contentType, "product");
      setImages((current) => [...current, uploaded]);
    } catch (error) {
      setUploadError(error instanceof Error && error.message ? error.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  };

  const confirmAndDeleteProduct = () =>
    showAlertWithButtons("Delete product?", "Buyers will no longer see this product.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteProduct.mutate() },
    ], { intent: "delete" });

  const validationMessage = validateProductForm(form, images, !productId);
  const canSave = validationMessage === null && !saveProduct.isPending;

  return (
    <Screen>
      <Header title={productId ? "Edit product" : "New product"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.images}>
          {images.map((image, index) => (
            <View key={image.mediaId} style={styles.image}>
              <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={index === 0 ? "Cover photo" : `Product photo ${index + 1}`} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${index + 1}`} hitSlop={8} onPress={() => setImages((current) => current.filter((candidate) => candidate.mediaId !== image.mediaId))} style={styles.remove}>
                <Cancel20Icon size={14} color={colors.white} />
              </Pressable>
            </View>
          ))}
          {images.length < MAXIMUM_PRODUCT_IMAGES ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Add product photo" onPress={pickAndUploadProductImage} disabled={uploading} style={[styles.image, styles.addImage]}>
              <CameraBolt24Icon />
              <Text size={12} lineHeight={16.8} color={colors.textMuted}>
                {uploading ? "Uploading…" : "Add photo"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {uploadError ? <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">{uploadError}</Text> : null}
        <BrandPickerField selectedBrandName={brand?.name ?? null} onSelectBrand={(chosen) => setBrand(chosen ? { id: chosen.id, name: chosen.name } : null)} />
        <ProductFormFields values={form} currency={currency} stockEditable={!productId} onChange={(patch) => setForm((f) => ({ ...f, ...patch }))} />
        {validationMessage && form.name.length > 0 ? (
          <Text size={12} lineHeight={16} color={colors.textMuted}>{validationMessage}</Text>
        ) : null}
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
  remove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.overlay, alignItems: "center", justifyContent: "center" },
}));
