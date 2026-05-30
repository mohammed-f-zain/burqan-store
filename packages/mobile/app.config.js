/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

const googleMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();

module.exports = () => {
  const expo = { ...appJson.expo };
  const plugins = [...(expo.plugins || [])];

  if (googleMapsApiKey) {
    expo.android = {
      ...expo.android,
      config: {
        ...(expo.android?.config ?? {}),
        googleMaps: { apiKey: googleMapsApiKey },
      },
    };
    plugins.push([
      "react-native-maps",
      {
        androidGoogleMapsApiKey: googleMapsApiKey,
      },
    ]);
  }

  return { expo: { ...expo, plugins } };
};
