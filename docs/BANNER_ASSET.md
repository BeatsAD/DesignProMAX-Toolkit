# 无文字首页 Banner

2026-10-16，Figma 独立工程。通过内置 imagegen 生成，未使用 CLI/API Key 工作流。

- 上线资源：`src/assets/home-banner-no-text.jpg`，1212×404，76,211 字节，JPEG。默认 380px 窗口实际显示约 364×121px；1000px 窗口约 984×328px。PNG 工作源保留为 `src/assets/home-banner-no-text.png`，原始生成尺寸 2172×724，交付源缩至 1212×404 后编码为 JPEG quality 85。
- 原生产图 2172×724、412,823 字节；新图不含文字、字母或水印。原图文件仅保留作设计参考，不进入生产离线资源。
- `HomeBanner.tsx` 独立维护 HTML 标题和说明，通过现有 JSX 翻译接入八种语言。去掉旧覆盖色块与 JSX runtime 中针对首页按钮的隐式注入。图片为装饰内容，alt 为空，按钮保留“打开问题反馈”的本地化名称和点击交互。
- 继续在首页提交后请求同一个 home-banner 资源；没有新增 ID、没有启动预热或 CDN。生产 MIME 为 image/jpeg，校验兼容旧 image/png，沿用分段、校验、合并、会话缓存、取消和重试。
- 用户明确授权 Banner 图片/文字替换，因此 `HomePage.tsx` 从完全相同副本移入基线的 customizedFiles 并保留原 SHA-256 与变更原因；原公共 CSS、Logo、布局管理与其他记录副本仍逐字节校验。父工程和其他平台既有 746 个文件未改动。

48 项检查通过：最新生产构建、showUI 预算、图片资源真实往返、新 JPEG 内容与源码一致、HTML 文字在图片未加载时仍可翻译、无重复文字层。浏览器验证八语文字、图片实际解码 1212×404、无 ::before 遮字色块、文案在 Banner 内及点击反馈。证据在本机 `output/browser-test/banner-locales.json`、`banner-zh.png`。

首屏 1,159,857 → 1,159,626 字节（-231），完整离线 HTML 8,883,519 → 8,434,473 字节（-449,046），主线程保持 102,470 字节。未进行 Figma 安装与原生宿主验收。

完整提示词与资源校验值记录在 `src/assets/home-banner.provenance.json`。

## 原生资源校验兼容修复（2026-10-16）

真实 Figma 的 Inner Plugin Iframe 使用 data: 文档，实测 `isSecureContext=false`、`crypto.subtle` 不可用。主线程已成功返回宣传图完整 JSON（101,663 字符）及正确校验值，但 UI 直接调用 `crypto.subtle.digest` 抛错，被图片 Hook 转成重试入口；重试不能恢复。此前浏览器预览绕过原生校验，包测试在 Node 中计算摘要，因此未覆盖这个环境差异。

`src/ui/sha256.ts` 统一宣传图、行政区和 OCR 的 UTF-8 SHA-256 校验。有 Web Crypto 时沿用原生计算；不可用时使用本地实现，每处理 256 KiB 让出执行机会并检查取消。完整性检查、按需读取、分段重组、成功后缓存和失败重试保持原有行为；没有新增资源 ID、素材、依赖或网络请求。宣传图仍在首页提交后读取，行政区仍在进入文本填充时读取，OCR 仍在用户发起识别时读取。

`npm run verify` 的类型检查、最新生产构建、60 项检查及 1682 个构建输入隔离通过；另显式运行启动、资源和新增原生完整性检查，共 11 项通过。新增测试覆盖缺少 Web Crypto、已知摘要、中文/emoji、填充边界、大资源取消、真实主线程和非预览桥往返、并发与缓存、损坏拒绝后重试，以及 OCR 完整资源校验和解压（识别 Worker 使用替身）。日志：`output/figma-banner-integrity-fix.log`、`output/figma-banner-startup-check.log`。

首屏 1,160,393 → 1,162,137 字节（+1,744，校验实现）；完整离线 HTML 8,435,240 → 8,436,984 字节（+1,744）；主线程 102,705 字节不变。首屏严格低于 1,572,864 字节，资源正文无重复。注册目录与最新 dist 字节一致。真实 Figma 两次关闭重开均显示宣传图且无重试按钮，文本填充页面资源加载成功；未写入图层、未修改语言设置，未测完整冷启动耗时或真实 OCR 识别。证据：`output/figma-registration/banner-integrity-fix-acceptance.json`。
