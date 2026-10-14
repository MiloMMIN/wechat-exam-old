# wechat-exam

微信小程序：电子商务师刷题（学习模式 / 模拟考试 / 错题本 / 收藏 / 笔记）。

## 题库

`miniprogram/data/questions.ts` 由 `scripts/docx-to-questions.py` 自动生成，勿手改。

更换题源：
1. `.doc` 先转 `.docx`：`pwsh -NoProfile -File scripts/doc2docx.ps1`（改脚本内路径）
2. 改 `scripts/docx-to-questions.py` 顶部 `SRC` 常量
3. `python scripts/docx-to-questions.py`

## 开发

微信开发者工具打开本目录（`miniprogramRoot=miniprogram/`），TS 编译已在 `project.config.json` 启用。

本地校验：`npx tsc --noEmit`

## 分享题库格式

题库 + 考试设置可导出为单个 `.kbz`（实为 UTF-8 JSON），接收方在"文档"页导入后即出现在自己的题库列表，可收藏/刷题/考试。结构见 `miniprogram/utils/bank-format.ts`。
