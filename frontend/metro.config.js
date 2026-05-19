const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// Watchman is blocked for this project on macOS, so force Metro to use the Node watcher.
config.resolver.useWatchman = false;

module.exports = withNativeWind(config, { input: "./src/global.css" });
