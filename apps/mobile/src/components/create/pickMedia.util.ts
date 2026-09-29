import * as ImagePicker from "expo-image-picker";

import type { Media } from "@/types";

const toMedia = (assets: ImagePicker.ImagePickerAsset[]): Media[] =>
  assets.map((a) => ({ type: a.type === "video" ? "video" : "image", url: a.uri }));

export async function pickPhotosAndVideosFromLibrary(allowMultiple: boolean): Promise<Media[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    allowsMultipleSelection: allowMultiple,
    selectionLimit: allowMultiple ? 10 : 1,
    quality: 0.85,
  });
  return result.canceled ? [] : toMedia(result.assets);
}

export async function takePhotoWithSystemCamera(): Promise<Media[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images", "videos"], quality: 0.85 });
  return result.canceled ? [] : toMedia(result.assets);
}
