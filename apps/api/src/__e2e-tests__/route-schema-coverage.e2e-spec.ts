import { METHOD_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';

import type { INestApplication } from '@nestjs/common';

describe('route schema coverage', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const oidc = new MockOidcService();
    await oidc.setup();
    app = await createTestApp({ oidcOverride: oidc });
  });

  afterAll(async () => {
    await app.close();
  });

  it('binds a runtime schema on every HTTP body, path and query parameter', () => {
    const scanner = new MetadataScanner();
    const reflector = app.get(Reflector);
    const observed: string[] = [];
    const missing: string[] = [];
    const validatedKinds = new Set<number>([
      RouteParamtypes.BODY,
      RouteParamtypes.PARAM,
      RouteParamtypes.QUERY,
    ]);

    for (const module of app.get(ModulesContainer).values()) {
      for (const wrapper of module.controllers.values()) {
        const controller = wrapper.metatype;
        if (!controller) continue;
        const prototype = controller.prototype as Record<string, unknown>;

        for (const method of scanner.getAllMethodNames(prototype)) {
          const handler = prototype[method];
          if (
            typeof handler !== 'function' ||
            reflector.get<unknown>(METHOD_METADATA, handler) === undefined
          ) {
            continue;
          }

          // eslint-disable-next-line unicorn/no-nonstandard-builtin-properties -- Nest stores parameter metadata on the constructor and method key.
          const parameters = Reflect.getMetadata(
            ROUTE_ARGS_METADATA,
            controller,
            method,
          ) as Record<string, { schema?: unknown }> | undefined;

          const entries = Object.entries(parameters ?? {});
          for (const [key, parameter] of entries) {
            const kind = Number(key.split(':', 1)[0]);
            if (!validatedKinds.has(kind)) continue;
            const label = `${controller.name}.${method}:${RouteParamtypes[kind]}`;
            observed.push(label);

            if (
              typeof parameter.schema !== 'object' ||
              parameter.schema === null ||
              !('~standard' in parameter.schema)
            ) {
              missing.push(label);
            }
          }
        }
      }
    }

    expect(observed).toContain('ItemController.create:BODY');
    expect(observed).toContain('ItemController.findOne:PARAM');
    expect(observed).toContain('ItemController.findAll:QUERY');
    expect(missing).toEqual([]);
  });
});
