import {
  Body,
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  Logger,
  Post,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from '../src/app.setup';
import { AppException } from '../src/common/errors/app.exception';
import { ErrorCode } from '../src/common/errors/error-code';

class EchoDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsInt()
  age!: number;
}

@Controller('setup-test')
class SetupTestController {
  @Get('ok')
  ok() {
    return { ok: true };
  }

  @Post('echo')
  echo(@Body() body: EchoDto) {
    return { isDto: body instanceof EchoDto, ...body };
  }

  @Get('app-exception')
  appException() {
    throw new AppException(HttpStatus.CONFLICT, ErrorCode.CONFLICT);
  }

  @Get('unexpected')
  unexpected() {
    throw new Error('connection failed: postgres://user:secret@db');
  }
}

describe('configureApp CORS (e2e)', () => {
  const originalWebUrl = process.env.WEB_URL;
  let app: INestApplication<App>;

  async function createApp() {
    const moduleFixture = await Test.createTestingModule({
      controllers: [SetupTestController],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  }

  afterEach(async () => {
    await app.close();
    if (originalWebUrl === undefined) {
      delete process.env.WEB_URL;
    } else {
      process.env.WEB_URL = originalWebUrl;
    }
  });

  it('WEB_URL이 없으면 http://localhost:3000의 사전 요청을 쿠키 포함으로 허용한다', async () => {
    delete process.env.WEB_URL;
    await createApp();

    const response = await request(app.getHttpServer())
      .options('/api/v1/setup-test/echo')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('허용한 출처의 실제 요청에도 CORS 헤더를 붙인다', async () => {
    delete process.env.WEB_URL;
    await createApp();

    const response = await request(app.getHttpServer())
      .get('/api/v1/setup-test/ok')
      .set('Origin', 'http://localhost:3000')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('허용하지 않은 출처에는 CORS 허용 헤더를 붙이지 않는다', async () => {
    delete process.env.WEB_URL;
    await createApp();

    const response = await request(app.getHttpServer())
      .get('/api/v1/setup-test/ok')
      .set('Origin', 'http://evil.example.com');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('WEB_URL을 지정하면 해당 출처만 허용한다', async () => {
    process.env.WEB_URL = 'https://admin.example.com';
    await createApp();

    const allowed = await request(app.getHttpServer())
      .get('/api/v1/setup-test/ok')
      .set('Origin', 'https://admin.example.com');
    const blocked = await request(app.getHttpServer())
      .get('/api/v1/setup-test/ok')
      .set('Origin', 'http://localhost:3000');

    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://admin.example.com',
    );
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('configureApp (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const moduleFixture = await Test.createTestingModule({
      controllers: [SetupTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('모든 경로에 /api/v1 접두사를 붙인다', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/setup-test/ok')
      .expect(200, { ok: true });
    await request(app.getHttpServer()).get('/setup-test/ok').expect(404);
  });

  it('없는 경로는 404와 NOT_FOUND code로 응답한다', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/unknown')
      .expect(404, { code: 'NOT_FOUND' });
  });

  it('올바른 본문은 DTO로 변환해 처리한다', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/setup-test/echo')
      .send({ name: 'admin', age: 30 })
      .expect(201, { isDto: true, name: 'admin', age: 30 });
  });

  it.each([
    ['필수 필드 누락', { age: 30 }],
    ['빈 문자열', { name: '', age: 30 }],
    ['타입 불일치', { name: 'admin', age: '30' }],
    ['정의하지 않은 필드', { name: 'admin', age: 30, role: 'ADMIN' }],
  ])(
    '입력 검증 실패(%s)는 400과 BAD_REQUEST code만 응답한다',
    async (_, body) => {
      await request(app.getHttpServer())
        .post('/api/v1/setup-test/echo')
        .send(body)
        .expect(400, { code: 'BAD_REQUEST' });
    },
  );

  it('AppException은 지정한 상태와 code로 응답한다', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/setup-test/app-exception')
      .expect(409, { code: 'CONFLICT' });
  });

  it('예상하지 못한 오류는 내부 내용 없이 500과 SERVER_ERROR code로 응답한다', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/setup-test/unexpected')
      .expect(500, { code: 'SERVER_ERROR' });
  });
});
