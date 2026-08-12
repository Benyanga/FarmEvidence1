const http = require('http');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
const RETRY_DELAY_MS = Number(process.env.PYTHON_RETRY_DELAY_MS || 1000);
const MAX_RETRIES = Number(process.env.PYTHON_MAX_RETRIES || 3);

function requestChart(payload, attempt = 0) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const { hostname, port, pathname } = new URL('/charts/render', PYTHON_SERVICE_URL);

    const req = http.request(
      {
        hostname,
        port,
        path: pathname,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
        timeout: 15000
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 400) {
            reject(new Error(`Chart service responded ${res.statusCode}: ${data}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('timeout', () => req.destroy(new Error('Chart service request timed out')));
    req.on('error', (err) => {
      const isTransient = err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET' || err.message === 'Chart service request timed out' || err.message === 'ECONNREFUSED';
      if (attempt < MAX_RETRIES && isTransient) {
        setTimeout(() => {
          requestChart(payload, attempt + 1).then(resolve).catch(reject);
        }, RETRY_DELAY_MS);
        return;
      }
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

/**
 * Forwards a chart-render request to the Python graphing service and
 * returns its `{ image: 'data:image/png;base64,...' }` response.
 * Uses Node's built-in http module rather than adding a dependency.
 */
function renderChart(payload) {
  return requestChart(payload, 0);
}

module.exports = { renderChart };
