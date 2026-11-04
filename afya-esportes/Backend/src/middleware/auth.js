import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';

// Exige um token JWT válido (enviado pelo frontend no cabeçalho
// "Authorization: Bearer <token>") e disponibiliza o id do usuário
// logado em req.usuarioId.
export function exigirLogin(req, res, next) {
  const [tipo, token] = (req.headers.authorization || '').split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({
      erro: 'Entre na sua conta para continuar.',
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET não foi definida no arquivo .env');
    return res.status(500).json({
      erro: 'Autenticação ainda não está configurada.',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuarioId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({
      erro: 'Sua sessão expirou. Entre novamente.',
    });
  }
}

// Use depois de exigirLogin. Libera somente usuários com papel 'aprovador'.
// O papel é lido do banco a cada chamada (e não do token), então remover
// o papel de alguém vale imediatamente.
export async function exigirAprovador(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.usuarioId).select('papel');

    if (!usuario || usuario.papel !== 'aprovador') {
      return res.status(403).json({
        erro: 'Apenas o aprovador pode realizar esta ação.',
      });
    }

    return next();
  } catch (erro) {
    console.error('Erro ao verificar permissão:', erro.message);

    return res.status(500).json({
      erro: 'Não foi possível verificar suas permissões.',
    });
  }
}