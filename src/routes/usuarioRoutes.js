const express = require('express');
const router = express.Router();
const usuarioController = require('../controllers/usuarioController');
const verifyJWT = require('../middlewares/verifyJWT');
const verifyRole = require('../middlewares/verifyRole');
const { validateBody } = require('../middlewares/validate');
const AppError = require('../utils/appError');

/**
 * Garante que apenas ADMIN ou o próprio usuário acessem/editem o recurso (previne BOLA/IDOR).
 */
function authorizeSelfOrAdmin(req, res, next) {
  if (!req.user) {
    return next(new AppError('Usuário não autenticado.', 401, 'UNAUTHORIZED'));
  }

  if (req.user.perfil === 'ADMIN' || Number(req.user.id) === Number(req.params.id)) {
    return next();
  }

  return next(
    new AppError(
      'Acesso negado. Você não tem permissão para visualizar ou editar dados de outro usuário.',
      403,
      'FORBIDDEN'
    )
  );
}

router.use(verifyJWT);

router.get('/', verifyRole('ADMIN'), usuarioController.list);
router.post('/', verifyRole('ADMIN'), validateBody(['nome', 'email', 'senha', 'perfil']), usuarioController.create);
router.get('/:id', authorizeSelfOrAdmin, usuarioController.getById);
router.put('/:id', authorizeSelfOrAdmin, usuarioController.update);
router.patch('/:id/perfil', verifyRole('ADMIN'), validateBody(['perfil']), usuarioController.updatePerfil);
router.delete('/:id', verifyRole('ADMIN'), usuarioController.delete);

router.authorizeSelfOrAdmin = authorizeSelfOrAdmin;

module.exports = router;
