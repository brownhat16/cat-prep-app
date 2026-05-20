const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
// Watchman is blocked for this project on macOS, so force Metro to use the Node watcher.
config.resolver.useWatchman = false;
// Allow .html files to be loaded as assets (needed for puter-bridge.html WebView)
config.resolver.assetExts = [...(config.resolver.assetExts || []), 'html'];

module.exports = withNativeWind(config, { input: "./src/global.css" });
