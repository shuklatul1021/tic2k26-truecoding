module.exports = ({ config }) => ({
  ...config,
  name: "Civic Samadhan",
  slug: "civic-samadhan",
  scheme: "civicsamadhan",
  plugins: [
    [
      "expo-router",
      {
        origin: "",
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-font",
    "expo-web-browser",
  ],
  extra: {
    ...(config.extra ?? {}),
    backendUrl: process.env.EXPO_BACKEND_URL || "http://10.56.214.101:3001",
  },
});
