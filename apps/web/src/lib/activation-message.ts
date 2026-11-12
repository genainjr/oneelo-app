export function formatActivationExpiration(expiresAt?: string | null) {
  if (!expiresAt) return null;

  const expiration = new Date(expiresAt);
  if (Number.isNaN(expiration.getTime())) return null;

  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(expiration);

  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';

  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}

export function buildActivationWelcomeMessage(
  user: { nome: string; activationExpiresAt?: string | null },
  link: string,
  tenantName?: string,
) {
  const churchName = tenantName?.trim() || 'nossa igreja';
  const expiration = formatActivationExpiration(user.activationExpiresAt);

  return [
    `Olá, ${user.nome}! Seja muito bem-vindo(a) à ${churchName} no One Elo. 🎉`,
    '',
    'Seu acesso foi criado para aproximar você ainda mais da rotina da nossa igreja.',
    'No One Elo, você poderá acompanhar suas escalas, consultar a agenda, manter seu perfil atualizado e receber notificações importantes.',
    '',
    expiration
      ? `Ative sua conta pelo link abaixo. Ele expira em ${expiration} (horário de Brasília):`
      : 'Ative sua conta pelo link abaixo (válido por 72 horas):',
    link,
    '',
    'Depois da ativação, confira seus dados em Meu Perfil e habilite as notificações para não perder nenhuma novidade.',
    '',
    'Estamos felizes em ter você com a gente!',
  ].join('\n');
}
