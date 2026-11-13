import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import pool from './db.js';
import { verificarAutenticacao } from './middlewares/auth.js';

const app = express();
const PORT = 3000;

// Configurações SSR (EJS) e leitura de formulários HTML
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// Configuração de Sessão (RNF04)
app.use(session({
    secret: 'chave-secreta-clinica-pequenos-passos',
    resave: false,
    saveUninitialized: false
}));

// Rota raiz redireciona para clientes (que passará pelo middleware de login)
app.get('/', (req, res) => {
    res.redirect('/clientes');
});

// ================= ROTAS DE AUTENTICAÇÃO (RF01) =================

app.get('/login', (req, res) => {
    res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
    const { cpf, senha } = req.body;
    try {
        const resultado = await pool.query('SELECT * FROM usuarios WHERE cpf = $1', [cpf]);
        
        if (resultado.rows.length === 0) {
            return res.render('login', { erro: 'CPF ou senha inválidos.' });
        }

        const usuario = resultado.rows[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha);

        if (!senhaValida) {
            return res.render('login', { erro: 'CPF ou senha inválidos.' });
        }

        // Grava usuário na sessão
        req.session.usuario = {
            id: usuario.id,
            nome: usuario.nome,
            cpf: usuario.cpf
        };

        return res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        return res.render('login', { erro: 'Erro interno ao autenticar.' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ================= CRUD 1: GRUPOS DE CLIENTES (RF02) =================

// Listar grupos e exibir formulário de cadastro
app.get('/grupos', verificarAutenticacao, async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM grupos_clientes ORDER BY id ASC');
        res.render('grupos', {
            grupos: resultado.rows,
            usuario: req.session.usuario,
            erro: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao listar grupos.');
    }
});

// Cadastrar novo grupo
app.post('/grupos', verificarAutenticacao, async (req, res) => {
    const { nome, descricao } = req.body;
    try {
        await pool.query(
            'INSERT INTO grupos_clientes (nome, descricao) VALUES ($1, $2)',
            [nome, descricao]
        );
        res.redirect('/grupos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao cadastrar grupo.');
    }
});

// Carregar página de edição de grupo
app.get('/grupos/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        const resultado = await pool.query('SELECT * FROM grupos_clientes WHERE id = $1', [id]);
        if (resultado.rows.length === 0) return res.redirect('/grupos');

        res.render('grupo-editar', { grupo: resultado.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar grupo para edição.');
    }
});

// Salvar edição de grupo
app.post('/grupos/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    const { nome, descricao } = req.body;
    try {
        await pool.query(
            'UPDATE grupos_clientes SET nome = $1, descricao = $2 WHERE id = $3',
            [nome, descricao, id]
        );
        res.redirect('/grupos');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar grupo.');
    }
});

// Excluir grupo (com tratamento de exceção caso existam clientes vinculados)
app.post('/grupos/excluir/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM grupos_clientes WHERE id = $1', [id]);
        res.redirect('/grupos');
    } catch (err) {
        console.error(err);
        const grupos = await pool.query('SELECT * FROM grupos_clientes ORDER BY id ASC');
        res.render('grupos', {
            grupos: grupos.rows,
            usuario: req.session.usuario,
            erro: 'Não é possível excluir este grupo pois existem clientes vinculados a ele.'
        });
    }
});

// ================= CRUD 2: CLIENTES RELACIONAL (RF03, RF04, RF05) =================

// Listar clientes (com filtro ?busca= e LEFT JOIN) + carregar grupos para o <select>
app.get('/clientes', verificarAutenticacao, async (req, res) => {
    const busca = req.query.busca || '';
    try {
        const sqlClientes = `
            SELECT 
                clientes.*, 
                grupos_clientes.nome AS grupo_nome 
            FROM clientes
            LEFT JOIN grupos_clientes ON clientes.grupo_id = grupos_clientes.id
            WHERE clientes.nome ILIKE $1
            ORDER BY clientes.id ASC
        `;
        const resultadoClientes = await pool.query(sqlClientes, [`%${busca}%`]);
        const resultadoGrupos = await pool.query('SELECT id, nome FROM grupos_clientes ORDER BY nome ASC');

        res.render('clientes', {
            clientes: resultadoClientes.rows,
            grupos: resultadoGrupos.rows,
            usuario: req.session.usuario,
            busca,
            erro: null
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao listar clientes.');
    }
});

// Cadastrar novo cliente
app.post('/clientes', verificarAutenticacao, async (req, res) => {
    const { nome, cpf, email, telefone, grupo_id } = req.body;
    try {
        await pool.query(
            'INSERT INTO clientes (nome, cpf, email, telefone, grupo_id) VALUES ($1, $2, $3, $4, $5)',
            [nome, cpf, email, telefone, grupo_id]
        );
        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        const sqlClientes = `
            SELECT clientes.*, grupos_clientes.nome AS grupo_nome 
            FROM clientes
            LEFT JOIN grupos_clientes ON clientes.grupo_id = grupos_clientes.id
            ORDER BY clientes.id ASC
        `;
        const resultadoClientes = await pool.query(sqlClientes);
        const resultadoGrupos = await pool.query('SELECT id, nome FROM grupos_clientes ORDER BY nome ASC');

        res.render('clientes', {
            clientes: resultadoClientes.rows,
            grupos: resultadoGrupos.rows,
            usuario: req.session.usuario,
            busca: '',
            erro: 'Erro ao cadastrar: verifique se o CPF já está em uso.'
        });
    }
});

// Carregar página de edição de cliente
app.get('/clientes/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        const resultadoCliente = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
        if (resultadoCliente.rows.length === 0) return res.redirect('/clientes');

        const resultadoGrupos = await pool.query('SELECT id, nome FROM grupos_clientes ORDER BY nome ASC');

        res.render('cliente-editar', {
            cliente: resultadoCliente.rows[0],
            grupos: resultadoGrupos.rows
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao carregar cliente para edição.');
    }
});

// Salvar edição de cliente
app.post('/clientes/editar/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    const { nome, cpf, email, telefone, grupo_id } = req.body;
    try {
        await pool.query(
            'UPDATE clientes SET nome = $1, cpf = $2, email = $3, telefone = $4, grupo_id = $5 WHERE id = $6',
            [nome, cpf, email, telefone, grupo_id, id]
        );
        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao atualizar cliente.');
    }
});

// Excluir cliente
app.post('/clientes/excluir/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        res.redirect('/clientes');
    } catch (err) {
        console.error(err);
        res.status(500).send('Erro ao excluir cliente.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});