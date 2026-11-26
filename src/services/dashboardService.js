const dashboardRepository = require('../repositories/dashboardRepository');

class DashboardService {
  /**
   * Retorna os indicadores consolidados do painel principal.
   */
  async getResumo() {
    return await dashboardRepository.getResumo();
  }
}

module.exports = new DashboardService();
