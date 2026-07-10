/** @type {import('expo/config').ExpoConfig} */
const appJson = require("./app.json");

const googleMapsApiKey = (process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "").trim();

module.exports = () => {
  const expo = { ...appJson.expo };
  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || "https://api.burqan.store").replace(/\/$/, "");

  expo.extra = {
    ...(expo.extra ?? {}),
    apiUrl,
    ...(googleMapsApiKey ? { googleMapsApiKey } : {}),
  };

  if (googleMapsApiKey) {
    expo.android = {
      ...expo.android,
      config: {
        ...(expo.android?.config ?? {}),
        googleMaps: { apiKey: googleMapsApiKey },
      },
    };
    expo.ios = {
      ...expo.ios,
      config: {
        ...(expo.ios?.config ?? {}),
        googleMapsApiKey,
      },
    };
  }

  return { expo };
};
