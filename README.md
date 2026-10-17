# DesignProMAX Toolkit — Figma

免费、开源的 Figma 效率工具箱，采用 MIT。当前版本 **0.3.2**，已完成本轮可靠性修复及针对性原生验证，尚未发布 Community。详见 [可靠性修复与验收](docs/RELIABILITY_FIX_20261017.md)。

这是独立工程：依赖、版本、主线程、UI、构建和测试全部位于本目录。以 DesignProMAX v1.0.48 的原有 React 界面、交互和保留算法为参考独立迁入，构建不引用父工程、Pixso 或 JSDesign 源码和产物。其他平台源码保持原样。

**界面沿用 MasterGo 原有蓝白样式、框架和交互**，不再使用 v0.2.0 的绿色重设计。保留首页、设置、确认框、布局管理、紧凑模式、窗口拖动及原工具完整参数和结果界面。按后续确认移除侧边栏，Logo 放在顶部最左侧，工具页从标题旁返回首页。见 [界面保留约定](docs/UI_RESTORATION.md)。

八语文案、取消与 OCR 风险提示已完成本轮 AI 校对；术语与验收范围见 [八语文案校对记录](docs/LOCALIZATION_REVIEW_20261017.md)，不等于母语人员审校或本轮 Figma 原生重验。

## 先在测试页验收

Node.js 22+，在本目录运行：

```sh
npm ci
npm run dev
```

打开 [浏览器测试页](http://127.0.0.1:5186/)。首次选择语言，默认英文；确认后保存，可在设置 → 常规设置中切换。默认插件窗口为 380×650，首页 10 张卡片等高；最窄支持 320px。右侧可切换文本、透明图片、六宫格、自由布局和清理示例，也可上传自己的 PNG/JPEG/WebP 测试。测试页只操作内存中的示例文档，刷新会重置文档；语言及设置保存在该浏览器的本地存储中。

典型操作：选择图层 → 设置参数 → 生成预览 → 勾选结果 → 确认执行 → 右侧“撤销”。图片工具先读取所选图片再处理。自动分割适用于清晰分隔或独立元素，复杂背景需要人工核对；支持原有可视区域边界、坐标编辑、补框、拆分与合并。

**用户已授权进入 Figma 安装与宿主验收，当前注册入口已接到生产构建，语言初始化、文本/图片写入、恢复及 12 项针对性检查已在客户端验证；完整参数矩阵与复杂文档仍待验收。** 浏览器画布、字体和撤销是测试宿主模拟，不能证明真实 Figma 的行为。

## 当前范围

- 文本填充只保留自定义字段，支持顺序、随机、循环和固定值；常用字段与行政区离线资源已退出正式构建。
- 10 个工具：一键抠图、透明裁剪、图片分割、文本填充、文本识别、文本拆分合并、清理、查找替换、设计统计、尺寸适配。
- 8 种界面语言：English、简体中文、日本語、한국어、Français、Deutsch、Español、Português。覆盖界面、参数、帮助、错误、确认和无障碍文本；首次默认英文、确认保存后进入，设置中可切换。每次生产构建检查词条覆盖，详见 [多语言验收](docs/LANGUAGE_ACCEPTANCE.md)。OCR 仍识别简中/英文；用户填写的自定义候选内容不会随界面翻译。
- 图标库、地图、团队设计库、快速定位、批量导出及基础比例缩放没有入口、处理器或专用资源进入正式构建；AI 生图与图片压缩保持暂停。
- 反馈保留微信号 `GoldM0535` 及复制，去掉二维码；GitHub 为 [BeatsAD](https://github.com/BeatsAD)，X 为 [WenBin8nk](https://x.com/WenBin8nk)。版本页底行的插件开源地址指向公开仓库 [DesignProMAX Toolkit](https://github.com/BeatsAD/DesignProMAX-Toolkit)。
- 一键抠图需用户自备密钥、保存图片上传授权；外部服务可能收费。测试未调用付费服务。

## 构建与检查

```sh
npm run verify
npm run preview
```

| 命令 | 用途 |
| --- | --- |
| `npm run lint` | 主线程与 UI 类型检查 |
| `npm run build` | 最新生产构建及首屏硬预算检查 |
| `npm test` | 重新构建并运行全部自动检查 |
| `npm run verify:isolation` | 验证构建输入和宿主 API 隔离 |
| `npm run verify` | 上述构建、测试与隔离检查 |
| `npm run dev` | 构建并启动本机测试页，默认 5186 端口 |
| `npm run preview` | 使用现有构建启动测试页 |
| `npm run configure:plugin -- <真实ID>` | 使用 Figma 分配的真实 ID 生成本地安装配置 |

服务仅监听 `127.0.0.1`，可用 `FIGMA_PREVIEW_PORT` 设置其他端口。构建只覆盖明确产物，不清空目录。有真实本地 ID 和已注册开发目录时，也同步该目录内的 code.js/ui.html；初始模板保留备份，ID 不一致时拒绝覆盖。测试使用 Node 的 `*.check.mjs`，避免被父项目 Vitest 默认规则收集。

## 工程结构

```text
src/main/             Figma 入口及原生 API 适配
src/engine/           独立迁入的保留工具算法与操作控制器
src/reference/        独立维护的原版 React 页面、样式、控件和交互
src/ui/               原界面入口、八语词典、资源读取和消息桥
src/image/            图片处理及可取消的离线 OCR Worker
src/preview/          浏览器示例宿主，生产 UI 不包含它
src/shared/           工具清单、设置、链接、协议和版本入口
src/assets/ocr/       官方模型及固定版本来源/校验信息
scripts/              构建、预览服务、隔离校验和 ID 配置
tests/                自动检查
docs/                 开发计划、实施状态和验收记录
licenses/             第三方许可原文
dist/main.js          Figma 主线程（生成、忽略）
dist/ui.html          完整离线 UI，OCR 资源在首次处理时分段读取
dist/workbench.html   浏览器外层测试画布（生成、忽略）
dist/preview.html     浏览器中的原版插件 iframe（生成、忽略）
dist/ocr-payload.json 测试页首次 OCR 时读取的本地资源
dist/build-info.json  构建输入及 UTF-8 体积证据
```

首页横幅在首页提交后读取；文本填充只保留自定义字段，进入页面时读取用户已保存字段，不再加载行政区数据。首屏只读取设置、布局和当前选区，不主动扫描整个文档。跨页扫描由用户选择范围后加载页面。OCR Worker/WASM/模型在用户开始识别时读取、验证并解码，失败可重试、可取消；没有 CDN 回退。首屏计量是实际传给 `figma.showUI` 的 HTML，要求严格小于 1,572,864 UTF-8 字节，这是项目预算。

`package.json` 为版本唯一来源，构建同时注入 UI 和主线程，锁文件同步维护；不运行父工程的 MasterGo 打包或版本脚本。真实插件 ID 仅在忽略的 `manifest.local.json` 中配置。以后安装时仅使用本目录生成的配置，不复用其他平台 ID。

## 隐私、开源与验收边界

反馈问题可在设置中心导出诊断日志，并附上复现步骤、预期和实际结果。日志采用统一白名单，仅保留排障元数据，不包含密钥、服务地址、自由错误文本、图片或设计文字，不会自动发送。截图及自行填写的问题描述仍需移除敏感内容。详见 [联系与支持](docs/SUPPORT.md)。

本地工具及 OCR 不上传文档或图片。抠图仅在用户授权并主动处理时将选中图片和密钥发送给所选服务；自定义服务需支持 HTTPS、CORS、`POST /remove-background`、Bearer 密钥及 `image` 表单字段，并返回 PNG。密钥保存在客户端存储中，不加密；不写入反馈或源码。

项目源码公开于 [DesignProMAX Toolkit](https://github.com/BeatsAD/DesignProMAX-Toolkit)，授权见 [MIT](LICENSE)，第三方资源保留各自许可，见 [第三方声明](THIRD_PARTY_NOTICES.md)。当前尚未打包上架 Figma Community；Figma 开发插件已接入当前构建，真实字体、图片写回、事务恢复及离线 OCR 链路已有样例证据；OCR 数字样例存在误识别。外部抠图服务、复杂布局与大文件性能、完整参数矩阵及发布材料，仍需在插件正式发布前验收。

[当前实施状态](docs/IMPLEMENTATION_STATUS.md) · [测试记录](docs/BROWSER_ACCEPTANCE.md) · [完整开发方案](docs/DEVELOPMENT_PLAN.md)

[Figma 开发插件接入与宿主待验项](docs/NATIVE_FIGMA_ACCEPTANCE.md)

本轮真实 Figma 调试已修复顶层窗口消息来源兼容性；已验证语言初始化及重开持久化。首页宣传图加载重试已在后续资源完整性修复中解决；当前可靠性与原生证据以 [0.3.2 验收记录](docs/RELIABILITY_FIX_20261017.md) 为准。


主题颜色已接入 Figma 官方语义变量。新配置默认跟随宿主；已有手动浅色／深色选择保留，可在设置中心 → 常规设置 → 主题模式恢复跟随。详见 [主题适配与验收](docs/FIGMA_THEME.md)。

Figma 文字使用普通 450、强调 550 字重，保留正文 11px、辅助说明 10px、标题 12px 和 380px 默认窗口宽度。详见 [文字适配与验收](docs/FIGMA_TYPOGRAPHY.md)。

透明裁剪的 Crop 写入、坐标补偿与失败重试已适配；新建结果在画布自由区域生成，自动布局/实例内替换保留尺寸。详见 [图片写入与宿主验收](docs/FIGMA_IMAGE_WRITES.md)。
