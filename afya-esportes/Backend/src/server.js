
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { conectarBanco } from './config/db.js';
import agendamentosRouter from './routes/agendamentos.js';
import authRouter from './routes/auth.js';
import Agendamento from './models/Agendamento.js';

const app = express();
const PORT = process.env.PORT || 5000;


app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
    ],
    credentials: true,
  }));
  

app.use(express.json());

app.use('/api/agendamentos', agendamentosRouter);

app.use('/api/auth', authRouter);

app.get('/', (req, res) => {
  res.json({
    mensagem: 'API AFYA Esportes funcionando!',
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    aplicacao: 'AFYA Esportes',
  });
});

// Reservas criadas antes do fluxo de aprovação passam a ficar "pendentes".
async function atualizarReservasAntigas() {
  try {
    const resultado = await Agendamento.updateMany(
      { aprovacao: { $exists: false } },
      { $set: { aprovacao: 'pendente' } }
    );

    if (resultado.modifiedCount > 0) {
      console.log(
        `${resultado.modifiedCount} reserva(s) antiga(s) marcada(s) como pendente(s).`
      );
    }
  } catch (erro) {
    console.error('Aviso: não foi possível atualizar reservas antigas:', erro.message);
  }
}

async function iniciarServidor() {
  try {
    await conectarBanco();
    await atualizarReservasAntigas();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (erro) {
    console.error('O servidor não iniciou porque o banco não conectou.');
    process.exit(1);
  }
}

iniciarServidor();