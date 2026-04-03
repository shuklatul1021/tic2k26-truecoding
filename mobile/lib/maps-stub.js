const React = require("react");
const { View } = require("react-native");
const Noop = () => React.createElement(View, null);
module.exports = {
  default: Noop,
  MapView: Noop,
  Marker: Noop,
  Callout: Noop,
  Polyline: Noop,
  PROVIDER_GOOGLE: null,
};
