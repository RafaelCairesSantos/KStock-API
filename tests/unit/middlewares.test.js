const { validateBody, isValidEmail } = require('../../src/middlewares/validate');
const verifyJWT = require('../../src/middlewares/verifyJWT');
const verifyRole = require('../../src/middlewares/verifyRole');
const errorHandler = require('../../src/middlewares/errorHandler');
const AppError = require('../../src/utils/appError');
const jwt = require('jsonwebtoken');

describe('Middlewares', () => {
  describe('validateBody', () => {
    it('deve chamar next() quando todos os campos obrigatórios estão presentes', () => {
      const middleware = validateBody(['nome', 'email']);
      const req = { body: { nome: 'Teste', email: 'teste@email.com' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('deve retornar AppError 400 com campos ausentes', () => {
      const middleware = validateBody(['nome', 'email', 'senha']);
      const req = { body: { nome: 'Teste' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(error.details.missingFields).toEqual(['email', 'senha']);
    });
  });

  describe('isValidEmail', () => {
    it('deve validar e-mails com formato correto', () => {
      expect(isValidEmail('usuario@dominio.com')).toBe(true);
      expect(isValidEmail('teste.dev@empresa.com.br')).toBe(true);
    });

    it('deve rejeitar e-mails em formato inválido', () => {
      expect(isValidEmail('email-sem-arroba')).toBe(false);
      expect(isValidEmail('usuario@')).toBe(false);
      expect(isValidEmail('@dominio.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });
  });

  describe('verifyJWT', () => {
    const secret = process.env.JWT_SECRET || 'kstock_secret_key_default';

    it('deve barrar requisições sem header Authorization com 401 UNAUTHORIZED', () => {
      const req = { headers: {} };
      const res = {};
      const next = jest.fn();

      verifyJWT(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
      expect(next.mock.calls[0][0].code).toBe('UNAUTHORIZED');
    });

    it('deve barrar header com formato inválido (sem Bearer)', () => {
      const req = { headers: { authorization: 'TokenInvalido' } };
      const res = {};
      const next = jest.fn();

      verifyJWT(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].code).toBe('MALFORMATTED_TOKEN');
    });

    it('deve autenticar com token válido e anexar req.user', () => {
      const payload = { id: 1, nome: 'Admin', email: 'admin@kstock.com', perfil: 'ADMIN' };
      const token = jwt.sign(payload, secret);

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {};
      const next = jest.fn();

      verifyJWT(req, res, next);
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toEqual({
        id: 1,
        nome: 'Admin',
        email: 'admin@kstock.com',
        perfil: 'ADMIN'
      });
    });

    it('deve rejeitar token expirado com TOKEN_EXPIRED', () => {
      const payload = { id: 1, nome: 'Expirado', email: 'exp@kstock.com' };
      const token = jwt.sign(payload, secret, { expiresIn: -10 });

      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {};
      const next = jest.fn();

      verifyJWT(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('verifyRole', () => {
    it('deve barrar se req.user não existir', () => {
      const middleware = verifyRole('ADMIN');
      const req = {};
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(401);
    });

    it('deve permitir acesso se perfil do usuário estiver autorizado', () => {
      const middleware = verifyRole('ADMIN', 'GERENTE');
      const req = { user: { perfil: 'ADMIN' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('deve bloquear acesso com 403 FORBIDDEN se perfil não estiver autorizado', () => {
      const middleware = verifyRole('ADMIN');
      const req = { user: { perfil: 'OPERADOR' } };
      const res = {};
      const next = jest.fn();

      middleware(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });
  });

  describe('errorHandler', () => {
    it('deve responder formatando instâncias de AppError', () => {
      const error = new AppError('Registro não encontrado', 404, 'NOT_FOUND');
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'NOT_FOUND',
          message: 'Registro não encontrado'
        }
      });
    });

    it('deve mapear erros genéricos para 500 INTERNAL_SERVER_ERROR', () => {
      const error = new Error('Falha no disco');
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Falha no disco'
        }
      });
    });

    it('deve mapear erro ER_DUP_ENTRY para 409 DUPLICATE_ENTRY', () => {
      const error = new Error('Duplicate');
      error.code = 'ER_DUP_ENTRY';
      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      errorHandler(error, req, res, next);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'DUPLICATE_ENTRY',
          message: expect.stringContaining('Já existe um registro')
        }
      });
    });
  });
});
