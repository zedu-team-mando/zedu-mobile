import { notifySessionExpired, onSessionExpired } from '@/utils/session-expiry';

describe('session expiry signals', () => {
  it('notifies every subscribed listener', () => {
    const first = jest.fn();
    const second = jest.fn();
    const unsubscribeFirst = onSessionExpired(first);
    const unsubscribeSecond = onSessionExpired(second);

    notifySessionExpired();

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('stops notifying after a listener unsubscribes', () => {
    const listener = jest.fn();
    const unsubscribe = onSessionExpired(listener);

    unsubscribe();
    notifySessionExpired();

    expect(listener).not.toHaveBeenCalled();
  });

  it('continues notifying other listeners when one throws', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const healthyListener = jest.fn();
    const unsubscribeThrowing = onSessionExpired(() => {
      throw new Error('listener failure');
    });
    const unsubscribeHealthy = onSessionExpired(healthyListener);

    expect(() => notifySessionExpired()).not.toThrow();
    expect(healthyListener).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalled();

    unsubscribeThrowing();
    unsubscribeHealthy();
    errorSpy.mockRestore();
  });
});
