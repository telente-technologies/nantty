import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Pressable, StyleSheet, View } from "react-native";

import { buildInternalRoute, findFirstExternalUrl, findFirstInternalReference, readFullDomain } from "@/components/chat/chatLinks.util";
import { SharedContentCardView } from "@/components/chatSafety/sharedContentCardView";
import { confirmRiskyLink, inAppBrowserColorsFromTheme, openInAppBrowser } from "@/components/links/openLink.util";
import { Text } from "@/components/ui/text";
import { postsService } from "@/services/content/posts.service";
import { feedInteractionsService, interactionTargetOf } from "@/services/feed/feedInteractions.service";
import { useAuthStore } from "@/store/auth.store";
import { makeThemedStyles, useTheme } from "@/theme";
import type { LinkPreview, Post, SharedContentReference } from "@/types";

import { usePostSurface } from "./interactions/postSurface.context";

const internalKindLabels: Readonly<Record<SharedContentReference["kind"], string>> = { product: "Product", store: "Store", profile: "Profile", live: "Live", post: "Post", clip: "Clip", order: "Order" };

function ExternalLinkCard({ preview, onOpen }: { readonly preview: LinkPreview; readonly onOpen: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const domain = preview.domain || readFullDomain(preview.url);
  const openWithSafetyCheck = () =>
    confirmRiskyLink(preview.url, () => {
      onOpen();
      void openInAppBrowser(preview.url, inAppBrowserColorsFromTheme(colors));
    });
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${preview.title}, opens ${domain}`} onPress={openWithSafetyCheck} style={styles.card}>
      {preview.imageUrl ? <Image source={{ uri: preview.imageUrl }} style={styles.image} contentFit="cover" accessibilityIgnoresInvertColors /> : null}
      <View style={styles.body}>
        <Text size={12} lineHeight={16} color={colors.textMuted} numberOfLines={1}>{preview.siteName ?? domain}</Text>
        <Text size={14} weight={600} lineHeight={19} numberOfLines={2}>{preview.title}</Text>
        {preview.description ? <Text size={13} lineHeight={18} color={colors.textMuted} numberOfLines={2}>{preview.description}</Text> : null}
      </View>
    </Pressable>
  );
}

function GuestInternalLinkCard({ reference }: { readonly reference: SharedContentReference }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const navigation = useNavigation();
  const route = buildInternalRoute(reference);
  const label = reference.kind === "profile" ? `@${reference.id}` : `View this ${internalKindLabels[reference.kind].toLowerCase()} on Nantty`;
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => (navigation.navigate as (name: string, params: object) => void)(route.name, route.params)} style={styles.card}>
      <View style={styles.body}>
        <Text size={12} weight={600} lineHeight={16} color={colors.primary}>{internalKindLabels[reference.kind]}</Text>
        <Text size={14} weight={600} lineHeight={19} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function PostLinkCard({ post }: { readonly post: Post }) {
  const styles = useStyles();
  const isSignedIn = useAuthStore((state) => state.status === "signedIn");
  const surface = usePostSurface();
  const internalReference = findFirstInternalReference(post.text);
  const externalUrl = !internalReference && !post.linkPreview ? findFirstExternalUrl(post.text) : null;
  const onDemand = useQuery({
    queryKey: ["posts", post.id, "link-preview"],
    queryFn: () => postsService.refreshPostLinkPreview(post.id),
    enabled: !!externalUrl && isSignedIn,
    retry: false,
    staleTime: Infinity,
  });
  if (internalReference) {
    return <View style={styles.wrap}>{isSignedIn ? <SharedContentCardView reference={internalReference} /> : <GuestInternalLinkCard reference={internalReference} />}</View>;
  }
  const preview = post.linkPreview ?? onDemand.data ?? null;
  return preview ? <View style={styles.wrap}><ExternalLinkCard preview={preview} onOpen={() => feedInteractionsService.recordLinkClick(interactionTargetOf(post), surface)} /></View> : null;
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  card: { borderRadius: 14, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider },
  image: { width: "100%", aspectRatio: 1.91 },
  body: { paddingHorizontal: 12, paddingVertical: 10, gap: 3 },
}));
