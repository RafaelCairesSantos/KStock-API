const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyJWT = require('../middlewares/verifyJWT');
const { validateBody } = require('../middlewares/validate');

router.post('/register', validateBody(['nome', 'email', 'senha']), authController.register);
router.post('/login', validateBody(['email', 'senha']), authController.login);
router.post('/forgot-password', validateBody(['email']), authController.solicitarReset);
router.post('/verify-reset-code', validateBody(['email', 'codigo']), authController.verificarResetCode);
router.post('/reset-password', validateBody(['email', 'codigo', 'novaSenha']), authController.confirmarResetFront);
router.post('/esqueci-senha', validateBody(['email']), authController.solicitarReset); // alias para compatibilidade
router.post('/resetar-senha', validateBody(['token', 'novaSenha']), authController.confirmarReset); // alias legado
router.get('/me', verifyJWT, authController.me);

module.exports = router;
