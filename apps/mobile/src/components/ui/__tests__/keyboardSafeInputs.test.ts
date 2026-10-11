import fs from "fs";
import path from "path";

const SRC = path.resolve(__dirname, "../../..");

const KEYBOARD_SAFE_CONTAINERS = [
  "KeyboardAwareForm",
  "KeyboardScrollScreen",
  "KeyboardStickyFooter",
  "KeyboardSpacer",
  "BottomSheet",
  "FullScreenModal",
  "AuthStep",
  "SettingsPage",
] as const;

const CONTAINER_DEFINITIONS: Record<string, string> = {
  "components/ui/bottomSheet.tsx": "KeyboardSpacer",
  "components/ui/fullScreenModal.tsx": "KeyboardSpacer",
  "components/auth/authStep.tsx": "KeyboardAwareForm",
  "components/settings/settingsPage.tsx": "KeyboardAwareForm",
  "components/ui/keyboardStickyFooter.tsx": "KeyboardSpacer",
};

const ALLOWED_WITHOUT_CONTAINER: Record<string, string> = {
  "components/ui/input.tsx": "The TextField primitive itself; every screen or sheet that renders it is audited on its own.",
};

const INPUT_ELEMENT = /(?<![\w])<(TextInput|TextField)[\s/]/;
const CONTAINER_ELEMENT = new RegExp(`<(${KEYBOARD_SAFE_CONTAINERS.join("|")})\\b`);

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const files = sourceFiles(SRC);
const source = new Map(files.map((file) => [file, fs.readFileSync(file, "utf8")]));
const relative = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

function resolveImport(fromFile: string, specifier: string): string | null {
  const base = specifier.startsWith("@/") ? path.join(SRC, specifier.slice(2)) : specifier.startsWith(".") ? path.resolve(path.dirname(fromFile), specifier) : null;
  if (!base) return null;
  return [`${base}.tsx`, `${base}.ts`, path.join(base, "index.ts"), path.join(base, "index.tsx")].find((candidate) => source.has(candidate)) ?? null;
}

const isRenderableName = (name: string) => /^[A-Z][a-z]/.test(name) || /^use[A-Z]/.test(name);

const renderers = new Map<string, Set<string>>();
for (const file of files) {
  for (const match of (source.get(file) ?? "").matchAll(/import\s+(type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g)) {
    if (match[1]) continue;
    const target = resolveImport(file, match[3]);
    if (!target) continue;
    const names = match[2].split(",").map((part) => part.trim()).filter((part) => part && !part.startsWith("type "));
    if (!names.some((name) => isRenderableName(name.split(/\s+as\s+/)[0]))) continue;
    if (!renderers.has(target)) renderers.set(target, new Set());
    renderers.get(target)?.add(file);
  }
}

function isKeyboardSafe(file: string, visiting = new Set<string>()): boolean {
  if (CONTAINER_ELEMENT.test(source.get(file) ?? "")) return true;
  if (visiting.has(file)) return false;
  const parents = [...(renderers.get(file) ?? [])];
  if (parents.length === 0) return false;
  const nextVisiting = new Set(visiting).add(file);
  return parents.every((parent) => isKeyboardSafe(parent, nextVisiting));
}

describe("keyboard-safe inputs", () => {
  const inputFiles = files.filter((file) => INPUT_ELEMENT.test(source.get(file) ?? ""));

  test("finds the app's text inputs", () => {
    expect(inputFiles.length).toBeGreaterThan(50);
  });

  test("every screen, sheet and component with a text input renders inside a keyboard-safe container", () => {
    const unsafe = inputFiles.map(relative).filter((file) => !ALLOWED_WITHOUT_CONTAINER[file] && !isKeyboardSafe(path.join(SRC, file)));
    expect(unsafe).toEqual([]);
  });

  test("every allowlisted exception still exists and has a reason", () => {
    for (const [file, reason] of Object.entries(ALLOWED_WITHOUT_CONTAINER)) {
      expect(source.has(path.join(SRC, file))).toBe(true);
      expect(reason.length).toBeGreaterThan(20);
    }
  });

  test("the shared containers really handle the keyboard", () => {
    for (const [file, primitive] of Object.entries(CONTAINER_DEFINITIONS)) {
      expect(source.get(path.join(SRC, file))).toMatch(new RegExp(`<${primitive}\\b`));
    }
  });

  test("only the adapter imports react-native-keyboard-controller, so Expo Go without the module cannot crash", () => {
    const direct = files.filter((file) => /["']react-native-keyboard-controller["']/.test(source.get(file) ?? "")).map(relative);
    expect(direct).toEqual(["components/ui/keyboardController.ts"]);
    const app = fs.readFileSync(path.resolve(SRC, "../App.tsx"), "utf8");
    expect(app).not.toMatch(/from "react-native-keyboard-controller"/);
    expect(app).toMatch(/<KeyboardProvider\b/);
  });

  test("Android resizes the window for the keyboard", () => {
    const appConfig = JSON.parse(fs.readFileSync(path.resolve(SRC, "../app.json"), "utf8"));
    expect(appConfig.expo.android.softwareKeyboardLayoutMode).toBe("resize");
  });
});
