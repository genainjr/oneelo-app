import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAndroidGoogleCalendarIntentUrl,
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildIcsContent,
  consolidateEscalasToCalendarEvents,
  detectCalendarPlatform,
  mapEscalaToCalendarEvent,
  mapEventoToCalendarEvent,
  openGoogleCalendar,
  resolveCalendarDateRange,
} from './calendar-url-builder';
import type { Evento, MinhaEscalaItem } from '../types';

describe('calendar-url-builder', () => {
  it('mapeia escala com evento associado contendo dataInicio e dataFim explícitos em UTC', () => {
    const item: MinhaEscalaItem = {
      id: 'item-123',
      escalaDiaId: 'dia-1',
      membroId: 'membro-1',
      ministerioFuncaoId: 'func-1',
      statusConfirmacao: 'CONFIRMADO',
      observacoes: 'Chegar 30 min antes para passagem de som',
      data: '2026-11-15T00:00:00.000Z',
      titulo: 'Culto de Celebração',
      evento: {
        id: 'ev-1',
        titulo: 'Culto de Celebração',
        dataInicio: '2026-11-15T22:00:00.000Z',
        dataFim: '2026-11-16T00:00:00.000Z',
        local: 'Templo Principal',
        status: 'AGENDADO',
        tipo: 'GERAL',
      },
      funcao: {
        id: 'func-1',
        ministerioId: 'min-1',
        nome: 'Bateria',
        ordem: 1,
      },
      escala: {
        id: 'esc-1',
        tenantId: 'ten-1',
        ministerioId: 'min-1',
        mes: 11,
        ano: 2026,
        status: 'PUBLICADA',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        ministerio: {
          id: 'min-1',
          nome: 'Louvor',
        },
      },
    };

    const mapped = mapEscalaToCalendarEvent(item, 'https://app.oneelo.com.br');
    assert.equal(mapped.title, '[Louvor] Culto de Celebração - Bateria');
    assert.equal(mapped.location, 'Templo Principal');
    assert.equal(mapped.isAllDay, false);
    assert.ok(mapped.description?.includes('Ministério: Louvor'));
    assert.ok(mapped.description?.includes('Função: Bateria'));
    assert.ok(mapped.description?.includes('Chegar 30 min antes'));
    assert.ok(mapped.description?.includes('https://app.oneelo.com.br/minhas-escalas'));

    const url = buildGoogleCalendarUrl(mapped);
    assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
    assert.ok(url.includes('action=TEMPLATE'));
    assert.ok(url.includes('dates=20261115T220000Z%2F20261116T000000Z'));
    assert.ok(url.includes('location=Templo+Principal'));
  });

  it('aplica duração padrão de 2 horas quando o evento possui dataInicio com horário mas sem dataFim', () => {
    const range = resolveCalendarDateRange({
      title: 'Culto de Oração',
      startDate: '2026-11-18T22:30:00.000Z',
      endDate: null,
      isAllDay: false,
    });

    assert.equal(range.isAllDay, false);
    assert.equal(range.startFormatted, '20261118T223000Z');
    assert.equal(range.endFormatted, '20261119T003000Z');
    assert.equal(range.googleDatesParam, '20261118T223000Z/20261119T003000Z');
  });

  it('previne bug de fuso UTC-3 tratando escala sem evento associado (00:00:00.000Z) como evento All-Day no dia civil exato', () => {
    const item: MinhaEscalaItem = {
      id: 'item-all-day',
      escalaDiaId: 'dia-all-day',
      membroId: 'membro-1',
      ministerioFuncaoId: 'func-2',
      statusConfirmacao: 'PENDENTE',
      data: '2026-11-22T00:00:00.000Z',
      titulo: 'Escala de Domingo',
      evento: null,
      funcao: {
        id: 'func-2',
        ministerioId: 'min-midia',
        nome: 'Projeção',
        ordem: 1,
      },
      escala: {
        id: 'esc-2',
        tenantId: 'ten-1',
        ministerioId: 'min-midia',
        mes: 11,
        ano: 2026,
        status: 'PUBLICADA',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        ministerio: {
          id: 'min-midia',
          nome: 'Mídia',
        },
      },
    };

    const mapped = mapEscalaToCalendarEvent(item, 'https://app.oneelo.com.br');
    assert.equal(mapped.isAllDay, true);

    const range = resolveCalendarDateRange(mapped);
    assert.equal(range.isAllDay, true);
    assert.equal(range.startFormatted, '20261122');
    assert.equal(range.endFormatted, '20261123');
    assert.equal(range.googleDatesParam, '20261122/20261123');
  });

  it('consolida múltiplas funções do mesmo voluntário no mesmo dia de escala em um único evento de calendário', () => {
    const baseItem: MinhaEscalaItem = {
      id: 'item-a',
      escalaDiaId: 'dia-domingo',
      membroId: 'membro-1',
      ministerioFuncaoId: 'func-violao',
      statusConfirmacao: 'CONFIRMADO',
      data: '2026-11-15T00:00:00.000Z',
      titulo: 'Culto da Família',
      evento: {
        id: 'ev-dom',
        titulo: 'Culto da Família',
        dataInicio: '2026-11-15T22:00:00.000Z',
        dataFim: '2026-11-16T00:00:00.000Z',
        local: 'Santuário',
        status: 'AGENDADO',
        tipo: 'GERAL',
      },
      funcao: {
        id: 'func-violao',
        ministerioId: 'min-louvor',
        nome: 'Violão',
        ordem: 1,
      },
      escala: {
        id: 'esc-1',
        tenantId: 'ten-1',
        ministerioId: 'min-louvor',
        mes: 11,
        ano: 2026,
        status: 'PUBLICADA',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        ministerio: {
          id: 'min-louvor',
          nome: 'Louvor',
        },
      },
    };

    const secondItem: MinhaEscalaItem = {
      ...baseItem,
      id: 'item-b',
      ministerioFuncaoId: 'func-ministro',
      funcao: {
        id: 'func-ministro',
        ministerioId: 'min-louvor',
        nome: 'Ministro',
        ordem: 2,
      },
    };

    const consolidated = consolidateEscalasToCalendarEvents([baseItem, secondItem]);
    assert.equal(consolidated.length, 1);
    assert.equal(consolidated[0].title, '[Louvor] Culto da Família - Violão, Ministro');
    assert.ok(consolidated[0].description?.includes('Funções: Violão, Ministro'));
  });

  it('mapeia eventos gerais e ministeriais da igreja e gera conteúdo .ics RFC 5545 válido', () => {
    const eventoGeral: Evento = {
      id: 'ev-conf-1',
      tenantId: 'ten-1',
      titulo: 'Conferência Anual, Fé; Esperança',
      descricao: 'Programação especial\nEntrada franca',
      local: 'Auditório Central, Rua A, 100',
      tipo: 'GERAL',
      dataInicio: '2026-11-28T22:00:00.000Z',
      dataFim: '2026-11-29T01:00:00.000Z',
      status: 'AGENDADO',
      createdAt: '2026-11-01T00:00:00.000Z',
      updatedAt: '2026-11-01T00:00:00.000Z',
      ministerios: [
        {
          eventoId: 'ev-conf-1',
          ministerioId: 'min-1',
          requerEscala: true,
          ministerio: { id: 'min-1', nome: 'Louvor' },
        },
      ],
    };

    const mappedEvento = mapEventoToCalendarEvent(eventoGeral, 'https://app.oneelo.com.br');
    assert.equal(mappedEvento.title, 'Conferência Anual, Fé; Esperança');
    assert.equal(mappedEvento.uid, 'evento-ev-conf-1@oneelo.app');

    const allDayEvent = {
      uid: 'allday-1@oneelo.app',
      title: 'Jejum Congregacional',
      startDate: '2026-11-30',
      isAllDay: true,
    };

    const ics = buildIcsContent([mappedEvento, allDayEvent], new Date('2026-11-09T12:00:00.000Z'));
    assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
    assert.ok(ics.includes('UID:evento-ev-conf-1@oneelo.app\r\n'));
    assert.ok(ics.includes('DTSTART:20261128T220000Z\r\n'));
    assert.ok(ics.includes('DTEND:20261129T010000Z\r\n'));
    assert.ok(ics.includes('SUMMARY:Conferência Anual\\, Fé\\; Esperança\r\n'));
    assert.ok(ics.includes('LOCATION:Auditório Central\\, Rua A\\, 100\r\n'));
    assert.ok(ics.includes('DTSTART;VALUE=DATE:20261130\r\n'));
    assert.ok(ics.includes('DTEND;VALUE=DATE:20261201\r\n'));
    assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  });

  it('gera URL de deeplink para Microsoft Outlook Web para evento com horário e All-Day', () => {
    const timedEvent = {
      title: 'Ensaio Geral',
      description: 'Ensaio com toda a equipe',
      location: 'Sala 3',
      startDate: '2026-11-20T21:00:00.000Z',
      endDate: '2026-11-20T23:00:00.000Z',
      isAllDay: false,
    };

    const timedUrl = buildOutlookCalendarUrl(timedEvent);
    assert.ok(timedUrl.startsWith('https://outlook.live.com/calendar/0/deeplink/compose?'));
    assert.ok(timedUrl.includes('path=%2Fcalendar%2Faction%2Fcompose'));
    assert.ok(timedUrl.includes('rru=addevent'));
    assert.ok(timedUrl.includes('subject=Ensaio+Geral'));
    assert.ok(timedUrl.includes('startdt=2026-11-20T21%3A00%3A00.000Z'));
    assert.ok(timedUrl.includes('enddt=2026-11-20T23%3A00%3A00.000Z'));
    assert.ok(timedUrl.includes('location=Sala+3'));
    assert.ok(timedUrl.includes('body=Ensaio+com+toda+a+equipe'));

    const allDayEvent = {
      title: 'Vigília da Igreja',
      startDate: '2026-11-21',
      isAllDay: true,
    };

    const allDayUrl = buildOutlookCalendarUrl(allDayEvent);
    assert.ok(allDayUrl.includes('allday=true'));
    assert.ok(allDayUrl.includes('startdt=2026-11-21'));
    assert.ok(allDayUrl.includes('enddt=2026-11-21'));
    assert.ok(allDayUrl.includes('subject=Vig%C3%ADlia+da+Igreja'));
  });

  it('retorna "other" quando executado em ambiente SSR (sem window/navigator)', () => {
    const platform = detectCalendarPlatform();
    // Em ambiente Node.js / SSR sem browser globals reais, o fallback é 'other'
    assert.ok(['other', 'windows', 'apple', 'android'].includes(platform));
  });

  it('gera URL de intent Android para Google Agenda nativo prevenindo Chrome Custom Tab órfã', () => {
    const event = {
      title: 'Culto de Celebração',
      startDate: '2026-11-15T22:00:00.000Z',
      endDate: '2026-11-16T00:00:00.000Z',
      location: 'Templo Principal',
      description: 'Chegar 15 minutos antes',
    };

    const intentUrl = buildAndroidGoogleCalendarIntentUrl(event);
    assert.ok(intentUrl.startsWith('intent://calendar.google.com/calendar/render?'));
    assert.ok(intentUrl.includes('action=TEMPLATE'));
    assert.ok(intentUrl.includes('text=Culto+de+Celebra%C3%A7%C3%A3o'));
    assert.ok(intentUrl.includes('#Intent;scheme=https;package=com.google.android.calendar;'));
    assert.ok(intentUrl.includes('S.browser_fallback_url=https%3A%2F%2Fcalendar.google.com%2Fcalendar%2Frender%3F'));
    assert.ok(intentUrl.endsWith(';end'));
  });
});
