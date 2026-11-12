const AppError = require('../../src/utils/appError');

describe('AppError Utility', () => {
  it('deve criar uma instância de AppError com os valores padrão', () => {
    const error = new AppError('Erro de teste');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.message).toBe('Erro de teste');
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.details).toBeNull();
    expect(error.isOperational).toBe(true);
  });

  it('deve aceitar statusCode, code e details customizados', () => {
    const details = { campo: 'email' };
    const error = new AppError('Não encontrado', 404, 'NOT_FOUND', details);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.details).toEqual(details);
  });
});
