/**
 * Nama File: api/orderkuota.js
 * Proyek: RAMZZPAY Relay
 * Deskripsi: REST API Relay Lengkap - Meneruskan SEMUA request ke Orderkuota
 *            + H2H OkeConnect + QRIS Dinamis + Withdraw + Mutasi + E-Wallet
 *            Deploy ke Vercel (Serverless Function)
 * Dibuat: 2026-05-28
 * Version: 2.0.0
 */

const axios = require('axios');
const https = require('https');

// ============================================
// KONFIGURASI
// ============================================
const CONFIG = {
  // Orderkuota
  baseUrl: 'https://app.orderkuota.com',
  checkerUrl: 'https://checker.orderkuota.com',
  username: process.env.ORKUT_USERNAME || 'ramzyystore',
  token: process.env.ORKUT_TOKEN || '2282758:yAoX4egvwGU9k6Y2ZqWsx05CBLJiFbD1',
  userId: process.env.ORKUT_USER_ID || '2282758',
  
  // H2H OkeConnect
  h2hBaseUrl: 'https://h2h.okeconnect.com/trx',
  h2hMemberID: process.env.H2H_MEMBER_ID || 'OK2282758',
  h2hPin: process.env.H2H_PIN || '2011',
  h2hPassword: process.env.H2H_PASSWORD || 'ramaaditia',
  
  // Security
  secretKey: process.env.RELAY_SECRET || 'ramzzpay_relay_2026',
};

// ============================================
// AXIOS INSTANCE
// ============================================
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

// ============================================
// UTILITY FUNCTIONS
// ============================================

/** Generate UUID v4 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/** Generate Ref ID */
function generateRefID(prefix = 'RZPAY') {
  return prefix.toUpperCase() + Date.now() + Math.floor(Math.random() * 900 + 100);
}

/** Format Rupiah */
function formatRupiah(amount) {
  return 'Rp ' + parseInt(amount).toLocaleString('id-ID');
}

/** Clean nominal string to integer */
function cleanNominal(nominal) {
  return parseInt(String(nominal).replace(/[^0-9]/g, ''));
}

/** Parse tanggal Orderkuota ke ISO */
function parseTanggal(dateStr) {
  if (!dateStr) return null;
  // DD/MM/YYYY HH:MM:SS
  let match = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]), 
                    parseInt(match[4]), parseInt(match[5]), parseInt(match[6])).toISOString();
  }
  // YYYY-MM-DD HH:MM:SS
  match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]),
                    parseInt(match[4]), parseInt(match[5]), parseInt(match[6])).toISOString();
  }
  const ts = Date.parse(dateStr);
  return ts ? new Date(ts).toISOString() : null;
}

/** Build default body params */
function defaultBody() {
  return {
    request_time: Date.now(),
    phone_android_version: '14',
    app_version_code: '260205',
    phone_uuid: uuid(),
    app_version_name: '26.02.05',
    ui_mode: 'light',
    phone_model: 'SM-S928B',
  };
}

// ============================================
// CORE: SEND REQUEST TO ORDERKUOTA
// ============================================

/**
 * Kirim request ke Orderkuota API
 */
async function sendToOrderkuota(endpoint, bodyParams = {}, cookies = {}, token = '', username = '') {
  const url = CONFIG.baseUrl + endpoint;
  const mergedBody = { ...defaultBody(), ...bodyParams };

  // Tambahkan auth jika ada
  if ((token || CONFIG.token) && (username || CONFIG.username)) {
    mergedBody.auth_token = token || CONFIG.token;
    mergedBody.auth_username = username || CONFIG.username;
  }

  const body = new URLSearchParams(mergedBody);

  // Build cookie header
  let cookieHeader = '';
  if (cookies && Object.keys(cookies).length > 0) {
    cookieHeader = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  const headers = {};
  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  const response = await api.post(url, body.toString(), { headers });

  // Extract cookies
  const responseCookies = {};
  const setCookieHeaders = response.headers['set-cookie'] || [];
  for (const cookie of setCookieHeaders) {
    const match = cookie.match(/^([^=]+)=([^;]*)/);
    if (match) {
      responseCookies[match[1].trim()] = match[2].trim();
    }
  }

  return {
    statusCode: response.status,
    data: response.data,
    cookies: responseCookies,
  };
}

/**
 * Kirim request ke H2H OkeConnect
 */
async function sendToH2H(product, dest, amount = 0, refID = '') {
  const params = new URLSearchParams({
    product: product,
    dest: dest,
    refID: refID || generateRefID(),
    memberID: CONFIG.h2hMemberID,
    pin: CONFIG.h2hPin,
    password: CONFIG.h2hPassword,
  });

  if (amount > 0) {
    params.append('amount', amount);
  }

  const url = CONFIG.h2hBaseUrl + '?' + params.toString();

  const response = await axios.get(url, {
    timeout: 60000,
    httpsAgent: new https.Agent({ keepAlive: true }),
  });

  return {
    statusCode: response.status,
    data: response.data,
    raw: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
  };
}

// ============================================
// MAIN HANDLER
// ============================================

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Relay-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;
  const body = req.body || {};
  const cookies = body.cookies || {};
  const token = body.token || req.query.token || CONFIG.token;
  const userId = body.userId || body.user_id || req.query.userId || CONFIG.userId;
  const username = body.username || CONFIG.username;

  try {
    switch (action) {

      // ============================================
      // AUTHENTICATION
      // ============================================

      /**
       * POST /api/orderkuota?action=request-otp
       * Body: { username, password }
       */
      case 'request-otp': {
        const { username: uname, password } = body;
        if (!uname || !password) {
          return res.status(400).json({ success: false, message: 'Username & password wajib' });
        }

        const result = await sendToOrderkuota('/api/v2/login', { username: uname, password });
        const data = result.data;

        if (data?.success) {
          return res.json({
            success: true,
            message: 'OTP dikirim via ' + (data.results?.otp || 'email') + ' ke ' + (data.results?.otp_value || '***'),
            data: {
              otp_method: data.results?.otp || 'email',
              otp_target: data.results?.otp_value || '***',
              request_id: data.results?.request_id || '',
            },
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: data?.message || 'Gagal request OTP', data });
      }

      /**
       * POST /api/orderkuota?action=verify-otp
       * Body: { username, otp }
       */
      case 'verify-otp': {
        const { username: uname, otp } = body;
        if (!uname || !otp) {
          return res.status(400).json({ success: false, message: 'Username & OTP wajib' });
        }

        const result = await sendToOrderkuota('/api/v2/login', { username: uname, password: otp });
        const data = result.data;

        if (data?.success && data?.results?.token) {
          return res.json({
            success: true,
            message: 'Login berhasil!',
            data: {
              user_id: data.results.id,
              token: data.results.token,
              name: data.results.name || '',
              balance: data.results.balance || '0',
            },
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: data?.message || 'OTP tidak valid' });
      }

      /**
       * POST /api/orderkuota?action=login-token
       * Body: { token, userId }
       */
      case 'login-token': {
        if (!token || !userId) {
          return res.status(400).json({ success: false, message: 'Token & User ID wajib' });
        }

        const result = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account' }, cookies, token, username);
        const data = result.data;

        if (data?.success) {
          return res.json({
            success: true,
            message: 'Token valid - Login sukses',
            data: { user_id: userId, username },
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: 'Token expired atau invalid' });
      }

      /**
       * POST /api/orderkuota?action=refresh-session
       * Body: { token, userId, cookies }
       */
      case 'refresh-session': {
        if (!token || !userId) {
          return res.status(400).json({ success: false, message: 'Token & User ID wajib' });
        }

        const result = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account' }, cookies, token, username);
        
        return res.json({
          success: result.data?.success || false,
          message: result.data?.success ? 'Session refreshed' : 'Session expired',
          cookies: result.cookies,
        });
      }

      // ============================================
      // ACCOUNT
      // ============================================

      /**
       * GET/POST /api/orderkuota?action=account
       * Query: token, userId
       * Body: { cookies }
       */
      case 'account': {
        const result = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account' }, cookies, token, username);
        const data = result.data;

        if (data?.success) {
          const info = data.account?.results || {};
          const balance = cleanNominal(info.balance || '0');
          const qrisBalance = cleanNominal(info.qris_balance || '0');

          return res.json({
            success: true,
            data: {
              user_id: userId,
              name: info.name || '',
              email: info.email || '',
              balance,
              balance_formatted: formatRupiah(balance),
              qris_balance: qrisBalance,
              qris_balance_formatted: formatRupiah(qrisBalance),
              qris_name: info.qris_name || '',
              qris: info.qris || '',
              qrcode: info.qrcode || '',
            },
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: data?.message || 'Gagal ambil info akun' });
      }

      /**
       * GET /api/orderkuota?action=balance
       */
      case 'balance': {
        const result = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account' }, cookies, token, username);
        const data = result.data;

        if (data?.success) {
          const balance = cleanNominal(data.account?.results?.balance || '0');
          return res.json({
            success: true,
            balance,
            balance_formatted: formatRupiah(balance),
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: data?.message || 'Gagal ambil saldo' });
      }

      // ============================================
      // MUTASI QRIS
      // ============================================

      /**
       * GET /api/orderkuota?action=mutasi&page=1
       */
      case 'mutasi': {
        const page = req.query.page || '1';
        const dariTanggal = req.query.dari_tanggal || '';
        const keTanggal = req.query.ke_tanggal || '';

        const bodyParams = {
          'requests[0]': 'account',
          'requests[qris_history][page]': page,
          'requests[qris_history][keterangan]': '',
          'requests[qris_history][jumlah]': '',
          'requests[qris_history][dari_tanggal]': dariTanggal,
          'requests[qris_history][ke_tanggal]': keTanggal,
        };

        const result = await sendToOrderkuota(`/api/v2/qris/mutasi/${userId}`, bodyParams, cookies, token, username);
        const data = result.data;

        if (data?.success) {
          const infoAkun = data.account?.results || [];
          const mutasi = (data.qris_history?.results || []).map(item => {
            const kredit = cleanNominal(item.kredit || '0');
            const debet = cleanNominal(item.debet || '0');
            const saldoAkhir = cleanNominal(item.saldo_akhir || '0');
            const timestamp = parseTanggal(item.tanggal || '');

            return {
              tanggal: item.tanggal || '',
              timestamp: timestamp ? new Date(timestamp).getTime() / 1000 : 0,
              tanggal_iso: timestamp,
              status: item.status || 'UNKNOWN',
              kredit,
              kredit_formatted: formatRupiah(kredit),
              debet,
              debet_formatted: formatRupiah(debet),
              saldo_akhir: saldoAkhir,
              saldo_formatted: formatRupiah(saldoAkhir),
              brand: item.brand?.name || '',
              keterangan: item.keterangan || '',
            };
          });

          return res.json({
            success: true,
            info: infoAkun,
            mutasi,
            total: mutasi.length,
            page: parseInt(page),
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: data?.message || 'Gagal ambil mutasi' });
      }

      // ============================================
      // QRIS MENU & DINAMIS
      // ============================================

      /**
       * GET /api/orderkuota?action=qris-menu
       */
      case 'qris-menu': {
        const result = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account', 'requests[1]': 'qris_menu' }, cookies, token, username);
        const data = result.data;

        if (data?.success) {
          const infoAkun = data.account?.results || {};
          const qrisMenu = data.qris_menu?.results || {};

          return res.json({
            success: true,
            download_url: qrisMenu.download || '',
            qrcode: infoAkun.qrcode || '',
            qris: infoAkun.qris || '',
            qris_name: infoAkun.qris_name || '',
            info: infoAkun,
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: data?.message || 'Gagal ambil menu QRIS' });
      }

      /**
       * POST /api/orderkuota?action=qris-dynamic
       * Body: { nominal, token, userId, cookies }
       */
      case 'qris-dynamic': {
        const nominal = cleanNominal(body.nominal || body.amount || 0);
        if (!nominal || nominal < 100) {
          return res.status(400).json({ success: false, message: 'Nominal minimal Rp 100' });
        }

        // Step 1: Get QRIS Menu
        const menuResult = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account', 'requests[1]': 'qris_menu' }, cookies, token, username);
        
        if (!menuResult.data?.success) {
          return res.json({ success: false, message: 'Gagal ambil QRIS menu' });
        }

        const qrisUrl = menuResult.data.qris_menu?.results?.download 
                     || menuResult.data.account?.results?.qris 
                     || '';
        const qrisName = menuResult.data.account?.results?.qris_name || '';

        if (!qrisUrl) {
          return res.json({ success: false, message: 'QRIS URL tidak ditemukan' });
        }

        const refID = generateRefID();
        const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrisUrl);

        return res.json({
          success: true,
          data: {
            ref_id: refID,
            qris_string: qrisUrl,
            qr_image_url: qrImageUrl,
            nominal,
            nominal_formatted: formatRupiah(nominal),
            expired_at: new Date(Date.now() + 600000).toISOString(),
            qris_name: qrisName,
            note: 'QRIS Statis - Customer input nominal manual',
          },
          cookies: menuResult.cookies,
        });
      }

      // ============================================
      // PAYMENT
      // ============================================

      /**
       * POST /api/orderkuota?action=payment-create
       * Body: { amount, token, userId, cookies }
       */
      case 'payment-create': {
        const amount = parseInt(body.amount || 0);
        if (!amount || amount < 100) {
          return res.status(400).json({ success: false, message: 'Nominal minimal Rp 100' });
        }

        // Get QRIS dulu
        const menuResult = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account', 'requests[1]': 'qris_menu' }, cookies, token, username);
        
        if (!menuResult.data?.success) {
          return res.json({ success: false, message: 'Gagal ambil QRIS menu' });
        }

        const qrisUrl = menuResult.data.qris_menu?.results?.download 
                     || menuResult.data.account?.results?.qris 
                     || '';

        const refID = generateRefID();
        const qrImageUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=' + encodeURIComponent(qrisUrl);

        return res.json({
          success: true,
          message: 'QRIS berhasil dibuat!',
          data: {
            ref_id: refID,
            amount,
            amount_formatted: formatRupiah(amount),
            qr_image_url: qrImageUrl,
            qris_string: qrisUrl,
            status: 'pending',
            expired_at: new Date(Date.now() + 600000).toISOString(),
            created_at: new Date().toISOString(),
          },
          cookies: menuResult.cookies,
        });
      }

      /**
       * POST /api/orderkuota?action=payment-check
       * Body: { ref_id, amount, token, userId, cookies }
       */
      case 'payment-check': {
        const searchAmount = cleanNominal(body.amount || 0);
        
        // Get mutasi
        const bodyParams = {
          'requests[0]': 'account',
          'requests[qris_history][page]': '1',
          'requests[qris_history][keterangan]': '',
          'requests[qris_history][jumlah]': '',
          'requests[qris_history][dari_tanggal]': '',
          'requests[qris_history][ke_tanggal]': '',
        };

        const result = await sendToOrderkuota(`/api/v2/qris/mutasi/${userId}`, bodyParams, cookies, token, username);
        const data = result.data;

        if (!data?.success) {
          return res.json({ success: false, message: 'Gagal cek mutasi', paid: false });
        }

        const mutasi = data.qris_history?.results || [];
        const now = Date.now();
        const cutoff = now - (60 * 60 * 1000);

        let paid = false;
        let paymentDetail = null;

        for (const item of mutasi) {
          const kredit = cleanNominal(item.kredit || '0');
          const debet = cleanNominal(item.debet || '0');
          const itemTime = parseTanggal(item.tanggal || '');
          const itemTimestamp = itemTime ? new Date(itemTime).getTime() : 0;
          
          if (itemTimestamp < cutoff) continue;

          const status = (item.status || '').toUpperCase();
          const isIncoming = ['IN', 'CREDIT', 'MASUK', 'TOPUP', 'INCOMING'].includes(status)
                          || (kredit > 0 && debet === 0)
                          || (kredit >= searchAmount && !status);

          if (isIncoming && kredit >= searchAmount && searchAmount > 0) {
            paid = true;
            paymentDetail = {
              nominal: kredit,
              nominal_formatted: formatRupiah(kredit),
              brand: item.brand?.name || '',
              tanggal: item.tanggal || '',
              tanggal_iso: itemTime,
              timestamp: itemTimestamp,
              diff_minutes: Math.round((now - itemTimestamp) / 60000 * 100) / 100,
            };
            break;
          }
        }

        return res.json({
          success: true,
          paid,
          data: paymentDetail || { status: 'pending' },
          cookies: result.cookies,
        });
      }

      // ============================================
      // WITHDRAW QRIS
      // ============================================

      /**
       * POST /api/orderkuota?action=withdraw-qris
       * Body: { amount, token, userId, cookies }
       */
      case 'withdraw-qris': {
        const amount = cleanNominal(body.amount || 0);
        if (amount < 100) {
          return res.status(400).json({ success: false, message: 'Minimal withdraw Rp 100' });
        }

        // Cek saldo dulu
        const accResult = await sendToOrderkuota(`/api/v2/qris/menu/${userId}`, 
          { 'requests[0]': 'account' }, cookies, token, username);
        
        if (!accResult.data?.success) {
          return res.json({ success: false, message: 'Gagal cek saldo' });
        }

        const qrisBalance = cleanNominal(accResult.data.account?.results?.qris_balance || '0');
        if (qrisBalance < amount) {
          return res.json({
            success: false,
            message: `Saldo QRIS tidak cukup. Saldo: ${formatRupiah(qrisBalance)}`,
          });
        }

        const result = await sendToOrderkuota('/api/v2/get', {
          'requests[0]': 'account',
          'requests[qris_withdraw][amount]': amount,
        }, cookies, token, username);

        if (result.data?.success) {
          return res.json({
            success: true,
            message: 'Withdraw QRIS berhasil!',
            data: {
              withdrawn: amount,
              withdrawn_formatted: formatRupiah(amount),
              qris_balance_before: qrisBalance,
              qris_balance_after: qrisBalance - amount,
              qris_balance_formatted: formatRupiah(qrisBalance - amount),
            },
            cookies: result.cookies,
          });
        }

        return res.json({ success: false, message: result.data?.message || 'Gagal withdraw' });
      }

      /**
       * GET /api/orderkuota?action=withdraw-history&page=1
       */
      case 'withdraw-history': {
        const page = req.query.page || '1';

        const bodyParams = {
          'requests[0]': 'account',
          'requests[qris_history][page]': page,
          'requests[qris_history][keterangan]': '',
          'requests[qris_history][jumlah]': '',
          'requests[qris_history][dari_tanggal]': '',
          'requests[qris_history][ke_tanggal]': '',
        };

        const result = await sendToOrderkuota(`/api/v2/qris/mutasi/${userId}`, bodyParams, cookies, token, username);
        const data = result.data;

        if (!data?.success) {
          return res.json({ success: false, message: 'Gagal ambil mutasi' });
        }

        const mutasi = data.qris_history?.results || [];
        const withdraws = mutasi
          .filter(item => (item.status === 'OUT' || cleanNominal(item.debet || '0') > 0))
          .map(item => ({
            tanggal: item.tanggal || '',
            tanggal_iso: parseTanggal(item.tanggal || ''),
            jumlah: cleanNominal(item.debet || '0'),
            jumlah_formatted: formatRupiah(cleanNominal(item.debet || '0')),
            keterangan: item.keterangan || 'Withdraw QRIS',
          }));

        return res.json({
          success: true,
          withdraws,
          total: withdraws.length,
          page: parseInt(page),
          cookies: result.cookies,
        });
      }

      // ============================================
      // H2H OKECONNECT
      // ============================================

      /**
       * POST /api/orderkuota?action=h2h-order
       * Body: { product, dest, amount, refID }
       */
      case 'h2h-order': {
        const { product, dest, amount, refID } = body;
        if (!product || !dest) {
          return res.status(400).json({ success: false, message: 'Product & destination wajib' });
        }

        const result = await sendToH2H(product, dest, parseInt(amount || 0), refID);

        return res.json({
          success: result.statusCode === 200,
          refID: refID || generateRefID(),
          product,
          dest,
          httpCode: result.statusCode,
          data: result.data,
          raw: result.raw,
        });
      }

      /**
       * GET /api/orderkuota?action=h2h-check&product=X&dest=Y&refID=Z
       */
      case 'h2h-check': {
        const { product, dest, refID } = req.query;
        if (!product || !dest || !refID) {
          return res.status(400).json({ success: false, message: 'Product, dest, refID wajib' });
        }

        const params = new URLSearchParams({
          product, dest, refID,
          memberID: CONFIG.h2hMemberID,
          pin: CONFIG.h2hPin,
          password: CONFIG.h2hPassword,
          check: '1',
        });

        const url = CONFIG.h2hBaseUrl + '?' + params.toString();
        const response = await axios.get(url, { timeout: 30000 });

        return res.json({
          success: response.status === 200,
          refID,
          httpCode: response.status,
          data: response.data,
          raw: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
        });
      }

      /**
       * GET /api/orderkuota?action=h2h-balance
       */
      case 'h2h-balance': {
        const params = new URLSearchParams({
          memberID: CONFIG.h2hMemberID,
          pin: CONFIG.h2hPin,
          password: CONFIG.h2hPassword,
          cek_saldo: '1',
        });

        const url = CONFIG.h2hBaseUrl + '?' + params.toString();
        const response = await axios.get(url, { timeout: 30000 });
        const data = response.data;
        const raw = typeof data === 'string' ? data : JSON.stringify(data);

        // Parse saldo
        let saldo = 0;
        if (data?.saldo) saldo = cleanNominal(data.saldo);
        else if (data?.balance) saldo = cleanNominal(data.balance);
        else if (data?.data?.saldo) saldo = cleanNominal(data.data.saldo);

        // Coba parse dari string
        if (!saldo && typeof raw === 'string') {
          const match = raw.match(/saldo[:\s]+(\d+)/i);
          if (match) saldo = cleanNominal(match[1]);
        }

        return res.json({
          success: response.status === 200,
          saldo,
          saldo_formatted: formatRupiah(saldo),
          data,
          raw,
        });
      }

      // ============================================
      // ORDER LANGSUNG
      // ============================================

      /**
       * POST /api/orderkuota?action=order-langsung
       * Body: { product, destination, token, userId, cookies }
       */
      case 'order-langsung': {
        const { product, destination } = body;
        if (!product || !destination) {
          return res.status(400).json({ success: false, message: 'Product & destination wajib' });
        }

        const result = await sendToOrderkuota('/api/v2/order', {
          product,
          destination,
          payment_method: 'balance',
        }, cookies, token, username);

        return res.json({
          success: result.data?.success || false,
          data: result.data,
          cookies: result.cookies,
        });
      }

      // ============================================
      // CHECK E-WALLET
      // ============================================

      /**
       * POST /api/orderkuota?action=check-ewallet
       * Body: { provider, destination, token }
       */
      case 'check-ewallet': {
        const { provider, destination, token: ewalletToken } = body;
        const validProviders = ['dana', 'ovo', 'gopay', 'shopeepay', 'linkaja'];

        if (!validProviders.includes(provider?.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: 'Provider tidak valid',
            valid_providers: validProviders,
          });
        }

        const ewalletBody = {
          app_reg_id: 'cdzXkBynRECkAODZEHwkeV:APA91bHRyLlgNSlpVrC4Yv3xBgRRaePSaCYruHnNwrEK8_pX3kzitxzi0CxIDFc2oztCwcw7-zPgwE-6v_-rJCJdTX8qE_ADiSnWHNeZ5O7_BIlgS_1N8tw',
          phone_uuid: 'cdzXkBynRECkAODZEHwkeV',
          phone_model: 'SM-S928B',
          phoneNumber: destination,
          request_time: Date.now(),
          phone_android_version: '14',
          app_version_code: '250811',
          auth_username: username,
          customerId: '',
          id: provider.toLowerCase(),
          auth_token: ewalletToken || token,
          app_version_name: '25.08.11',
          ui_mode: 'dark',
        };

        try {
          const url = `${CONFIG.checkerUrl}/api/checkname/produk/bff66b406f/06/2604338/${provider.toLowerCase()}`;
          const response = await axios.post(url, new URLSearchParams(ewalletBody).toString(), {
            headers: {
              'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 14)',
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept-Encoding': 'gzip',
            },
            timeout: 30000,
          });

          return res.json({
            success: response.status === 200,
            data: response.data,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: 'Gagal cek e-wallet: ' + error.message,
          });
        }
      }

      // ============================================
      // TEST ENDPOINT
      // ============================================

      /**
       * POST /api/orderkuota?action=test
       * Body: { endpoint, params, cookies }
       */
      case 'test': {
        const { endpoint, params } = body;
        if (!endpoint) {
          return res.status(400).json({ success: false, message: 'Endpoint wajib' });
        }

        const result = await sendToOrderkuota(endpoint, params || {}, cookies, token, username);
        return res.json({
          success: true,
          data: result.data,
          statusCode: result.statusCode,
          cookies: result.cookies,
        });
      }

      // ============================================
      // DEFAULT
      // ============================================
      default:
        return res.status(400).json({
          success: false,
          message: 'Action tidak dikenal. Gunakan salah satu:',
          actions: {
            auth: ['request-otp', 'verify-otp', 'login-token', 'refresh-session'],
            account: ['account', 'balance'],
            data: ['mutasi', 'qris-menu', 'qris-dynamic'],
            payment: ['payment-create', 'payment-check'],
            withdraw: ['withdraw-qris', 'withdraw-history'],
            h2h: ['h2h-order', 'h2h-check', 'h2h-balance'],
            order: ['order-langsung'],
            ewallet: ['check-ewallet'],
            utility: ['test'],
          },
        });
    }

  } catch (error) {
    console.error('Relay Error:', error.message);
    
    // Tangkap error axios detail
    if (error.response) {
      return res.status(error.response.status || 500).json({
        success: false,
        message: 'Orderkuota error: ' + (error.response.data?.message || error.message),
        statusCode: error.response.status,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal relay error: ' + error.message,
    });
  }
}