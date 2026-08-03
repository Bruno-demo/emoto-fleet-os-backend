const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// ─── Monorepo watch folders ─────────────────────────────────────────────────
// Metro must watch the workspace root so it can resolve hoisted packages that
// live outside apps/rider/node_modules.
config.watchFolders = [workspaceRoot];

// ─── Module resolution order ────────────────────────────────────────────────
// Rider-local node_modules first, then workspace root as fallback.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// ─── Singleton enforcement (prevents "Invalid hook call") ───────────────────
// In an npm-workspaces monorepo the dashboard uses React 19.2.x while the rider
// app pins React 19.1.x.  npm hoists 19.2.x to root and keeps 19.1.x local.
// react-native-web is hoisted to root but it resolves React from *its own*
// node_modules scope (root), picking up 19.2.x → two React copies → crash.
//
// require.resolve() finds the *actual* installed copy no matter where npm
// decided to place it, so every import of these packages goes through the same
// physical directory.  We resolve from the rider project directory so the
// rider-local copy wins when it exists.
function resolveModule(name) {
  // resolve the package's directory (not the entry file) so Metro can find
  // all sub-paths like react/jsx-runtime, react-dom/client, etc.
  return path.dirname(require.resolve(`${name}/package.json`, { paths: [projectRoot] }));
}

config.resolver.extraNodeModules = {
  // React singleton — rider-local 19.1.0 wins
  react: resolveModule('react'),
  'react-dom': resolveModule('react-dom'),
  // react-native-web is hoisted to root; resolve it from there, but force
  // it to use the same React via the entries above
  'react-native-web': resolveModule('react-native-web'),
  // react-native-gesture-handler web deps
  'react-native': resolveModule('react-native'),
  'react-native-gesture-handler': resolveModule('react-native-gesture-handler'),
  'react-native-screens': resolveModule('react-native-screens'),
  'react-native-safe-area-context': resolveModule('react-native-safe-area-context'),
  '@react-navigation/native': resolveModule('@react-navigation/native'),
  '@react-navigation/native-stack': resolveModule('@react-navigation/native-stack'),
  '@react-navigation/bottom-tabs': resolveModule('@react-navigation/bottom-tabs'),
};

// ─── Block root React from being bundled ────────────────────────────────────
// Even with extraNodeModules, Metro can still follow symlinks or transitive
// imports to the root copy.  blockList prevents that.
const rootReact = path.resolve(workspaceRoot, 'node_modules', 'react');
const rootReactDom = path.resolve(workspaceRoot, 'node_modules', 'react-dom');
// Escape backslashes for Windows regex
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
config.resolver.blockList = [
  new RegExp(`${escapeRegex(rootReact)}(/|\\\\).*`),
  new RegExp(`${escapeRegex(rootReactDom)}(/|\\\\).*`),
];

module.exports = config;
