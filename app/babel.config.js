module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // The worklets plugin has to be last: it rewrites the functions that run on the UI
    // thread, and anything after it would not be rewritten. Without it the app builds
    // and every animation silently does nothing.
    'react-native-worklets/plugin',
  ],
};
