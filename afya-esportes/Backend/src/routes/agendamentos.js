import { Router } from 'express';
import mongoose from 'mongoose';
import Agendamento from '../models/Agendamento.js';
import { exigirLogin, exigirAprovador } from '../middleware/auth.js';

const router = Router();

// Mesmos horários exibidos no frontend (src/App.tsx).
const HORARIOS_PERMITIDOS = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00',
];

// Data e hora atuais no fuso de Pato Branco (America/Sao_Paulo),
// independente do fuso do servidor onde o backend estiver rodando.
// Retorna { data: 'AAAA-MM-DD', hora: 'HH:mm' }.
function agoraSP() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const valor = (tipo) => partes.find((p) => p.type === tipo).value;

  return {
    data: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
  };
}

// Confere se a string é uma data real (rejeita, por exemplo, 2026-02-31).
function dataValida(valor) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

// GET /api/agendamentos
// Público: devolve apenas data e horário dos horários ocupados (para a grade
// de horários). Nomes e demais dados pessoais NÃO são expostos aqui.
router.get('/', async (req, res) => {
  try {
    const filtro = { status: 'reservado' };

    if (typeof req.query.data === 'string') {
      filtro.data = req.query.data;
    }

    const ocupados = await Agendamento.find(filtro)
      .select('data horario -_id')
      .sort({ data: 1, horario: 1 })
      .lean();

    return res.json(ocupados);
  } catch (erro) {
    console.error('Erro ao consultar agendamentos:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível consultar os agendamentos.',
    });
  }
});

// GET /api/agendamentos/minhas
// Reservas do usuário logado, em qualquer situação (inclui o motivo de
// uma eventual reprovação).
router.get('/minhas', exigirLogin, async (req, res) => {
  try {
    const minhas = await Agendamento.find({ usuario: req.usuarioId })
      .select('-usuario -avaliadoPor')
      .sort({ data: 1, horario: 1 });

    return res.json(minhas);
  } catch (erro) {
    console.error('Erro ao consultar suas reservas:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível consultar suas reservas.',
    });
  }
});

// GET /api/agendamentos/pendentes  (somente aprovador)
// Solicitações aguardando decisão, de hoje em diante.
router.get('/pendentes', exigirLogin, exigirAprovador, async (req, res) => {
  try {
    const pendentes = await Agendamento.find({
      status: 'reservado',
      aprovacao: 'pendente',
      data: { $gte: agoraSP().data },
    })
      .select('-avaliadoPor')
      .populate('usuario', 'nome email')
      .sort({ data: 1, horario: 1 });

    return res.json(pendentes);
  } catch (erro) {
    console.error('Erro ao consultar pendentes:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível consultar as solicitações pendentes.',
    });
  }
});

// GET /api/agendamentos/todas  (somente aprovador)
// Todas as solicitações de todos os alunos (pendentes, aprovadas,
// reprovadas e canceladas), com nome e e-mail de quem pediu.
router.get('/todas', exigirLogin, exigirAprovador, async (req, res) => {
  try {
    const todas = await Agendamento.find({})
      .select('-avaliadoPor')
      .populate('usuario', 'nome email')
      .sort({ data: 1, horario: 1 })
      .limit(500);

    return res.json(todas);
  } catch (erro) {
    console.error('Erro ao consultar todas as reservas:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível consultar as reservas.',
    });
  }
});

// POST /api/agendamentos
// Cria um agendamento no banco, vinculado ao usuário logado.
router.post('/', exigirLogin, async (req, res) => {
  try {
    const { nomeResponsavel, data, horario, modalidade } = req.body;

    if (
      typeof nomeResponsavel !== 'string' ||
      typeof data !== 'string' ||
      typeof horario !== 'string' ||
      typeof modalidade !== 'string' ||
      !nomeResponsavel.trim()
    ) {
      return res.status(400).json({
        erro: 'Preencha nome, data, horário e modalidade.',
      });
    }

    if (!dataValida(data)) {
      return res.status(400).json({ erro: 'Data inválida.' });
    }

    const agora = agoraSP();

    if (data < agora.data) {
      return res.status(400).json({
        erro: 'Não é possível agendar em uma data que já passou.',
      });
    }

    if (!HORARIOS_PERMITIDOS.includes(horario)) {
      return res.status(400).json({
        erro: 'Horário indisponível para agendamento.',
      });
    }

    // Hoje, horários que já começaram ficam bloqueados.
    if (data === agora.data && horario <= agora.hora) {
      return res.status(400).json({
        erro: 'Este horário já começou ou passou. Escolha um horário futuro.',
      });
    }

    const novoAgendamento = await Agendamento.create({
      nomeResponsavel,
      data,
      horario,
      modalidade,
      usuario: req.usuarioId,
    });

    return res.status(201).json(novoAgendamento);
  } catch (erro) {
    if (erro.code === 11000) {
      return res.status(409).json({
        erro: 'Este horário já está reservado para essa data.',
      });
    }

    if (erro.name === 'ValidationError' || erro.name === 'CastError') {
      return res.status(400).json({
        erro: erro.message,
      });
    }

    console.error('Erro ao criar agendamento:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível criar o agendamento.',
    });
  }
});

// PATCH /api/agendamentos/:id/cancelar
// Cancela uma reserva (sem apagar o histórico). Só o dono pode cancelar.
router.patch('/:id/cancelar', exigirLogin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        erro: 'ID de agendamento inválido.',
      });
    }

    const agendamento = await Agendamento.findOneAndUpdate(
      { _id: id, status: 'reservado', usuario: req.usuarioId },
      { $set: { status: 'cancelado' } },
      { new: true, runValidators: true }
    ).select('-usuario');

    if (!agendamento) {
      return res.status(404).json({
        erro: 'Agendamento não encontrado, já cancelado ou não pertence a você.',
      });
    }

    return res.json({
      mensagem: 'Agendamento cancelado com sucesso.',
      agendamento,
    });
  } catch (erro) {
    console.error('Erro ao cancelar agendamento:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível cancelar o agendamento.',
    });
  }
});

// PATCH /api/agendamentos/:id/aprovar  (somente aprovador)
router.patch('/:id/aprovar', exigirLogin, exigirAprovador, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ erro: 'ID de agendamento inválido.' });
    }

    const agendamento = await Agendamento.findOneAndUpdate(
      { _id: id, status: 'reservado', aprovacao: 'pendente' },
      {
        $set: {
          aprovacao: 'aprovado',
          avaliadoPor: req.usuarioId,
          avaliadoEm: new Date(),
        },
      },
      { new: true, runValidators: true }
    ).select('-avaliadoPor');

    if (!agendamento) {
      return res.status(404).json({
        erro: 'Solicitação não encontrada, cancelada ou já avaliada.',
      });
    }

    return res.json({ mensagem: 'Agendamento aprovado.', agendamento });
  } catch (erro) {
    console.error('Erro ao aprovar agendamento:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível aprovar o agendamento.',
    });
  }
});

// PATCH /api/agendamentos/:id/reprovar  (somente aprovador)
// Exige o motivo. Ao reprovar, o horário é liberado (status = cancelado).
router.patch('/:id/reprovar', exigirLogin, exigirAprovador, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ erro: 'ID de agendamento inválido.' });
    }

    const motivo =
      typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';

    if (motivo.length < 5) {
      return res.status(400).json({
        erro: 'Informe o motivo da reprovação (mínimo de 5 caracteres).',
      });
    }

    if (motivo.length > 300) {
      return res.status(400).json({
        erro: 'O motivo deve ter no máximo 300 caracteres.',
      });
    }

    const agendamento = await Agendamento.findOneAndUpdate(
      { _id: id, status: 'reservado', aprovacao: 'pendente' },
      {
        $set: {
          aprovacao: 'reprovado',
          status: 'cancelado',
          motivoReprovacao: motivo,
          avaliadoPor: req.usuarioId,
          avaliadoEm: new Date(),
        },
      },
      { new: true, runValidators: true }
    ).select('-avaliadoPor');

    if (!agendamento) {
      return res.status(404).json({
        erro: 'Solicitação não encontrada, cancelada ou já avaliada.',
      });
    }

    return res.json({ mensagem: 'Agendamento reprovado.', agendamento });
  } catch (erro) {
    console.error('Erro ao reprovar agendamento:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível reprovar o agendamento.',
    });
  }
});

export default router;