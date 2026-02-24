const path = require('path');
const fs = require('fs');

// Load .env file
const envFile = path.join(__dirname, '.env');
const envVars = {};
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      envVars[trimmed.substring(0, eqIdx).trim()] = trimmed.substring(eqIdx + 1).trim();
    }
  });
}

module.exports = {
  apps: [{
    name: 'arcellite',
    script: 'node_modules/.bin/vite',
    args: '--host 0.0.0.0 --port 3000',
    interpreter: 'none',
    cwd: __dirname,
    env: {
      ...envVars,
      NODE_ENV: 'production',
    },
    node_args: '--max-old-space-size=512',
    watch: false,
    max_memory_restart: '1G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '~/.arcellite/logs/pm2-error.log',
    out_file: '~/.arcellite/logs/pm2-out.log',
    merge_logs: true,
    // Restart on crash, with exponential backoff
    autorestart: true,
    restart_delay: 3000,
    max_restarts: 10,
    min_uptime: '10s',
  }],
};
