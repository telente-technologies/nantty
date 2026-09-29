const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [...[].concat(config.resolver.blockList ?? []), /(^|[/\\])apps[/\\](web|api)[/\\]/];

module.exports = config;
