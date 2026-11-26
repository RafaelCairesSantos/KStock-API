const { query } = require('../db/connect');

class DashboardRepository {
  /**
   * Obtém os indicadores consolidados de produtos e movimentações para o dashboard.
   */
  async getResumo() {
    const [produtoRows] = await query(`
      SELECT 
        COUNT(*) AS totalProdutos,
        COALESCE(SUM(quantidade_atual), 0) AS totalEstoqueFisico,
        COALESCE(SUM(CASE WHEN quantidade_atual <= quantidade_minima THEN 1 ELSE 0 END), 0) AS itensEstoqueBaixo
      FROM produto
    `);

    const [movRows] = await query(`
      SELECT COUNT(*) AS movimentacoesTotal FROM movimentacao
    `);

    const statsProdutos = produtoRows[0] || {};
    const statsMovs = movRows[0] || {};

    return {
      totalProdutos: Number(statsProdutos.totalProdutos) || 0,
      totalEstoqueFisico: Number(statsProdutos.totalEstoqueFisico) || 0,
      itensEstoqueBaixo: Number(statsProdutos.itensEstoqueBaixo) || 0,
      movimentacoesTotal: Number(statsMovs.movimentacoesTotal) || 0
    };
  }
}

module.exports = new DashboardRepository();
