import { Transform, type TransformFnParams } from 'class-transformer';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const RAW_HTML_TAG_PATTERN = /<\/?[a-z][a-z0-9-]*(\s[^>]*)?>/i;

export function TrimNullableString() {
  return Transform(({ value }: TransformFnParams): unknown => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  });
}

export function TrimString() {
  return Transform(({ value }: TransformFnParams): unknown =>
    typeof value === 'string' ? value.trim() : value,
  );
}

export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function hasRawHtmlTags(value: string): boolean {
  return RAW_HTML_TAG_PATTERN.test(value);
}

@ValidatorConstraint({ name: 'safeHttpUrl', async: false })
export class SafeHttpUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return isSafeHttpUrl(value);
  }

  defaultMessage(): string {
    return 'A URL informada deve começar com http:// ou https://.';
  }
}

@ValidatorConstraint({ name: 'noRawHtml', async: false })
export class NoRawHtmlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value === undefined || value === null || value === '') {
      return true;
    }

    if (typeof value !== 'string') {
      return false;
    }

    return !hasRawHtmlTags(value);
  }

  defaultMessage(): string {
    return 'O texto não pode conter tags HTML.';
  }
}
