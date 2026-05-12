module.exports = {
  apps: [
    {
      name: "burqan-api",
      cwd: "/var/www/burqan-store/packages/api",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
