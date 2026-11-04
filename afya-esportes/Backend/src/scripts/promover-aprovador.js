// Torna um usuário já cadastrado o aprovador (diretor da quadra).
// Uso (dentro da pasta Backend):  npm run promover -- diretor@exemplo.com
import 'dotenv/config';
import mongoose from 'mongoose';
import { conectarBanco } from '../config/db.js';
import Usuario from '../models/Usuario.js';

const email = (process.argv[2] || '').trim().toLowerCase();

if (!email) {
  console.error('Informe o e-mail. Exemplo: npm run promover -- diretor@exemplo.com');
  process.exit(1);
}

try {
  await conectarBanco();

  const usuario = await Usuario.findOneAndUpdate(
    { email },
    { $set: { papel: 'aprovador' } },
    { new: true }
  );

  if (!usuario) {
    console.error(`Nenhum usuário com o e-mail ${email}. Crie a conta no app primeiro.`);
    process.exitCode = 1;
  } else {
    console.log(`${usuario.nome} (${usuario.email}) agora é aprovador.`);
  }
} catch (erro) {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}