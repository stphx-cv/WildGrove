import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // Every workspace installs its own physical copy of
  // @vis.gl/react-google-maps, and each copy carries its own React
  // context. An <APIProvider> from this app's copy provides nothing to
  // the <Map> inside packages/ui, which throws "<Map> can only be used
  // inside an <ApiProvider> component". Everyone goes through the
  // re-export so there is one copy in the tree.
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [{
          name: "@vis.gl/react-google-maps",
          message: "Import from @wildgrove/ui/places/maps instead — see packages/ui/places/maps.ts.",
        }],
      }],
    },
  },
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Skill/agent template files — intentional unused vars in boilerplate
    ".agents/**",
    ".claude/**",
  ]),
]);

export default eslintConfig;
