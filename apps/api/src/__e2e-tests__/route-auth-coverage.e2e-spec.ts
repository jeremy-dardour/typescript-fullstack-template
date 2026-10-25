import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { IS_PUBLIC_KEY } from '@/app/auth/decorators';

import type { INestApplication } from '@nestjs/common';

/**
 * Every route reachable without a token, each with the reason it must be.
 * Making a route @Public() fails this suite until it is added here, so the
 * decision shows up in review.
 */
const PUBLIC_ROUTES: Record<string, string> = {
  'GET /health': 'monitoring probe',
  'GET /health/ready': 'orchestrator readiness probe',
  'GET /health/live': 'orchestrator liveness probe',
};

interface Route {
  name: string;
  method: RequestMethod;
  path: string;
  isPublic: boolean;
}

/** Reads every route from controller metadata, the same source Nest routes from. */
function listRoutes(app: INestApplication): Route[] {
  const reflector = app.get(Reflector);
  const routes: Route[] = [];

  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype;
      if (!controller) continue;

      const basePath = reflector.get<string>(PATH_METADATA, controller) ?? '';
      const prototype = controller.prototype as Record<string, unknown>;
      for (const key of Object.getOwnPropertyNames(prototype)) {
        const handler = prototype[key];
        if (key === 'constructor' || typeof handler !== 'function') continue;

        const path = reflector.get<string | undefined>(PATH_METADATA, handler);
        const method = reflector.get<RequestMethod | undefined>(
          METHOD_METADATA,
          handler,
        );
        if (path === undefined || method === undefined) continue;

        const fullPath = `/${basePath}/${path}`
          .replaceAll(/\/+/g, '/')
          .replace(/(.)\/$/, '$1');
        const isPublic =
          reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
            handler,
            controller,
          ]) ?? false;

        routes.push({
          name: `${RequestMethod[method]} ${fullPath}`,
          method,
          path: fullPath,
          isPublic,
        });
      }
    }
  }

  return routes;
}

function send(app: INestApplication, route: Route) {
  const agent = request(app.getHttpServer() as never);
  // Guards run before pipes, so any well-formed id reaches the auth check.
  const url = route.path.replaceAll(
    /:\w+/g,
    '00000000-0000-4000-8000-000000000000',
  );
  const method = RequestMethod[route.method].toLowerCase() as
    'get' | 'post' | 'put' | 'patch' | 'delete';

  return agent[method](url);
}

describe('Route auth coverage', () => {
  const mockOidc = new MockOidcService();
  let app: INestApplication;
  let routes: Route[];

  beforeAll(async () => {
    await mockOidc.setup();
    app = await createTestApp({ oidcOverride: mockOidc });
    routes = listRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('discovers the application routes', () => {
    expect(routes.map((route) => route.name)).toContain('GET /items');
  });

  it('exposes exactly the reviewed public routes', () => {
    const publicRoutes = routes
      .filter((route) => route.isPublic)
      .map((route) => route.name)
      .sort((a, b) => a.localeCompare(b));

    expect(publicRoutes).toEqual(
      Object.keys(PUBLIC_ROUTES).sort((a, b) => a.localeCompare(b)),
    );
  });

  it('answers 401 Problem Details on every other route without a token', async () => {
    const guarded = routes.filter((route) => !route.isPublic);
    const unprotected: string[] = [];

    for (const route of guarded) {
      const response = await send(app, route);
      if (
        response.status !== 401 ||
        !String(response.headers['content-type']).includes(
          'application/problem+json',
        )
      ) {
        unprotected.push(`${route.name} → ${response.status}`);
      }
    }

    expect(unprotected).toEqual([]);
  });
});
