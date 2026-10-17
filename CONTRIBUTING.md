# Contributing / 贡献指南

For substantial behavior or dependency changes, discuss scope in an issue first. Bug reports and focused fixes are welcome.

## Develop and check

Use Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

The demo listens on `127.0.0.1:5186`; use `FIGMA_PREVIEW_PORT` for another port. Follow [installation](docs/INSTALLATION.md) with your own plugin ID for native checks. Browser fixtures and CI do not replace Figma acceptance.

Before submitting runtime, dependency, or build changes:

```sh
npm run verify
```

Checks include types, the latest production build, locale coverage, tests, and isolation. Initial production `figma.showUI` HTML must be strictly below 1,572,864 UTF-8 bytes. Startup/resource changes should report before/after initial and total offline bytes, when resources load, checks, and native-host status.

Documentation-only changes that do not affect build inputs need link, command, and diff checks; no version bump or local rebuild is required. CI still checks the pushed repository.

## Pull requests

- Keep changes focused; explain the problem, resulting behavior, and checks.
- Keep eight UI languages in sync. Load new resources when needed rather than on startup.
- Preserve settings and document data.
- Do not rerun historical `migrate-reference-ui.mjs` or `prune-retired-reference-data.mjs` over maintained source. Normal builds use the independent source already here.
- Exclude keys, customer files, unreviewed screenshots, machine paths, dependencies, generated builds, QA output, local manifests, registered bundles, and local/internal instruction/specification files.
- Use synthetic sample documents in screenshots and tests.
- Retain third-party notices and asset provenance.

No review deadline or release date is promised. Follow [SECURITY.md](SECURITY.md) for private vulnerability reporting.

## 中文

较大的行为或依赖改动请先在 Issue 讨论；PR 保持聚焦，说明修改前后行为与验证结果。运行时、依赖或构建改动通过 `npm run verify`；文档改动核对链接、命令和差异即可。

不要提交密钥、客户资料、原始验收输出、本机注册插件、依赖和构建目录。新增资源按需加载，保留用户设置和文档状态。八语词条同步维护；浏览器、自动检查与真实 Figma 验收分别说明。正常开发不需要重新执行历史迁移脚本。
