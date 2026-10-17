# Image operations and limits / 图片操作与限制

Applies to the v0.3.2 development preview. See [current status](STATUS.md) for validation coverage and [usage](USAGE.md) for the common workflow.

## Create or replace / 新建或替换

- New result layers are placed in free space on the current page, outside the source's auto layout or component instance. Existing top-level objects and earlier batch results are avoided.
- Crop, FIT/FILL, image rotation, and layer rotation are mapped to the processed image coordinates.
- Replacing a plain rectangle can tighten its visible transparent bounds. Auto-layout items, instance contents, rounded/stroked objects, multiple fills, and special shapes retain their geometry while the image mapping is adjusted; this avoids resizing the layout or mask shape.
- Other fills, image filters, and opacity are retained. Locked targets and protected ancestors are rejected.

新建结果放在当前页空闲区域，避开已有顶层对象和本批结果，不写入原自动布局或组件实例。普通矩形替换可收紧透明边；自动布局、实例、圆角、描边、多填充和特殊形状保留几何尺寸，仅补偿图片映射。其余填充、图片滤镜和透明度保留；锁定对象及受保护祖先不可写入。

## Tiled images / 平铺图片

Replacing a tiled image after trimming one tile's transparent border would change repetition spacing. Use **create a new cropped layer** instead; the processed result remains available.

平铺（Tile）图片裁掉单张瓦片透明边后，直接替换会改变重复间距。此时请使用“新建裁剪图层”，处理结果会继续保留。

## Changed sources and failures / 源变化与失败

Changes to image content, fills, geometry, selection, or container relationships invalidate old results. Reread the source or regenerate the preview before writing.

A write failure is separate from image-processing failure: processed bytes, previews, and selections remain available for supported retries. If the outcome is unknown, inspect the canvas before repeating an operation. An individual failure does not by itself establish whether other batch items succeeded; inspect the final receipt and document.

预览后源图片、填充、几何、选区或容器关系变化，会拒绝旧结果。写入失败时保留已处理图片、预览和勾选，按提示重试；结果不明确时先检查画布。批次中单项失败不能代表整批没有写入，以最终回执及文档为准。

## Validation limits / 验证边界

Automated checks cover coordinate mapping, rotation, geometry preservation, stale-result rejection, recovery, and partial failures. Earlier targeted native Figma checks exercised image creation/replacement and transaction recovery. They do not establish every auto-layout/instance/rotation combination, external background-removal service, or complex-document case. CI and browser simulation do not replace native checks.

自动检查覆盖图片映射、旋转、保尺寸、旧结果拒绝、恢复及部分失败；此前针对性 Figma 原生检查覆盖部分新建、替换和事务恢复。复杂布局组合、真实外部抠图服务及复杂文档仍需扩大验收。
