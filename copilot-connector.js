/*
  Nemu -> Microsoft 365 Copilot connector (prototype)
  ---------------------------------------------------
  IMPORTANT:
  - Do not put client secrets, passwords, or permanent access tokens in this file.
  - Microsoft 365 Copilot Chat API currently requires a supported work/school account.
  - The Copilot Chat API is currently under Microsoft Graph /beta; do not treat this as production code.

  This single file exposes window.NemuCopilot.
  It uses OAuth 2.0 Authorization Code + PKCE directly from a browser/PWA.

  BEFORE USING:
  1. Register a Microsoft Entra SPA application.
  2. Put its Application (client) ID in CONFIG.clientId below.
  3. Add this PWA URL as an SPA redirect URI in the app registration.
  4. Grant the Microsoft Graph delegated permissions required by the Copilot Chat API.

  Example use from your existing app.js:
    await NemuCopilot.login();
    const state = await NemuCopilot.handleRedirect();
    if (state.connected) console.log('Connected');

    const conversation = await NemuCopilot.createConversation();
    console.log(conversation);

    NemuCopilot.logout();
*/

(() => {
  'use strict';

  const CONFIG = {
    clientId: 'PASTE_YOUR_ENTRA_APP_CLIENT_ID_HERE',
    tenant: 'organizations',
    // Required by the current Copilot Chat API documentation.
    scopes: [
      'openid',
      'profile',
      'offline_access',
      'Sites.Read.All',
      'Mail.Read',
      'People.Read.All',
      'OnlineMeetingTranscript.Read.All',
      'Chat.Read',
      'ChannelMessage.Read.All',
      'ExternalItem.Read.All'
    ],
    graphBase: 'https://graph.microsoft.com/beta',
    redirectUri: `${location.origin}${location.pathname}`
  };

  const KEYS = {
    verifier: 'nemu_copilot_pkce_verifier',
    oauthState: 'nemu_copilot_oauth_state',
    accessToken: 'nemu_copilot_access_token',
    expiresAt: 'nemu_copilot_expires_at'
  };

  const enc = new TextEncoder();

  function b64url(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function randomString(length = 64) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    return b64url(bytes);
  }

  async function sha256(text) {
    return crypto.subtle.digest('SHA-256', enc.encode(text));
  }

  function validateConfig() {
    if (!CONFIG.clientId || CONFIG.clientId.includes('PASTE_')) {
      throw new Error('Nemu Copilot is not configured. Add your Microsoft Entra Application (client) ID to copilot-connector.js.');
    }
  }

  function token() {
    const accessToken = sessionStorage.getItem(KEYS.accessToken);
    const expiresAt = Number(sessionStorage.getItem(KEYS.expiresAt) || 0);
    if (!accessToken || Date.now() >= expiresAt) return null;
    return accessToken;
  }

  async function login() {
    validateConfig();
    const verifier = randomString(72);
    const challenge = b64url(await sha256(verifier));
    const state = randomString(32);

    sessionStorage.setItem(KEYS.verifier, verifier);
    sessionStorage.setItem(KEYS.oauthState, state);

    const url = new URL(`https://login.microsoftonline.com/${CONFIG.tenant}/oauth2/v2.0/authorize`);
    url.searchParams.set('client_id', CONFIG.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', CONFIG.redirectUri);
    url.searchParams.set('response_mode', 'query');
    url.searchParams.set('scope', CONFIG.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    location.assign(url.toString());
  }

  async function handleRedirect() {
    validateConfig();
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    if (error) {
      const description = params.get('error_description') || error;
      cleanupUrl();
      throw new Error(description);
    }

    const code = params.get('code');
    if (!code) return { connected: !!token() };

    const returnedState = params.get('state');
    const expectedState = sessionStorage.getItem(KEYS.oauthState);
    const verifier = sessionStorage.getItem(KEYS.verifier);
    if (!returnedState || returnedState !== expectedState || !verifier) {
      cleanupUrl();
      throw new Error('Microsoft sign-in could not be verified. Please try again.');
    }

    const body = new URLSearchParams({
      client_id: CONFIG.clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: CONFIG.redirectUri,
      code_verifier: verifier,
      scope: CONFIG.scopes.join(' ')
    });

    const res = await fetch(`https://login.microsoftonline.com/${CONFIG.tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const data = await res.json();
    if (!res.ok || !data.access_token) {
      cleanupUrl();
      throw new Error(data.error_description || 'Microsoft sign-in failed.');
    }

    // sessionStorage intentionally limits the token to this browser tab/session.
    sessionStorage.setItem(KEYS.accessToken, data.access_token);
    sessionStorage.setItem(KEYS.expiresAt, String(Date.now() + Math.max(0, (data.expires_in - 60)) * 1000));
    sessionStorage.removeItem(KEYS.verifier);
    sessionStorage.removeItem(KEYS.oauthState);
    cleanupUrl();
    return { connected: true };
  }

  function cleanupUrl() {
    const clean = `${location.origin}${location.pathname}${location.hash || ''}`;
    history.replaceState({}, document.title, clean);
  }

  async function graph(path, options = {}) {
    const accessToken = token();
    if (!accessToken) throw new Error('Not connected. Sign in with Microsoft first.');

    const res = await fetch(`${CONFIG.graphBase}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

    if (!res.ok) {
      const message = data?.error?.message || data?.error_description || `Microsoft Graph request failed (${res.status}).`;
      throw new Error(message);
    }
    return data;
  }

  // Creates a new Microsoft 365 Copilot conversation.
  async function createConversation() {
    return graph('/copilot/conversations', {
      method: 'POST',
      body: '{}'
    });
  }

  function logout() {
    Object.values(KEYS).forEach(k => sessionStorage.removeItem(k));
    return { connected: false };
  }

  function status() {
    return {
      configured: !!CONFIG.clientId && !CONFIG.clientId.includes('PASTE_'),
      connected: !!token(),
      redirectUri: CONFIG.redirectUri
    };
  }

  window.NemuCopilot = Object.freeze({
    login,
    handleRedirect,
    createConversation,
    logout,
    status
  });
})();
