// routes\cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

router.post('/cart/add', cartController.addItemToCart);
router.put('/cart/:itemId', cartController.updateCartItem);
router.delete('/cart/:itemId', cartController.deleteCartItem);
router.get('/cart', cartController.showCart); // New route for showing the cart

module.exports = router;
