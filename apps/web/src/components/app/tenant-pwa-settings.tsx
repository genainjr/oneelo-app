'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import type { AuthUser } from '@/types';

type TenantPwaPayload = NonNullable<AuthUser['tenant']>;

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function validatePwaIcon(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    return 'format';
  }
  if (file.size > 5 * 1024 * 1024) return 'size';

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  bitmap.close();
  if (width < 512 || height < 512) return 'dimensions';
  if (width !== height) return 'square';
  return null;
}

export function TenantPwaSettings({ tenant, onUpdated }: { tenant: TenantPwaPayload; onUpdated: (tenant: TenantPwaPayload) => void }) {
  const t = useTranslations('settings.pwa');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [shortName, setShortName] = useState(tenant.pwaShortName || '');
  const [previewUrl, setPreviewUrl] = useState<string | null>(tenant.pwaIconUrl || null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  async function saveShortName() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.patch<TenantPwaPayload>('/api/auth/tenant/pwa-settings', { shortName });
      onUpdated(updated);
      setShortName(updated.pwaShortName || '');
      setMessage({ type: 'success', text: t('messages.shortNameSaved') });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('errors.saveShortName')) });
    } finally {
      setSaving(false);
    }
  }

  async function uploadIcon(file?: File) {
    if (!file) return;
    setMessage(null);
    const validationError = await validatePwaIcon(file).catch(() => 'read');
    if (validationError) {
      setMessage({ type: 'error', text: t(`errors.${validationError}`) });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const updated = await api.post<TenantPwaPayload>('/api/auth/tenant/pwa-icon', body);
      onUpdated(updated);
      setPreviewUrl(updated.pwaIconUrl || null);
      setMessage({ type: 'success', text: t('messages.iconPublished') });
    } catch (error: unknown) {
      setPreviewUrl(tenant.pwaIconUrl || null);
      setMessage({ type: 'error', text: getErrorMessage(error, t('errors.publishIcon')) });
    } finally {
      URL.revokeObjectURL(objectUrl);
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeIcon() {
    setRemoving(true);
    setMessage(null);
    try {
      const updated = await api.delete<TenantPwaPayload>('/api/auth/tenant/pwa-icon');
      onUpdated(updated);
      setPreviewUrl(null);
      setMessage({ type: 'success', text: t('messages.iconRemoved') });
    } catch (error: unknown) {
      setMessage({ type: 'error', text: getErrorMessage(error, t('errors.removeIcon')) });
    } finally {
      setRemoving(false);
    }
  }

  const isComplete = Boolean(tenant.pwaShortName && tenant.pwaIconUrl && tenant.pwaIconKey);
  const squarePreviewUrl = previewUrl?.startsWith('blob:')
    ? previewUrl
    : previewUrl?.replace(/\/icon-512\.png$/, '/icon-square-512.png');
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-2xs">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-bold text-gray-900">{t('title')}</h2>
        <p className="text-sm text-gray-600">{t('description')}</p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-semibold text-gray-800">{t('shortName')}</span>
            <span className="mt-1 block text-xs text-gray-500">{t('shortNameHint')}</span>
            <div className="mt-2 flex gap-2">
              <input value={shortName} onChange={(event) => setShortName(event.target.value.slice(0, 12))} maxLength={12} className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder={tenant.nome.slice(0, 12)} />
              <button type="button" onClick={saveShortName} disabled={saving || !shortName.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">{saving ? t('saving') : t('save')}</button>
            </div>
          </label>

          <div>
            <p className="text-sm font-semibold text-gray-800">{t('icon')}</p>
            <p className="mt-1 text-xs text-gray-500">{t('iconHint')}</p>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => uploadIcon(event.target.files?.[0])} />
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">{uploading ? t('processing') : previewUrl ? t('changeIcon') : t('uploadIcon')}</button>
              {previewUrl && <button type="button" onClick={removeIcon} disabled={removing} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">{removing ? t('removing') : t('remove')}</button>}
            </div>
          </div>

          <div className={`rounded-xl border px-4 py-3 text-sm ${isComplete ? 'border-emerald-100 bg-emerald-50 text-emerald-800' : 'border-amber-100 bg-amber-50 text-amber-800'}`}>
            {isComplete ? t('complete') : t('incomplete')}
          </div>
          <div className="space-y-1 text-xs text-gray-500">
            <p>{t('reinstallIntro')}</p>
            <p><strong>Android:</strong> {t('reinstallAndroid')}</p>
            <p><strong>iPhone:</strong> {t('reinstallIos')}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('preview')}</p>
          <div className="mt-4 flex items-end justify-around gap-4 text-center text-xs text-gray-600">
            {['rounded-none', 'rounded-full', 'rounded-[28%]'].map((shape, index) => (
              <div key={shape} className="space-y-2">
                <div className={`flex h-20 w-20 items-center justify-center overflow-hidden bg-white shadow-sm ${shape}`}>
                  {previewUrl ? <Image src={index === 0 ? squarePreviewUrl! : previewUrl} alt={t('previewAlt')} width={80} height={80} unoptimized className="h-full w-full object-cover" /> : <span className="text-xl font-bold text-indigo-700">OE</span>}
                </div>
                <span>{index === 0 ? t('squarePreview') : index === 1 ? t('circularPreview') : t('roundedPreview')}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 truncate text-center text-sm font-medium text-gray-800">{shortName.trim() || tenant.nome.slice(0, 12)}</p>
        </div>
      </div>

      {message && <p className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${message.type === 'error' ? 'border-red-100 bg-red-50 text-red-700' : 'border-emerald-100 bg-emerald-50 text-emerald-700'}`}>{message.text}</p>}
    </section>
  );
}
