/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: [
            'lh3.googleusercontent.com',
            'pyapps.s3.us-east-1.amazonaws.com'
        ],
        unoptimized: true,
    },
    experimental: {
        serverActions: true,
    }
}

export default nextConfig
