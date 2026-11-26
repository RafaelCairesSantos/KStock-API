jest.mock('../../src/repositories/usuarioRepository');

const usuarioService = require('../../src/services/usuarioService');
const usuarioRepository = require('../../src/repositories/usuarioRepository');
const AppError = require('../../src/utils/appError');

describe('UsuarioService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('deleteUser', () => {
    it('deve impedir exclusão do próprio usuário logado', async () => {
      await expect(usuarioService.deleteUser(5, 5))
        .rejects.toThrow(new AppError('Não é permitido excluir o próprio usuário logado.', 400, 'CANNOT_DELETE_SELF'));
    });

    it('deve impedir exclusão do único ADMIN restante no sistema', async () => {
      usuarioRepository.findById.mockResolvedValue({ id: 1, nome: 'Root', email: 'admin@kstock.com', perfil: 'ADMIN' });
      usuarioRepository.countByPerfil.mockResolvedValue(1);

      await expect(usuarioService.deleteUser(1, 99))
        .rejects.toThrow(new AppError('Não é possível excluir o único administrador do sistema.', 400, 'LAST_ADMIN_PROTECTION'));

      expect(usuarioRepository.countByPerfil).toHaveBeenCalledWith('ADMIN');
      expect(usuarioRepository.delete).not.toHaveBeenCalled();
    });

    it('deve permitir excluir ADMIN quando existir mais de um ADMIN', async () => {
      usuarioRepository.findById.mockResolvedValue({ id: 2, nome: 'Admin 2', email: 'admin2@kstock.com', perfil: 'ADMIN' });
      usuarioRepository.countByPerfil.mockResolvedValue(2);
      usuarioRepository.delete.mockResolvedValue(true);

      const result = await usuarioService.deleteUser(2, 1);

      expect(result).toBe(true);
      expect(usuarioRepository.delete).toHaveBeenCalledWith(2);
    });

    it('deve permitir excluir OPERADOR sem consultar contagem de ADMIN', async () => {
      usuarioRepository.findById.mockResolvedValue({ id: 3, nome: 'Operador', email: 'op@kstock.com', perfil: 'OPERADOR' });
      usuarioRepository.delete.mockResolvedValue(true);

      const result = await usuarioService.deleteUser(3, 1);

      expect(result).toBe(true);
      expect(usuarioRepository.countByPerfil).not.toHaveBeenCalled();
      expect(usuarioRepository.delete).toHaveBeenCalledWith(3);
    });
  });
});
