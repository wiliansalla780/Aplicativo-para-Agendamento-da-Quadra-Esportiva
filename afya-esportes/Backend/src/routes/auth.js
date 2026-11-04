
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';

const router = Router();

router.post('/cadastro', async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (
      typeof nome !== 'string' ||
      typeof email !== 'string' ||
      typeof senha !== 'string'
    ) {
      return res.status(400).json({
        mensagem: 'Informe nome, e-mail e senha válidos.',
      });
    }

    const nomeNormalizado = nome.trim();
    const emailNormalizado = email.trim().toLowerCase();

    if (nomeNormalizado.length < 2 || nomeNormalizado.length > 100) {
      return res.status(400).json({
        mensagem: 'O nome deve ter entre 2 e 100 caracteres.',
      });
    }

    if (
      emailNormalizado.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)
    ) {
      return res.status(400).json({
        mensagem: 'Informe um e-mail válido.',
      });
    }

    if (senha.length < 8 || senha.length > 72) {
      return res.status(400).json({
        mensagem: 'A senha deve ter entre 8 e 72 caracteres.',
      });
    }

    const existente = await Usuario.findOne({
      email: emailNormalizado,
    });

    if (existente) {
      return res.status(409).json({
        mensagem: 'Este e-mail já está cadastrado.',
      });
    }

    const senhaHash = await bcrypt.hash(senha, 12);

    const usuario = await Usuario.create({
      nome: nomeNormalizado,
      email: emailNormalizado,
      senha: senhaHash,
    });

    return res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
      },
    });
  } catch (erro) {
    if (erro.code === 11000) {
      return res.status(409).json({
        mensagem: 'Este e-mail já está cadastrado.',
      });
    }

    console.error('Erro no cadastro:', erro.message);

    return res.status(500).json({
      mensagem: 'Não foi possível realizar o cadastro.',
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (
      typeof email !== 'string' ||
      typeof senha !== 'string' ||
      email.length > 254 ||
      senha.length > 72
    ) {
      return res.status(400).json({
        mensagem: 'Informe e-mail e senha válidos.',
      });
    }

    const usuario = await Usuario.findOne({
      email: email.trim().toLowerCase(),
    }).select('+senha');

    if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
      return res.status(401).json({
        mensagem: 'E-mail ou senha incorretos.',
      });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error('JWT_SECRET ausente ou muito curta.');
      return res.status(500).json({
        mensagem: 'Autenticação ainda não está configurada.',
      });
    }

    const token = jwt.sign(
      { sub: usuario._id.toString() },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return res.status(200).json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: {
        id: usuario._id,
        nome: usuario.nome,
        email: usuario.email,
        papel: usuario.papel || 'estudante',
      },
    });
  } catch (erro) {
    console.error('Erro no login:', erro.message);

    return res.status(500).json({
      mensagem: 'Não foi possível realizar o login.',
    });
  }
});

export default router;