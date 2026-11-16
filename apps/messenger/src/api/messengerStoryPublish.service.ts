import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import type { MessengerRequest } from "./messengerChat.service";
import { uploadMessengerMedia } from "./messengerMediaUpload.native";
import { messengerStoriesService } from "./messengerStories.service";

const maximumStoryImageBytes = 20 * 1024 * 1024;
const maximumStoryImageEdge = 2048;

export async function publishMessengerPhotoStory(
  request: MessengerRequest,
  image: { readonly uri: string; readonly width: number; readonly height: number },
): Promise<void> {
  const transform = ImageManipulator.manipulate(image.uri);
  if (Math.max(image.width, image.height) > maximumStoryImageEdge) {
    transform.resize(image.width >= image.height ? { width: maximumStoryImageEdge } : { height: maximumStoryImageEdge });
  }
  const rendered = await transform.renderAsync();
  const prepared = await rendered.saveAsync({ compress: 0.84, format: SaveFormat.JPEG });
  try {
    const temporary = new File(prepared.uri);
    const bytes = await temporary.bytes();
    if (bytes.byteLength > maximumStoryImageBytes) throw new Error("This photo is too large to post as a Story.");
    const mediaId = await uploadMessengerMedia(request, { fileName: "story-photo.jpg", mimeType: "image/jpeg", purpose: "story" }, bytes);
    await messengerStoriesService.publishPhoto(request, { mediaId });
  } finally {
    const temporary = new File(prepared.uri);
    if (temporary.exists) temporary.delete();
  }
}
