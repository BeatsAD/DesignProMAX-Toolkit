# Prebuilt development plugin / 预编译开发插件

Version 0.3.3 is a development preview. Download `DesignProMAX-Toolkit-v0.3.3-figma.zip` from the repository's [Releases](https://github.com/BeatsAD/DesignProMAX-Toolkit/releases), when available, and unzip it to a permanent folder. The prebuilt package needs no Node.js, npm, or source build. It still uses Figma's desktop development-plugin import; it is not a one-click Community installation.

1. In Figma desktop, open a Design file and choose Plugins → Development → New plugin. Choose Figma Design and Custom UI. Save that generated template separately, outside the extracted package.
2. Copy the numeric `id` from the generated template's `manifest.json`.
3. Open `CONFIGURE.html` from the extracted package in a browser. Paste the ID and download `manifest.json`. This page is local and makes no network request.
4. Move the downloaded file into the extracted package folder, replacing its unconfigured `manifest.json`. Keep `code.js` and `ui.html` beside it.
5. In Figma desktop, choose Plugins → Development → Import plugin from manifest, select that configured file, and run DesignProMAX Toolkit. Confirm the first-use language choice. Start in a test document and check results and undo.

Do not import the unconfigured manifest or the empty Figma starter template as the finished toolkit. Use your own Figma-assigned ID; no account-specific ID is distributed. Updates require downloading a new package, configuring it with the same ID, and reimporting if the folder location changes. Keep the previous folder until the update is verified.

## 中文

1. 从仓库 Releases 下载预编译 ZIP，解压到长期保留的目录，不需要安装 Node.js、npm 或自行构建。
2. 在 Figma 桌面版创建 Design → Custom UI 开发插件，模板另存到解压包之外的目录，复制模板 manifest.json 的数字 `id`。
3. 用浏览器打开解压包内的 `CONFIGURE.html`，填写 ID 并下载配置；该页面完全本地运行。
4. 将下载文件放回解压目录，替换其中的 `manifest.json`，与 `code.js`、`ui.html` 保持同级。
5. 在 Figma 通过“开发 → 从 manifest 导入插件”选择该配置，运行工具箱，首次确认语言。先使用测试文档核对结果和撤销。

这仍是开发插件导入方式；不要直接导入未配置的 manifest，也不要把 Figma 生成的空模板当成工具箱。更新时沿用自己的 ID，目录移动后重新导入，验证新包前保留旧目录。

## Verification and limits / 校验与限制

Compare the ZIP's SHA-256 with the attached `SHA256SUMS`. `SOURCE.json` records its source commit and per-file checksums before local configuration; changing the manifest to add your own ID is expected. OCR and artwork are embedded in `ui.html`; do not remove or edit `code.js`/`ui.html`. Licenses and pinned OCR component notices are included. Full source and provenance are available at the recorded repository commit.

Local OCR supports English/Simplified Chinese and needs manual review. Optional background removal sends images to an external service only with consent and may incur charges. See `PRIVACY.md`. Complex documents, all parameter combinations, and external-service behavior are not fully accepted. Menu wording may vary by Figma version.

Release ZIPs and source code are separate deliverables. GitHub's automatic “Source code” downloads are not these prebuilt packages. A Community review submission does not establish approval or public availability.
