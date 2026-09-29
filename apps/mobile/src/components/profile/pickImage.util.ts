import * as ImagePicker from "expo-image-picker";

export interface PickedImage {
  readonly uri: string;
  readonly contentType: string;
}

export async function pickSquareOrWideImageFromLibrary(aspect: [number, number]): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect, quality: 0.8 });
  const asset = result.canceled ? null : result.assets[0];
  return asset ? { uri: asset.uri, contentType: asset.mimeType ?? "image/jpeg" } : null;
}
