# Current status / 当前状态

Updated: 2026-10-17. Source version: **0.3.2**. This page summarizes recorded validation; internal process records remain local-only.

| Area | State |
| --- | --- |
| Public source | [BeatsAD/DesignProMAX-Toolkit](https://github.com/BeatsAD/DesignProMAX-Toolkit), MIT for project-owned code |
| Distribution | Development/source preview; not on Figma Community; no released installation bundle |
| Tools | 10 tools; eight UI languages; local English/Simplified Chinese OCR |
| Latest recorded automation | 121 tests, type checks, production build, locale coverage, and 1,689 isolated inputs, including Node/browser ZIP64 dependency regressions; diagnostic export behavior is summarized in [privacy](PRIVACY.md) |
| Native Figma evidence | Earlier v0.3.2 targeted checks cover language persistence, text/image operations, and transaction recovery; these were 12 targeted checks, not a complete native parameter matrix |
| Subsequent changes | Eight-language copy review and diagnostic-export filtering have automated/browser evidence; those changes have not been reaccepted in native Figma |

For checks on a particular commit, see its [CI run](https://github.com/BeatsAD/DesignProMAX-Toolkit/actions/workflows/ci.yml). CI does not validate native Figma, external image services, or OCR accuracy.

## Latest recorded build

| Measurement | UTF-8 bytes |
| --- | ---: |
| Actual initial `figma.showUI` HTML | 1,190,379 |
| Complete offline HTML | 8,210,851 |
| Main thread JavaScript | 103,896 |

Initial HTML must be **strictly below 1,572,864 bytes**. Home artwork loads after the home page commits; OCR Worker/WASM/models load when recognition starts. Package size is not cold-start timing. Values were rechecked after the fflate update; documentation and repository images do not enter the plugin build.

## Dependency and repository update — 2026-10-17

fflate was pinned from 0.8.2 to 0.8.3 for [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98). Before the update, an isolated malformed-ZIP64 input timed out in both Node and browser exports. After the update, two malformed forms promptly throw invalid-ZIP errors; valid ZIP/gzip controls and existing OCR resource round trips pass. Product code uses `gunzipSync` for embedded OCR resources, and no product ZIP-extraction caller was found. This removes the affected dependency without claiming a demonstrated ZIP64 attack path through the plugin UI.

The production build, 121 automated checks, and isolation pass; all three build sizes above are unchanged. The registered local plugin was synchronized, but native Figma was not reopened for this dependency-only change. Repository cover and four explicitly labeled promotional illustrations are documentation-only assets. Future main-branch changes use PRs with the `Verify` check; no second reviewer is required.

## Before a plugin release

- Recheck the latest copy and diagnostic export in native Figma.
- Expand testing of complex documents, full parameters, image modes, cancellation, and large-file performance.
- Verify external background-removal services only with user credentials and explicit upload/billing consent.
- Review OCR output manually; numeric examples have shown errors.
- Complete native-component license notices, native-language review as needed, and publication material.

No release date, support response deadline, or complete host-compatibility guarantee is promised.

## 中文摘要

源码已公开，0.3.2 仍为开发预览，未上架 Community。fflate 已升级至 0.8.3，最新 121 项自动检查通过；首屏仍为 1,190,379 字节。此前 12 项针对性原生检查不能替代后续文案、诊断导出及依赖更新的 Figma 重验。内部过程记录仅在本机保留，公开摘要以本页及对应提交的 CI 为准。main 后续采用 PR + Verify 检查，维护者可自行合并。

[Install / 安装](INSTALLATION.md) · [Support / 支持](SUPPORT.md) · [Documentation / 文档](README.md)
