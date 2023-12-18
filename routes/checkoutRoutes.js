// routes\checkoutRoutes.js
const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');

router.post('/cart/:cartId/checkout', checkoutController.checkout);

module.exports = router;
