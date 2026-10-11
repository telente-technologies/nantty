// Bundled in place of src/mocks when a build has mocks off (see metro.config.js), so the mock backend and its seed data
// never ship in production or preview builds. Any mock export reached by mistake fails loudly instead of faking data.
const disabled = () => {
  throw new Error("Mocks are not part of this build (EXPO_PUBLIC_USE_MOCKS is off).");
};

module.exports = new Proxy({}, { get: (_target, name) => (name === "__esModule" ? false : disabled) });
