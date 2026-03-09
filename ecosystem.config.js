module.exports = {
  apps: [
    {
      name: "froo-techpack",
      script: "src/index.js",
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
