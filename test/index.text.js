/* eslint-disable no-unused-vars */
const assert = require('assert');
//  Next.js API Routes behaves similar to Node HTTP Server
const { createServer } = require('http');
const request = require('supertest');
const nextConnect = require('../lib');

const httpMethods = ['get', 'head', 'post', 'put', 'delete', 'options', 'trace', 'patch'];

describe('nextConnect', () => {
  let handler;
  beforeEach(() => {
    handler = nextConnect();
  });

  context('method routing', () => {
    it('[method]() should response correctly to METHODS', () => {
      httpMethods.forEach((method) => {
        handler[method]((req, res) => res.end(method));
      });
      const app = createServer(handler);
      const requestPromises = [];
      for (let i = 0; i < httpMethods.length; i += 1) {
        requestPromises.push(
          request(app)[httpMethods[i]]('/').expect(httpMethods[i] !== 'head' ? httpMethods[i] : undefined),
        );
      }
      return Promise.all(requestPromises);
    });
  });

  context('middleware', () => {
    it('use() should response to any method', () => {
      handler.use((req, res) => res.end('any'));
      const app = createServer(handler);
      const requestPromises = [];
      for (let i = 0; i < httpMethods.length; i += 1) {
        requestPromises.push(
          request(app)[httpMethods[i]]('/').expect(httpMethods[i] !== 'head' ? 'any' : undefined),
        );
      }
      return Promise.all(requestPromises);
    });

    it('use() should work as middleware', () => {
      handler.use((req, res, next) => {
        req.ok = 'ok';
        next();
      });
      handler.get((req, res) => {
        res.end(req.ok);
      });
      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect('ok');
    });

    it('use() can reuse another instance', () => {
      const handler2 = nextConnect();
      handler2.use((req, res, next) => {
        req.hello = 'world';
        next();
      });

      handler.use(handler2);
      handler.use((req, res) => res.end(req.hello));

      const app = createServer(handler);
      return request(app).get('/').expect('world');
    });

    it('[method]() should be chainable', () => {
      handler.get(
        (req, res, next) => {
          res.setHeader('x-ok', 'yes');
          next();
        },
        (req, res) => {
          res.end('ok');
        },
      );
      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect('x-ok', 'yes')
        .expect('ok');
    });
  });

  context('non-api support', () => {
    it('apply() should apply middleware to req and res', () => {
      handler.use((req, res, next) => { req.hello = 'world'; next(); });
      const app = createServer(async (req, res) => {
        await handler.apply(req, res);
        res.end(req.hello || '');
      });
      return request(app).get('/').expect('world');
    });
  });

  context('error handling', () => {
    it('use() with 4 args should work as an error middleware', () => {
      handler.get((req, res) => {
        throw new Error('error');
      });
      handler.use((err, req, res, next) => {
        res.end(err.message);
      });
      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect('error');
    });

    it('error() should work as an error middleware', () => {
      handler.get((req, res) => {
        throw new Error('error');
      });
      handler.error((err, req, res) => {
        res.end(err.message);
      });
      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect('error');
    });

    it('should bypass other handler if error thrown', () => {
      handler.get((req, res) => {
        throw new Error('error');
      });
      handler.use((req, res) => {
        res.setHeader('x-ok', 'yes');
        res.end('ok');
      });
      handler.error((err, req, res) => {
        res.end(err.message);
      });
      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect((res) => {
          assert(res.header['x-ok'] !== 'yes');
        })
        .expect('error');
    });
  });

  context('miscellaneous', () => {
    it('nextConnnet() should return a function with two argument', () => {
      assert(typeof nextConnect() === 'function' && nextConnect().length === 2);
    });

    it('should return when run out of layer', () => {
      handler.get(
        (req, res, next) => {
          next();
        },
        (req, res, next) => {
          res.end('ok');
          // should exit after this not to throw
          next();
        },
      );

      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect('ok');
    });

    it('should 404 if header not sent after stack ended', () => {
      handler.post((req, res) => {
        res.end('hmm');
      });

      const app = createServer(handler);
      return request(app)
        .get('/')
        .expect(404);
    });
  });
});
