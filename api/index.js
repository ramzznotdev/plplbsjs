/**
 * Nama File: api/index.js
 * Proyek: RAMZZPAY Relay
 * Deskripsi: Health check endpoint
 */

export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'RAMZZPAY Relay API v1.0',
    status: 'online',
    time: new Date().toISOString(),
    endpoints: {
      health: '/api',
      requestOTP: 'POST /api/orderkuota?action=request-otp',
      verifyOTP: 'POST /api/orderkuota?action=verify-otp',
      loginToken: 'POST /api/orderkuota?action=login-token',
      accountInfo: 'GET /api/orderkuota?action=account',
      mutasi: 'GET /api/orderkuota?action=mutasi',
      paymentCreate: 'POST /api/orderkuota?action=payment-create',
      paymentCheck: 'POST /api/orderkuota?action=payment-check',
      checkEwallet: 'POST /api/orderkuota?action=check-ewallet',
    }
  });
}