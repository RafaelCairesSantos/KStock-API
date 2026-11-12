jest.mock('../../src/repositories/usuarioRepository');
jest.mock('../../src/repositories/assinaturaRepository');
jest.mock('../../src/services/emailService');

const authService = require('../../src/services/authService');
const usuarioRepository = require('../../src/repositories/usuarioRepository');
const assinaturaRepository = require('../../src/repositories/assinaturaRepository');
const emailService = require('../../src/services/emailService');
const AppError = require('../../src/utils/appError');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('deve registrar usuário com sucesso, hashear senha e criar assinatura FREE', async () => {
      usuarioRepository.findByEmail.mockResolvedValue(null);
      usuarioRepository.create.mockImplementation(async (dados) => ({
        id: 10,
        nome: dados.nome,
        email: dados.email,
        perfil: dados.perfil
      }));
      assinaturaRepository.create.mockResolvedValue({ id: 1 });

      const result = await authService.register({
        nome: 'João Silva',
        email: 'joao@kstock.com',
        senha: 'senhaSegura123',
        perfil: 'OPERADOR'
      });

      expect(usuarioRepository.findByEmail).toHaveBeenCalledWith('joao@kstock.com');
      expect(usuarioRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        nome: 'João Silva',
        email: 'joao@kstock.com',
        perfil: 'OPERADOR'
      }));
      expect(assinaturaRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        usuario_id: 10,
        plano: 'FREE',
        status: 'ATIVO'
      }));
      expect(result).toHaveProperty('token');
      expect(result.user).toEqual({
        id: 10,
        nome: 'João Silva',
        email: 'joao@kstock.com',
        perfil: 'OPERADOR'
      });
    });

    it('deve lançar erro se faltar nome, email ou senha', async () => {
      await expect(authService.register({ nome: '', email: 'a@b.com', senha: '123' }))
        .rejects.toThrow(new AppError('Nome, e-mail e senha são obrigatórios.', 400, 'MISSING_FIELDS'));
    });

    it('deve lançar erro para e-mail com formato inválido', async () => {
      await expect(authService.register({ nome: 'Teste', email: 'emailinvalido', senha: '123456' }))
        .rejects.toThrow(new AppError('Formato de e-mail inválido.', 400, 'INVALID_EMAIL'));
    });

    it('deve lançar erro se a senha tiver menos de 6 caracteres', async () => {
      await expect(authService.register({ nome: 'Teste', email: 'teste@kstock.com', senha: '123' }))
        .rejects.toThrow(new AppError('A senha deve conter no mínimo 6 caracteres.', 400, 'WEAK_PASSWORD'));
    });

    it('deve lançar erro 409 se o e-mail já estiver cadastrado', async () => {
      usuarioRepository.findByEmail.mockResolvedValue({ id: 1, email: 'existente@kstock.com' });

      await expect(authService.register({
        nome: 'Novo',
        email: 'existente@kstock.com',
        senha: 'senhaSegura123'
      })).rejects.toThrow(new AppError('Já existe um usuário cadastrado com este e-mail.', 409, 'DUPLICATE_EMAIL'));
    });
  });

  describe('login', () => {
    it('deve autenticar usuário com sucesso e retornar token e perfil', async () => {
      const senhaHash = await bcrypt.hash('minhaSenha123', 10);
      usuarioRepository.findByEmail.mockResolvedValue({
        id: 5,
        nome: 'Maria Gestora',
        email: 'maria@kstock.com',
        senha_hash: senhaHash,
        perfil: 'GERENTE'
      });
      assinaturaRepository.findByUsuarioId.mockResolvedValue({ plano: 'PRO', status: 'ATIVO' });

      const result = await authService.login({
        email: 'maria@kstock.com',
        senha: 'minhaSenha123'
      });

      expect(result).toHaveProperty('token');
      expect(result.user.id).toBe(5);
      expect(result.user.perfil).toBe('GERENTE');
      expect(result.assinatura.plano).toBe('PRO');
    });

    it('deve falhar com 401 INVALID_CREDENTIALS quando usuário não existe', async () => {
      usuarioRepository.findByEmail.mockResolvedValue(null);

      await expect(authService.login({
        email: 'naoexiste@kstock.com',
        senha: 'qualquersenha'
      })).rejects.toThrow(new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS'));
    });

    it('deve falhar com 401 INVALID_CREDENTIALS quando a senha está incorreta', async () => {
      const senhaHash = await bcrypt.hash('senhaCerta', 10);
      usuarioRepository.findByEmail.mockResolvedValue({
        id: 1,
        email: 'usuario@kstock.com',
        senha_hash: senhaHash
      });

      await expect(authService.login({
        email: 'usuario@kstock.com',
        senha: 'senhaErrada'
      })).rejects.toThrow(new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS'));
    });
  });

  describe('solicitarReset', () => {
    it('deve gerar código numérico de 6 dígitos e disparar e-mail de recuperação', async () => {
      usuarioRepository.findByEmail.mockResolvedValue({
        id: 1,
        nome: 'Carlos',
        email: 'carlos@kstock.com'
      });
      usuarioRepository.updateResetToken.mockResolvedValue(true);
      emailService.sendPasswordResetEmail.mockResolvedValue({ success: true });

      const result = await authService.solicitarReset({ email: 'carlos@kstock.com' });

      expect(usuarioRepository.updateResetToken).toHaveBeenCalledWith(
        1,
        expect.stringMatching(/^\d{6}$/),
        expect.any(String)
      );
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(expect.objectContaining({
        email: 'carlos@kstock.com',
        nome: 'Carlos',
        token: expect.stringMatching(/^\d{6}$/)
      }));
      expect(result.message).toContain('Se o e-mail estiver cadastrado');
    });

    it('deve retornar mensagem padrão sem lançar erro quando usuário não for encontrado', async () => {
      usuarioRepository.findByEmail.mockResolvedValue(null);

      const result = await authService.solicitarReset({ email: 'fantasma@kstock.com' });

      expect(usuarioRepository.updateResetToken).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toContain('Se o e-mail estiver cadastrado');
    });
  });

  describe('confirmarReset', () => {
    it('deve atualizar senha com hash e limpar token de reset', async () => {
      usuarioRepository.findByResetToken.mockResolvedValue({
        id: 7,
        nome: 'Lucas',
        email: 'lucas@kstock.com'
      });
      usuarioRepository.updateSenha.mockResolvedValue(true);
      usuarioRepository.updateResetToken.mockResolvedValue(true);

      const result = await authService.confirmarReset({
        codigo: '654321',
        novaSenha: 'novaSenhaForte123'
      });

      expect(usuarioRepository.findByResetToken).toHaveBeenCalledWith('654321');
      expect(usuarioRepository.updateSenha).toHaveBeenCalledWith(7, expect.any(String));
      expect(usuarioRepository.updateResetToken).toHaveBeenCalledWith(7, null, null);
      expect(result.message).toContain('Senha redefinida com sucesso');
    });

    it('deve rejeitar código inválido ou expirado', async () => {
      usuarioRepository.findByResetToken.mockResolvedValue(null);

      await expect(authService.confirmarReset({
        codigo: '000000',
        novaSenha: 'novaSenha123'
      })).rejects.toThrow(new AppError('Código de verificação inválido ou expirado.', 400, 'INVALID_TOKEN'));
    });

    it('deve rejeitar nova senha muito curta', async () => {
      usuarioRepository.findByResetToken.mockResolvedValue({ id: 1 });

      await expect(authService.confirmarReset({
        codigo: '123456',
        novaSenha: '123'
      })).rejects.toThrow(new AppError('A senha deve conter no mínimo 6 caracteres.', 400, 'WEAK_PASSWORD'));
    });
  });

  describe('generateToken', () => {
    it('deve gerar JWT válido contendo os dados do payload', () => {
      const user = { id: 3, nome: 'Ana', email: 'ana@kstock.com', perfil: 'ADMIN' };
      const token = authService.generateToken(user);
      expect(typeof token).toBe('string');

      const secret = process.env.JWT_SECRET || 'kstock_secret_key_default';
      const decoded = jwt.verify(token, secret);
      expect(decoded.id).toBe(3);
      expect(decoded.nome).toBe('Ana');
      expect(decoded.email).toBe('ana@kstock.com');
      expect(decoded.perfil).toBe('ADMIN');
    });
  });
});
