# Documentation / 文档目录

## Start here / 从这里开始

- [Installation from source / 源码安装](INSTALLATION.md)
- [Prebuilt development package / 预编译开发插件包](PREBUILT.md)
- [Usage and recovery / 使用与恢复](USAGE.md)
- [Image operations and limits / 图片操作与限制](FIGMA_IMAGE_WRITES.md)
- [Current status and validation / 当前状态与验证](STATUS.md)
- [Privacy / 隐私](PRIVACY.md)
- [Support / 联系与支持](SUPPORT.md)
- [Changelog / 更新记录](../CHANGELOG.md)
- [Contributing / 贡献指南](../CONTRIBUTING.md)
- [Security reporting / 安全报告](../SECURITY.md)

## Contributor references / 贡献者资料

- [Eight-language glossary / 八语术语表](LOCALIZATION_GLOSSARY.md)
- [Repository artwork / 仓库展示图](images/README.md)
- [Third-party notices / 第三方声明](../THIRD_PARTY_NOTICES.md)

`locale-data-exemptions.json` is consumed by locale checks; `mastergo-ui-baseline.json` is consumed by reference-contract tests. Both are required development inputs. Asset source references and checksums remain in `src/assets/` and `docs/images/`; third-party licenses remain in `licenses/`.

Public documentation summarizes supported behavior and validation limits. Internal plans, raw acceptance logs, dated implementation notes, and historical migration tools remain local-only. Removing them from the current tree does not erase older Git history.

公开文档保留安装、使用、限制、验证摘要和贡献说明。内部计划、原始验收记录、阶段实施记录及历史迁移脚本仅在本机保留；当前目录整理不清除旧 Git 历史。上述两个 JSON 为检查输入，不能作为普通过程记录移除。
