jest.mock('http', () => ({
  request: jest.fn()
}));

const { EventEmitter } = require('events');
const http = require('http');
const { renderChart } = require('./pythonChartService');

describe('pythonChartService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries transient connection failures before succeeding', async () => {
    const requestMock = http.request;
    let attempts = 0;

    requestMock.mockImplementation((options, callback) => {
      const req = new EventEmitter();
      req.write = jest.fn();
      req.end = jest.fn();

      attempts += 1;

      if (attempts === 1) {
        setImmediate(() => req.emit('error', new Error('ECONNREFUSED')));
        return req;
      }

      setImmediate(() => {
        const res = new EventEmitter();
        res.statusCode = 200;
        callback(res);
        res.emit('data', JSON.stringify({ image: 'data:image/png;base64,abc' }));
        res.emit('end');
      });

      return req;
    });

    await expect(renderChart({ type: 'bar', labels: ['A'], series: [] })).resolves.toEqual({ image: 'data:image/png;base64,abc' });
    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});
