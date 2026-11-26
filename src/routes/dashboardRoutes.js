const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const verifyJWT = require('../middlewares/verifyJWT');

router.use(verifyJWT);

router.get('/resumo', dashboardController.resumo);

module.exports = router;
