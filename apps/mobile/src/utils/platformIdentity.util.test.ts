import { platformIdentityLabelFor } from "./platformIdentity.util";

test("labels the iOS mobile client as Nantty for iPhone", () => {
  expect(platformIdentityLabelFor("ios")).toBe("Nantty for iPhone");
});

test("labels the Android mobile client as Nantty for Android", () => {
  expect(platformIdentityLabelFor("android")).toBe("Nantty for Android");
});

test("does not apply a mobile platform label to other targets", () => {
  expect(platformIdentityLabelFor("web")).toBeNull();
});
