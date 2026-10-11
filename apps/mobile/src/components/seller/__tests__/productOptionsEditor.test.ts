import { createElement, useState } from "react";
import { AccessibilityInfo } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { ProductOptionsEditor } from "@/components/seller/productOptionsEditor";
import { showAlertWithButtons } from "@/utils/crossPlatformAlert.util";
import type { OptionGroupDraft } from "@/utils/productOptions.util";

jest.setTimeout(30_000);
jest.mock("@/utils/crossPlatformAlert.util", () => ({ showAlertWithButtons: jest.fn() }));

let latestGroups: readonly OptionGroupDraft[] = [];

function Harness({ impact }: { impact: string | null }) {
  const [groups, setGroups] = useState<readonly OptionGroupDraft[]>([]);
  latestGroups = groups;
  return createElement(ProductOptionsEditor, { groups, onGroupsChange: (update) => setGroups((current) => update(current)), describeRemovalImpact: () => impact });
}

const sizeInput = () => screen.getByLabelText("New size value");
const chipValues = () => latestGroups[0]?.values ?? [];

describe("ProductOptionsEditor", () => {
  const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);

  test("adds values as chips from Return, the Add button, typed commas and pastes", async () => {
    await render(createElement(Harness, { impact: null }));
    await fireEvent.press(screen.getByLabelText("Add Size option"));
    await fireEvent.changeText(sizeInput(), "S");
    await fireEvent(sizeInput(), "submitEditing");
    expect(chipValues()).toEqual(["S"]);
    expect(latestGroups[0]?.pendingText).toBe("");
    expect(announce).toHaveBeenCalledWith("Added S");
    await fireEvent.changeText(sizeInput(), "M, L, XL");
    expect(chipValues()).toEqual(["S", "M", "L", "XL"]);
    await fireEvent.changeText(sizeInput(), "XX");
    await fireEvent.changeText(sizeInput(), "XXL,");
    expect(chipValues()).toEqual(["S", "M", "L", "XL", "XXL"]);
    expect(screen.getByLabelText("Remove XXL")).toBeTruthy();
  });

  test("shows duplicates inline, ignores a double tap and an empty submit", async () => {
    await render(createElement(Harness, { impact: null }));
    await fireEvent.press(screen.getByLabelText("Add Size option"));
    await fireEvent.changeText(sizeInput(), "S");
    const add = screen.getByLabelText("Add size value");
    await fireEvent.press(add);
    await fireEvent.press(add);
    expect(chipValues()).toEqual(["S"]);
    await fireEvent(sizeInput(), "submitEditing");
    expect(screen.queryByText("Type a value first.")).toBeNull();
    await fireEvent.changeText(sizeInput(), " s ");
    await fireEvent(sizeInput(), "submitEditing");
    expect(screen.getByText("“s” is already added.")).toBeTruthy();
    expect(chipValues()).toEqual(["S"]);
    expect(latestGroups[0]?.pendingText).toBe(" s ");
  });

  test("removes chips, reorders them and stops at three options", async () => {
    await render(createElement(Harness, { impact: null }));
    await fireEvent.press(screen.getByLabelText("Add Size option"));
    await fireEvent.changeText(sizeInput(), "S, M");
    await fireEvent.press(screen.getByLabelText("M, 2 of 2"));
    await fireEvent.press(screen.getByLabelText("Move M earlier"));
    expect(chipValues()).toEqual(["M", "S"]);
    await fireEvent.press(screen.getByLabelText("Remove S"));
    expect(chipValues()).toEqual(["M"]);
    expect(announce).toHaveBeenCalledWith("Removed S");
    await fireEvent.press(screen.getByLabelText("Add Colour option"));
    expect(screen.queryByText("Add another option")).toBeNull();
    await fireEvent.changeText(screen.getByLabelText("New colour value"), "Red,");
    await fireEvent.press(screen.getByLabelText("Add a custom option"));
    await fireEvent.press(screen.getByLabelText("Name it Material"));
    await fireEvent.changeText(screen.getByLabelText("New material value"), "Silk,");
    expect(latestGroups.map((group) => group.name)).toEqual(["Size", "Colour", "Material"]);
    expect(screen.queryByText("Add another option")).toBeNull();
    expect(screen.getByText(/the most options a product can have/)).toBeTruthy();
  });

  test("asks before removing a value that deletes saved variants", async () => {
    await render(createElement(Harness, { impact: "S / Red will be deleted when you save." }));
    await fireEvent.press(screen.getByLabelText("Add Size option"));
    await fireEvent.changeText(sizeInput(), "S, M");
    await fireEvent.press(screen.getByLabelText("Remove S"));
    expect(chipValues()).toEqual(["S", "M"]);
    expect(showAlertWithButtons).toHaveBeenCalledWith("Remove S?", "S / Red will be deleted when you save.", expect.any(Array), { intent: "remove" });
  });
});
