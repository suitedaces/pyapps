/** @type {import('next').NextConfig} */
const nextConfig = {  
    cloudflare: {
        kv_namespaces: ["GRUNTY_KV"],
    },
};

export default nextConfig;
