'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { api, HttpError } from '@/lib/api';

// Ícones

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
    <svg className="w-5 h-5 text-teal-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

// Seções

function Navbar() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.jpg"
            alt="One Elo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover"
            priority
          />
          <span className="font-bold text-gray-900 text-lg">One Elo</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 text-sm font-medium text-indigo-700 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-lg transition"
        >
          Entrar
        </Link>
      </div>
    </header>
  );
}

function Hero({ onCtaClick }: { onCtaClick: () => void }) {
  const previewStats = [
    { label: 'Membros', value: 'Cadastro', color: 'bg-indigo-50 text-indigo-700' },
    { label: 'Ministérios', value: 'Equipes', color: 'bg-teal-50 text-teal-700' },
    { label: 'Agenda', value: 'Eventos', color: 'bg-sky-50 text-sky-700' },
  ];

  const previewRows = [
    { title: 'Culto de domingo', meta: 'Agenda', status: 'Agendado', tone: 'bg-sky-50 text-sky-700' },
    { title: 'Escala de louvor', meta: 'Escalas', status: 'Confirmações', tone: 'bg-teal-50 text-teal-700' },
    { title: 'Equipe de recepção', meta: 'Ministérios', status: 'Organizado', tone: 'bg-indigo-50 text-indigo-700' },
  ];

  return (
    <section className="pt-28 pb-20 px-6 bg-[radial-gradient(circle_at_top_left,#334155_0%,#1e1b4b_42%,#0f172a_100%)]">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[0.95fr_1.05fr] gap-12 lg:gap-14 items-center">
        <div className="text-center lg:text-left">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-indigo-100 text-xs font-medium mb-6">
            Gestão operacional para igrejas
          </span>
          <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-5">
            Menos planilhas. Menos mensagens perdidas.{' '}
            <span className="text-teal-200">Mais organização para a sua igreja.</span>
          </h1>
          <p className="text-lg text-indigo-100/80 leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            O One Elo centraliza membros, ministérios, escalas e agenda para ajudar sua igreja a reduzir o retrabalho e organizar melhor a rotina administrativa.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3">
            <button
              onClick={onCtaClick}
              className="w-full sm:w-auto px-6 py-3 bg-teal-400 hover:bg-teal-300 text-slate-950 font-semibold rounded-xl transition shadow-lg shadow-teal-950/30 text-sm"
            >
              Solicitar demonstração
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="bg-white rounded-2xl border border-white/20 shadow-2xl shadow-slate-950/40 overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
              </div>
              <div className="flex-1 text-center text-xs font-medium text-gray-400">Painel One Elo</div>
            </div>

            <div className="sm:hidden bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-bold text-gray-900">Dashboard</p>
                  <p className="text-xs text-gray-500">Rotina administrativa</p>
                </div>
                <Image
                  src="/logo.jpg"
                  alt="One Elo"
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-lg object-cover"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {previewStats.slice(0, 2).map((stat) => (
                  <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                    <p className="text-[11px] font-medium text-gray-500">{stat.label}</p>
                    <p className="mt-1 text-sm font-bold text-gray-900">{stat.value}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">Rotina da semana</p>
                  <p className="text-xs text-gray-400">Agenda e escalas conectadas</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {previewRows.slice(0, 2).map((row) => (
                    <div key={row.title} className="px-3 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{row.title}</p>
                          <p className="text-xs text-gray-400">{row.meta}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${row.tone}`}>
                          {row.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                {['Membros', 'Ministérios', 'Escalas', 'Agenda'].map((mod) => (
                  <div key={mod} className="bg-white border border-slate-100 rounded-xl px-2.5 py-2 text-center font-medium text-gray-600 shadow-sm">
                    {mod}
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden sm:grid sm:grid-cols-[132px_1fr] min-h-[430px] bg-slate-50">
              <aside className="bg-indigo-950 text-indigo-100 p-4">
                <div className="flex items-center gap-2 mb-6">
                  <Image
                    src="/logo.jpg"
                    alt="One Elo"
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-lg object-cover"
                  />
                  <span className="text-sm font-semibold">One Elo</span>
                </div>
                <div className="space-y-2 text-xs">
                  {['Dashboard', 'Membros', 'Escalas', 'Agenda'].map((item, index) => (
                    <div
                      key={item}
                      className={`rounded-lg px-2.5 py-2 ${index === 0 ? 'bg-indigo-700 text-white' : 'text-indigo-200'}`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </aside>

              <div className="p-5 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <p className="text-base font-bold text-gray-900">Dashboard</p>
                    <p className="text-xs text-gray-500 mt-0.5">Visão da rotina administrativa</p>
                  </div>
                  <span className="inline-flex rounded-lg bg-white border border-slate-100 px-3 py-1.5 text-xs font-medium text-gray-500">
                    Hoje
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {previewStats.map((stat) => (
                    <div key={stat.label} className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm">
                      <div className={`w-8 h-8 rounded-lg ${stat.color} flex items-center justify-center mb-3`}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                      </div>
                      <p className="text-[11px] font-medium text-gray-500 truncate">{stat.label}</p>
                      <p className="mt-0.5 text-lg font-bold text-gray-900">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Rotina da semana</p>
                      <p className="text-xs text-gray-400">Agenda, escalas e equipes conectadas</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      Organizado
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {previewRows.map((row) => (
                      <div key={row.title} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-3 items-center">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{row.title}</p>
                          <p className="text-xs text-gray-400">{row.meta}</p>
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${row.tone}`}>
                          {row.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-4 gap-2 text-xs">
                  {['Membros', 'Ministérios', 'Escalas', 'Agenda'].map((mod) => (
                    <div key={mod} className="bg-white border border-slate-100 rounded-xl px-3 py-2.5 text-center font-medium text-gray-600 shadow-sm">
                      {mod}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const MODULOS = [
  {
    icon: <IconUsers />,
    titulo: 'Membros',
    descricao: 'Mantenha os dados das pessoas organizados, com histórico, status e informações úteis para a rotina administrativa da igreja.',
    cor: 'bg-sky-50 text-sky-700',
    detalhe: 'Base cadastral',
  },
  {
    icon: <IconMusic />,
    titulo: 'Ministérios',
    descricao: 'Organize equipes, funções e lideranças para saber quem participa de cada área e quem pode ajudar em cada responsabilidade.',
    cor: 'bg-teal-50 text-teal-700',
    detalhe: 'Equipes e funções',
  },
  {
    icon: <IconGrid />,
    titulo: 'Escalas',
    descricao: 'Monte escalas por ministério, envie convites e receba as confirmações dos voluntários diretamente pelo sistema.',
    cor: 'bg-indigo-50 text-indigo-700',
    detalhe: 'Serviço voluntário',
  },
  {
    icon: <IconCalendar />,
    titulo: 'Agenda',
    descricao: 'Registre cultos, reuniões e eventos para dar mais visibilidade à programação e apoiar o planejamento das equipes.',
    cor: 'bg-emerald-50 text-emerald-700',
    detalhe: 'Programação',
  },
];

function Modulos() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-12">
          <span className="inline-flex items-center rounded-full bg-white border border-slate-100 px-3 py-1 text-xs font-medium text-indigo-700 mb-4">
            Módulos principais
          </span>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Menos informação espalhada, mais rotina organizada</h2>
          <p className="text-gray-500">Reúna os principais cadastros e processos da igreja em uma plataforma feita para apoiar a administração do dia a dia.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {MODULOS.map((m) => (
            <div key={m.titulo} className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-slate-200 transition-all">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${m.cor}`}>
                  {m.icon}
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 group-hover:text-gray-500 transition-colors">
                  {m.detalhe}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{m.titulo}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{m.descricao}</p>
              <div className="mt-5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full w-1/2 rounded-full ${m.cor.split(' ')[0]}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const BENEFICIOS = [
  {
    titulo: 'Centralização da rotina',
    itens: [
      'Membros, ministérios, escalas e agenda no mesmo ambiente',
      'Menos dependência de planilhas e conversas antigas',
      'Informações importantes mais fáceis de localizar',
      'Histórico para apoiar decisões administrativas',
    ],
  },
  {
    titulo: 'Organização para as equipes',
    itens: [
      'Responsabilidades mais claras por ministério',
      'Escalas organizadas por período e equipe',
      'Convites e confirmações diretamente pelo sistema',
      'Mais previsibilidade para líderes e voluntários',
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
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Por que o One Elo?</h2>
          <p className="text-gray-500">Porque a gestão da igreja fica mais leve quando as informações estão centralizadas, atualizadas e fáceis de encontrar.</p>
        </div>
        <div className="grid lg:grid-cols-3 gap-5">
          {BENEFICIOS.map((b, index) => (
            <div key={b.titulo} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-sm font-bold text-indigo-700">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-gray-900">{b.titulo}</h3>
              </div>
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

function Planos({ onCtaClick }: { onCtaClick: () => void }) {
  const rotina = [
    {
      icon: <IconUsers />,
      titulo: 'Membros',
      descricao: 'A igreja começa com uma base organizada de pessoas, contatos, status e histórico administrativo.',
    cor: 'bg-sky-50 text-sky-700',
    },
    {
      icon: <IconMusic />,
      titulo: 'Ministérios',
      descricao: 'Com os membros organizados, as equipes ganham funções e lideranças mais claras.',
    cor: 'bg-teal-50 text-teal-700',
    },
    {
      icon: <IconGrid />,
      titulo: 'Escalas',
      descricao: 'Com as equipes definidas, os líderes organizam os serviços e acompanham as confirmações dos voluntários.',
    cor: 'bg-indigo-50 text-indigo-700',
    },
    {
      icon: <IconCalendar />,
      titulo: 'Agenda',
      descricao: 'A programação da igreja fica mais visível, ajudando a equipe a acompanhar cultos, reuniões e eventos.',
    cor: 'bg-emerald-50 text-emerald-700',
    },
  ];

  return (
    <section className="py-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Da base de membros à rotina da semana</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">O One Elo organiza as informações em uma sequência simples: pessoas bem cadastradas, equipes definidas, escalas acompanhadas e agenda visível para a equipe.</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 lg:p-8">
          <div className="grid gap-0 lg:grid-cols-4">
            {rotina.map((item, index) => (
              <div key={item.titulo} className="relative">
                {index < rotina.length - 1 && (
                  <>
                    <div className="hidden lg:block absolute left-[calc(50%+40px)] right-[-50%] top-9 h-px bg-slate-200" />
                    <div className="lg:hidden absolute left-6 top-14 bottom-0 w-px bg-slate-200" />
                  </>
                )}

                <div className="relative flex gap-4 pb-8 last:pb-0 lg:block lg:px-4 lg:pb-0 lg:text-center">
                  <div className="relative z-10 flex shrink-0 flex-col items-center">
                    <span className="mb-2 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-700 text-[11px] font-bold text-white">
                      {index + 1}
                    </span>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${item.cor}`}>
                      {item.icon}
                    </div>
                  </div>

                  <div className="min-w-0 pt-1 lg:pt-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{item.titulo}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">{item.descricao}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 border-t border-slate-100 pt-6 text-center">
            <p className="text-sm text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Quando tudo está conectado, a equipe perde menos tempo procurando informações e ganha mais clareza para organizar a semana.
            </p>
            <button
              onClick={onCtaClick}
              className="mt-5 w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold transition bg-indigo-700 text-white hover:bg-indigo-600 shadow-lg shadow-indigo-200"
            >
              Solicitar uma demonstração
            </button>
          </div>
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
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 mb-3">Conheça o One Elo na prática</h2>
          <p className="text-gray-500">Envie seus dados e vamos entender a rotina da sua igreja para mostrar como o One Elo pode ajudar.</p>
        </div>

        {status === 'success' ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-emerald-900 mb-1">Solicitação recebida</h3>
            <p className="text-emerald-700 text-sm">Vamos entrar em contato pelo e-mail informado para combinar os próximos passos.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    required
                    value={form.nome}
                    onChange={(e) => set('nome', e.target.value)}
                    placeholder="Seu nome"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="voce@suaigreja.com"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                <input
                  value={form.telefone}
                  onChange={(e) => set('telefone', e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  rows={3}
                  value={form.mensagem}
                  onChange={(e) => set('mensagem', e.target.value)}
                  placeholder="Conte quais processos hoje dão mais trabalho na sua igreja..."
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                />
              </div>

              {status === 'error' && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{errorMsg}</p>
              )}

              <button
                type="submit"
                disabled={status === 'loading'}
                className="w-full py-3 bg-indigo-700 hover:bg-indigo-600 text-white font-semibold rounded-xl transition disabled:opacity-60 text-sm shadow-lg shadow-indigo-200"
              >
                {status === 'loading' ? 'Enviando...' : 'Solicitar contato'}
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
    <footer className="border-t border-slate-100 py-8 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-sm text-gray-400">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.jpg"
            alt="One Elo"
            width={20}
            height={20}
            className="h-5 w-5 rounded object-cover"
          />
          <span>One Elo — <span className="text-gray-500">uma plataforma da Lookup Labs</span></span>
        </div>
        <span>© {new Date().getFullYear()} Lookup Labs. Todos os direitos reservados.</span>
      </div>
    </footer>
  );
}

// Página

export default function LandingPage() {
  const formRef = { current: null as HTMLElement | null };

  function scrollToForm() {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_34%,#eef2ff_100%)]">
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
