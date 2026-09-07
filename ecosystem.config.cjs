module.exports = {
  apps: [
    {
      name: "vps-panel-frontend",

      cwd: "/home/tanmay/Code/vps-panel/frontend",

      script: "server.mjs",

      interpreter: "/home/tanmay/.nvm/versions/node/v24.19.0/bin/node",

      exec_mode: "fork",

      instances: 1,

      autorestart: true,

      restart_delay: 3000,

      max_restarts: 10,

      env_production: {
        NODE_ENV: "production",

        HOSTNAME: "127.0.0.1",

        PORT: "3000",

        BACKEND_WS_URL: "ws://127.0.0.1:8090",

        VPS_PANEL_LOG_DIR: "/home/tanmay/Code/vps-panel/logs",
      },

      error_file: "/home/tanmay/Code/vps-panel/logs/pm2-frontend-error.log",

      out_file: "/home/tanmay/Code/vps-panel/logs/pm2-frontend-out.log",

      merge_logs: true,

      time: true,
    },
  ],
};
