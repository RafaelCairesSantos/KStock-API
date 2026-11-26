jest.mock('../../src/db/connect', () => ({
  query: jest.fn(),
  ping: jest.fn().mockResolvedValue(true),
  withTransaction: jest.fn()
}));
jest.mock('../../src/repositories/usuarioRepository');
jest.mock('../../src/repositories/dashboardRepository');
jest.mock('../../src/repositories/movimentacaoRepository');

process.env.FRONTEND_URL = 'http://localhost:5173, https://keepstock.vercel.app';

const app = require('../../src/server');
const usuarioRoutes = require('../../src/routes/usuarioRoutes');
const authRoutes = require('../../src/routes/authRoutes');
const dashboardRoutes = require('../../src/routes/dashboardRoutes');
const dashboardController = require('../../src/controllers/dashboardController');
const movimentacaoController = require('../../src/controllers/movimentacaoController');
const dashboardRepository = require('../../src/repositories/dashboardRepository');
const movimentacaoRepository = require('../../src/repositories/movimentacaoRepository');
const AppError = require('../../src/utils/appError');

function findRouteLayers(router, path, method) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method]
  );
  return layer ? layer.route.stack.map((s) => s.handle) : [];
}

describe('Segurança, Rotas, CORS e Novos Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('BOLA/IDOR em /api/v1/usuarios/:id', () => {
    const { authorizeSelfOrAdmin } = usuarioRoutes;

    it('deve registrar authorizeSelfOrAdmin nas rotas GET /:id e PUT /:id', () => {
      expect(findRouteLayers(usuarioRoutes, '/:id', 'get')).toContain(authorizeSelfOrAdmin);
      expect(findRouteLayers(usuarioRoutes, '/:id', 'put')).toContain(authorizeSelfOrAdmin);
    });

    it('deve bloquear OPERADOR tentando acessar ou editar outro usuário (403)', () => {
      const req = { user: { id: 10, perfil: 'OPERADOR' }, params: { id: '20' } };
      const next = jest.fn();

      authorizeSelfOrAdmin(req, {}, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(next.mock.calls[0][0].code).toBe('FORBIDDEN');
    });

    it('deve bloquear GERENTE tentando acessar ou editar outro usuário (403)', () => {
      const req = { user: { id: 10, perfil: 'GERENTE' }, params: { id: '20' } };
      const next = jest.fn();

      authorizeSelfOrAdmin(req, {}, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });

    it('deve permitir acesso ao próprio usuário quando IDs coincidem', () => {
      const req = { user: { id: 10, perfil: 'OPERADOR' }, params: { id: '10' } };
      const next = jest.fn();

      authorizeSelfOrAdmin(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });

    it('deve permitir ADMIN acessar ou editar qualquer usuário', () => {
      const req = { user: { id: 1, perfil: 'ADMIN' }, params: { id: '99' } };
      const next = jest.fn();

      authorizeSelfOrAdmin(req, {}, next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('Dashboard Resumo (/api/v1/dashboard/resumo)', () => {
    it('deve proteger /dashboard com verifyJWT', () => {
      const hasVerifyJWT = dashboardRoutes.stack.some(
        (layer) => layer.handle && layer.handle.name === 'verifyJWT'
      );
      expect(hasVerifyJWT).toBe(true);
    });

    it('deve retornar os indicadores consolidados com status 200', async () => {
      dashboardRepository.getResumo.mockResolvedValue({
        totalProdutos: 25,
        totalEstoqueFisico: 500,
        itensEstoqueBaixo: 4,
        movimentacoesTotal: 112
      });

      const req = {};
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await dashboardController.resumo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalProdutos: 25,
        totalEstoqueFisico: 500,
        itensEstoqueBaixo: 4,
        movimentacoesTotal: 112
      });
    });
  });

  describe('Sazonalidade de Vendas (GET /api/v1/movimentacoes/vendas-mensais)', () => {
    it('deve aceitar ano, categoria_id e produto_id e retornar contrato esperado', async () => {
      movimentacaoRepository.getVendasMensais.mockResolvedValue([
        { mes: 5, ano: 2026, total_saidas: 120, total_transacoes: 4 }
      ]);

      const req = { query: { ano: '2026', categoria_id: '2', produto_id: '8' } };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      await movimentacaoController.vendasMensais(req, res, next);

      expect(movimentacaoRepository.getVendasMensais).toHaveBeenCalledWith({
        ano: 2026,
        categoria_id: 2,
        produto_id: 8
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          dadosMensais: expect.any(Array),
          mesMaisVendido: expect.objectContaining({ mesNumero: 5, mesNome: 'Mai', totalSaidas: 120 }),
          mesMenosVendido: expect.objectContaining({ mesNumero: 5, mesNome: 'Mai', totalSaidas: 120 }),
          totalAnualSaidas: 120,
          mediaMensal: 10
        })
      );
    });
  });

  describe('Rate Limiting em /api/v1/auth', () => {
    it('deve aplicar authLimiter em /register, /login e /esqueci-senha', () => {
      const { authLimiter } = authRoutes;
      expect(findRouteLayers(authRoutes, '/register', 'post')).toContain(authLimiter);
      expect(findRouteLayers(authRoutes, '/login', 'post')).toContain(authLimiter);
      expect(findRouteLayers(authRoutes, '/esqueci-senha', 'post')).toContain(authLimiter);
    });
  });

  describe('Configuração de CORS', () => {
    function getCorsMiddleware() {
      const layer = app._router.stack.find(
        (l) => l.handle && l.handle.name === 'corsMiddleware'
      );
      return layer ? layer.handle : null;
    }

    it('deve permitir origens configuradas em FRONTEND_URL (localhost e Vercel)', (done) => {
      const corsMiddleware = getCorsMiddleware();
      expect(corsMiddleware).toBeTruthy();

      const req = {
        method: 'GET',
        headers: { origin: 'https://keepstock.vercel.app' }
      };
      const headers = {};
      const res = {
        getHeader: (name) => headers[name.toLowerCase()],
        setHeader: (name, val) => { headers[name.toLowerCase()] = val; }
      };

      corsMiddleware(req, res, (err) => {
        expect(err).toBeUndefined();
        expect(headers['access-control-allow-origin']).toBe('https://keepstock.vercel.app');
        done();
      });
    });

    it('deve rejeitar origem não autorizada com AppError 403', (done) => {
      const corsMiddleware = getCorsMiddleware();
      const req = {
        method: 'GET',
        headers: { origin: 'https://malicious-site.example.com' }
      };
      const res = {
        getHeader: () => undefined,
        setHeader: () => {}
      };

      corsMiddleware(req, res, (err) => {
        expect(err).toBeInstanceOf(AppError);
        expect(err.statusCode).toBe(403);
        expect(err.code).toBe('CORS_NOT_ALLOWED');
        done();
      });
    });
  });
});
