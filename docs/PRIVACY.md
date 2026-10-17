# Privacy / 隐私说明

This describes the development plugin, not a separate hosted service.

## Local tools and storage

Text tools, local image processing, cleanup, statistics, size adaptation, and offline OCR do not upload document content or images. OCR engine files and English/Simplified Chinese models are bundled locally and loaded when recognition starts, without a runtime CDN fallback.

Settings, layouts, custom text fields, and service credentials are stored in Figma client storage. The plugin does not encrypt API keys. The browser demo stores settings in the browser and uses an in-memory sample document.

## Optional background removal

Background removal sends the selected image and required credentials to remove.bg or a configured HTTPS service only after upload consent and an explicit operation. Its retention, privacy, terms, quotas, and billing are separate. Check the selected service before sending confidential images.

## Diagnostics and reports

Export uses an allowlist of operational metadata: time, version, known event/error categories, durations, and counts. It excludes API keys, service URLs, arbitrary error text, images, design text, layer names/IDs, and session identifiers. Export creates a local download without automatic submission.

Descriptions, screenshots, and attachments you provide are separate from filtered exports. Review them before posting. See [support](SUPPORT.md) and [security reporting](../SECURITY.md).

## 中文

文本、本地图片处理、清理、统计、尺寸适配和 OCR 不上传文档或图片；OCR 引擎及简中/英文模型随本地构建提供，开始识别后才读取，无运行时 CDN 回退。

设置、布局、自定义字段及凭据保存在 Figma 客户端存储，插件不对密钥加密。浏览器示例将设置保存在浏览器中，示例文档只在内存中。

抠图为可选外部服务：只有授权上传并主动操作后，才将所选图片及所需凭据发送至 remove.bg 或指定 HTTPS 服务。其数据保留、隐私、条款和费用由该服务决定。

诊断导出仅保留允许的排障元数据，排除密钥、服务 URL、任意错误正文、图片、设计文字、图层名称/ID 和会话标识；本机下载不会自动发送。自行填写的描述、截图和附件仍需人工移除敏感内容。
