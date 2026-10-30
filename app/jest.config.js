module.exports = {
  preset: '@react-native/jest-preset',
  // The packages that ship their code as ES modules have to be transformed, or jest
  // cannot read them.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-reanimated|react-native-worklets|react-native-svg)/)',
  ],
  // Reanimated's own resolver: it points the web-only parts of the library at their
  // native versions, which is what the app runs.
  resolver: 'react-native-reanimated/jest/resolver.js',
};
