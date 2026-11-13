-- Criação do banco (execute separado se já estiver conectado no pgAdmin/psql)
CREATE DATABASE clinica_pequenos_passos;

-- Conecte-se ao banco clinica_pequenos_passos antes de rodar as tabelas abaixo:

CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL
);

CREATE TABLE grupos_clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    descricao TEXT
);

CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    email VARCHAR(100),
    telefone VARCHAR(20),
    grupo_id INTEGER NOT NULL REFERENCES grupos_clientes(id) ON DELETE RESTRICT
);

-- Usuário operador inicial (CPF: 111.111.111-11 | Senha: 123456)
-- Cole abaixo o hash $2b$10$... gerado no terminal
INSERT INTO usuarios (nome, cpf, senha) VALUES 
('Recepção Clínica', '111.111.111-11', '$2b$10$Xhg4crRrmVPj8wspVWP6Aed8WutfpbaQZO7JGO10s0gizGH1oFsJy');

-- Grupos iniciais para facilitar os testes
INSERT INTO grupos_clientes (nome, descricao) VALUES 
('Convênio Bronze', 'Atendimento padrão via planos básicos'),
('Particular Especial', 'Consultas particulares com retorno incluso'),
('Programa Neonatal', 'Acompanhamento de recém-nascidos até 6 meses'),
('Atendimento Social', 'Atendimento subsidiado pela clínica');