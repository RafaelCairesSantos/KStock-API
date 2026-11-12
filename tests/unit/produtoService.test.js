jest.mock('../../src/repositories/produtoRepository');
jest.mock('../../src/repositories/categoriaRepository');
jest.mock('../../src/repositories/fornecedorRepository');
jest.mock('../../src/repositories/historicoRepository');

const produtoService = require('../../src/services/produtoService');
const produtoRepository = require('../../src/repositories/produtoRepository');
const AppError = require('../../src/utils/appError');

describe('ProdutoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getProdutoById', () => {
    it('deve retornar dados do produto quando encontrado', async () => {
      const mockProduto = { id: 1, nome: 'Cafeteira', codigo: 'SKU-001', preco: 150 };
      produtoRepository.findById.mockResolvedValue(mockProduto);

      const result = await produtoService.getProdutoById(1);
      expect(result).toEqual(mockProduto);
    });

    it('deve lançar 404 PRODUCT_NOT_FOUND quando produto não existe', async () => {
      produtoRepository.findById.mockResolvedValue(null);

      await expect(produtoService.getProdutoById(999))
        .rejects.toThrow(expect.objectContaining({ statusCode: 404, code: 'PRODUCT_NOT_FOUND' }));
    });
  });

  describe('Previsão de Ruptura (_calcularPrevisao)', () => {
    it('deve calcular dias até ruptura com base no saldo e saídas', () => {
      const row = {
        id: 10,
        nome: 'Notebook Dell',
        codigo: 'SKU-NOTE-01',
        quantidade_atual: 20,
        quantidade_minima: 5,
        total_saidas: 60
      };

      // 60 saídas em 30 dias = média diária 2.0 un/dia.
      // Saldo de 20 un / 2.0 = 10 dias até ruptura.
      const previsao = produtoService._calcularPrevisao(row, 30, 7);

      expect(previsao.produto_id).toBe(10);
      expect(previsao.media_diaria_saidas).toBe(2);
      expect(previsao.dias_ate_ruptura).toBe(10);
      expect(previsao.risco).toBe('NORMAL'); // 10 dias > limiar de 7 dias
    });

    it('deve marcar risco como ALTO se dias_ate_ruptura <= limiar', () => {
      const row = {
        id: 11,
        nome: 'Mousepad',
        codigo: 'SKU-PAD',
        quantidade_atual: 6,
        quantidade_minima: 2,
        total_saidas: 60
      };

      // 60 saídas em 30 dias = média 2.0 un/dia.
      // Saldo 6 / 2 = 3 dias até ruptura (menor que limiar de 7 dias)
      const previsao = produtoService._calcularPrevisao(row, 30, 7);

      expect(previsao.dias_ate_ruptura).toBe(3);
      expect(previsao.risco).toBe('ALTO');
    });

    it('deve retornar diasAteRuptura null quando média diária for 0 (sem saídas)', () => {
      const row = {
        id: 12,
        nome: 'Item Parado',
        codigo: 'SKU-PARADO',
        quantidade_atual: 50,
        quantidade_minima: 5,
        total_saidas: 0
      };

      const previsao = produtoService._calcularPrevisao(row, 30, 7);
      expect(previsao.media_diaria_saidas).toBe(0);
      expect(previsao.dias_ate_ruptura).toBeNull();
      expect(previsao.risco).toBe('NORMAL');
    });
  });
});
