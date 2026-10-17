# Changelog / 更新记录

This records source changes. Source versions do not establish Figma Community publication or downloadable bundles.

## Unreleased

- Added English/Chinese introductions, installation, current status, privacy, and contribution guides.
- Added GitHub CI, issue forms, a PR template, and dependency-update configuration.
- Anonymized a local path in the native acceptance document; older Git history retains the original entry.

## 0.3.2 — 2026-10-17 — Development preview

- Fixed stale writes after selection changes, edits, locks, and async waits.
- Improved cancellation, result reporting, transaction recovery, and image-write authorization.
- Reviewed eight-language copy and clarified OCR limitations and partial/uncertain outcomes.
- Restricted diagnostic collection/export to shared allowlisted metadata.
- Published the independent Figma source and connected the in-plugin source link.

Evidence: [reliability](docs/RELIABILITY_FIX_20261017.md), [copy review](docs/LOCALIZATION_REVIEW_20261017.md), [diagnostic privacy](docs/DIAGNOSTIC_EXPORT_PRIVACY.md). See [current status](docs/STATUS.md) for remaining acceptance. No Community release has been made.

## Earlier source work

The 0.2.x/0.3.1 stages introduced the independent Figma adapter, restored UI, eight languages, local OCR, themes, typography, and image-write adaptations. See the [engineering archive](docs/README.md); this does not imply historical package tags or public releases exist.
