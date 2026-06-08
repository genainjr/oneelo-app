'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { api, HttpError } from '@/lib/api';

// ─── Ícones ────────────────────────────────────────────────────────────────────

function IconUsers() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}

function IconMusic() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg className="w-5 h-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// ─── Seções ────────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">OneElo</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-lg transition"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}

function Hero({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <section className="pt-32 pb-20 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-medium mb-6">
          Gestão para igrejas
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight mb-5">
          Organize sua igreja com{' '}
          <span className="text-indigo-600">mais facilidade</span>
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl mx-auto">
          OneElo centraliza membros, ministérios, escalas e agenda em um só lugar —
          para que você foque no que realmente importa.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onCtaClick}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-200 text-sm"
          >
            Solicitar demonstração
          </button>
          <Link
            href="/login"
            className="px-6 py-3 text-gray-600 hover:text-gray-900 font-medium text-sm transition"
          >
            Já tenho acesso →
          </Link>
        </div>
      </div>

      {/* Preview mockup */}
      <div className="mt-16 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-2xl shadow-gray-200/80 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-100 px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-300" />
            <div className="w-3 h-3 rounded-full bg-yellow-300" />
            <div className="w-3 h-3 rounded-full bg-green-300" />
            <div className="flex-1 bg-white rounded-md h-6 mx-4 border border-gray-200" />
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-100 text-xs">
            {['Membros', 'Ministérios', 'Escalas', 'Agenda'].map((mod) => (
              <div key={mod} className="p-4 text-center">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg mx-auto mb-2" />
                <span className="text-gray-600 font-medium">{mod}</span>
              </div>
            ))}
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-50 rounded-xl border border-gray-100 animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const MODULOS = [
  {
    icon: <IconUsers />,
    titulo: 'Gestão de Membros',
    descricao: 'Cadastre, filtre e organize todos os membros da sua igreja. Tags, status, datas de nascimento e muito mais.',
    cor: 'bg-blue-50 text-blue-600',
  },
  {
    icon: <IconMusic />,
    titulo: 'Ministérios',
    descricao: 'Crie ministérios, defina funções e gerencie quem faz parte de cada equipe com controle de liderança.',
    cor: 'bg-purple-50 text-purple-600',
  },
  {
    icon: <IconGrid />,
    titulo: 'Escalas',
    descricao: 'Monte grades mensais de serviço por ministério. Membros confirmam presença diretamente pelo sistema.',
    cor: 'bg-indigo-50 text-indigo-600',
  },
  {
    icon: <IconCalendar />,
    titulo: 'Agenda',
    descricao: 'Registre cultos, ensaios e eventos. Tudo integrado com as escalas para uma visão completa da semana.',
    cor: 'bg-emerald-50 text-emerald-600',
  },
];

function Modulos() {
  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Tudo que sua igreja precisa</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Quatro módulos integrados para uma gestão completa, sem planilhas e sem complicação.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MODULOS.map((m) => (
            <div key={m.titulo} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${m.cor}`}>
                {m.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{m.titulo}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{m.descricao}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const BENEFICIOS = [
  {
    titulo: 'Organização real',
    itens: [
      'Visão centralizada de toda a igreja',
      'Histórico completo de cada membro',
      'Filtros e buscas avançadas',
      'Log de auditoria de ações',
    ],
  },
  {
    titulo: 'Multi-idioma',
    itens: [
      'Português (Brasil)',
      'Português (Portugal)',
      'Inglês (EUA)',
      'Mais idiomas em breve',
    ],
  },
  {
    titulo: 'Seguro e acessível',
    itens: [
      'Dados isolados por igreja',
      'Controle de permissões por usuário',
      'Acesso de qualquer dispositivo',
      'Sem instalação necessária',
    ],
  },
];

function Beneficios() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Por que o OneElo?</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Desenvolvido para a realidade das igrejas brasileiras, com foco em simplicidade e eficiência.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6">
          {BENEFICIOS.map((b) => (
            <div key={b.titulo} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">{b.titulo}</h3>
              <ul className="space-y-3">
                {b.itens.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                    <IconCheck />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PLANOS = [
  {
    nome: 'Gratuito',
    preco: 'R$ 0',
    periodo: 'para sempre',
    descricao: 'Para igrejas pequenas começando a se organizar.',
    itens: ['Até 50 membros', '2 ministérios', 'Escalas mensais', 'Agenda básica'],
    destaque: false,
    cta: 'Solicitar acesso',
  },
  {
    nome: 'Básico',
    preco: 'R$ 49',
    periodo: 'por mês',
    descricao: 'Para igrejas em crescimento com mais ministérios.',
    itens: ['Até 200 membros', 'Ministérios ilimitados', 'Escalas + confirmação', 'Suporte prioritário'],
    destaque: true,
    cta: 'Solicitar demonstração',
  },
  {
    nome: 'Profissional',
    preco: 'R$ 99',
    periodo: 'por mês',
    descricao: 'Para igrejas grandes que precisam do máximo.',
    itens: ['Membros ilimitados', 'Tudo do Básico', 'Múltiplos administradores', 'Relatórios avançados'],
    destaque: false,
    cta: 'Solicitar demonstração',
  },
];

function Planos({ onCtaClick }: { onCtaClick: () => void }) {
  return (
    <section className="py-20 px-6 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Planos simples e transparentes</h2>
          <p className="text-gray-500 max-w-xl mx-auto">Comece gratuitamente e escale conforme sua igreja cresce.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-6 items-start">
          {PLANOS.map((p) => (
            <div
              key={p.nome}
              className={`rounded-2xl p-6 border ${p.destaque
                ? 'bg-indigo-600 border-indigo-600 shadow-xl shadow-indigo-200'
                : 'bg-white border-gray-100 shadow-sm'
              }`}
            >
              <div className="mb-5">
                <p className={`text-sm font-medium mb-1 ${p.destaque ? 'text-indigo-200' : 'text-gray-500'}`}>{p.nome}</p>
                <div className="flex items-end gap-1.5">
                  <span className={`text-3xl font-bold ${p.destaque ? 'text-white' : 'text-gray-900'}`}>{p.preco}</span>
                  <span className={`text-sm pb-1 ${p.destaque ? 'text-indigo-200' : 'text-gray-400'}`}>/ {p.periodo}</span>
                </div>
                <p className={`text-sm mt-2 ${p.destaque ? 'text-indigo-200' : 'text-gray-500'}`}>{p.descricao}</p>
              </div>
              <ul className="space-y-2.5 mb-6">
                {p.itens.map((item) => (
                  <li key={item} className={`flex items-center gap-2 text-sm ${p.destaque ? 'text-indigo-100' : 'text-gray-600'}`}>
                    <svg className={`w-4 h-4 shrink-0 ${p.destaque ? 'text-indigo-300' : 'text-indigo-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                onClick={onCtaClick}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition ${p.destaque
                  ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                  : 'bg-indigo-600 text-white hover:bg-indigo-500'
                }`}
              >
                {p.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Formulario({ formRef }: { formRef: React.RefObject<HTMLElement | null> }) {
  const [form, setForm] = useState({ nome: '', email: '', telefone: '', mensagem: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function set(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      await api.post('/api/leads', form);
      setStatus('success');
      setForm({ nome: '', email: '', telefone: '', mensagem: '' });
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof HttpError ? err.message : 'Erro ao enviar. Tente novamente.');
    }
  }

  return (
    <section ref={formRef as React.RefObject<HTMLElement>} className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Solicitar demonstração</h2>
          <p className="text-gray-500">Preencha o formulário e entraremos em contato em até 48 horas.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-emerald-900 mb-1">Solicitação recebida!</h3>
            <p className="text-emerald-700 text-sm">Entraremos em contato em breve no e-mail informado.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => set('nome', e.target.value)}
                    placeholder="Pastor João"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="pastor@suaigreja.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  value={form.telefone}
                  onChange={(e) => set('telefone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  rows={3}
                  value={form.mensagem}
                  onChange={(e) => set('mensagem', e.target.value)}
                  placeholder="Conte um pouco sobre sua igreja e o que você precisa..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition resize-none"
                />
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm shadow-lg shadow-indigo-200"
              >
                {status === 'loading' ? 'Enviando...' : 'Enviar solicitação'}
              </button>
            </form>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-indigo-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-xs">O</span>
          </div>
          <span>OneElo — <span className="text-gray-500">Lookup Labs</span></span>
        </div>
        <span>© {new Date().getFullYear()} Lookup Labs. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}

// ─── Página ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const formRef = { current: null as HTMLElement | null };

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero onCtaClick={scrollToForm} />
      <Modulos />
      <Beneficios />
      <Planos onCtaClick={scrollToForm} />
      <Formulario formRef={formRef} />
      <Footer />
    </div>
  );
}
