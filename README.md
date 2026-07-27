# Data Submission System

A mobile-friendly data submission system that collects multi-record form data and sends each record to WPS 多维表 via webhook.

## Architecture

```
Browser (Vue3 + Vant4)      Cloudflare Pages          WPS 多维表
       │                         │                        │
       │  POST /api/submit       │                        │
       │  {globalDate, reporter, │                        │
   ────│   records: [...]}      │                        │
       │                         │                        │
       │                     ╔════════════╗               │
       │                     ║ loop N     ║               │
       │                     ║ times      ║               │
       │                     ╚════════════╝               │
       │                         │                        │
       │                         │ POST webhook (N times) │
       │                         │────────────────────────▶
       │                         │   {sequence, date,     │
       │                         │    reporter, time,     │
       │                         │    bags, carNumber,    │
       │                         │    tareWeight,         │
       │                         │    grossWeight,        │
       │                         │    cargoWeight}        │
       │                         │                        │
       │  JSON results{          │                        │
       │   results:[{success}],  │                        │
       │   successCount,N,       │                        │
       │   failCount:N           │                        │
       │  }                      │                        │
       │◀────────────────────────│                        │
```

## File Structure

```
├── index.html              # Frontend (Vue3 + Vant4)
├── functions/
│   └── api/
│       └── submit.js       # Cloudflare Pages Function (backend API)
└── README.md               # This file
```

## Frontend (`index.html`)

### Technology Stack
- **Vue 3** (CDN) - Reactive framework
- **Vant 4** (CDN) - Mobile UI components
- **localStorage** - Draft data persistence

### UI Layout
- **Global info card** (top): Date + Reporter fields, shared by all records
- **Record cards**: Each card contains 6 input fields in a 2-column flex layout
- **Footer bar**: 3 buttons — Add Row / Save Draft / Submit

### Field Mapping (per record)

| Label | Key | Type |
|-------|-----|------|
| Time | `time` | text (required) |
| Vehicle No. | `carNumber` | text |
| Bags | `bags` | number |
| Tare Wt. | `tareWeight` | number |
| Gross Wt. | `grossWeight` | number |
| Net Wt. | `cargoWeight` | number |

### Key Features
1. **Draft persistence**: Data saved to `localStorage` via `Save Draft` button. Storage keys: `data_records_draft_v5`, `data_global_date_v5`, `data_reporter_v5`.
2. **Date picker**: Defaults to today's date via `pickerDefault = new Date()`.
3. **Record management**: Add/delete rows. Minimum 1 row (cleared on delete attempt).
4. **Batch submission**: Sends all records to `/api/submit` as a single POST.
5. **Progress dialog** (Chinese text): Shows per-record submission status with WPS HTTP response. Supports retry on failed items.
6. **Validation**: Date and Reporter required at global level; Time required per record.
7. **Error handling**: Network errors, API errors, and empty results are all handled gracefully.

### Progress Dialog Details
- Displays real-time progress: "进度 X / Y", "成功 X，失败 Y"
- Each record shows: status dot (pending/loading/success/fail), record number, time, WPS HTTP status
- Click ✗ icon to see full WPS response dialog
- "重试失败项" button resubmits only failed records
- All progress dialog text remains in Chinese

## Backend (`functions/api/submit.js`)

### Technology
- **Cloudflare Pages Function** (serverless)
- Runs on every POST to `/api/submit`

### Input
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

### Webhook Payload (per record, sent N times)
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

### WPS Webhook URL (hardcoded)
```
https://www.kdocs.cn/chatflow/api/v2/func/webhook/3H56oMJ5ZxwhbvKg39gmFnhZXg1
```

### Request Headers
```
Content-Type: application/json
Accept: application/json, text/plain, */*
Origin: www.kdocs.cn
Referer: https://www.kdocs.cn/
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...
```

### Logic Flow
1. Validate input (records array, globalDate, reporter)
2. Loop through each record (i = 0 to N-1):
   a. Build payload with `sequence: String(i+1)`, date, reporter, and record fields
   b. POST payload to WPS webhook URL with full headers
   c. Record success/failure in results array
3. Return aggregated results with per-record HTTP status and response body

## Deployment

### Cloudflare Pages
1. Push this repo to GitHub
2. In Cloudflare Pages dashboard → Create → Connect GitHub repo
3. Framework preset: **None**
4. Build command: (leave empty)
5. Build output directory: (leave empty)
6. Deploy

No environment variables needed (webhook URL is hardcoded in submit.js).

## WPS 多维表 Configuration
1. Open WPS多维表 → Automation → New automation flow
2. Trigger: "When webhook received"
3. Paste a sample JSON in the request body example field
4. Action: "Create record" → map each field to the corresponding table column
5. Save and enable the automation

## Data Storage
- **Drafts**: Saved to browser `localStorage` (per-device, per-browser, ~5MB limit)
- **Submitted data**: Stored in WPS 多维表 via webhook
- **No server-side database**: Cloudflare Function is stateless
