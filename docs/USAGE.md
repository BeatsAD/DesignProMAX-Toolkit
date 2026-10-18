# Usage and recovery / 使用与恢复

Version 0.3.3 is a development preview. Follow [installation](INSTALLATION.md) and review [current validation limits](STATUS.md) before using it on important documents.

## Common workflow / 基本流程

Select the target layers, open a tool, set parameters, and inspect its preview. Where results can be selected, choose the items to apply and confirm the operation. Check the reported success/failure counts and the actual document afterward.

选择目标图层后进入工具，设置参数并检查预览；有勾选项时选择需要执行的结果，再确认操作。执行后同时核对成功／失败数量和文档内容。

## Custom text fill / 自定义文本填充

Create or select a custom field and its candidate values. Choose sequential, random, cyclic, or fixed-value filling, then generate and inspect the preview before applying. Built-in name, phone, address, administrative-region, number, and date presets are not provided.

Changing the selection or parameters invalidates the old preview. If field loading fails, retry; do not treat a failed read as an empty saved list. A failed save keeps the previous values and editing draft.

新增或选择自定义字段及候选内容，选择顺序、随机、循环或固定值方式，生成预览并核对后执行。不提供内置姓名、电话、地址、省市区、数字或日期预设。修改选区或参数后需要重新预览；读取失败时手动重试，保存失败会保留旧值和草稿。

## Images and OCR / 图片与识别

Image tools first read the selected images. Inspect crop/split boundaries and choose creation or replacement where offered; see [image behavior](FIGMA_IMAGE_WRITES.md) for supported modes. Background removal uses an external service only after upload consent; review [privacy](PRIVACY.md) and the service's charges before proceeding.

OCR runs locally with English and Simplified Chinese models. Eight UI languages do not imply eight recognition languages. Review recognized text manually, especially numbers, dates, and amounts; successful recognition does not establish accuracy.

图片工具先读取选中图片；生成前核对裁剪／分割边界，并按可用选项新建或替换。抠图需要授权上传，且外部服务可能收费。本地 OCR 仅支持英文和简体中文，数字、日期及金额必须人工复核。

## Cleanup and recovery / 清理与恢复

Inspect cleanup candidates before applying. Instance children are excluded from the default scan; when included for preview they cannot be selected for deletion. Locked targets and protected ancestors are not writable.

After changing a selection or source content, reread or regenerate the preview. Cancellation stops later work and waits for a final receipt; it does not imply that earlier successful items were reverted. A timeout or unknown outcome requires inspecting the document before retrying. Use Figma undo for completed changes where supported, and keep a document copy when evaluating unfamiliar operations.

清理前核对候选项。默认不扫描实例子项；包含实例进行预览时，其内部条目不可勾选删除。锁定目标及受保护祖先不能写入。修改选区或源内容后重新读取／预览。取消会停止后续工作并等待回执，不能视为此前成功项已撤销；超时或结果不明确时，先检查文档再决定是否重试。按实际支持情况使用 Figma 撤销，首次尝试不熟悉的操作时保留文档副本。

The browser demo simulates document APIs and undo. Its results and CI checks do not replace native Figma acceptance. See [support](SUPPORT.md) for reporting a reproducible issue without sharing customer content or credentials.
