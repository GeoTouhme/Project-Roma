/**
 * Socket.IO manager — exposes the initialized `io` instance and helpers to
 * emit events to connected admin clients.
 */

let io = null;

function setIO(socketIoInstance) {
  io = socketIoInstance;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialized');
  }
  return io;
}

/**
 * Emit an event to all connected admin sockets.
 * @param {string} event
 * @param {any} payload
 */
function emitToAdmins(event, payload) {
  if (!io) {
    console.warn('Socket.IO not initialized; skipping real-time emit.');
    return;
  }
  io.to('admin').emit(event, payload);
}

module.exports = { setIO, getIO, emitToAdmins };
