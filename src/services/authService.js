const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const usuarioRepository = require('../repositories/usuarioRepository');
const assinaturaRepository = require('../repositories/assinaturaRepository');
const emailService = require('./emailService');
const AppError = require('../utils/appError');
const { isValidEmail } = require('../middlewares/validate');

class AuthService {
  async register({ nome, email, senha, perfil = 'OPERADOR' }) {
    if (!nome || !email || !senha) {
      throw new AppError('Nome, e-mail e senha são obrigatórios.', 400, 'MISSING_FIELDS');
    }

    if (!isValidEmail(email)) {
      throw new AppError('Formato de e-mail inválido.', 400, 'INVALID_EMAIL');
    }

    if (senha.length < 6) {
      throw new AppError('A senha deve conter no mínimo 6 caracteres.', 400, 'WEAK_PASSWORD');
    }

    const existingUser = await usuarioRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError('Já existe um usuário cadastrado com este e-mail.', 409, 'DUPLICATE_EMAIL');
    }

    const salt = await bcrypt.genSalt(10);
    const senha_hash = await bcrypt.hash(senha, salt);

    const user = await usuarioRepository.create({
      nome,
      email,
      senha_hash,
      perfil: perfil.toUpperCase()
    });

    // Criar assinatura inicial gratuita padrão
    const hoje = new Date().toISOString().split('T')[0];
    await assinaturaRepository.create({
      usuario_id: user.id,
      plano: 'FREE',
      data_inicio: hoje,
      status: 'ATIVO'
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      },
      token
    };
  }

  async login({ email, senha }) {
    if (!email || !senha) {
      throw new AppError('E-mail e senha são obrigatórios.', 400, 'MISSING_FIELDS');
    }

    const user = await usuarioRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(senha, user.senha_hash);
    if (!isMatch) {
      throw new AppError('Credenciais inválidas.', 401, 'INVALID_CREDENTIALS');
    }

    const assinatura = await assinaturaRepository.findByUsuarioId(user.id);
    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      },
      assinatura,
      token
    };
  }

  async getProfile(userId) {
    const user = await usuarioRepository.findById(userId);
    if (!user) {
      throw new AppError('Usuário não encontrado.', 404, 'USER_NOT_FOUND');
    }

    const assinatura = await assinaturaRepository.findByUsuarioId(userId);

    return {
      user,
      assinatura
    };
  }

  async verificarResetCode({ email, codigo }) {
    if (!email || !codigo) throw new AppError('E-mail e código são obrigatórios.', 400, 'MISSING_FIELDS');
    const user = await usuarioRepository.findByEmail(email);
    if (!user) throw new AppError('Código inválido ou expirado.', 400, 'INVALID_CODE');
    if (!user.senha_reset_token) throw new AppError('Código inválido ou expirado.', 400, 'INVALID_CODE');
    const tokenExp = new Date(user.reset_token_expira || 0);
    if (tokenExp < new Date()) throw new AppError('Código expirado.', 400, 'CODE_EXPIRED');
    if (user.senha_reset_token !== codigo) throw new AppError('Código inválido.', 400, 'INVALID_CODE');
    return { message: 'Código validado com sucesso.', valid: true };
  }

  async confirmarResetFront({ email, codigo, novaSenha }) {
    if (!email || !codigo) throw new AppError('E-mail e código são obrigatórios.', 400, 'MISSING_FIELDS');
    if (!novaSenha || novaSenha.length < 6) throw new AppError('Senha muito curta.', 400, 'WEAK_PASSWORD');
    const user = await usuarioRepository.findByEmail(email);
    if (!user) throw new AppError('Código inválido ou expirado.', 400, 'INVALID_TOKEN');
    if (!user.senha_reset_token || user.senha_reset_token !== codigo) throw new AppError('Código inválido.', 400, 'INVALID_TOKEN');
    const tokenExp = new Date(user.reset_token_expira || 0);
    if (tokenExp < new Date()) throw new AppError('Código expirado.', 400, 'CODE_EXPIRED');
    const salt = await bcrypt.genSalt(10);
    await usuarioRepository.updateSenha(user.id, await bcrypt.hash(novaSenha, salt));
    await usuarioRepository.updateResetToken(user.id, null, null);
    return { message: 'Senha redefinida com sucesso.' };
  }

  async solicitarReset({ email }) {
    const user = await usuarioRepository.findByEmail(email);
    let codigo = null;
    let previewUrl = null;
    if (user) {
      // Gera um codigo numerico de 6 digitos (em vez de token hex)
      codigo = crypto.randomInt(100000, 999999).toString();
      const expiraEm = new Date(Date.now() + 3600000).toISOString().slice(0, 19).replace('T', ' ');
      await usuarioRepository.updateResetToken(user.id, token, expiraEm);

      console.log('\n====================================================');
      console.log(`🔑 [REDEFINIÇÃO DE SENHA]`);
      console.log(`📧 E-mail: ${email}`);
      console.log(`🎟️  Token: ${token}`);
      console.log('====================================================\n');

      // Dispara o e-mail via servico SMTP
      const emailResult = await emailService.sendPasswordResetEmail({
        email: user.email,
        nome: user.nome,
        token: codigo,
      });

      if (emailResult && emailResult.previewUrl) {
        previewUrl = emailResult.previewUrl;
      }
    }
    return {
      message: 'Se o e-mail estiver cadastrado, você receberá instruções por e-mail.',
      ...(process.env.NODE_ENV === 'development' && codigo ? { devCode: codigo, ...(previewUrl ? { previewUrl } : {}) } : {})
    };
  }

  async confirmarReset({ token, novaSenha }) {
    const user = await usuarioRepository.findByResetToken(token);
    if (!user) throw new AppError('Token inválido ou expirado.', 400, 'INVALID_TOKEN');
    if (!novaSenha || novaSenha.length < 6) throw new AppError('Senha muito curta.', 400, 'WEAK_PASSWORD');
    const salt = await bcrypt.genSalt(10);
    await usuarioRepository.updateSenha(user.id, await bcrypt.hash(novaSenha, salt));
    await usuarioRepository.updateResetToken(user.id, null, null);
    return { message: 'Senha redefinida com sucesso.' };
  }

  generateToken(user) {
    const secret = process.env.JWT_SECRET || 'kstock_secret_key_default';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    return jwt.sign(
      {
        id: user.id,
        nome: user.nome,
        email: user.email,
        perfil: user.perfil
      },
      secret,
      { expiresIn }
    );
  }
}

module.exports = new AuthService();
