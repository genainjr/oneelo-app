'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';
import { cn } from '@/lib/utils';

const LOCALE_COUNTRY: Record<string, CountryCode> = {
  'pt-BR': 'BR',
  'pt-PT': 'PT',
  'en-US': 'US',
};

const COUNTRY_PLACEHOLDER: Partial<Record<CountryCode, string>> = {
  BR: '(11) 99999-9999',
  PT: '912 345 678',
  US: '(202) 555-0123',
};

type InternationalPhoneInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  optionalLabel?: string;
  countryLabel: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  variant?: 'default' | 'auth';
};

function getFlag(country: CountryCode) {
  return country
    .split('')
    .map((character) => String.fromCodePoint(character.charCodeAt(0) + 127397))
    .join('');
}

export function InternationalPhoneInput({
  id,
  label,
  value,
  onChange,
  optionalLabel,
  countryLabel,
  placeholder,
  disabled = false,
  required = false,
  variant = 'default',
}: InternationalPhoneInputProps) {
  const locale = useLocale();
  const defaultCountry = LOCALE_COUNTRY[locale] ?? 'BR';
  const [country, setCountry] = useState<CountryCode>(defaultCountry);
  const [nationalValue, setNationalValue] = useState('');
  const lastEmittedValue = useRef<string | null>(null);

  const countries = useMemo(() => {
    const displayNames = new Intl.DisplayNames([locale], { type: 'region' });

    return getCountries()
      .map((countryCode) => ({
        code: countryCode,
        name: displayNames.of(countryCode) ?? countryCode,
        callingCode: getCountryCallingCode(countryCode),
      }))
      .sort((left, right) => left.name.localeCompare(right.name, locale));
  }, [locale]);

  useEffect(() => {
    if (value === lastEmittedValue.current) {
      lastEmittedValue.current = null;
      return;
    }

    if (!value) {
      setNationalValue('');
      setCountry(defaultCountry);
      return;
    }

    const parsed = parsePhoneNumberFromString(value);
    if (parsed?.country) {
      setCountry(parsed.country);
      setNationalValue(parsed.formatNational());
      return;
    }

    setNationalValue(value);
  }, [defaultCountry, value]);

  function emitPhoneValue(nextCountry: CountryCode, input: string) {
    const formatter = new AsYouType(nextCountry);
    const formatted = formatter.input(input);
    const internationalValue = formatter.getNumberValue()?.toString() ?? '';

    setNationalValue(formatted);
    lastEmittedValue.current = internationalValue;
    onChange(internationalValue);
  }

  function handleCountryChange(nextCountry: CountryCode) {
    setCountry(nextCountry);
    emitPhoneValue(nextCountry, nationalValue.replace(/\D/g, ''));
  }

  const isAuth = variant === 'auth';
  const labelClass = isAuth
    ? 'block text-sm font-medium text-indigo-200 mb-1.5'
    : 'text-xs font-semibold text-gray-700 uppercase tracking-wider';
  const controlClass = isAuth
    ? 'bg-white/10 border-white/20 text-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent'
    : 'bg-gray-50 border-gray-200 text-gray-900 focus:border-indigo-500 focus:bg-white';

  return (
    <div className={isAuth ? undefined : 'space-y-1.5'}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required && ' *'}
        {optionalLabel && (
          <span className={cn(
            'ml-1 font-medium normal-case tracking-normal',
            isAuth ? 'text-xs text-indigo-300' : 'text-[10px] text-gray-400',
          )}>
            {optionalLabel}
          </span>
        )}
      </label>
      <div className="flex min-w-0">
        <select
          aria-label={countryLabel}
          value={country}
          onChange={(event) => handleCountryChange(event.target.value as CountryCode)}
          disabled={disabled}
          className={cn(
            'w-[46%] min-w-0 rounded-l-xl border px-2 py-2.5 text-sm focus:outline-none disabled:opacity-50',
            controlClass,
          )}
        >
          {countries.map((option) => (
            <option key={option.code} value={option.code} className="text-gray-900">
              {getFlag(option.code)} {option.name} (+{option.callingCode})
            </option>
          ))}
        </select>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required={required}
          disabled={disabled}
          value={nationalValue}
          onChange={(event) => emitPhoneValue(country, event.target.value)}
          placeholder={placeholder ?? COUNTRY_PLACEHOLDER[country] ?? ''}
          className={cn(
            'min-w-0 flex-1 rounded-r-xl border border-l-0 px-3 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none disabled:opacity-50',
            controlClass,
            isAuth && 'placeholder:text-indigo-300/60',
          )}
        />
      </div>
    </div>
  );
}
