import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { AppException } from './app.exception';
import { ErrorCode } from './error-code';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let logError: jest.SpyInstance;

  beforeEach(() => {
    logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function catchException(exception: unknown) {
    const { host, status, json } = createHost();
    new AllExceptionsFilter().catch(exception, host);
    return { status, json };
  }

  it('AppException은 지정한 상태 코드와 code를 그대로 응답한다', () => {
    const { status, json } = catchException(
      new AppException(
        HttpStatus.TOO_MANY_REQUESTS,
        ErrorCode.TOO_MANY_REQUESTS,
      ),
    );

    expect(status).toHaveBeenCalledWith(429);
    expect(json).toHaveBeenCalledWith({ code: 'TOO_MANY_REQUESTS' });
  });

  it.each([
    [new BadRequestException('detail'), 400, 'BAD_REQUEST'],
    [new UnauthorizedException(), 401, 'UNAUTHORIZED'],
    [new ForbiddenException(), 403, 'FORBIDDEN'],
    [new NotFoundException(), 404, 'NOT_FOUND'],
    [new ConflictException(), 409, 'CONFLICT'],
    [new UnprocessableEntityException(), 422, 'UNPROCESSABLE'],
    [new HttpException('too many', 429), 429, 'TOO_MANY_REQUESTS'],
  ])(
    'NestJS HTTP 예외 %s는 %i 상태와 %s code로 응답한다',
    (exception, expectedStatus, expectedCode) => {
      const { status, json } = catchException(exception);

      expect(status).toHaveBeenCalledWith(expectedStatus);
      expect(json).toHaveBeenCalledWith({ code: expectedCode });
    },
  );

  it('목록에 없는 4xx는 상태 코드를 유지하고 BAD_REQUEST code로 응답한다', () => {
    const { status, json } = catchException(
      new HttpException('method not allowed', HttpStatus.METHOD_NOT_ALLOWED),
    );

    expect(status).toHaveBeenCalledWith(405);
    expect(json).toHaveBeenCalledWith({ code: 'BAD_REQUEST' });
  });

  it('5xx HTTP 예외는 상태 코드를 유지하고 SERVER_ERROR code로 응답한다', () => {
    const { status, json } = catchException(new ServiceUnavailableException());

    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({ code: 'SERVER_ERROR' });
  });

  it('예상하지 못한 오류는 내부 내용 없이 500 SERVER_ERROR로 응답한다', () => {
    const { status, json } = catchException(
      new Error('connection failed: postgres://user:secret@db'),
    );

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ code: 'SERVER_ERROR' });
  });

  it('예상하지 못한 오류는 서버 로그에 남긴다', () => {
    catchException(new Error('unexpected'));

    expect(logError).toHaveBeenCalledTimes(1);
  });

  it('4xx HTTP 예외는 서버 오류 로그를 남기지 않는다', () => {
    catchException(new NotFoundException());

    expect(logError).not.toHaveBeenCalled();
  });
});
