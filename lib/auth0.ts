import { initAuth0 } from '@auth0/nextjs-auth0';

export const auth0 = initAuth0({
  secret: process.env.AUTH0_SECRET,
  issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,
  baseURL: process.env.AUTH0_BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  clientSecret: process.env.AUTH0_CLIENT_SECRET,
});

export const getSession = auth0.getSession;
export const handleAuth = auth0.handleAuth;
export const handleCallback = auth0.handleCallback;
export const handleLogin = auth0.handleLogin;
export const handleLogout = auth0.handleLogout;
export const withPageAuthRequired = auth0.withPageAuthRequired;
export const withApiAuthRequired = auth0.withApiAuthRequired;