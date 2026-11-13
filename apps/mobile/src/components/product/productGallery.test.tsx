import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProductGallery } from "./productGallery";

jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("@/components/ui/previewableImage", () => ({
  useImagePreview: () => ({ openImagePreview: jest.fn(), imagePreviewElement: null }),
}));
jest.mock("@/theme", () => ({
  makeThemedStyles: (factory: (colors: Record<string, string>, scheme: string) => unknown) => () => factory({
    textSubtle: "subtle",
    background: "background",
    placeholder: "placeholder",
    primary: "primary",
  }, "light"),
}));

describe("ProductGallery", () => {
  it("shows the product cover image when the gallery list is empty", async () => {
    await render(<ProductGallery images={[]} fallbackImageUrl="https://example.test/product.jpg" promo={null} />);

    const cover = screen.getByRole("imagebutton", { name: "Product image 1 of 1" });
    expect(cover).toBeTruthy();
    expect(cover.props.accessibilityState?.disabled).not.toBe(true);
    await fireEvent.press(cover);
  });

  it("keeps the multi-image gallery when gallery images are present", async () => {
    await render(<ProductGallery images={["https://example.test/one.jpg", "https://example.test/two.jpg"]} fallbackImageUrl="https://example.test/cover.jpg" promo={null} />);

    expect(screen.getByRole("imagebutton", { name: "Product image 1 of 2" })).toBeTruthy();
    expect(screen.getByRole("imagebutton", { name: "Product image 2 of 2" })).toBeTruthy();
  });
});
