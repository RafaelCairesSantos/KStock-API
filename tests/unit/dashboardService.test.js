jest.mock('../../src/repositories/dashboardRepository');

const dashboardService = require('../../src/services/dashboardService');
const dashboardRepository = require('../../src/repositories/dashboardRepository');

describe('DashboardService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('deve retornar os indicadores consolidados do dashboard', async () => {
    const mockResumo = {
      totalProdutos: 15,
      totalEstoqueFisico: 340,
      itensEstoqueBaixo: 3,
      movimentacoesTotal: 89
    };
    dashboardRepository.getResumo.mockResolvedValue(mockResumo);

    const result = await dashboardService.getResumo();

    expect(dashboardRepository.getResumo).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockResumo);
  });
});
