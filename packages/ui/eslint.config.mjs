import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// This package is a React component library, not a Next app: there is no
// router and no .next output. It keeps the apps' presets anyway, because its
// components use next/image and next/link and must obey the same rules the
// apps are held to — a shared component that breaks core-web-vitals breaks
// both apps at once.

const eslintConfig = defineConfig([
  // Every workspace installs its own physical copy of
  // @vis.gl/react-google-maps, and each copy carries its own React
  // context. An <APIProvider> from an app's copy provides nothing to
  // the <Map> inside this package, which throws "<Map> can only be used
  // inside an <ApiProvider> component". Everyone goes through the
  // re-export so there is one copy in the tree.
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@vis.gl/react-google-maps",
          message: "Import from ./maps (packages/ui/places/maps.ts) instead.",
        }],
      }],
    },
  },
  ...nextVitals,
  ...nextTs,
  // no-html-link-for-pages scans for a Pages Router directory and prints
  // "Pages directory cannot be found" on every run when there is none. This
  // package has no router at all, and both apps are App Router, so the rule
  // has nothing to check here.
  {
    rules: { "@next/next/no-html-link-for-pages": "off" },
  },
  // places/maps.ts is the re-export itself, and the only file allowed to
  // reach the library directly. The rule above exists to protect it.
  {
    files: ["places/maps.ts"],
    rules: { "no-restricted-imports": "off" },
  },
  globalIgnores([
    "build/**",
    "dist/**",
  ]),
]);

export default eslintConfig;
