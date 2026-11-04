import { useEffect, useState } from 'react'
import './App.css'
import './Painel.css'

const BASE_URL = 'https://aplicativo-para-agendamento-da-quadra.onrender.com';
const API_URL = `${BASE_URL}/api/agendamentos`;
const AUTH_URL = `${BASE_URL}/api/auth`;

const horarios = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00',
  '21:00', '22:00',
]

const modalidades = ['Futsal', 'Basquete', 'Vôlei', 'Handebol', 'Outro']

type Aprovacao = 'pendente' | 'aprovado' | 'reprovado'

// Resposta pública da API: apenas os horários ocupados (sem dados pessoais).
type HorarioOcupado = {
  data: string
  horario: string
}

// Reserva completa (retornada em "minhas reservas").
type Reserva = {
  _id: string
  nomeResponsavel: string
  data: string
  horario: string
  modalidade: string
  status: 'reservado' | 'cancelado'
  aprovacao: Aprovacao
  motivoReprovacao?: string
}

// Reserva como o diretor enxerga: inclui quem solicitou.
type ReservaPainel = Reserva & {
  usuario: { _id: string; nome: string; email: string } | null
}

type FiltroPainel = 'pendentes' | 'aprovados' | 'reprovados' | 'todos'

type Aba = 'agendar' | 'painel'

type Usuario = {
  id: string
  nome: string
  email: string
  // 'aprovador' = diretor. O servidor é quem realmente confere a permissão.
  papel?: 'estudante' | 'aprovador'
}

type Sessao = {
  token: string
  usuario: Usuario
}

type TipoAuth = 'login' | 'cadastro'

function lerSessao(): Sessao | null {
  try {
    const valor = sessionStorage.getItem('afya-sessao')
    if (!valor) return null

    const sessao = JSON.parse(valor) as Sessao

    if (
      typeof sessao.token !== 'string' ||
      typeof sessao.usuario?.id !== 'string' ||
      typeof sessao.usuario?.nome !== 'string' ||
      typeof sessao.usuario?.email !== 'string'
    ) {
      sessionStorage.removeItem('afya-sessao')
      return null
    }

    return sessao
  } catch {
    return null
  }
}

// Data e hora atuais em Pato Branco (America/Sao_Paulo), iguais às que o
// servidor usa, mesmo que o relógio/fuso do aparelho esteja diferente.
function agoraEmSaoPaulo() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date())

  const valor = (tipo: string) =>
    partes.find((parte) => parte.type === tipo)?.value ?? ''

  return {
    data: `${valor('year')}-${valor('month')}-${valor('day')}`,
    hora: `${valor('hour')}:${valor('minute')}`,
  }
}

// Texto e cor do selo de status de uma reserva.
function situacao(reserva: Reserva) {
  if (reserva.aprovacao === 'reprovado') {
    return { texto: 'Reprovado', classe: 'status-reprovado' }
  }
  if (reserva.status === 'cancelado') {
    return { texto: 'Cancelado', classe: 'status-cancelado' }
  }
  if (reserva.aprovacao === 'aprovado') {
    return { texto: 'Aprovado', classe: 'status-aprovado' }
  }
  return { texto: 'Pendente', classe: 'status-pendente' }
}

function App() {
  const [sessao, setSessao] = useState<Sessao | null>(lerSessao)
  const [tipoAuth, setTipoAuth] = useState<TipoAuth | null>(null)

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [mensagemAuth, setMensagemAuth] = useState('')
  const [enviandoAuth, setEnviandoAuth] = useState(false)

  const [nomeResponsavel, setNomeResponsavel] = useState('')
  const [modalidade, setModalidade] = useState('Futsal')
  const [data, setData] = useState('')
  const [horarioSelecionado, setHorarioSelecionado] = useState('')
  const [ocupados, setOcupados] = useState<HorarioOcupado[]>([])
  const [minhas, setMinhas] = useState<Reserva[]>([])
  const [mensagemMinhas, setMensagemMinhas] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [agora, setAgora] = useState(agoraEmSaoPaulo)

  // Painel do diretor
  const [aba, setAba] = useState<Aba>('agendar')
  const [painel, setPainel] = useState<ReservaPainel[]>([])
  const [filtroPainel, setFiltroPainel] = useState<FiltroPainel>('pendentes')
  const [carregandoPainel, setCarregandoPainel] = useState(false)
  const [mensagemPainel, setMensagemPainel] = useState('')
  const [processandoId, setProcessandoId] = useState('')
  const [reprovandoId, setReprovandoId] = useState('')
  const [motivo, setMotivo] = useState('')

  const ehAprovador = sessao?.usuario.papel === 'aprovador'

  async function carregarReservas(silencioso = false) {
    try {
      const resposta = await fetch(API_URL, { cache: 'no-store' })

      if (!resposta.ok) {
        throw new Error('Não foi possível consultar as reservas.')
      }

      const dados: HorarioOcupado[] = await resposta.json()
      setOcupados(dados)
    } catch (erro) {
      console.error('Erro ao carregar reservas:', erro)
      if (!silencioso) {
        setMensagem(
          'Não foi possível conectar ao servidor. Verifique se o backend está funcionando.',
        )
      }
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    void carregarReservas()

    function atualizar() {
      setAgora(agoraEmSaoPaulo())
      void carregarReservas(true)
    }

    // Atualiza relógio e reservas a cada 30s e quando a aba volta ao foco.
    const intervalo = setInterval(atualizar, 30000)
    window.addEventListener('focus', atualizar)

    return () => {
      clearInterval(intervalo)
      window.removeEventListener('focus', atualizar)
    }
  }, [])

  // Encerra a sessão localmente (token expirado ou inválido).
  function encerrarSessaoExpirada() {
    sessionStorage.removeItem('afya-sessao')
    setSessao(null)
    setMinhas([])
    setPainel([])
    setAba('agendar')
    setMensagem('Sua sessão expirou. Entre novamente.')
    abrirAuth('login')
  }

  // Chamada autenticada à API de agendamentos.
  async function chamarApi(caminho: string, init: RequestInit = {}) {
    if (!sessao) throw new Error('Entre na sua conta para continuar.')

    const resposta = await fetch(`${API_URL}${caminho}`, {
      ...init,
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sessao.token}`,
      },
    })

    if (resposta.status === 401) {
      encerrarSessaoExpirada()
      throw new Error('Sua sessão expirou. Entre novamente.')
    }

    const corpo = await resposta.json().catch(() => ({}))

    if (!resposta.ok) {
      throw new Error(
        corpo.erro || corpo.mensagem || 'Não foi possível concluir a operação.',
      )
    }

    return corpo
  }

  async function carregarMinhas() {
    try {
      setMinhas(await chamarApi('/minhas'))
    } catch (erro) {
      console.error('Erro ao carregar suas reservas:', erro)
    }
  }

  async function carregarPainel(silencioso = false) {
    if (!ehAprovador) return

    if (!silencioso) setCarregandoPainel(true)

    try {
      setPainel(await chamarApi('/todas'))
    } catch (erro) {
      if (!silencioso) {
        setMensagemPainel(
          erro instanceof Error
            ? erro.message
            : 'Não foi possível carregar o painel.',
        )
      }
    } finally {
      setCarregandoPainel(false)
    }
  }

  // Ao entrar (ou recarregar a página já logado) busca as reservas do usuário
  // e, se for o diretor, as solicitações de todos. Atualiza a cada 30s.
  useEffect(() => {
    if (!sessao) return

    void carregarMinhas()
    void carregarPainel(true)

    const intervalo = setInterval(() => {
      void carregarMinhas()
      void carregarPainel(true)
    }, 30000)

    return () => clearInterval(intervalo)
  }, [sessao])

  async function aprovar(id: string) {
    setProcessandoId(id)
    setMensagemPainel('')

    try {
      await chamarApi(`/${id}/aprovar`, { method: 'PATCH' })
      setMensagemPainel('Agendamento aprovado.')
      await carregarPainel(true)
      void carregarMinhas()
    } catch (erro) {
      setMensagemPainel(
        erro instanceof Error ? erro.message : 'Não foi possível aprovar.',
      )
      void carregarPainel(true)
    } finally {
      setProcessandoId('')
    }
  }

  async function reprovar(id: string) {
    if (motivo.trim().length < 5) {
      setMensagemPainel(
        'Informe o motivo da reprovação (mínimo de 5 caracteres).',
      )
      return
    }

    setProcessandoId(id)
    setMensagemPainel('')

    try {
      await chamarApi(`/${id}/reprovar`, {
        method: 'PATCH',
        body: JSON.stringify({ motivo: motivo.trim() }),
      })
      setMensagemPainel('Agendamento reprovado. O horário foi liberado.')
      setReprovandoId('')
      setMotivo('')
      await carregarPainel(true)
      void carregarMinhas()
      void carregarReservas(true)
    } catch (erro) {
      setMensagemPainel(
        erro instanceof Error ? erro.message : 'Não foi possível reprovar.',
      )
      void carregarPainel(true)
    } finally {
      setProcessandoId('')
    }
  }

  async function cancelarReserva(id: string) {
    if (!window.confirm('Deseja realmente cancelar esta reserva?')) return

    setMensagemMinhas('')

    try {
      await chamarApi(`/${id}/cancelar`, { method: 'PATCH' })
      setMensagemMinhas('Reserva cancelada. O horário foi liberado.')
      await carregarMinhas()
      void carregarReservas(true)
    } catch (erro) {
      setMensagemMinhas(
        erro instanceof Error ? erro.message : 'Não foi possível cancelar.',
      )
    }
  }

  // Vai para uma seção da tela principal, mesmo estando no painel do diretor.
  function irParaSecao(id: string) {
    setAba('agendar')
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }, 0)
  }

  // Um horário fica indisponível quando já começou (hoje) ou a data já passou.
  function horarioJaPassou(horario: string) {
    if (!data) return false
    return (
      data < agora.data || (data === agora.data && horario <= agora.hora)
    )
  }

  function abrirAuth(tipo: TipoAuth) {
    setTipoAuth(tipo)
    setMensagemAuth('')
    setSenha('')
    setConfirmarSenha('')
  }

  function fecharAuth() {
    setTipoAuth(null)
    setMensagemAuth('')
    setSenha('')
    setConfirmarSenha('')
  }

  function sair() {
    sessionStorage.removeItem('afya-sessao')
    setSessao(null)
    setTipoAuth(null)
    setMensagem('Você saiu da sua conta.')
    setNomeResponsavel('')
    setMinhas([])
    setPainel([])
    setAba('agendar')
    setReprovandoId('')
    setMotivo('')
  }

  async function autenticar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!tipoAuth || enviandoAuth) return

    const emailNormalizado = email.trim().toLowerCase()

    if (tipoAuth === 'cadastro') {
      if (nome.trim().length < 2) {
        setMensagemAuth('Informe seu nome completo.')
        return
      }

      if (senha !== confirmarSenha) {
        setMensagemAuth('As senhas não coincidem.')
        return
      }

      if (senha.length < 8 || senha.length > 72) {
        setMensagemAuth('A senha deve ter entre 8 e 72 caracteres.')
        return
      }
    }

    setEnviandoAuth(true)
    setMensagemAuth('')

    try {
      const endpoint =
        tipoAuth === 'cadastro' ? '/cadastro' : '/login'

      const corpo =
        tipoAuth === 'cadastro'
          ? { nome: nome.trim(), email: emailNormalizado, senha }
          : { email: emailNormalizado, senha }

      const resposta = await fetch(`${AUTH_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo),
      })

      const resultado = await resposta.json()

      if (!resposta.ok) {
        throw new Error(
          resultado.mensagem || 'Não foi possível concluir a operação.',
        )
      }

      if (tipoAuth === 'cadastro') {
        setMensagemAuth('Conta criada! Agora entre com seu e-mail e senha.')
        setTipoAuth('login')
        setNome('')
        setSenha('')
        setConfirmarSenha('')
        return
      }

      if (
        typeof resultado.token !== 'string' ||
        typeof resultado.usuario?.id !== 'string' ||
        typeof resultado.usuario?.nome !== 'string' ||
        typeof resultado.usuario?.email !== 'string'
      ) {
        throw new Error('O servidor retornou uma resposta inválida.')
      }

      const novaSessao: Sessao = {
        token: resultado.token,
        usuario: resultado.usuario,
      }

      sessionStorage.setItem('afya-sessao', JSON.stringify(novaSessao))
      setSessao(novaSessao)
      setNomeResponsavel(resultado.usuario.nome)
      setMensagemAuth('')
      fecharAuth()
      setMensagem('Login realizado com sucesso!')
      void carregarReservas(true)
    } catch (erro) {
      setMensagemAuth(
        erro instanceof Error
          ? erro.message
          : 'Ocorreu um erro. Tente novamente.',
      )
    } finally {
      setEnviandoAuth(false)
    }
  }

  async function agendar() {
    if (!sessao) {
      setMensagem('Entre na sua conta para solicitar um agendamento.')
      abrirAuth('login')
      return
    }

    if (!nomeResponsavel.trim() || !data || !horarioSelecionado || !modalidade) {
      setMensagem('Preencha seu nome, escolha uma data, um horário e uma modalidade.')
      return
    }

    const agoraAtual = agoraEmSaoPaulo()
    setAgora(agoraAtual)

    if (data < agoraAtual.data) {
      setMensagem('Selecione uma data válida.')
      return
    }

    if (data === agoraAtual.data && horarioSelecionado <= agoraAtual.hora) {
      setMensagem('Este horário já começou ou passou. Escolha um horário futuro.')
      setHorarioSelecionado('')
      return
    }

    const jaReservado = ocupados.some(
      (item) => item.data === data && item.horario === horarioSelecionado,
    )

    if (jaReservado) {
      setMensagem('Este horário já está reservado. Escolha outro.')
      return
    }

    setEnviando(true)
    setMensagem('')

    try {
      const resposta = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessao.token}`,
        },
        body: JSON.stringify({
          nomeResponsavel: nomeResponsavel.trim(),
          data,
          horario: horarioSelecionado,
          modalidade,
        }),
      })

      const resultado = await resposta.json()

      if (resposta.status === 401) {
        sessionStorage.removeItem('afya-sessao')
        setSessao(null)
        setMensagem('Sua sessão expirou. Entre novamente para agendar.')
        abrirAuth('login')
        return
      }

      // NOVO: alguém reservou o mesmo horário antes → atualiza a lista
      if (resposta.status === 409) {
        setHorarioSelecionado('')
        await carregarReservas(true)
        setMensagem('Este horário acabou de ser reservado. Escolha outro.')
        return
      }

      if (!resposta.ok) {
        throw new Error(
          resultado.mensagem ||
            resultado.erro ||
            'Não foi possível realizar a reserva.',
        )
      }

      // O horário já fica ocupado na grade (mesmo pendente) e a solicitação
      // aparece em "Minhas reservas" como pendente.
      const novaReserva = resultado as Reserva
      setOcupados((atuais) => [
        ...atuais,
        { data: novaReserva.data, horario: novaReserva.horario },
      ])

      setMensagem(
        'Solicitação enviada! Ela ficará pendente até o diretor aprovar.',
      )
      setHorarioSelecionado('')
      void carregarReservas(true)
      void carregarMinhas()
    } catch (erro) {
      setMensagem(
        erro instanceof Error
          ? erro.message
          : 'Ocorreu um erro ao cadastrar a reserva.',
      )
    } finally {
      setEnviando(false)
    }
  }

  function formatarData(valor: string) {
    return new Date(`${valor}T00:00:00`).toLocaleDateString('pt-BR')
  }

  // Dados derivados do painel do diretor.
  const pendentesDoPainel = painel.filter(
    (r) =>
      r.status === 'reservado' &&
      r.aprovacao === 'pendente' &&
      r.data >= agora.data,
  )
  const totalPendentes = pendentesDoPainel.length

  const painelFiltrado = painel.filter((r) => {
    if (filtroPainel === 'pendentes') return pendentesDoPainel.includes(r)
    if (filtroPainel === 'aprovados') {
      return r.aprovacao === 'aprovado' && r.status === 'reservado'
    }
    if (filtroPainel === 'reprovados') return r.aprovacao === 'reprovado'
    return true
  })

  const filtros: { valor: FiltroPainel; rotulo: string }[] = [
    { valor: 'pendentes', rotulo: 'Pendentes' },
    { valor: 'aprovados', rotulo: 'Aprovados' },
    { valor: 'reprovados', rotulo: 'Reprovados' },
    { valor: 'todos', rotulo: 'Todos' },
  ]

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="AFYA Esportes - início">
          <span className="brand-icon">A</span>
          <span>
            <strong>AFYA</strong>
            <small>ESPORTES</small>
          </span>
        </a>

        <nav className="header-actions" aria-label="Navegação principal">
          <a
            className="header-link"
            href="#minhas-reservas"
            onClick={(event) => {
              if (aba === 'painel') {
                event.preventDefault()
                irParaSecao('minhas-reservas')
              }
            }}
          >
            Reservas
          </a>

          {sessao ? (
            <>
              {ehAprovador && (
                <button
                  className="header-button header-button-outline painel-toggle"
                  type="button"
                  onClick={() => {
                    setAba(aba === 'painel' ? 'agendar' : 'painel')
                    window.scrollTo({ top: 0 })
                    if (aba !== 'painel') void carregarPainel(true)
                  }}
                >
                  {aba === 'painel' ? 'Voltar ao app' : 'Painel do diretor'}
                  {aba !== 'painel' && totalPendentes > 0 && (
                    <span className="badge">{totalPendentes}</span>
                  )}
                </button>
              )}
              <span className="user-greeting">
                Olá, {sessao.usuario.nome.split(' ')[0]}!
              </span>
              <button className="header-button" type="button" onClick={sair}>
                Sair
              </button>
            </>
          ) : (
            <>
              <button
                className="header-button header-button-outline"
                type="button"
                onClick={() => abrirAuth('login')}
              >
                Entrar
              </button>
              <button
                className="header-button"
                type="button"
                onClick={() => abrirAuth('cadastro')}
              >
                Criar conta
              </button>
            </>
          )}
        </nav>
      </header>

      {aba === 'painel' && ehAprovador ? (
        <section className="painel section" id="painel">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ÁREA DO DIRETOR</span>
              <h2>Solicitações de agendamento</h2>
              <p>Aprove ou reprove os pedidos de reserva da quadra.</p>
            </div>
            <span className="reservation-count">{totalPendentes}</span>
          </div>

          <div className="painel-filtros" role="group" aria-label="Filtrar">
            {filtros.map((filtro) => (
              <button
                key={filtro.valor}
                type="button"
                className={`painel-filtro ${
                  filtroPainel === filtro.valor ? 'ativo' : ''
                }`}
                onClick={() => setFiltroPainel(filtro.valor)}
              >
                {filtro.rotulo}
                {filtro.valor === 'pendentes' && totalPendentes > 0 && (
                  <span className="badge">{totalPendentes}</span>
                )}
              </button>
            ))}
            <button
              type="button"
              className="painel-filtro painel-atualizar"
              onClick={() => void carregarPainel()}
              disabled={carregandoPainel}
            >
              {carregandoPainel ? 'Atualizando...' : '↻ Atualizar'}
            </button>
          </div>

          {mensagemPainel && (
            <p className="feedback" role="status">
              {mensagemPainel}
            </p>
          )}

          {carregandoPainel && painel.length === 0 ? (
            <div className="empty-state">
              <p>Carregando solicitações...</p>
            </div>
          ) : painelFiltrado.length === 0 ? (
            <div className="empty-state">
              <span>✅</span>
              <h3>Nada por aqui</h3>
              <p>Nenhuma solicitação nesta lista.</p>
            </div>
          ) : (
            <div className="reservation-list">
              {painelFiltrado.map((reserva) => {
                const selo = situacao(reserva)
                const podeAvaliar =
                  reserva.status === 'reservado' &&
                  reserva.aprovacao === 'pendente' &&
                  reserva.data >= agora.data
                const ocupadoAgora = processandoId === reserva._id

                return (
                  <article
                    className="reservation-item painel-item"
                    key={reserva._id}
                  >
                    <div className="reservation-date">
                      <span>DATA</span>
                      <strong>{formatarData(reserva.data)}</strong>
                    </div>
                    <div className="reservation-time">
                      <span>HORÁRIO</span>
                      <strong>{reserva.horario}</strong>
                    </div>
                    <div>
                      <span>SOLICITANTE</span>
                      <strong>{reserva.nomeResponsavel}</strong>
                      {reserva.usuario?.email && (
                        <small className="painel-email">
                          {reserva.usuario.email}
                        </small>
                      )}
                    </div>
                    <div>
                      <span>MODALIDADE</span>
                      <strong>{reserva.modalidade}</strong>
                    </div>
                    <span className={`status ${selo.classe}`}>
                      {selo.texto}
                    </span>

                    {reserva.aprovacao === 'reprovado' &&
                      reserva.motivoReprovacao && (
                        <p className="reservation-note">
                          Motivo: {reserva.motivoReprovacao}
                        </p>
                      )}

                    {podeAvaliar && (
                      <div className="painel-acoes">
                        {reprovandoId === reserva._id ? (
                          <div className="painel-motivo">
                            <label htmlFor={`motivo-${reserva._id}`}>
                              Motivo da reprovação (o aluno vai ver)
                            </label>
                            <textarea
                              id={`motivo-${reserva._id}`}
                              rows={2}
                              maxLength={300}
                              value={motivo}
                              placeholder="Ex.: quadra reservada para evento da faculdade"
                              onChange={(event) => setMotivo(event.target.value)}
                            />
                            <div className="painel-botoes">
                              <button
                                type="button"
                                className="btn-reprovar"
                                disabled={ocupadoAgora}
                                onClick={() => void reprovar(reserva._id)}
                              >
                                {ocupadoAgora
                                  ? 'Reprovando...'
                                  : 'Confirmar reprovação'}
                              </button>
                              <button
                                type="button"
                                className="btn-neutro"
                                disabled={ocupadoAgora}
                                onClick={() => {
                                  setReprovandoId('')
                                  setMotivo('')
                                }}
                              >
                                Voltar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="painel-botoes">
                            <button
                              type="button"
                              className="btn-aprovar"
                              disabled={ocupadoAgora}
                              onClick={() => void aprovar(reserva._id)}
                            >
                              {ocupadoAgora ? 'Aprovando...' : '✓ Aprovar'}
                            </button>
                            <button
                              type="button"
                              className="btn-reprovar-outline"
                              disabled={ocupadoAgora}
                              onClick={() => {
                                setReprovandoId(reserva._id)
                                setMotivo('')
                                setMensagemPainel('')
                              }}
                            >
                              ✕ Reprovar
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
      ) : (
        <>
        <section className="hero" id="inicio">
          <div className="hero-content">
            <span className="eyebrow">AFYA CENTRO UNIVERSITÁRIO · PATO BRANCO</span>

            <h1>
              Seu próximo jogo
              <br />
              <span>começa aqui.</span>
            </h1>

            <p>
              Agende a quadra esportiva da faculdade de forma simples,
              rápida e pelo seu celular.
            </p>

            <a className="primary-link" href="#agendamento">
              Agendar horário <span>→</span>
            </a>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="court">
              <div className="court-center" />
              <div className="court-circle" />
              <div className="court-area court-area-left" />
              <div className="court-area court-area-right" />
            </div>
            <span className="ball">🏀</span>
            <span className="hero-tag">MOVIMENTO &amp; SAÚDE</span>
          </div>
        </section>

        <section className="booking section" id="agendamento">
          <div className="section-heading">
            <div>
              <span className="eyebrow">RESERVE SEU ESPAÇO</span>
              <h2>Agende sua quadra</h2>
              <p>Escolha o melhor dia e horário para jogar.</p>
            </div>
            <span className="calendar-icon">▦</span>
          </div>

          <div className="booking-card">
            <label htmlFor="nomeResponsavel">1. Nome do responsável</label>
            <input
              id="nomeResponsavel"
              type="text"
              value={nomeResponsavel}
              maxLength={100}
              placeholder="Digite seu nome completo"
              onChange={(event) => setNomeResponsavel(event.target.value)}
            />

            <label htmlFor="modalidade">2. Modalidade esportiva</label>
            <select
              id="modalidade"
              value={modalidade}
              onChange={(event) => setModalidade(event.target.value)}
            >
              {modalidades.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {opcao}
                </option>
              ))}
            </select>

            <label htmlFor="data">3. Escolha a data</label>
            <input
              id="data"
              type="date"
              value={data}
              min={agora.data}
              onChange={(event) => {
                setData(event.target.value)
                setHorarioSelecionado('')
                setMensagem('')
                void carregarReservas(true)
              }}
            />

            <div className="availability-heading">
              <label>4. Selecione um horário</label>
              <span>{horarios.length} opções</span>
            </div>

            <div className="time-grid">
              {horarios.map((horario) => {
                const ocupado = ocupados.some(
                  (item) => item.data === data && item.horario === horario,
                )

                const passado = horarioJaPassou(horario)

                return (
                  <button
                    key={horario}
                    type="button"
                    className={`time-option ${
                      horarioSelecionado === horario ? 'selected' : ''
                    }`}
                    disabled={
                      !data || ocupado || passado || carregando || enviando
                    }
                    onClick={() => {
                      setHorarioSelecionado(horario)
                      setMensagem('')
                    }}
                  >
                    {horario}
                    {ocupado ? (
                      <small>Reservado</small>
                    ) : (
                      passado && <small>Encerrado</small>
                    )}
                  </button>
                )
              })}
            </div>

            {mensagem && (
              <p className="feedback" role="status">
                {mensagem}
              </p>
            )}

            <button
              type="button"
              className="book-button"
              onClick={agendar}
              disabled={enviando || carregando}
            >
              {enviando ? 'Salvando reserva...' : 'Solicitar agendamento'}
              {!enviando && <span> →</span>}
            </button>

            <p className="notice">
              {sessao
                ? `Conectado como ${sessao.usuario.email}.`
                : 'Entre ou crie uma conta para solicitar um agendamento.'}
            </p>
          </div>
        </section>

        <section className="reservations section" id="minhas-reservas">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SUA AGENDA</span>
              <h2>Minhas reservas</h2>
              <p>
                Acompanhe se o diretor já aprovou os seus pedidos de horário.
              </p>
            </div>
            <span className="reservation-count">{minhas.length}</span>
          </div>

          {mensagemMinhas && (
            <p className="feedback" role="status">
              {mensagemMinhas}
            </p>
          )}

          {!sessao ? (
            <div className="empty-state">
              <span>🔒</span>
              <h3>Entre para ver suas reservas</h3>
              <p>Faça login para solicitar e acompanhar seus agendamentos.</p>
            </div>
          ) : minhas.length === 0 ? (
            <div className="empty-state">
              <span>📅</span>
              <h3>Nenhuma reserva por enquanto</h3>
              <p>Escolha uma data e solicite seu próximo horário.</p>
            </div>
          ) : (
            <div className="reservation-list">
              {minhas.map((reserva) => {
                const selo = situacao(reserva)
                const podeCancelar =
                  reserva.status === 'reservado' && reserva.data >= agora.data

                return (
                  <article className="reservation-item" key={reserva._id}>
                    <div className="reservation-date">
                      <span>DATA</span>
                      <strong>{formatarData(reserva.data)}</strong>
                    </div>
                    <div className="reservation-time">
                      <span>HORÁRIO</span>
                      <strong>{reserva.horario}</strong>
                    </div>
                    <div>
                      <span>RESPONSÁVEL</span>
                      <strong>{reserva.nomeResponsavel}</strong>
                    </div>
                    <div>
                      <span>MODALIDADE</span>
                      <strong>{reserva.modalidade}</strong>
                    </div>
                    <aside className="reservation-side">
                      <span className={`status ${selo.classe}`}>
                        {selo.texto}
                      </span>
                      {podeCancelar && (
                        <button
                          type="button"
                          className="btn-cancelar"
                          onClick={() => void cancelarReserva(reserva._id)}
                        >
                          Cancelar
                        </button>
                      )}
                    </aside>

                    {reserva.aprovacao === 'reprovado' &&
                      reserva.motivoReprovacao && (
                        <p className="reservation-note">
                          Motivo da reprovação: {reserva.motivoReprovacao}
                        </p>
                      )}
                    {selo.texto === 'Pendente' && (
                      <p className="reservation-note reservation-note-info">
                        Aguardando aprovação do diretor. O horário já está
                        reservado para você enquanto isso.
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
        </>
      )}

      <footer className="footer">
        <a className="brand footer-brand" href="#inicio">
          <span className="brand-icon">A</span>
          <span>
            <strong>AFYA</strong>
            <small>ESPORTES</small>
          </span>
        </a>
        <p>Afya Centro Universitário · Pato Branco, Paraná</p>
        <small>Pratique esporte. Compartilhe momentos.</small>
      </footer>

      {tipoAuth && (
        <div
          className="auth-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !enviandoAuth) {
              fecharAuth()
            }
          }}
        >
          <section
            className="auth-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
          >
            <button
              type="button"
              className="auth-close"
              aria-label="Fechar"
              onClick={fecharAuth}
              disabled={enviandoAuth}
            >
              ×
            </button>

            <div className="auth-brand-mark">A</div>
            <span className="eyebrow">AFYA ESPORTES</span>

            <h2 id="auth-title">
              {tipoAuth === 'login' ? 'Bem-vindo de volta!' : 'Crie sua conta'}
            </h2>
            <p className="auth-description">
              {tipoAuth === 'login'
                ? 'Entre para continuar sua experiência esportiva.'
                : 'Cadastre-se para solicitar seus agendamentos.'}
            </p>

            <form className="auth-form" onSubmit={autenticar}>
              {tipoAuth === 'cadastro' && (
                <>
                  <label htmlFor="auth-nome">Nome completo</label>
                  <input
                    id="auth-nome"
                    type="text"
                    autoComplete="name"
                    value={nome}
                    maxLength={100}
                    onChange={(event) => setNome(event.target.value)}
                    placeholder="Seu nome completo"
                    required
                    minLength={2}
                  />
                </>
              )}

              <label htmlFor="auth-email">E-mail</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@exemplo.com"
                maxLength={254}
                required
              />

              <label htmlFor="auth-senha">Senha</label>
              <input
                id="auth-senha"
                type="password"
                autoComplete={
                  tipoAuth === 'login' ? 'current-password' : 'new-password'
                }
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Mínimo de 8 caracteres"
                minLength={8}
                maxLength={72}
                required
              />

              {tipoAuth === 'cadastro' && (
                <>
                  <label htmlFor="auth-confirmar">Confirmar senha</label>
                  <input
                    id="auth-confirmar"
                    type="password"
                    autoComplete="new-password"
                    value={confirmarSenha}
                    onChange={(event) => setConfirmarSenha(event.target.value)}
                    placeholder="Digite a senha novamente"
                    minLength={8}
                    maxLength={72}
                    required
                  />
                </>
              )}

              {mensagemAuth && (
                <p className="feedback auth-feedback" role="status">
                  {mensagemAuth}
                </p>
              )}

              <button
                className="book-button auth-submit"
                type="submit"
                disabled={enviandoAuth}
              >
                {enviandoAuth
                  ? 'Aguarde...'
                  : tipoAuth === 'login'
                    ? 'Entrar na minha conta'
                    : 'Criar minha conta'}
              </button>
            </form>

            <p className="auth-switch">
              {tipoAuth === 'login'
                ? 'Ainda não tem conta?'
                : 'Já possui uma conta?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setMensagemAuth('')
                  setTipoAuth(tipoAuth === 'login' ? 'cadastro' : 'login')
                }}
                disabled={enviandoAuth}
              >
                {tipoAuth === 'login' ? 'Cadastre-se' : 'Faça login'}
              </button>
            </p>
          </section>
        </div>
      )}
    </main>
  )
}

export default App