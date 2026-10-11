import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorResponseBody } from './error-code';

export class AppException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
  ) {
    super({ code } satisfies ErrorResponseBody, status);
  }
}
