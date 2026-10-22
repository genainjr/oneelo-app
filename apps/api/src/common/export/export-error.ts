import { ServiceUnavailableException } from '@nestjs/common';

export class ExportServiceUnavailableException extends ServiceUnavailableException {
  constructor(
    message: string,
    public readonly retryAfterSeconds = 5,
  ) {
    super(message);
  }
}
