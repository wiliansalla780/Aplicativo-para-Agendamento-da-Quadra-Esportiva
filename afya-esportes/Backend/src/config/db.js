
import mongoose from 'mongoose';

export async function conectarBanco() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('A variável MONGO_URI não foi definida no arquivo .env');
    }

    await mongoose.connect(process.env.MONGO_URI, {
      dbName: 'afya_esportes',
    });

    console.log('MongoDB Atlas conectado com sucesso!');
  } catch (erro) {
    console.error('Erro ao conectar ao MongoDB:', erro.message);
    throw erro;
  }
}
