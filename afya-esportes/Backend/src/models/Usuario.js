
import mongoose from 'mongoose';

const usuarioSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    senha: {
      type: String,
      required: true,
      select: false,
    },
    // 'estudante' (padrão) ou 'aprovador' (diretor da quadra).
    // Só é alterado manualmente: npm run promover -- email@exemplo.com
    papel: {
      type: String,
      enum: ['estudante', 'aprovador'],
      default: 'estudante',
    },
  },
  {
    timestamps: true,
    collection: 'Usuarios',
  }
);

const Usuario = mongoose.model('Usuario', usuarioSchema);

export default Usuario;