// Dynamic Expo config. Expo reads the static values from app.json and passes
// them in as `config`; here we give non-production (testing / staging) builds a
// DISTINCT application identifier, name and scheme so a testing APK installs
// side-by-side with — and can never be mistaken for — the production app.
//
// The testing build profile (eas.json → "testing") sets APP_VARIANT=staging.
// Production / default builds are returned unchanged.
const VARIANT = (
  process.env.APP_VARIANT ||
  process.env.EXPO_PUBLIC_APP_ENV ||
  ""
).toLowerCase();

const IS_TESTING = VARIANT === "staging" || VARIANT === "testing" || VARIANT === "development";

module.exports = ({ config }) => {
  if (!IS_TESTING) return config;

  const androidPkg = config.android && config.android.package;
  const iosBundle = config.ios && config.ios.bundleIdentifier;

  return {
    ...config,
    name: `${config.name} (Testing)`,
    scheme: `${config.scheme}staging`,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundle ? `${iosBundle}.staging` : iosBundle,
    },
    android: {
      ...config.android,
      package: androidPkg ? `${androidPkg}.staging` : androidPkg,
    },
  };
};
