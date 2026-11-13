import {
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Music,
  Phone,
} from 'lucide-react';
import { InstagramIcon, WhatsAppIcon, YouTubeIcon } from './church-brand-mark';
import type { PublicSiteConfig, PublicSiteTenant } from '@/lib/api-website';
import {
  buildSafeGoogleMapsLink,
  buildWhatsappLink,
  isSafePublicHttpUrl,
} from './site-utils';

export function hasLocationContent(
  tenant: PublicSiteTenant,
  config: PublicSiteConfig | null,
): boolean {
  return Boolean(
    config?.endereco ||
      config?.cidade ||
      config?.googleMapsUrl ||
      config?.horarioSecretaria ||
      config?.whatsappAtendimento ||
      config?.instagramUrl ||
      config?.youtubeUrl ||
      config?.facebookUrl ||
      config?.spotifyUrl ||
      tenant.email ||
      tenant.telefone,
  );
}

function formatAddressLines(config: PublicSiteConfig | null): {
  line1: string | null;
  line2: string | null;
} {
  if (!config) return { line1: null, line2: null };

  const line1Parts = [
    config.endereco?.trim(),
    config.numero?.trim() ? `nº ${config.numero.trim()}` : null,
  ].filter(Boolean);

  const cityState = [config.cidade?.trim(), config.estado?.trim()]
    .filter(Boolean)
    .join(' - ');

  const line2Parts = [
    config.bairro?.trim(),
    cityState || null,
    config.cep?.trim() ? `CEP ${config.cep.trim()}` : null,
  ].filter(Boolean);

  return {
    line1: line1Parts.length > 0 ? line1Parts.join(', ') : null,
    line2: line2Parts.length > 0 ? line2Parts.join(' · ') : null,
  };
}

export function SiteLocationSection({
  tenant,
  config,
}: {
  tenant: PublicSiteTenant;
  config: PublicSiteConfig | null;
}) {
  if (!hasLocationContent(tenant, config)) return null;

  const { line1, line2 } = formatAddressLines(config);
  const mapsLink = buildSafeGoogleMapsLink({
    googleMapsUrl: config?.googleMapsUrl,
    endereco: config?.endereco,
    numero: config?.numero,
    bairro: config?.bairro,
    cidade: config?.cidade,
    estado: config?.estado,
    cep: config?.cep,
    churchName: tenant.nome,
  });
  const phoneDisplay = config?.whatsappAtendimento || tenant.telefone;
  const whatsappHref = buildWhatsappLink(phoneDisplay, tenant.nome);
  const telHref = phoneDisplay
    ? `tel:${phoneDisplay.replace(/[^\d+]/g, '')}`
    : null;
  const hasAddressOrHours = Boolean(
    line1 || line2 || config?.horarioSecretaria || mapsLink,
  );
  const socialLinks = [
    isSafePublicHttpUrl(config?.instagramUrl)
      ? { label: 'Instagram', href: config.instagramUrl, icon: InstagramIcon }
      : null,
    isSafePublicHttpUrl(config?.youtubeUrl)
      ? { label: 'YouTube', href: config.youtubeUrl, icon: YouTubeIcon }
      : null,
    isSafePublicHttpUrl(config?.facebookUrl)
      ? { label: 'Facebook', href: config.facebookUrl, icon: Globe }
      : null,
    isSafePublicHttpUrl(config?.spotifyUrl)
      ? { label: 'Spotify', href: config.spotifyUrl, icon: Music }
      : null,
  ].filter(Boolean) as Array<{ label: string; href: string; icon: typeof Globe }>;

  return (
    <section
      id="localizacao"
      className="border-b border-stone-200/80 bg-[#f4f2ed] py-14 sm:py-20"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-stone-200/90 bg-white shadow-sm">
          {hasAddressOrHours ? (
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="min-w-0 space-y-6 p-6 sm:p-9 lg:col-span-7">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    <span>Onde Estamos</span>
                  </div>
                  <h2 className="text-[clamp(1.625rem,1.25rem+1.4vw,2.25rem)] font-extrabold tracking-[-0.025em] text-zinc-950 [text-wrap:balance]">
                    Visite Nossa Comunidade
                  </h2>
                </div>

                {(line1 || line2) && (
                  <div className="space-y-1 text-base text-stone-700">
                    {line1 && (
                      <p className="font-semibold text-zinc-950">{line1}</p>
                    )}
                    {line2 && (
                      <p className="text-sm text-stone-600">{line2}</p>
                    )}
                  </div>
                )}

                {config?.horarioSecretaria && (
                  <div className="flex items-start gap-3 rounded-2xl border border-stone-200/80 bg-[#faf9f6] px-4 py-3.5 text-sm text-stone-700">
                    <Clock
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-950">
                        Atendimento da Secretaria
                      </p>
                      <p className="text-stone-600 [text-wrap:pretty]">
                        {config.horarioSecretaria}
                      </p>
                    </div>
                  </div>
                )}

                {(mapsLink || whatsappHref) && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {mapsLink && (
                      <a
                        href={mapsLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-bold text-white shadow-xs transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                      >
                        <MapPin className="h-4 w-4 text-amber-400" aria-hidden="true" />
                        <span>Abrir no Google Maps</span>
                        <ExternalLink
                          className="h-3.5 w-3.5 opacity-80"
                          aria-hidden="true"
                        />
                      </a>
                    )}

                    {whatsappHref && (
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2.5 rounded-full border border-zinc-800 bg-zinc-950 py-1.5 pl-1.5 pr-5 text-sm font-semibold text-white shadow-xs transition hover:border-amber-400/70 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-zinc-950">
                          <WhatsAppIcon className="h-4 w-4" />
                        </span>
                        <span>Iniciar conversa no WhatsApp</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center space-y-4 bg-zinc-950 p-6 text-white sm:p-9 lg:col-span-5">
                <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-amber-400">
                  Contato Direto
                </h3>

                <ul className="space-y-3">
                  {phoneDisplay && telHref && (
                    <li>
                      <a
                        href={telHref}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 transition hover:border-amber-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-zinc-950 text-amber-400">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-400">
                            Telefone
                          </p>
                          <p className="break-words font-semibold text-white">
                            {phoneDisplay}
                          </p>
                        </div>
                      </a>
                    </li>
                  )}

                  {tenant.email && (
                    <li>
                      <a
                        href={`mailto:${tenant.email}`}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 transition hover:border-amber-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-zinc-950 text-amber-400">
                          <Mail className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-400">
                            E-mail
                          </p>
                          <p className="break-words font-semibold text-white">
                            {tenant.email}
                          </p>
                        </div>
                      </a>
                    </li>
                  )}
                </ul>

                {socialLinks.length > 0 && (
                  <div className="pt-2">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      Redes Sociais
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {socialLinks.map((social) => {
                        const Icon = social.icon;
                        return (
                          <li key={social.label}>
                            <a
                              href={social.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-400/50 hover:text-amber-300"
                            >
                              <Icon className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                              <span>{social.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-stretch">
              <div className="min-w-0 space-y-2.5 p-6 sm:p-9 lg:col-span-6">
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  <span>Atendimento</span>
                </div>
                <h2 className="text-[clamp(1.625rem,1.25rem+1.4vw,2.25rem)] font-extrabold tracking-[-0.025em] text-zinc-950 [text-wrap:balance]">
                  Fale com a Nossa Equipe
                </h2>
                <p className="max-w-[50ch] text-sm leading-relaxed text-stone-600 [text-wrap:pretty]">
                  Tire dúvidas sobre programações, visitas ou participação pelos canais oficiais da {tenant.nome}.
                </p>
              </div>

              <div className="flex flex-col justify-center bg-zinc-950 p-6 text-white sm:p-9 lg:col-span-6">
                <ul className="space-y-3">
                  {whatsappHref && (
                    <li>
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex min-h-12 items-center justify-between gap-3 rounded-full border border-zinc-700/90 bg-zinc-900/95 py-1.5 pl-2 pr-4 text-sm font-bold text-white transition hover:border-amber-400/60 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="inline-flex min-w-0 items-center gap-3">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-zinc-950 transition group-hover:scale-105">
                            <WhatsAppIcon className="h-4 w-4" />
                          </span>
                          <span>Iniciar conversa no WhatsApp</span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--site-accent)] opacity-80 transition group-hover:opacity-100" aria-hidden="true" />
                      </a>
                    </li>
                  )}

                  {phoneDisplay && telHref && (
                    <li>
                      <a
                        href={telHref}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 transition hover:border-amber-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-zinc-950 text-amber-400">
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-400">
                            Telefone
                          </p>
                          <p className="break-words font-semibold text-white">
                            {phoneDisplay}
                          </p>
                        </div>
                      </a>
                    </li>
                  )}

                  {tenant.email && (
                    <li>
                      <a
                        href={`mailto:${tenant.email}`}
                        className="flex min-h-11 items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-3 text-sm text-zinc-200 transition hover:border-amber-400/50 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/30 bg-zinc-950 text-amber-400">
                          <Mail className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-400">
                            E-mail
                          </p>
                          <p className="break-words font-semibold text-white">
                            {tenant.email}
                          </p>
                        </div>
                      </a>
                    </li>
                  )}
                </ul>

                {socialLinks.length > 0 && (
                  <div className="mt-4 pt-2">
                    <p className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                      Redes Sociais
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {socialLinks.map((social) => {
                        const Icon = social.icon;
                        return (
                          <li key={social.label}>
                            <a
                              href={social.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-zinc-200 transition hover:border-amber-400/50 hover:text-amber-300"
                            >
                              <Icon className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                              <span>{social.label}</span>
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
