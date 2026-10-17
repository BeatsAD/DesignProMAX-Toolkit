# Changelog / 更新记录

This records source changes. Source versions do not establish Figma Community publication or downloadable bundles.

## Unreleased

- Prepared 0.3.3 with eight-language welcome-announcement instructions for exporting filtered diagnostic logs and providing reproduction details. Existing language preferences and announcement acknowledgements are preserved; first use still offers English as the default language choice.

- Replaced an account-specific test plugin ID with synthetic data, kept internal process records and historical migration tools local-only, and shortened public artwork provenance while preserving source references and checksums. Public guides now summarize usage and acceptance limits; existing Git history is unchanged.

- Updated fflate from 0.8.2 to 0.8.3 for [GHSA-px8p-9vwx-vf98](https://github.com/advisories/GHSA-px8p-9vwx-vf98). Added bounded malformed-ZIP64 regression checks for Node/browser exports and valid ZIP/gzip controls. Product code uses gzip decoding; no product ZIP extraction call was found.
- Added four selected feature illustrations and a dedicated repository/share cover, explicitly labeled as promotional artwork rather than host screenshots. They are not runtime assets.
- Added English/Chinese introductions, installation, current status, privacy, and contribution guides.
- Added GitHub CI, issue forms, a PR template, and dependency-update configuration.
- Anonymized a local path in the native acceptance document; older Git history retains the original entry.

## 0.3.2 — 2026-10-17 — Development preview

- Fixed stale writes after selection changes, edits, locks, and async waits.
- Improved cancellation, result reporting, transaction recovery, and image-write authorization.
- Reviewed eight-language copy and clarified OCR limitations and partial/uncertain outcomes.
- Restricted diagnostic collection/export to shared allowlisted metadata.
- Published the independent Figma source and connected the in-plugin source link.

See [current status](docs/STATUS.md) for the validation summary and remaining acceptance, and [privacy](docs/PRIVACY.md) for diagnostic-export behavior. No Community release has been made.

## Earlier source work

The 0.2.x/0.3.1 stages introduced the independent Figma adapter, restored UI, eight languages, local OCR, themes, typography, and image-write adaptations. See the [documentation index](docs/README.md); this does not imply historical package tags or public releases exist.
