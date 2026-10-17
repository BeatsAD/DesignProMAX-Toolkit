# Current status / 当前状态

Updated: 2026-10-17. Source version: **0.3.2**. Dated engineering records describe their own historical stages; this page provides the current summary.

| Area | State |
| --- | --- |
| Public source | [BeatsAD/DesignProMAX-Toolkit](https://github.com/BeatsAD/DesignProMAX-Toolkit), MIT for project-owned code |
| Distribution | Development/source preview; not on Figma Community; no released installation bundle |
| Tools | 10 tools; eight UI languages; local English/Simplified Chinese OCR |
| Latest recorded automation | 119 tests, type checks, production build, locale coverage, and 1,689 isolated inputs; see [diagnostic privacy verification](DIAGNOSTIC_EXPORT_PRIVACY.md) |
| Native Figma evidence | Earlier v0.3.2 targeted checks cover language persistence, text/image operations, and transaction recovery; see [reliability acceptance](RELIABILITY_FIX_20261017.md) |
| Subsequent changes | Eight-language copy review and diagnostic-export filtering have automated/browser evidence; those changes have not been reaccepted in native Figma |

For checks on a particular commit, see its [CI run](https://github.com/BeatsAD/DesignProMAX-Toolkit/actions/workflows/ci.yml). CI does not validate native Figma, external image services, or OCR accuracy.

## Latest recorded build

| Measurement | UTF-8 bytes |
| --- | ---: |
| Actual initial `figma.showUI` HTML | 1,190,379 |
| Complete offline HTML | 8,210,851 |
| Main thread JavaScript | 103,896 |

Initial HTML must be **strictly below 1,572,864 bytes**. Home artwork loads after the home page commits; OCR Worker/WASM/models load when recognition starts. Package size is not cold-start timing. Values come from the [latest runtime-change record](DIAGNOSTIC_EXPORT_PRIVACY.md); documentation and repository images do not enter the plugin build.

## Before a plugin release

- Recheck the latest copy and diagnostic export in native Figma.
- Expand testing of complex documents, full parameters, image modes, cancellation, and large-file performance.
- Verify external background-removal services only with user credentials and explicit upload/billing consent.
- Review OCR output manually; numeric examples have shown errors.
- Complete native-component license notices, native-language review as needed, and publication material.

No release date, support response deadline, or complete host-compatibility guarantee is promised.

## 中文摘要

源码已公开，0.3.2 仍为开发预览，未上架 Community。最新运行时改动记录为 119 项自动检查；此前 12 项针对性原生检查不能替代后续文案及诊断导出改动的 Figma 重验。最新首屏 1,190,379 字节。历史记录中的“尚未安装”“待创建仓库”和早期测试数量只代表当时阶段。

[Install / 安装](INSTALLATION.md) · [Support / 支持](SUPPORT.md) · [Engineering archive / 工程文档](README.md)
