jest.mock('../../src/db/connect');
jest.mock('../../src/repositories/movimentacaoRepository');
jest.mock('../../src/repositories/produtoRepository');
jest.mock('../../src/repositories/historicoRepository');

const movimentacaoService = require('../../src/services/movimentacaoService');
const db = require('../../src/db/connect');
const movimentacaoRepository = require('../../src/repositories/movimentacaoRepository');
const produtoRepository = require('../../src/repositories/produtoRepository');
const historicoRepository = require('../../src/repositories/historicoRepository');
const AppError = require('../../src/utils/appError');

describe('MovimentacaoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock padrão de transação atômica que repassa uma conexão fake e executa o callback
    db.withTransaction.mockImplementation(async (callback) => {
      const fakeConnection = {};
      return await callback(fakeConnection);
    });
  });

  describe('createMovimentacao', () => {
    it('deve validar campos obrigatórios (usuario_id, produto_id, tipo, quantidade)', async () => {
      await expect(movimentacaoService.createMovimentacao({}))
        .rejects.toThrow(new AppError('Usuário, produto, tipo e quantidade são obrigatórios.', 400, 'MISSING_FIELDS'));
    });

    it('deve rejeitar tipo inválido de movimentação', async () => {
      await expect(movimentacaoService.createMovimentacao({
        usuario_id: 1,
        produto_id: 1,
        tipo: 'DOACAO',
        quantidade: 10
      })).rejects.toThrow(expect.objectContaining({ code: 'INVALID_TYPE' }));
    });

    it('deve rejeitar quantidade negativa ou zerada para ENTRADA', async () => {
      await expect(movimentacaoService.createMovimentacao({
        usuario_id: 1,
        produto_id: 1,
        tipo: 'ENTRADA',
        quantidade: 0
      })).rejects.toThrow(expect.objectContaining({ code: 'INVALID_QUANTITY' }));
    });

    it('deve registrar ENTRADA somando ao estoque atual com lock transacional', async () => {
      const mockProduto = { id: 10, nome: 'Teclado Mecânico', quantidade_atual: 15 };
      produtoRepository.findByIdForUpdate.mockResolvedValue(mockProduto);
      produtoRepository.updateQuantidade.mockResolvedValue(true);
      movimentacaoRepository.create.mockResolvedValue(101);
      historicoRepository.create.mockResolvedValue(1);
      movimentacaoRepository.findById.mockResolvedValue({
        id: 101,
        produto_id: 10,
        tipo: 'ENTRADA',
        quantidade: 5,
        quantidade_anterior: 15,
        quantidade_posterior: 20
      });

      const result = await movimentacaoService.createMovimentacao({
        usuario_id: 1,
        produto_id: 10,
        tipo: 'ENTRADA',
        quantidade: 5,
        observacao: 'Compra de lote'
      });

      expect(produtoRepository.findByIdForUpdate).toHaveBeenCalledWith(10, expect.anything());
      expect(produtoRepository.updateQuantidade).toHaveBeenCalledWith(10, 20, expect.anything());
      expect(movimentacaoRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        usuario_id: 1,
        produto_id: 10,
        tipo: 'ENTRADA',
        quantidade: 5,
        observacao: 'Compra de lote'
      }), expect.anything());
      expect(historicoRepository.create).toHaveBeenCalledWith(expect.objectContaining({
        usuario_id: 1,
        produto_id: 10,
        tipo_operacao: 'MOVIMENTACAO_ESTOQUE'
      }), expect.anything());
      expect(result.id).toBe(101);
    });

    it('deve registrar SAIDA subtraindo do estoque quando saldo é suficiente', async () => {
      const mockProduto = { id: 2, nome: 'Mouse sem Fio', quantidade_atual: 30 };
      produtoRepository.findByIdForUpdate.mockResolvedValue(mockProduto);
      produtoRepository.updateQuantidade.mockResolvedValue(true);
      movimentacaoRepository.create.mockResolvedValue(102);
      historicoRepository.create.mockResolvedValue(2);
      movimentacaoRepository.findById.mockResolvedValue({
        id: 102,
        produto_id: 2,
        tipo: 'SAIDA',
        quantidade: 10,
        quantidade_anterior: 30,
        quantidade_posterior: 20
      });

      const result = await movimentacaoService.createMovimentacao({
        usuario_id: 1,
        produto_id: 2,
        tipo: 'SAIDA',
        quantidade: 10
      });

      expect(produtoRepository.updateQuantidade).toHaveBeenCalledWith(2, 20, expect.anything());
      expect(result.quantidade_posterior).toBe(20);
    });

    it('deve lançar INSUFFICIENT_STOCK 422 quando quantidade de SAIDA excede o saldo', async () => {
      const mockProduto = { id: 3, nome: 'Monitor 4K', quantidade_atual: 4 };
      produtoRepository.findByIdForUpdate.mockResolvedValue(mockProduto);

      await expect(movimentacaoService.createMovimentacao({
        usuario_id: 1,
        produto_id: 3,
        tipo: 'SAIDA',
        quantidade: 10
      })).rejects.toThrow(expect.objectContaining({
        statusCode: 422,
        code: 'INSUFFICIENT_STOCK'
      }));

      expect(produtoRepository.updateQuantidade).not.toHaveBeenCalled();
      expect(movimentacaoRepository.create).not.toHaveBeenCalled();
    });

    it('deve registrar AJUSTE atualizando saldo diretamente para o valor informado', async () => {
      const mockProduto = { id: 5, nome: 'Cabo HDMI', quantidade_atual: 12 };
      produtoRepository.findByIdForUpdate.mockResolvedValue(mockProduto);
      produtoRepository.updateQuantidade.mockResolvedValue(true);
      movimentacaoRepository.create.mockResolvedValue(103);
      historicoRepository.create.mockResolvedValue(3);
      movimentacaoRepository.findById.mockResolvedValue({
        id: 103,
        produto_id: 5,
        tipo: 'AJUSTE',
        quantidade: 8,
        quantidade_anterior: 12,
        quantidade_posterior: 8
      });

      const result = await movimentacaoService.createMovimentacao({
        usuario_id: 1,
        produto_id: 5,
        tipo: 'AJUSTE',
        quantidade: 8,
        observacao: 'Contagem física'
      });

      expect(produtoRepository.updateQuantidade).toHaveBeenCalledWith(5, 8, expect.anything());
      expect(result.quantidade_posterior).toBe(8);
    });
  });

  describe('getMovimentacaoById', () => {
    it('deve lançar 404 MOVEMENT_NOT_FOUND se movimentação não existir', async () => {
      movimentacaoRepository.findById.mockResolvedValue(null);

      await expect(movimentacaoService.getMovimentacaoById(999))
        .rejects.toThrow(expect.objectContaining({ statusCode: 404, code: 'MOVEMENT_NOT_FOUND' }));
    });
  });
});
