const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), /(^|[/\\])apps[/\\](web|api)[/\\]/];

// Mocks are only bundled when EXPO_PUBLIC_USE_MOCKS is "true" (dev and the EAS "demo" profile). Production and preview
// builds resolve every import of src/mocks from outside it to a stub, so Metro never includes the mock modules.
const mocksDirectory = path.join(__dirname, "src", "mocks") + path.sep;
const mocksDisabledStub = path.join(__dirname, "src", "config", "mocksDisabled.stub.js");
const mockFlag = process.env.EXPO_PUBLIC_USE_MOCKS;
const stripMocks = mockFlag === "false" || (mockFlag === undefined && process.env.NODE_ENV === "production");

if (stripMocks) {
  const upstreamResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
    const fromMocks = context.originModulePath.startsWith(mocksDirectory);
    if (!fromMocks && resolved.type === "sourceFile" && resolved.filePath.startsWith(mocksDirectory)) return { type: "sourceFile", filePath: mocksDisabledStub };
    return resolved;
  };
}

module.exports = config;
