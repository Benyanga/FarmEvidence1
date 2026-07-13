const http = require('http');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';

/**
 * Forwards a chart-render request to the Python graphing service and
 * returns its `{ image: 'data:image/png;base64,...' }` response.
 * Uses Node's built-in http module rather than adding a dependency.
 */
function renderChart(payload) {
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
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { renderChart };
