const express = require('express');
const router = express.Router();
const produtoService = require('../services/produtoService');

router.get('/resumo', async (req, res, next) => {
  try {
    const [produtos, alertas] = await Promise.all([
      produtoService.listProdutos({ limit: 5 }),
      produtoService.getAlertasEstoque()
    ]);
    // Contagem simples de movimentações (sem depender de repo.countAll sem args)
    let totalMovs = 0;
    try {
      const { query } = require('../db/connect');
      const [rows] = await query('SELECT COUNT(*) as total FROM movimentacao');
      totalMovs = (rows && rows[0]) ? rows[0].total || 0 : 0;
    } catch (e) { totalMovs = 0; }
    return res.status(200).json({
      total_produtos: (produtos && produtos.pagination) ? produtos.pagination.total : 0,
      alertas_estoque: Array.isArray(alertas) ? alertas.length : (alertas && alertas.total ? alertas.total : 0),
      movimentacoes_hoje: totalMovs,
      produtos_recentes: (produtos && produtos.data) ? produtos.data.slice(0, 3) : []
    });
  } catch (error) { next(error); }
});

module.exports = router;
