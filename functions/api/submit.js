/**
 * Cloudflare Pages Function - 接收前端提交的数据，循环逐条发送 webhook 到 WPS 多维表
 */

// WPS 多维表 webhook 地址
const WPS_WEBHOOK_URL = 'https://www.kdocs.cn/chatflow/api/v2/func/webhook/3H56oMJ5ZxwhbvKg39gmFnhZXg1';

export async function onRequest(context) {
  const { request } = context;

  // 仅接受 POST 请求
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: '仅支持 POST 请求' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST' }
    });
  }

  // 解析请求体
  let data;
  try {
    data = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: '请求体不是有效的 JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const { records, globalDate, reporter } = data;

  if (!Array.isArray(records) || records.length === 0) {
    return new Response(JSON.stringify({ error: '提交数据为空，请至少填写一条记录' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!globalDate || globalDate.trim() === '') {
    return new Response(JSON.stringify({ error: '缺少日期信息' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 逐条循环提交到 WPS 多维表 webhook
  const results = [];
  for (let i = 0; i < records.length; i++) {
    const record = records[i];

    // 构建发送给 WPS 的 payload
    const payload = {
      date: globalDate,
      reporter: reporter || '',
      time: record.time || '',
      bags: record.bags || '',
      carNumber: record.carNumber || '',
      tareWeight: record.tareWeight || '',
      grossWeight: record.grossWeight || '',
      cargoWeight: record.cargoWeight || ''
    };

    try {
      const resp = await fetch(WPS_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let respBody = '';
      try {
        respBody = await resp.text();
      } catch (_) {
        respBody = '(无法读取响应体)';
      }

      results.push({
        index: i,
        success: resp.ok,
        status: resp.status,
        response: respBody.substring(0, 500) // 截断长响应
      });
    } catch (err) {
      results.push({
        index: i,
        success: false,
        error: err.message
      });
    }
  }

  // 统计结果
  const successCount = results.filter(r => r.success).length;
  const failCount = records.length - successCount;

  return new Response(JSON.stringify({
    success: failCount === 0,
    total: records.length,
    successCount,
    failCount,
    results
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
