/**
 * Serves the built React app (client/build) for a Render Web Service
 * deployment. Reads PORT from process.env directly instead of shell
 * variable expansion, since npm's default script-shell on Windows
 * (cmd.exe) doesn't support POSIX ${VAR:-default} syntax — this runs
 * identically regardless of the host OS/shell.
 */
const { spawn } = require('child_process');
const path = require('path');

const port = process.env.PORT || 3000;
const buildDir = path.join(__dirname, '..', 'client', 'build');

const child = spawn('npx', ['serve', '-s', buildDir, '-l', String(port)], {
  stdio: 'inherit',
  shell: true
});

child.on('exit', (code) => process.exit(code ?? 0));
