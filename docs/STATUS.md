# Current status / 当前状态

Updated: 2026-10-17. Source version: **0.3.3**. This page summarizes recorded validation; internal process records remain local-only.

| Area | State |
| --- | --- |
| Public source | [BeatsAD/DesignProMAX-Toolkit](https://github.com/BeatsAD/DesignProMAX-Toolkit), MIT for project-owned code |
| Distribution | Initial v0.3.2 submitted to Figma Community review on 2026-10-17; approval/public availability pending |
| Tools | 10 tools; eight UI languages; local English/Simplified Chinese OCR |
| Latest recorded automation | 121 tests, type checks, production build, locale coverage, and 1,689 isolated inputs, including Node/browser ZIP64 dependency regressions; diagnostic export behavior is summarized in [privacy](PRIVACY.md) |
| Native Figma evidence | Earlier v0.3.2 targeted checks cover language persistence, text/image operations, and transaction recovery; these were 12 targeted checks, not a complete native parameter matrix |
| Subsequent changes | Eight-language copy review and diagnostic-export filtering have automated/browser evidence; those changes have not been reaccepted in native Figma |

For checks on a particular commit, see its [CI run](https://github.com/BeatsAD/DesignProMAX-Toolkit/actions/workflows/ci.yml). CI does not validate native Figma, external image services, or OCR accuracy.

## Latest recorded build

| Measurement | UTF-8 bytes |
| --- | ---: |
| Actual initial `figma.showUI` HTML | 1,194,837 |
| Complete offline HTML | 8,215,309 |
| Main thread JavaScript | 103,896 |

Initial HTML must be **strictly below 1,572,864 bytes**. Home artwork loads after the home page commits; OCR Worker/WASM/models load when recognition starts. Package size is not cold-start timing. The table reflects the 0.3.3 announcement build; documentation and repository images do not enter the plugin build.

## Dependency and repository update — 2026-10-17

fflate was pinned from 0.8.2 to 0.8.3 for [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98). Before the update, an isolated malformed-ZIP64 input timed out in both Node and browser exports. After the update, two malformed forms promptly throw invalid-ZIP errors; valid ZIP/gzip controls and existing OCR resource round trips pass. Product code uses `gunzipSync` for embedded OCR resources, and no product ZIP-extraction caller was found. This removes the affected dependency without claiming a demonstrated ZIP64 attack path through the plugin UI.

The production build, 121 automated checks, and isolation pass; the fflate-only update did not change the preceding 0.3.2 build sizes. The registered local plugin was synchronized, but native Figma was not reopened for this dependency-only change. Repository cover and four explicitly labeled promotional illustrations are documentation-only assets. Future main-branch changes use PRs with the `Verify` check; no second reviewer is required.

## Announcement update — 0.3.3

The welcome announcement now explains how to export filtered diagnostic logs, provide reproduction steps and expected/actual results, and remove sensitive content from screenshots. The copy covers all eight UI languages. The announcement identifier and existing acknowledgement state are preserved. Its date is explicitly a development-record date, not a Community approval date.

First use with no saved language still opens the language picker with English selected; confirmation saves the choice. Existing saved languages are retained. This update does not reset language or announcement preferences. The feedback paragraphs were inspected in the native Figma development plugin; the automated suite and explicit startup checks pass on the final build.

Final 0.3.3 sizes: initial showUI HTML 1,194,837 bytes (+4,458), complete offline HTML 8,215,309 bytes (+4,458), main JS 103,896 bytes (unchanged). Growth is eight-language announcement copy and the development date. Artwork and OCR loading times are unchanged. This is size evidence, not cold-start timing.

## Before a plugin release

- Recheck the latest copy and diagnostic export in native Figma.
- Expand testing of complex documents, full parameters, image modes, cancellation, and large-file performance.
- Verify external background-removal services only with user credentials and explicit upload/billing consent.
- Review OCR output manually; numeric examples have shown errors.
- Complete native-component license notices, native-language review as needed, and publication material.

No release date, support response deadline, or complete host-compatibility guarantee is promised.

## 中文摘要

源码已公开，0.3.2 已提交 Community 审核，尚未获准公开上架。0.3.3 补充八语公告中的日志反馈说明；121 项自动检查通过，首屏为 1,194,837 字节。首次没有保存语言时仍默认选中 English，确认后保存，已有语言与公告关闭状态不重置。此前 12 项针对性原生检查不能替代后续文案、诊断导出及依赖更新的 Figma 重验。内部过程记录仅在本机保留，公开摘要以本页及对应提交的 CI 为准。main 后续采用 PR + Verify 检查，维护者可自行合并。

[Install / 安装](INSTALLATION.md) · [Support / 支持](SUPPORT.md) · [Documentation / 文档](README.md)
