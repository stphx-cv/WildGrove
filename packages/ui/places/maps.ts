"use client"

// ══════════════════════════════════════════════════════════════════
// maps — the single @vis.gl/react-google-maps instance
//
// Every workspace installs its own physical copy of
// @vis.gl/react-google-maps (npm nests it under wildgrove-cms/,
// wildgrove-web/ and packages/ui/ instead of hoisting it). Each copy
// carries its own React context, so an <APIProvider> imported from an
// app's copy does not provide anything to the <Map>, <AdvancedMarker>
// or useMapsLibrary() inside AddressAutocomplete / MapPicker, which
// import from the packages/ui copy. The mismatch throws
// "<Map> can only be used inside an <ApiProvider> component" and, with
// no error boundary in the CMS, takes the whole page down.
//
// So: apps never import @vis.gl/react-google-maps directly. They import
// from here, which re-exports the same copy the shared components use.
// ══════════════════════════════════════════════════════════════════

export {
  APIProvider,
  AdvancedMarker,
  Map,
  Pin,
  useApiIsLoaded,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps"
