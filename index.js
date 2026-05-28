/**
 * Nama File: index.js
 * Proyek: RAMZZPAY Relay API
 * Deskripsi: Express server + semua route (single file)
 * Dibuat: 2026-05-28
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// Konfigurasi
const CONFIG = {
  baseUrl: 'https://app.orderkuota.com',
  checkerUrl: 'https://checker.orderkuota.com',
  h2hBaseUrl: 'https://h2h.okeconnect.com/trx',
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// UTILITY FUNCTIONS
// ============================================

const api = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 30000,
  headers: {
    'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14; SM-S928B)',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Encoding': 'gzip',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
    'Connection': 'keep-alive',
    'Host': 'app.orderkuota.com',
  },
});

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function formatRupiah(n) {
  return 'Rp ' + parseInt(n).toLocaleString('id-ID');
}

function cleanNominal(n) {
  return parseInt(String(n).replace(/[^0-9]/g, ''));
}

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

async function sendToOrderkuota(endpoint, bodyParams = {}, cookies = {}, token = '', username = '') {
  const url = CONFIG.baseUrl + endpoint;
  const merged = { ...defaultBody(token, username), ...bodyParams };
  const body = new URLSearchParams(merged);

  let cookieHeader = '';
  if (cookies && Object.keys(cookies).length > 0) {
    cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  const headers = {};
  if (cookieHeader) headers['Cookie'] = cookieHeader;

  const response = await api.post(url, body.toString(), { headers });

  const responseCookies = {};
  (response.headers['set-cookie'] || []).forEach(c => {
    const m = c.match(/^([^=]+)=([^;]*)/);
    if (m) responseCookies[m[1].trim()] = m[2].trim();
  });

  return { statusCode: response.status, data: response.data, cookies: responseCookies };
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RAMZZPAY Relay API v1.0',
    status: 'online',
    time: new Date().toISOString(),
    endpoints: {
      health: 'GET /',
      requestOTP: 'POST /api/request-otp',
      verifyOTP: 'POST /api/verify-otp',
      account: 'POST /api/account',
      mutasi: 'POST /api/mutasi',
      paymentCreate: 'POST /api/payment-create',
      paymentCheck: 'POST /api/payment-check',
      withdrawQris: 'POST /api/withdraw-qris',
      checkEwallet: 'POST /api/check-ewallet',
    },
  });
});

// ============================================
// AUTH
// ============================================

app.post('/api/request-otp', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ success: false, message: 'Username & password wajib' });

    const result = await sendToOrderkuota('/api/v2/login', { username, password }, {}, '', username);
    const data = result.data;

    if (data?.success) {
      return res.json({
        success: true,
        message: 'OTP dikirim',
        data: { otp_method: data.results?.otp || 'email', otp_target: data.results?.otp_value || '***' },
        cookies: result.cookies,
      });
    }

    return res.json({ success: false, message: data?.message || 'Gagal' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { username, otp } = req.body;
    if (!username || !otp) return res.status(400).json({ success: false, message: 'Username & OTP wajib' });

    const result = await sendToOrderkuota('/api/v2/login', { username, password: otp }, {}, '', username);
    const data = result.data;

    if (data?.success && data?.results?.token) {
      return res.json({
        success: true,
        message: 'Login berhasil',
        data: { user_id: data.results.id, token: data.results.token, name: data.results.name || '' },
        cookies: result.cookies,
      });
    }

    return res.json({ success: false, message: data?.message || 'OTP tidak valid' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// ACCOUNT
// ============================================

app.post('/api/account', async (req, res) => {
  try {
    const { token, userId, username, cookies } = req.body;

    const result = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, { 'requests[0]': 'account' }, cookies || {}, token, username);
    const data = result.data;

    if (data?.success) {
      const info = data.account?.results || {};
      return res.json({
        success: true,
        data: {
          name: info.name || '', email: info.email || '',
          balance: cleanNominal(info.balance || '0'),
          balance_formatted: formatRupiah(cleanNominal(info.balance || '0')),
          qris_balance: cleanNominal(info.qris_balance || '0'),
          qris: info.qris || '', qrcode: info.qrcode || '',
        },
        cookies: result.cookies,
      });
    }

    return res.json({ success: false, message: data?.message || 'Gagal' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// MUTASI
// ============================================

app.post('/api/mutasi', async (req, res) => {
  try {
    const { token, userId, username, cookies, page = '1' } = req.body;

    const bodyParams = {
      'requests[0]': 'account',
      'requests[qris_history][page]': page,
      'requests[qris_history][keterangan]': '',
      'requests[qris_history][jumlah]': '',
      'requests[qris_history][dari_tanggal]': '',
      'requests[qris_history][ke_tanggal]': '',
    };

    const result = await sendToOrderkuota(`/api/v2/qris/mutasi/${userId}`, bodyParams, cookies || {}, token, username);
    const data = result.data;

    if (data?.success) {
      const mutasi = (data.qris_history?.results || []).map(item => ({
        tanggal: item.tanggal || '',
        status: item.status || 'UNKNOWN',
        kredit: cleanNominal(item.kredit || '0'),
        kredit_formatted: formatRupiah(cleanNominal(item.kredit || '0')),
        debet: cleanNominal(item.debet || '0'),
        debet_formatted: formatRupiah(cleanNominal(item.debet || '0')),
        brand: item.brand?.name || '',
        keterangan: item.keterangan || '',
      }));

      return res.json({ success: true, mutasi, total: mutasi.length, cookies: result.cookies });
    }

    return res.json({ success: false, message: data?.message || 'Gagal' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// PAYMENT
// ============================================

app.post('/api/payment-create', async (req, res) => {
  try {
    const { token, userId, username, cookies, amount } = req.body;
    const nominal = parseInt(amount || 0);
    if (!nominal || nominal < 100) return res.status(400).json({ success: false, message: 'Minimal Rp 100' });

    const menuResult = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, { 'requests[0]': 'account', 'requests[1]': 'qris_menu' }, cookies || {}, token, username);
    if (!menuResult.data?.success) return res.json({ success: false, message: 'Gagal ambil QRIS' });

    const qrisUrl = menuResult.data.qris_menu?.results?.download || '';
    const refID = 'RZPAY' + Date.now();
    const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrisUrl);

    return res.json({
      success: true,
      data: {
        ref_id: refID, amount: nominal, amount_formatted: formatRupiah(nominal),
        qr_image_url: qrUrl, qris_string: qrisUrl,
        status: 'pending', expired_at: new Date(Date.now() + 600000).toISOString(),
      },
      cookies: menuResult.cookies,
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/payment-check', async (req, res) => {
  try {
    const { token, userId, username, cookies, amount } = req.body;
    const searchAmount = cleanNominal(amount || 0);

    const result = await sendToOrderkuota(`/api/v2/qris/mutasi/${userId}`, {
      'requests[0]': 'account',
      'requests[qris_history][page]': '1',
      'requests[qris_history][keterangan]': '',
      'requests[qris_history][jumlah]': '',
      'requests[qris_history][dari_tanggal]': '',
      'requests[qris_history][ke_tanggal]': '',
    }, cookies || {}, token, username);

    const data = result.data;
    if (!data?.success) return res.json({ success: false, paid: false, message: 'Gagal cek mutasi' });

    const mutasi = data.qris_history?.results || [];
    let paid = false, detail = null;

    for (const item of mutasi) {
      const kredit = cleanNominal(item.kredit || '0');
      if (kredit >= searchAmount && searchAmount > 0) {
        paid = true;
        detail = { nominal: kredit, nominal_formatted: formatRupiah(kredit), brand: item.brand?.name || '', tanggal: item.tanggal || '' };
        break;
      }
    }

    return res.json({ success: true, paid, data: detail || { status: 'pending' }, cookies: result.cookies });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// WITHDRAW QRIS
// ============================================

app.post('/api/withdraw-qris', async (req, res) => {
  try {
    const { token, userId, username, cookies, amount } = req.body;
    const nominal = cleanNominal(amount || 0);
    if (nominal < 100) return res.status(400).json({ success: false, message: 'Minimal Rp 100' });

    const result = await sendToOrderkuota('/api/v2/get', {
      'requests[0]': 'account',
      'requests[qris_withdraw][amount]': nominal,
    }, cookies || {}, token, username);

    if (result.data?.success) {
      return res.json({
        success: true,
        message: 'Withdraw berhasil',
        data: { withdrawn: nominal, withdrawn_formatted: formatRupiah(nominal) },
        cookies: result.cookies,
      });
    }

    return res.json({ success: false, message: result.data?.message || 'Gagal withdraw' });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// CHECK E-WALLET
// ============================================

app.post('/api/check-ewallet', async (req, res) => {
  try {
    const { provider, destination, token } = req.body;
    const valid = ['dana', 'ovo', 'gopay', 'shopeepay', 'linkaja'];
    if (!valid.includes(provider?.toLowerCase())) return res.status(400).json({ success: false, message: 'Provider tidak valid' });

    const body = new URLSearchParams({
      phone_uuid: 'cdzXkBynRECkAODZEHwkeV', phone_model: 'SM-S928B', phoneNumber: destination,
      request_time: Date.now(), phone_android_version: '14', app_version_code: '250811',
      auth_username: 'ramzyystore', id: provider.toLowerCase(), auth_token: token || '',
      app_version_name: '25.08.11', ui_mode: 'dark',
    });

    const url = `${CONFIG.checkerUrl}/api/checkname/produk/bff66b406f/06/2604338/${provider.toLowerCase()}`;
    const response = await axios.post(url, body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 30000 });

    return res.json({ success: response.status === 200, data: response.data });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// ============================================
// 404
// ============================================

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Endpoint tidak ditemukan', path: req.originalUrl });
});

// ============================================
// EXPORT
// ============================================

module.exports = app;
