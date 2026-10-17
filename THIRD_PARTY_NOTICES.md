# Third-party notices

The MIT license at the root of this Figma project covers project-owned code only. Third-party libraries and OCR models retain their own terms. This does not change the parent project or other platform licenses.

The selected design-tool algorithms were migrated from the author-owned DesignProMAX v1.0.48 source and are maintained independently here. No icon catalog, maps, third-party font binaries, feedback QR image or remote illustration is bundled. The original author-owned logo is reused. The production home banner is newly generated with the built-in imagegen tool using the author-owned original banner as a style reference. It contains no embedded typography; source references, generation summary, and checksums are recorded in `src/assets/home-banner.provenance.json`. The old banner remains a source reference only. UI control symbols use lucide-react; test fixtures are drawn in code. Legacy administrative-name data is a source reference only and is not bundled; no map geometry is included.

## Installed production packages

Versions below come from this project's lockfile and installed package metadata. Full license files are retained under `licenses/`. Build dependencies remain identified in `package-lock.json` and are not distributed as the plugin runtime.

| Package | Version | Declared license | Local notice |
| --- | --- | --- | --- |
| bmp-js | 0.1.0 | MIT | licenses/bmp-js-LICENSE |
| lucide-react | 0.468.0 | ISC | licenses/lucide-react-LICENSE |
| fflate | 0.8.3 | MIT | licenses/fflate-LICENSE |
| idb-keyval | 6.3.0 | Apache-2.0 | licenses/idb-keyval-LICENCE |
| is-electron | 2.2.2 | MIT | licenses/is-electron-LICENSE |
| is-url | 1.2.4 | MIT | licenses/is-url-LICENSE-MIT |
| node-fetch | 2.7.0 | MIT | licenses/node-fetch-LICENSE.md |
| opencollective-postinstall | 2.0.3 | MIT | licenses/opencollective-postinstall-LICENSE |
| react | 19.2.7 | MIT | licenses/react-LICENSE |
| react-dom | 19.2.7 | MIT | licenses/react-dom-LICENSE |
| regenerator-runtime | 0.13.11 | MIT | licenses/regenerator-runtime-LICENSE |
| scheduler | 0.27.0 | MIT | licenses/scheduler-LICENSE |
| tesseract.js | 5.1.1 | Apache-2.0 | licenses/tesseract.js-LICENSE.md |
| tesseract.js-core | 5.1.1 | Apache-2.0 | licenses/tesseract.js-core-LICENSE |
| tr46 | 0.0.3 | MIT | See upstream source |
| wasm-feature-detect | 1.9.0 | Apache-2.0 | licenses/wasm-feature-detect-LICENSE |
| webidl-conversions | 3.0.1 | BSD-2-Clause | licenses/webidl-conversions-LICENSE.md |
| whatwg-url | 5.0.0 | MIT | licenses/whatwg-url-LICENSE.txt |
| zlibjs | 0.3.1 | MIT | licenses/zlibjs-LICENSE |

## OCR

- Tesseract.js 5.1.1 and tesseract.js-core 5.1.1: Apache-2.0; retain the package licenses and `licenses/tesseract-worker-bundled-LICENSE.txt` for bundled worker components (including buffer, ieee754, regenerator-runtime and zlib.js).
- English and Simplified Chinese models: official [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast), Apache-2.0. Pinned commit, source URLs, raw and gzip SHA-256 checksums are recorded in `src/assets/ocr/provenance.json`. Models are gzip-compressed locally with a zero timestamp; tests verify both compressed and original bytes.
- `licenses/tessdata-fast-Apache-2.0.txt` preserves the model repository license.
- Before a public release, recheck the compiled core's upstream dependency notices against its exact release source; the npm package license alone is not a complete inventory of its native components. This browser-test version has not been published.

## Optional external service

remove.bg or a user-configured service is not part of this project's MIT license. Users supply their own key and authorize image upload; service terms, quotas and possible fees are separate. The plugin does not include a service key.
