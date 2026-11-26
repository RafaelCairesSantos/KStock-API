const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyJWT = require('../middlewares/verifyJWT');
const { validateBody } = require('../middlewares/validate');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // máximo de 20 requisições por IP na janela
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas requisições deste IP. Tente novamente em 15 minutos.'
    }
  }
});

router.post('/register', authLimiter, validateBody(['nome', 'email', 'senha']), authController.register);
router.post('/login', authLimiter, validateBody(['email', 'senha']), authController.login);
// Rotas de recuperação de senha com suporte a pt-BR e en-US
router.post('/esqueci-senha', authLimiter, validateBody(['email']), authController.solicitarReset);
router.post('/forgot-password', authLimiter, validateBody(['email']), authController.solicitarReset);
router.post('/resetar-senha', authLimiter, validateBody(['novaSenha']), authController.confirmarReset);
router.post('/reset-password', authLimiter, validateBody(['novaSenha']), authController.confirmarReset);
router.get('/me', verifyJWT, authController.me);

router.authLimiter = authLimiter;

module.exports = router;
