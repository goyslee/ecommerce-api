// routes\userRoutes.js 
const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();

router.post('/register', userController.register);
router.get('/users/:userid', userController.getUserById);
router.put('/users/:userid', userController.updateUser);
router.delete('/users/:userid', userController.deleteUser);

module.exports = router;
