import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, View } from "react-native";

import { Check16Icon, MapPin24Icon, Trash24Icon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottomSheet";
import { BrandLoader } from "@/components/ui/brandLoader";
import { Text } from "@/components/ui/text";
import { placesService } from "@/services/geo/places.service";
import { makeThemedStyles, useTheme } from "@/theme";
import type { PostLocationTag } from "@/types";

import { SearchField, useDebouncedSearchText } from "./searchField";

export interface PlaceSearchSheetProps {
  readonly visible: boolean;
  readonly selected: PostLocationTag | null;
  readonly onSelect: (place: PostLocationTag | null) => void;
  readonly onClose: () => void;
}

export function PlaceSearchSheet({ visible, selected, onSelect, onClose }: PlaceSearchSheetProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const search = useDebouncedSearchText();
  const places = useQuery({
    queryKey: ["places", "search", search.debounced],
    queryFn: () => placesService.searchPlaces(search.debounced),
    enabled: visible && search.debounced.length >= 2,
    staleTime: 5 * 60_000,
  });
  const emptyMessage = search.debounced.length < 2 ? "Type at least 2 letters to search." : places.isError ? "Search isn't available right now. Try again." : "No places match. Try a nearby area or landmark.";

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Add location" subtitle="Search for a place by name. Nantty never reads your device location for this.">
      <View style={styles.body}>
        <SearchField value={search.typed} onChangeText={search.setTyped} label="Search places" />
        {selected ? (
          <View style={styles.removeRow}>
            <Trash24Icon size={20} color={colors.error} />
            <Text size={14} weight={500} lineHeight={16.8} color={colors.error} accessibilityRole="button" onPress={() => onSelect(null)} style={styles.remove}>
              Remove {selected.name}
            </Text>
          </View>
        ) : null}
        {places.isFetching ? (
          <BrandLoader size="md" style={styles.message} />
        ) : (
          <FlatList
            style={styles.list}
            data={search.debounced.length >= 2 ? (places.data ?? []) : []}
            keyExtractor={(place) => place.placeId}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text size={13} lineHeight={18.2} color={colors.textMuted} align="center" style={styles.message}>{emptyMessage}</Text>}
            renderItem={({ item }) => {
              const isSelected = item.placeId === selected?.placeId;
              return (
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: isSelected }} accessibilityLabel={item.area ? `${item.name}, ${item.area}` : item.name} onPress={() => onSelect(item)} style={styles.row}>
                  <MapPin24Icon size={20} color={colors.textMuted} />
                  <View style={styles.texts}>
                    <Text size={14} weight={isSelected ? 600 : 500} lineHeight={16.8} numberOfLines={1}>{item.name}</Text>
                    {item.area ? <Text size={12} lineHeight={16.8} color={colors.textMuted} numberOfLines={1}>{item.area}</Text> : null}
                  </View>
                  {isSelected ? <Check16Icon color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}

const useStyles = makeThemedStyles((colors) => StyleSheet.create({
  body: { flexShrink: 1, paddingHorizontal: 16, paddingBottom: 16, gap: 12, maxHeight: 520 },
  list: { flexShrink: 1, maxHeight: 340 },
  message: { marginVertical: 24 },
  remove: { paddingVertical: 6, flex: 1 },
  removeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  texts: { flex: 1, gap: 2 },
}));
