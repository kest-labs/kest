/**
 * Minimalist Auth Config
 */
export const authConfig = {
  accessTokenExpiry: 604800,
  
  cookies: {
    accessToken: 'zgi_access_token',
  },
  
  routes: {
    login: '/login',
    afterLogin: '/workspace',
    afterLogout: '/login',
  },
};
