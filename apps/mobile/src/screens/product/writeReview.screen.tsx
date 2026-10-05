import { Image } from "expo-image";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, TextInput, View } from "react-native";

import { useInvalidateProductReviews } from "@/components/reviews/reviewQueries.hook";
import { StarPicker, ratingWord } from "@/components/reviews/starRating";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/emptyState";
import { Header } from "@/components/ui/header";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { fontFamily } from "@/constants/typography.constant";
import type { MainScreenProps } from "@/navigation/navigation.types";
import { generateIdempotencyKey } from "@/services/apiClient.service";
import { reviewsService } from "@/services/reviews.service";
import { useReviewedProductsStore } from "@/store/reviewedProducts.store";
import { showToast } from "@/store/toast.store";
import { makeThemedStyles, useTheme } from "@/theme";
import {
  REVIEW_TEXT_MAX_BYTES,
  classifyReviewSubmitError,
  hasDraftErrors,
  toSubmitReviewInput,
  utf8ByteLength,
  validateReviewDraft,
  type ReviewDraftErrors,
  type ReviewSubmitOutcome,
} from "@/utils/productReviews.util";

export function WriteReviewScreen({ navigation, route }: MainScreenProps<"WriteReview">) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { productId, productName, imageUrl } = route.params;
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [errors, setErrors] = useState<ReviewDraftErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<{ outcome: ReviewSubmitOutcome; message: string } | null>(null);
  const inFlight = useRef(false);
  const idempotencyKey = useRef(generateIdempotencyKey());
  const markReviewed = useReviewedProductsStore((state) => state.markReviewed);
  const invalidate = useInvalidateProductReviews();

  const submit = async () => {
    if (inFlight.current) return;
    const draft = { rating, text, title };
    const found = validateReviewDraft(draft);
    setErrors(found);
    if (hasDraftErrors(found)) return;
    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);
    try {
      await reviewsService.submitProductReview(productId, toSubmitReviewInput(draft), idempotencyKey.current);
      markReviewed(productId);
      void invalidate(productId);
      showToast("Thanks for your review", { tone: "success" });
      navigation.replace("ProductReviews", { productId });
    } catch (error) {
      const classified = classifyReviewSubmitError(error);
      if (classified.outcome === "already_reviewed") markReviewed(productId);
      if (classified.outcome !== "failed") idempotencyKey.current = generateIdempotencyKey();
      setFailure(classified);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (failure && (failure.outcome === "already_reviewed" || failure.outcome === "not_eligible")) {
    return (
      <Screen>
        <Header title="Rate your purchase" />
        <EmptyState
          title={failure.outcome === "already_reviewed" ? "You've already reviewed this" : "Not ready for a review yet"}
          body={failure.message}
          actionLabel={failure.outcome === "already_reviewed" ? "See your review" : "Back"}
          onAction={() => (failure.outcome === "already_reviewed" ? navigation.replace("ProductReviews", { productId }) : navigation.goBack())}
        />
      </Screen>
    );
  }

  const textBytes = utf8ByteLength(text.trim());
  return (
    <Screen>
      <Header title="Rate your purchase" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {productName ? (
          <View style={styles.product}>
            <View style={styles.thumb}>{imageUrl ? <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
            <Text size={14} weight={500} lineHeight={18} numberOfLines={2} style={styles.flex}>{productName}</Text>
          </View>
        ) : null}
        <View style={styles.field}>
          <Text size={16} weight={600} lineHeight={19.2} accessibilityRole="header">How would you rate it?</Text>
          <StarPicker value={rating} onChange={(next) => { setRating(next); setErrors((current) => ({ ...current, rating: undefined })); }} disabled={submitting} />
          <Text size={13} lineHeight={16.9} color={errors.rating ? colors.error : colors.textMuted} accessibilityLiveRegion="polite">
            {errors.rating ?? (rating > 0 ? ratingWord(rating) : "Tap a star")}
          </Text>
        </View>
        <View style={styles.field}>
          <Text size={16} weight={600} lineHeight={19.2}>Title (optional)</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            editable={!submitting}
            maxLength={120}
            placeholder="Sum it up in a few words"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Review title, optional"
            style={[styles.input, styles.titleInput, errors.title ? styles.invalid : null]}
          />
          {errors.title ? <Text size={12} lineHeight={16} color={colors.error} accessibilityRole="alert">{errors.title}</Text> : null}
        </View>
        <View style={styles.field}>
          <Text size={16} weight={600} lineHeight={19.2}>Your review</Text>
          <TextInput
            value={text}
            onChangeText={(next) => { setText(next); if (errors.text) setErrors((current) => ({ ...current, text: undefined })); }}
            editable={!submitting}
            multiline
            maxLength={REVIEW_TEXT_MAX_BYTES}
            placeholder="What did you like or dislike? How was the quality and fit?"
            placeholderTextColor={colors.textSubtle}
            accessibilityLabel="Your review"
            style={[styles.input, styles.bodyInput, errors.text ? styles.invalid : null]}
          />
          <Text size={12} lineHeight={16} color={errors.text ? colors.error : colors.textSubtle} accessibilityRole={errors.text ? "alert" : undefined}>
            {errors.text ?? `${textBytes}/${REVIEW_TEXT_MAX_BYTES}`}
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {failure ? <Text size={12} lineHeight={16} color={colors.error} align="center" accessibilityRole="alert">{failure.message}</Text> : null}
        <Button title="Post review" loading={submitting} disabled={submitting} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 24 },
  product: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 8, overflow: "hidden", backgroundColor: colors.placeholder },
  field: { gap: 8 },
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textSubtle,
    backgroundColor: colors.surface,
    fontFamily: fontFamily[400],
    fontSize: 14,
    color: colors.text,
  },
  titleInput: { height: 44, paddingVertical: 0 },
  bodyInput: { minHeight: 140, textAlignVertical: "top" },
  invalid: { borderColor: colors.error },
  footer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 8 },
}));
