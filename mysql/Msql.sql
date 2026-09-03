CREATE DATABASE IF NOT EXISTS public;

USE public;

CREATE TABLE USUARIO (
  id BIGINT,
  nome TEXT,
  email TEXT,
  senha_hash TEXT,
  perfil TEXT
);

CREATE TABLE ASSINATURA (
  id BIGINT,
  usuario_id BIGINT,
  plano TEXT,
  data_inicio TEXT,
  data_fim TEXT,
  status TEXT
);

CREATE TABLE CATEGORIA (
  id BIGINT,
  nome TEXT,
  descricao TEXT
);

CREATE TABLE FORNECEDOR (
  id BIGINT,
  nome TEXT,
  cnpj TEXT,
  contato TEXT,
  endereco TEXT
);

CREATE TABLE PRODUTO (
  id BIGINT,
  categoria_id BIGINT,
  fornecedor_id BIGINT,
  nome TEXT,
  codigo TEXT,
  descricao TEXT,
  quantidade_atual BIGINT,
  quantidade_minima BIGINT,
  codigo_barras BIGINT
);

CREATE TABLE MOVIMENTACAO (
  id BIGINT,
  usuario_id BIGINT,
  produto_id BIGINT,
  tipo TEXT,
  quantidade BIGINT,
  data_hora TIMESTAMP,
  observacao TEXT
);

CREATE TABLE HISTORICO (
  id BIGINT,
  usuario_id BIGINT,
  produto_id BIGINT,
  movimentacao_id BIGINT,
  data_hora TIMESTAMP,
  tipo_operacao TEXT,
  descricao TEXT
);