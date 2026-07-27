# 修复 Origin 请求头

## 修改内容
将 [submit.js](file:///c:\Users\12610\Desktop\py脚本\报表提交\1-main\functions\api\submit.js#L67) 中的 `Origin` 头从 `'https://www.kdocs.cn'` 改为 `'www.kdocs.cn'`

## 涉及文件
- `functions/api/submit.js` — 第67行

## 步骤
1. 修改 submit.js 中 Origin 头值
2. git add + commit + push 到 GitHub
