const { verifyAccessToken } = require('../utils/authTokens');

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const [key, ...valueParts] = part.trim().split('=');
      const value = valueParts.join('=');
      return [key, decodeURIComponent(value || '')];
    })
  );
}

/**
 * Socket.IO handshake authentication.
 * Reads the HttpOnly JWT cookie from the WebSocket upgrade request and verifies
 * the user is an admin or super admin. Non-admin sockets are rejected.
 *
 * @param {import('socket.io').Socket} socket
 * @param {(err?: Error) => void} next
 */
const { authenticateSession } = require('../utils/authSession');

async function socketAuth(socket, next) {
  try {
    const cookies = parseCookies(socket.request.headers.cookie || '');
    const token = cookies.token;

    if (!token) {
      return next(new Error('Authentication error: no token'));
    }

    const decoded = await authenticateSession(verifyAccessToken(token));
    socket.accessToken = token;
    const role = decoded.role;
    if (role !== 'admin' && role !== 'super admin') {
      return next(new Error('Authentication error: admin required'));
    }
    socket.user = decoded;
    next();
  } catch (error) {
    next(new Error('Authentication error'));
  }
}

module.exports = socketAuth;
