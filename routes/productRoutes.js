// routes\productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

router.post('/products', productController.addProduct);
router.get('/products', productController.getAllProducts);
router.get('/products/:productid', productController.getProductById);
router.put('/products/:productid', productController.updateProduct);
router.delete('/products/:productid', productController.deleteProduct);

module.exports = router;

