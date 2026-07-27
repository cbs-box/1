# 数据提交系统

一个移动端友好的数据提交系统，支持多条记录批量填写，并通过 Cloudflare Pages Function 逐条提交到 WPS 多维表。

## 架构

```
浏览器 (Vue3 + Vant4)      Cloudflare Pages          WPS 多维表
       │                         │                        │
       │  POST /api/submit       │                        │
       │  {globalDate, reporter, │                        │
   ────│   records: [...]}      │                        │
       │                         │                        │
       │                     ╔════════════╗               │
       │                     ║ 循环 N 次  ║               │
       │                     ╚════════════╝               │
       │                         │                        │
       │                         │ POST webhook (N 次)   │
       │                         │────────────────────────▶
       │                         │   {sequence, date,     │
       │                         │    reporter, time,     │
       │                         │    bags, carNumber,    │
       │                         │    tareWeight,         │
       │                         │    grossWeight,        │
       │                         │    cargoWeight}        │
       │                         │                        │
       │  返回 JSON {            │                        │
       │   results: [{success}], │                        │
       │   successCount,         │                        │
       │   failCount             │                        │
       │  }                      │                        │
       │◀────────────────────────│                        │
```

## 文件结构

```
├── index.html                # 前端页面 (Vue3 + Vant4)
├── functions/
│   └── api/
│       └── submit.js         # Cloudflare Pages Function（后端 API）
└── README.md                 # 本文件
```

## 前端（`index.html`）

### 技术栈
- **Vue 3**（CDN）- 响应式框架
- **Vant 4**（CDN）- 移动端 UI 组件库
- **localStorage** - 草稿数据本地持久化

### 界面布局
- **全局信息卡片**（顶部）：日期 + 填写人字段，所有记录共享
- **记录卡片**：每条记录包含 6 个输入框，采用 2 列 flex 布局（时间+车号一行，其余字段各占一行）
- **底部按钮栏**：3 个按钮 — 添加行 / 保存草稿 / 提交

### 每条记录的字段映射

| 标签 | 字段名 | 类型 |
|------|--------|------|
| Time | `time` | text（必填） |
| Vehicle No. | `carNumber` | text |
| Bags | `bags` | number |
| Tare Wt. | `tareWeight` | number |
| Gross Wt. | `grossWeight` | number |
| Net Wt. | `cargoWeight` | number |

### 核心功能
1. **草稿持久化**：点击"Save Draft"将数据保存到浏览器 `localStorage`，存储键为：`data_records_draft_v5`、`data_global_date_v5`、`data_reporter_v5`
2. **日期选择器**：默认显示当天日期，通过 `pickerDefault = new Date()` 实现
3. **记录管理**：支持添加/删除行，至少保留 1 行
4. **批量提交**：一次性将所有记录以 POST 方式发送到 `/api/submit`
5. **提交流程弹窗**（中文界面）：实时显示每条记录的提交状态（进行中/成功/失败），支持对失败项单独重试
6. **表单校验**：全局日期和填写人必填；每条记录的时间必填
7. **异常处理**：网络错误、API 错误、空结果等均有友好的提示

### 提交流程弹窗详情
- 实时显示进度："进度 X / Y"，"成功 X，失败 Y"
- 每条记录显示：状态点（待提交/提交中/成功/失败）、记录序号、时间、WPS HTTP 状态码
- 点击 ✗ 图标可查看 WPS 返回的完整响应内容
- 提交完成后，如有失败项可点击"重试失败项"按钮重新提交失败的数据
- 弹窗中的所有文本保留中文

## 后端（`functions/api/submit.js`）

### 技术
- **Cloudflare Pages Function**（无服务器函数）
- 每次 POST 到 `/api/submit` 时自动触发

### 输入格式
```json
{
  "globalDate": "2026-07-26",
  "reporter": "张三",
  "records": [
    {
      "time": "08:30",
      "bags": "20",
      "carNumber": "粤B12345",
      "tareWeight": "5000",
      "grossWeight": "15300",
      "cargoWeight": "10300"
    }
  ]
}
```

### Webhook Payload（每条记录发送一次）
```json
{
  "sequence": "1",
  "date": "2026-07-26",
  "reporter": "张三",
  "time": "08:30",
  "bags": "20",
  "carNumber": "粤B12345",
  "tareWeight": "5000",
  "grossWeight": "15300",
  "cargoWeight": "10300"
}
```

> 注意：`sequence` 字段是字符串类型而非数字，每条记录从 "1" 开始递增。

### WPS Webhook 地址（硬编码在 submit.js 中）
```
https://www.kdocs.cn/chatflow/api/v2/func/webhook/3H56oMJ5ZxwhbvKg39gmFnhZXg1
```

### 请求头
```
Content-Type: application/json
Accept: application/json, text/plain, */*
Origin: www.kdocs.cn
Referer: https://www.kdocs.cn/
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
```

### 逻辑流程
1. 校验输入：records 数组不能为空、globalDate 不能为空
2. 遍历每条记录（i = 0 到 N-1）：
   a. 构建 payload，包含 `sequence: String(i+1)`、日期、填写人及各字段值
   b. 向 WPS webhook 发送 POST 请求（含完整请求头）
   c. 记录成功/失败结果到 results 数组
3. 返回汇总结果，包含每条记录的 HTTP 状态码和响应体

## 部署

### Cloudflare Pages
1. 将代码推送到 GitHub
2. 打开 Cloudflare Pages 控制台 → 创建项目 → 连接 GitHub 仓库
3. 框架预设：**None**
4. 构建命令：（留空）
5. 构建输出目录：（留空）
6. 部署

> 无需配置环境变量，webhook URL 已在 submit.js 中硬编码。

## WPS 多维表 配置
1. 打开 WPS 多维表 → 自动化 → 新建自动化流程
2. 触发器：选择"当收到 Webhook 时"
3. 在请求示例中粘贴一条 JSON 样例数据
4. 操作：选择"创建记录"，将 payload 中的每个字段映射到对应的表格列
5. 保存并启用自动化

## 数据存储说明
- **草稿数据**：保存在浏览器的 `localStorage` 中（按设备/浏览器隔离，约 5MB 大小限制）
- **已提交数据**：通过 webhook 存储在 WPS 多维表中
- **服务端**：Cloudflare Function 为无状态，不存储任何数据
