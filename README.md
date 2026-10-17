# DesignProMAX Toolkit

Free, open-source productivity tools for Figma: text, images, local OCR, and document cleanup.

[![CI](https://github.com/BeatsAD/DesignProMAX-Toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/BeatsAD/DesignProMAX-Toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

English · [简体中文](README.zh-CN.md)

**Version 0.3.2 · Development preview.** Source is public; the plugin is not yet on Figma Community. Build it locally and import it as a development plugin. See [installation](docs/INSTALLATION.md) and [current status](docs/STATUS.md).

## Features

| Area | Tools |
| --- | --- |
| Text | Custom-field fill, find and replace, split and merge |
| Images | Background removal, trim transparent edges, split into PNG layers |
| OCR | Local English and Simplified Chinese text recognition |
| Documents | Review cleanup candidates, design statistics, size adaptation |

- Eight UI languages: English, 简体中文, 日本語, 한국어, Français, Deutsch, Español, Português.
- Light/dark themes, compact mode, and a resizable window (default 380×650, minimum width 320px).
- Local tools and OCR process content without uploading documents or images. Optional background removal requires your own service key and explicit image-upload consent; the service may charge fees.
- Review previews and results. OCR can misread text, especially numbers, dates, and amounts.

## Install in Figma

Requires Node.js 22+, npm, and the Figma desktop app for this development-plugin workflow.

```sh
git clone https://github.com/BeatsAD/DesignProMAX-Toolkit.git
cd DesignProMAX-Toolkit
npm ci
npm run build
```

Then create your own Figma development-plugin ID, generate the local manifest, and import it. Follow the [step-by-step installation guide](docs/INSTALLATION.md). No shared plugin ID or prebuilt download is included.

## Try the browser demo

```sh
npm run dev
```

Open [localhost:5186](http://127.0.0.1:5186/). Use sample text, images, layouts, and cleanup scenarios, or load a non-sensitive image of your own. The demo uses an in-memory document: refreshing resets its document; language and settings persist in that browser.

The browser demo simulates Figma APIs and undo. Its results do not establish native Figma compatibility.

## Use

1. Select layers and open a tool.
2. Set parameters, inspect the preview, and choose the results to apply where offered.
3. Confirm the operation and inspect its result. If an outcome is uncertain, inspect the document before retrying.

Image tools read your selection before processing. Automatic image splitting works best with clearly separated regions; adjust regions before generating results.

## Limits and privacy

- Complex documents, the full native parameter matrix, external background-removal services, and large-file performance still need broader acceptance testing.
- Eight UI languages do not mean eight OCR languages: recognition is English/Simplified Chinese only.
- Some image replacement modes and instance contents have deliberate restrictions. See [image behavior](docs/FIGMA_IMAGE_WRITES.md).
- API keys are stored in Figma client storage without encryption. Do not share them in issues or screenshots.
- Diagnostic export downloads filtered metadata locally and does not send it automatically. See [privacy](docs/PRIVACY.md) and [support](docs/SUPPORT.md).

## Report a problem or contribute

[Report a bug](https://github.com/BeatsAD/DesignProMAX-Toolkit/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/BeatsAD/DesignProMAX-Toolkit/issues/new?template=feature_request.yml) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md)

Support: [wenbinailab@gmail.com](mailto:wenbinailab@gmail.com). Remove sensitive content before sharing examples; never upload customer documents or API keys.

## Development

```sh
npm ci
npm run verify
```

`verify` runs TypeScript checks, a production build, locale coverage, automated tests (including production startup HTML and resource round trips), and build-input isolation. Initial `figma.showUI` HTML must stay strictly below 1,572,864 UTF-8 bytes.

This project builds independently of the author's other platform implementations. Source is in `src/`, build utilities in `scripts/`, and tests in `tests/`. Generated builds, dependencies, local plugin configuration, and QA output are excluded from Git. Historical migration scripts are not normal setup steps.

[Current status](docs/STATUS.md) · [Changelog](CHANGELOG.md) · [Engineering document index](docs/README.md)

## License

Project-owned code is [MIT licensed](LICENSE). Dependencies, OCR models, and bundled components retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md) and `licenses/`.
