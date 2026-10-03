module.exports = {
  apps: [
    {
      name: 'cpfedst-webapp',
      script: 'src/index.js',
      cwd: '/var/www/cpfedst-webapp/server',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '5G',
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
