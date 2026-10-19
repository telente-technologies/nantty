import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const mobileRoot = join(__dirname, "..", "..", "..", "..");
const androidWidgetFolder = join(mobileRoot, "src", "widgets", "android");
const androidOnlyModuleNames = ["androidWidgetTaskHandler", "androidWidgetParts", "commerceAndroidWidgets", "socialAndroidWidgets", "renderAndroidWidget"];
const androidOnlySpecifier = new RegExp(`(react-native-android-widget|(^|/)(${androidOnlyModuleNames.join("|")})|androidWidgetModules\\.android|registerAndroidWidgets\\.android)$`);
const valueImportPattern = /(?:^|\n)\s*import\s+(?!type\b)[^;]*?from\s+["']([^"']+)["']|require\(\s*["']([^"']+)["']\s*\)/g;

function listSourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (name === "node_modules" || name === "__tests__") return [];
    if (statSync(path).isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const isAndroidOnlyFile = (path: string) =>
  /\.android\.tsx?$/.test(path) || androidOnlyModuleNames.some((name) => path === join(androidWidgetFolder, `${name}.tsx`) || path === join(androidWidgetFolder, `${name}.ts`));

describe("Android home-screen widget code stays out of web and iOS bundles", () => {
  it("only Android-only files import react-native-android-widget or the Android widget modules", () => {
    const sharedFiles = [...listSourceFiles(join(mobileRoot, "src")), join(mobileRoot, "index.ts"), join(mobileRoot, "App.tsx")].filter((path) => !isAndroidOnlyFile(path));
    const offenders = sharedFiles.flatMap((path) =>
      [...readFileSync(path, "utf8").matchAll(valueImportPattern)]
        .map((match) => match[1] ?? match[2] ?? "")
        .filter((specifier) => androidOnlySpecifier.test(specifier))
        .map((specifier) => `${relative(mobileRoot, path)} -> ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it("resolves to no-op modules off Android without loading the native widget library", () => {
    const loadNativeWidgetLibrary = jest.fn(() => ({ registerWidgetTaskHandler: jest.fn(), requestWidgetUpdate: jest.fn() }));
    jest.isolateModules(() => {
      jest.doMock("react-native-android-widget", loadNativeWidgetLibrary);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { registerAndroidHomeScreenWidgets } = require("../registerAndroidWidgets") as typeof import("../registerAndroidWidgets");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { loadAndroidWidgetModules } = require("../androidWidgetModules") as typeof import("../androidWidgetModules");
      registerAndroidHomeScreenWidgets();
      expect(loadAndroidWidgetModules()).toBeNull();
    });
    expect(loadNativeWidgetLibrary).not.toHaveBeenCalled();
  });
});
