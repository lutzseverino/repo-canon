import { existsSync } from "node:fs";

// Adopted consumers share canonical modules, including class identity.
// Standalone copies select their shipped runtime as one complete installation.
const canonicalVendor = new URL("../../../vendor/", import.meta.url);
const adopted = existsSync(new URL("./postern/postern.mjs", canonicalVendor));
export function runtimeModule(path) {
  return adopted
    ? new URL(path.slice("vendor/".length), canonicalVendor).href
    : new URL(`./runtime/${path}`, import.meta.url).href;
}
