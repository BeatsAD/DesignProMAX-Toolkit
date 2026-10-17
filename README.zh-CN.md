# DesignProMAX Toolkit

免费、开源的 Figma 效率工具箱，提供文本、图片、本地 OCR 和文档整理工具。

[English](README.md) · 简体中文

**当前版本 0.3.2，处于开发预览阶段。** 源码已公开，尚未上架 Figma Community；可自行构建并作为开发插件导入。详见[安装指南](docs/INSTALLATION.md)和[当前状态](docs/STATUS.md)。

## 功能

| 分类 | 工具 |
| --- | --- |
| 文本 | 自定义字段填充、查找替换、拆分合并 |
| 图片 | 一键抠图、透明边裁剪、分割为 PNG 图层 |
| OCR | 本地识别英文和简体中文 |
| 文档 | 清理预览、设计统计、尺寸适配 |

- 八种界面语言：English、简体中文、日本語、한국어、Français、Deutsch、Español、Português。
- 支持明暗主题、紧凑模式和调整窗口尺寸；默认 380×650，最窄 320px。
- 本地工具和 OCR 不上传文档或图片。抠图需自备服务密钥、明确授权上传，外部服务可能收费。
- 执行前核对预览，执行后核对结果。OCR 可能误识别，尤其需要复核数字、日期和金额。

## 安装到 Figma

需要 Node.js 22+、npm 和 Figma 桌面客户端。

```sh
git clone https://github.com/BeatsAD/DesignProMAX-Toolkit.git
cd DesignProMAX-Toolkit
npm ci
npm run build
```

之后使用 Figma 为你分配的开发插件 ID 生成本地配置并导入。请按[完整安装指南](docs/INSTALLATION.md)操作；仓库不包含共享插件 ID 或已发布的安装包。

## 浏览器体验

```sh
npm run dev
```

打开 [localhost:5186](http://127.0.0.1:5186/)，使用示例文本、图片、布局和清理场景，也可上传无敏感内容的图片。示例文档仅保存在内存中，刷新后重置；语言和设置保存在该浏览器中。浏览器体验模拟 Figma API 和撤销，不能替代原生 Figma 验收。

## 使用

1. 选择图层并进入工具。
2. 设置参数，检查预览；有结果选择时，勾选需要执行的项目。
3. 确认执行并核对回执。若提示结果状态不明确，先检查文档再决定是否重试。

图片工具先读取选中的图片。自动分割适合清晰分隔的区域，生成前可调整边界。

## 限制与隐私

- 复杂文档、完整原生参数矩阵、外部抠图服务和大文件性能仍需扩大验收范围。
- OCR 识别简中和英文，八语界面不代表八语 OCR。
- 图片替换模式和实例内部操作存在限制，详见[图片写入说明](docs/FIGMA_IMAGE_WRITES.md)。
- API 密钥保存在 Figma 客户端存储中，不加密。不要在 Issue 或截图中分享。
- 诊断导出仅在本机生成元数据文件，不会自动发送。详见[隐私说明](docs/PRIVACY.md)和[联系与支持](docs/SUPPORT.md)。

## 反馈与贡献

[报告缺陷](https://github.com/BeatsAD/DesignProMAX-Toolkit/issues/new?template=bug_report.yml) · [功能建议](https://github.com/BeatsAD/DesignProMAX-Toolkit/issues/new?template=feature_request.yml) · [贡献指南](CONTRIBUTING.md) · [安全报告](SECURITY.md)

联系邮箱：[wenbinailab@gmail.com](mailto:wenbinailab@gmail.com)。提交示例前请移除敏感内容，不要上传客户文档或 API 密钥。

## 开发

```sh
npm ci
npm run verify
```

检查包括类型、生产构建、词条覆盖、自动测试和构建输入隔离；启动测试使用实际生产 `figma.showUI` HTML，要求严格小于 1,572,864 UTF-8 字节。

本工程可独立构建，不依赖其他平台源码。生成目录、依赖、本机插件配置和验收输出不入库。维护中的源码无需重新执行历史迁移脚本。

[当前状态](docs/STATUS.md) · [更新记录](CHANGELOG.md) · [工程文档目录](docs/README.md)

## 许可

项目自有代码使用 [MIT](LICENSE)。依赖、OCR 模型和内嵌组件保留各自许可，见[第三方声明](THIRD_PARTY_NOTICES.md)和 `licenses/`。
