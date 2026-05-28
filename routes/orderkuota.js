/**
 * Nama File: lib/relay.js
 * Proyek: RAMZZPAY Relay API
 * Deskripsi: Core logic - Kirim request ke Orderkuota
 * Dibuat: 2026-05-28
 */

const axios = require('axios');
const https = require('https');

// Konfigurasi
const CONFIG = {
  baseUrl: 'https://app.orderkuota.com',
  checkerUrl: 'https://checker.orderkuota.com',
  h2hBaseUrl: 'https://h2h.okeconnect.com/trx',
};

// Axios instance
const api = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 30000,
  headers: {
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14; SM-S928B Build/UP1A.231005.007)',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    'Connection': 'keep-alive',
    'Host': 'app.orderkuota.com',
  },
});

/**
 * Generate UUID v4
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Build default body params
 */
function defaultBody(token, username) {
  const body = {
    request_time: Date.now(),
    phone_android_version: '14',
    app_version_code: '260205',
    phone_uuid: uuid(),
    app_version_name: '26.02.05',
    ui_mode: 'light',
    phone_model: 'SM-S928B',
  };

  if (token && username) {
    body.auth_token = token;
    body.auth_username = username;
  }

  return body;
}

/**
 * Format Rupiah
 */
function formatRupiah(amount) {
  return 'Rp ' + parseInt(amount).toLocaleString('id-ID');
}

/**
 * Clean nominal
 */
function cleanNominal(n) {
  return parseInt(String(n).replace(/[^0-9]/g, ''));
}

/**
 * Parse tanggal
 */
function parseTanggal(dateStr) {
  if (!dateStr) return null;
  let match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]),
                    parseInt(match[4]), parseInt(match[5]), parseInt(match[6])).toISOString();
  }
  const ts = Date.parse(dateStr);
  return ts ? new Date(ts).toISOString() : null;
}

/**
 * Send request to Orderkuota
 */
async function sendToOrderkuota(endpoint, bodyParams = {}, cookies = {}, token = '', username = '') {
  const url = CONFIG.baseUrl + endpoint;
  const mergedBody = { ...defaultBody(token, username), ...bodyParams };
  const body = new URLSearchParams(mergedBody);

  let cookieHeader = '';
  if (cookies && Object.keys(cookies).length > 0) {
    cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  const headers = {};
  if (cookieHeader) headers['Cookie'] = cookieHeader;

  const response = await api.post(url, body.toString(), { headers });

  const responseCookies = {};
  const setCookieHeaders = response.headers['set-cookie'] || [];
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/^([^=]+)=([^;]*)/);
    if (match) responseCookies[match[1].trim()] = match[2].trim();
  }

  return {
    statusCode: response.status,
    data: response.data,
    cookies: responseCookies,
  };
}

/**
 * Send to H2H
 */
async function sendToH2H(product, dest, amount = 0, refID = '') {
  const params = new URLSearchParams({
    product,
    dest,
    refID: refID || 'RZPAY' + Date.now(),
    memberID: process.env.H2H_MEMBER_ID || 'OK2282758',
    pin: process.env.H2H_PIN || '2011',
    password: process.env.H2H_PASSWORD || 'ramaaditia',
  });

  if (amount > 0) params.append('amount', amount);

  const url = CONFIG.h2hBaseUrl + '?' + params.toString();
  const response = await axios.get(url, { timeout: 60000 });

  return {
    statusCode: response.status,
    data: response.data,
    raw: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
  };
}

module.exports = {
  sendToOrderkuota,
  sendToH2H,
  formatRupiah,
  cleanNominal,
  parseTanggal,
  CONFIG,
};
