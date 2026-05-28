/**
 * Nama File: index.js
 * Proyek: RAMZZPAY Relay API
 * Deskripsi: Entry point - Express server untuk relay Orderkuota
 * Dibuat: 2026-05-28
 */

const express = require('express');
const cors = require('cors');
const orderkuotaRoutes = require('./routes/orderkuota');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes - PASTIKAN pakai app.use dengan router
app.use(orderkuotaRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'RAMZZPAY Relay API v1.0',
    status: 'online',
    time: new Date().toISOString(),
    docs: '/docs',
  });
});

// Dokumentasi endpoint
app.get('/docs', (req, res) => {
  res.json({
    success: true,
    api_name: 'RAMZZPAY Relay API',
    version: '1.0.0',
    endpoints: {
      health: 'GET /',
      docs: 'GET /docs',
      requestOTP: 'POST /api/request-otp',
      verifyOTP: 'POST /api/verify-otp',
      loginToken: 'POST /api/login-token',
      refreshSession: 'POST /api/refresh-session',
      account: 'POST /api/account',
      balance: 'POST /api/balance',
      mutasi: 'POST /api/mutasi',
      qrisMenu: 'POST /api/qris-menu',
      qrisDynamic: 'POST /api/qris-dynamic',
      paymentCreate: 'POST /api/payment-create',
      paymentCheck: 'POST /api/payment-check',
      withdrawQris: 'POST /api/withdraw-qris',
      withdrawHistory: 'POST /api/withdraw-history',
      h2hOrder: 'POST /api/h2h-order',
      h2hCheck: 'POST /api/h2h-check',
      h2hBalance: 'POST /api/h2h-balance',
      orderLangsung: 'POST /api/order-langsung',
      checkEwallet: 'POST /api/check-ewallet',
      testEndpoint: 'POST /api/test',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
    path: req.originalUrl,
    docs: '/docs',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

// Export untuk Vercel
module.exports = app;

// Start server lokal
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`RAMZZPAY Relay API running on http://localhost:${PORT}`);
  });
}
