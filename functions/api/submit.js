/**
 * Cloudflare Pages Function - 接收前端提交的数据，循环逐条发送 webhook 到 WPS 多维表
 *
 * 工作流程：
 *   前端 POST { globalDate, reporter, records: [...] } 到 /api/submit
 *   → 本函数逐条遍历 records 数组，为每条记录单独调用一次 WPS webhook
 *   → 返回每条记录的提交结果（成功/失败、HTTP状态码、响应体）
 *
 * WPS webhook 地址直接硬编码在此文件中。
 */

// ===== WPS 多维表 webhook 地址（硬编码） =====
const WPS_WEBHOOK_URL = 'https://www.kdocs.cn/chatflow/api/v2/func/webhook/3H56oMJ5ZxwhbvKg39gmFnhZXg1';

/**
 * Cloudflare Pages Function 入口函数
 * 每当有 POST 请求到 /api/submit 时自动触发
 */
export async function onRequest(context) {
  const { request } = context;

  // ----- 1. 请求方法校验：仅接受 POST -----
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }

  // ----- 2. 解析请求体 JSON -----
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求体不是有效的 JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ----- 3. 提取并校验前端传来的数据 -----
  const { records, globalDate, reporter } = data;

  // records 必须是数组且不能为空
  if (!Array.isArray(records) || records.length === 0) {
    return new Response(JSON.stringify({ error: '提交数据为空，请至少填写一条记录' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 全局日期不能为空
  if (!globalDate || globalDate.trim() === '') {
    return new Response(JSON.stringify({ error: '缺少日期信息' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ----- 4. 逐条循环提交到 WPS 多维表 webhook -----
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // 构建发送给 WPS 的 payload
    // sequence 从 1 开始，转为字符串类型
    const payload = {
      sequence: String(i + 1),  // 序号（字符串）
      date: globalDate,          // 全局日期
      reporter: reporter || '',  // 填写人
      time: record.time || '',         // 时间
      bags: record.bags || '',         // 袋数
      carNumber: record.carNumber || '',       // 车号
      tareWeight: record.tareWeight || '',     // 车皮重
      grossWeight: record.grossWeight || '',   // 毛重
      cargoWeight: record.cargoWeight || ''    // 货重
    };

    try {
      // 调用 WPS webhook API，发送 POST 请求
      const resp = await fetch(WPS_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'Origin': 'www.kdocs.cn',
          'Referer': 'https://www.kdocs.cn/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(payload)
      });

      // 读取响应体（可能为空或非 JSON）
      let respBody = '';
      try {
        respBody = await resp.text();
      } catch (_) {
        respBody = '(无法读取响应体)';
      }

      // 记录本条提交的结果
      results.push({
        index: i,           // 记录序号（从0开始）
        success: resp.ok,   // 是否成功（HTTP 2xx）
        status: resp.status, // HTTP 状态码
        response: respBody   // WPS 返回的响应原文
      });
    } catch (err) {
      // 网络错误或请求超时等异常情况
      results.push({
        index: i,
        success: false,
        error: err.message
      });
    }
  }

  // ----- 5. 统计并返回结果 -----
  const successCount = results.filter(r => r.success).length;
  const failCount = records.length - successCount;

  // 只有当所有记录都成功时，整体 success 才为 true
  return new Response(JSON.stringify({
    success: failCount === 0,
    total: records.length,
    successCount,
    failCount,
    results  // 每条记录的详细结果
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
