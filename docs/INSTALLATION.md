# Install / 安装指南

[English README](../README.md) · [中文首页](../README.zh-CN.md)

Version 0.3.3 is a development preview. For a prebuilt ZIP without Node.js/npm, follow [prebuilt installation](PREBUILT.md). The source-build steps below use a Figma desktop development plugin and your own plugin ID. The initial 0.3.2 Community submission was recorded on 2026-10-17; current approval/public availability must be checked separately.

无需构建的预编译 ZIP 安装见[独立步骤](PREBUILT.md)。下文保留源码构建方法；Community 提交记录不代表已获准公开上架。

## 1. Build the source

Install Git, Node.js 22+, npm, and the Figma desktop app. Then run:

```sh
git clone https://github.com/BeatsAD/DesignProMAX-Toolkit.git
cd DesignProMAX-Toolkit
npm ci
npm run build
```

The build produces `dist/main.js` and `dist/ui.html`. Keep them in the checkout. Do not move a directory Figma has registered without re-importing it afterward.

## 2. Get your own development-plugin ID

In Figma desktop, open a Figma Design file and choose **Plugins → Development → New plugin**. Create a **Figma Design** plugin with a **Custom UI** template. Menu wording may differ by client version.

Save the generated template in a separate new folder outside this checkout, so it cannot overwrite project files. Open its `manifest.json` and copy the numeric `id`. Use your own assigned ID, not an ID from someone else's installation, a test fixture, or another platform.

## 3. Generate the local manifest

From the checkout, replace `YOUR_NUMERIC_PLUGIN_ID` with that numeric ID:

```sh
npm run configure:plugin -- YOUR_NUMERIC_PLUGIN_ID
```

This creates the Git-ignored `manifest.local.json`, pointing to `dist/main.js` and `dist/ui.html`. The shared manifest deliberately has no account-specific ID.

## 4. Import and run

In Figma, choose **Plugins → Development → Import plugin from manifest** and select the checkout's `manifest.local.json`. Open **DesignProMAX Toolkit** from Development. On first launch, choose a language and confirm; later launches use the saved language.

Start in a disposable design file. Try text fill or split/merge on sample layers, inspect results, and verify undo. Use non-sensitive sample images. Do not enable external background removal until you accept the selected service's upload and billing behavior.

## Update

With your local changes saved separately and a clean checkout:

```sh
git pull --ff-only
npm ci
npm run build
```

Close and reopen the plugin. If the checkout moved, re-import the local manifest from its new location.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Missing/invalid ID | Use the numeric ID from your own generated Figma template |
| Code or UI not found | Build again; keep the local manifest and generated files in the same checkout |
| Old UI appears | Close, rebuild, and reopen the entry imported from this checkout |
| Settings fail to load | Use the retry action; report steps without clearing saved settings |
| OCR is inaccurate | Check source resolution and manually verify text, especially numbers/dates/amounts |

See [support](SUPPORT.md). The browser demo (`npm run dev`) does not establish native Figma compatibility.

## 中文步骤

1. 安装 Git、Node.js 22+、npm 和 Figma 桌面客户端，按第一节克隆、安装依赖并构建。
2. 在 Figma Design 文件中通过“插件 → 开发 → 新建插件”创建带 Custom UI 的开发插件。模板保存到仓库之外的新目录，不覆盖工程文件。
3. 从模板的 `manifest.json` 复制自己的数字 `id`，替换第三节命令中的 `YOUR_NUMERIC_PLUGIN_ID` 后执行。
4. 通过“插件 → 开发 → 从 manifest 导入插件”，选择本工程的 `manifest.local.json`。菜单文字可能随语言和版本变化。
5. 从开发菜单运行 DesignProMAX Toolkit，首次确认语言。先在测试文件验证工具和撤销，不直接用客户文件试验。
6. 更新前单独保存本地修改，再拉取、安装依赖、构建和重开插件。移动目录后需从新位置重新导入。

无需运行 MasterGo 打包、版本脚本或历史迁移脚本。此指南描述安装方法，不扩大[当前状态](STATUS.md)记录的宿主验收范围。
