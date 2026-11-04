import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { conectarBanco } from './config/db.js';
import agendamentosRouter from './routes/agendamentos.js';
import authRouter from './routes/auth.js';
import Agendamento from './models/Agendamento.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração flexível de CORS para aceitar conexões locais e do frontend publicado
// Configuração flexível de CORS para aceitar localhost, rede local e frontend publicado
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite chamadas sem origin (Postman) ou se estiver na lista permitida
      // Também permite automaticamente qualquer IP local da rede (192.168.x.x ou 10.x.x.x) nas portas do Vite
      const isLocalNetwork = origin && /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.\d{1,3}\.\d{1,3}\.\d{1,3}):(5173|5174)$/.test(origin);

      if (!origin || allowedOrigins.indexOf(origin) !== -1 || isLocalNetwork) {
        callback(null, true);
      } else {
        callback(new Error('Bloqueado pelas políticas de CORS'));
      }
    },
    credentials: true,
  })
);

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