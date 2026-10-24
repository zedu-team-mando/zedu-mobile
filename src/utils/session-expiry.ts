type SessionExpiredListener = () => void;

const listeners = new Set<SessionExpiredListener>();

/**
 * Registers a callback for the first point at which an authenticated request
 * receives a 401 response. Returns an unsubscribe function.
 */
export const onSessionExpired = (listener: SessionExpiredListener) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

/**
 * Notifies the app that the persisted session has been invalidated by the
 * API so in-memory auth state can be cleared as well. A listener failure must
 * not prevent the remaining listeners (or the original request) from running.
 */
export const notifySessionExpired = () => {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error('Session expiry handler failed', error);
    }
  }
};
