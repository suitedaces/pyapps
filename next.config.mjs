/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack(config) {
      config.experiments = {
        asyncWebAssembly: true,
        layers: true,
      };
  
      config.module.rules.push({
        test: /\.wasm$/,
        type: "webassembly/async",
      });
  
      return config;
    },
  }
  
  export default nextConfig;
  