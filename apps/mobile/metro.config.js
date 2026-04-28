const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force react + react-native to always resolve from the app's node_modules
// to prevent duplicate React ("Invalid hook call") errors in monorepos.
const forceLocal = ['react', 'react-native'];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isForced = forceLocal.some(
    (m) => moduleName === m || moduleName.startsWith(m + '/'),
  );
  if (isForced) {
    try {
      // `paths` takes parent dirs of node_modules, not node_modules itself
      const resolved = require.resolve(moduleName, { paths: [projectRoot] });
      return { filePath: resolved, type: 'sourceFile' };
    } catch {}
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
