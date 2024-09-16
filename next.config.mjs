/** @type {import('next').NextConfig} */
const nextConfig = {  
    webpack(config) {
    config.experiments = {
      asyncWebAssembly: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    return config;
  },}

export default nextConfig
