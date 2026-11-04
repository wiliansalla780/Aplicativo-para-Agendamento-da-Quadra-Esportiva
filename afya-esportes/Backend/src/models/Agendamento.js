
import mongoose from 'mongoose';

const agendamentoSchema = new mongoose.Schema(
  {
    nomeResponsavel: {
      type: String,
      required: [true, 'O nome do responsável é obrigatório.'],
      trim: true,
      maxlength: 100,
    },

    data: {
      type: String,
      required: [true, 'A data do agendamento é obrigatória.'],
      match: [
        /^\d{4}-\d{2}-\d{2}$/,
        'Informe a data no formato AAAA-MM-DD.',
      ],
    },

    horario: {
      type: String,
      required: [true, 'O horário é obrigatório.'],
      match: [
        /^([01]\d|2[0-3]):[0-5]\d$/,
        'Informe o horário no formato HH:mm.',
      ],
    },

    modalidade: {
      type: String,
      required: [true, 'A modalidade esportiva é obrigatória.'],
      enum: ['Futsal', 'Basquete', 'Vôlei', 'Handebol', 'Outro'],
    },

    usuario: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'O agendamento precisa estar vinculado a um usuário.'],
    },

    // 'reservado' = ocupa o horário; 'cancelado' = horário liberado.
    status: {
      type: String,
      enum: ['reservado', 'cancelado'],
      default: 'reservado',
    },

    // Decisão do aprovador. Ao reprovar, o status vira 'cancelado'
    // para liberar o horário.
    aprovacao: {
      type: String,
      enum: ['pendente', 'aprovado', 'reprovado'],
      default: 'pendente',
    },

    motivoReprovacao: {
      type: String,
      trim: true,
      maxlength: 300,
    },

    avaliadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
    },

    avaliadoEm: {
      type: Date,
    },
  },
  {
    timestamps: true,
    collection: 'agendamentos',
  }
);

// Impede duas reservas ativas para a mesma data e horário.
// Reservas canceladas não bloqueiam o horário.
agendamentoSchema.index(
  { data: 1, horario: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'reservado' },
  }
);

const Agendamento = mongoose.model(
  'Agendamento',
  agendamentoSchema
);

export default Agendamento;