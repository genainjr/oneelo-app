'use client';

import { useState } from 'react';

export function ChatbotButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Tooltip / Dialog */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-20 right-5 z-50 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">Assistente IA</p>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  Em breve
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Em breve você poderá usar linguagem natural para gerenciar o portal — adicionar membros, consultar escalas, criar eventos e muito mais.
            </p>
            <div className="space-y-1.5">
              {[
                '"Quem está escalado domingo?"',
                '"Adiciona João ao ministério de louvor"',
                '"Cria evento para sábado às 19h"',
              ].map((example) => (
                <div
                  key={example}
                  className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-1.5 font-mono"
                >
                  {example}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Botão flutuante */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Assistente IA (Em breve)"
        className="fixed bottom-5 right-5 z-50 w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg hover:shadow-indigo-300 hover:scale-105 transition-all flex items-center justify-center"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        )}
      </button>
    </>
  );
}
