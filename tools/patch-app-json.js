// Adds the localization plugin to a freshly created Expo project's app.json.
// Kept as a file rather than inline `node -e` so it works identically from bash
// and PowerShell, where quoting rules differ.
const fs = require('fs');

const cfg = JSON.parse(fs.readFileSync('app.json', 'utf8'));
cfg.expo.plugins = cfg.expo.plugins || [];

const already = cfg.expo.plugins.some(
  (p) => (Array.isArray(p) ? p[0] : p) === 'expo-localization'
);
if (!already) {
  cfg.expo.plugins.push(['expo-localization', {
    supportedLocales: {
      ios: ['tr', 'en'],
      android: ['tr', 'en'],
    },
  }]);
}
cfg.expo.name = 'Sofra';
cfg.expo.slug = cfg.expo.slug || 'sofra';

// iOS specifics that App Store Connect will ask for anyway. Setting
// usesNonExemptEncryption now saves a rejected submission later: without it every
// build triggers the export-compliance questionnaire.
cfg.expo.ios = Object.assign({}, cfg.expo.ios, {
  bundleIdentifier: cfg.expo.ios && cfg.expo.ios.bundleIdentifier
    ? cfg.expo.ios.bundleIdentifier : 'com.CHANGEME.sofra',
  supportsTablet: true,
  config: Object.assign({}, cfg.expo.ios && cfg.expo.ios.config, {
    usesNonExemptEncryption: false,
  }),
});
cfg.expo.locales = Object.assign({}, cfg.expo.locales);

fs.writeFileSync('app.json', JSON.stringify(cfg, null, 2));
console.log('  app.json updated');
