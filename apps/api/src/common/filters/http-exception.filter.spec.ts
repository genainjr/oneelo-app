import { ArgumentsHost, ForbiddenException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('preserva o codigo de negocio de uma HttpException', () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/auth/login' }),
      }),
    } as unknown as ArgumentsHost;

    new HttpExceptionFilter().catch(
      new ForbiddenException({
        code: 'ACCOUNT_PENDING_ACTIVATION',
        message: 'Sua conta ainda não foi ativada.',
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        path: '/api/auth/login',
        code: 'ACCOUNT_PENDING_ACTIVATION',
        message: 'Sua conta ainda não foi ativada.',
      }),
    );
  });
});
