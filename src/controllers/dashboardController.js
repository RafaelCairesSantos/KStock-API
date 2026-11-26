const dashboardService = require('../services/dashboardService');

class DashboardController {
  async resumo(req, res, next) {
    try {
      const resumo = await dashboardService.getResumo();
      return res.status(200).json(resumo);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DashboardController();
