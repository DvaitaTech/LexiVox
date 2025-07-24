import { useEffect } from 'react';

interface MediaSessionOptions {
  title: string;
  artist?: string;
  album?: string;
  artwork?: Array<{
    src: string;
    sizes: string;
    type: string;
  }>;
}

interface MediaSessionHandlers {
  onPlay?: () => void;
  onPause?: () => void;
  onPreviousTrack?: () => void;
  onNextTrack?: () => void;
  onSeekBackward?: () => void;
  onSeekForward?: () => void;
  onSeekTo?: (details: { seekTime: number }) => void;
}

export function useMediaSession(
  options: MediaSessionOptions,
  handlers: MediaSessionHandlers,
  isPlaying: boolean,
  duration?: number,
  currentTime?: number
) {
  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return;
    }

    // Set metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: options.title,
      artist: options.artist || 'LexiVox',
      album: options.album || 'Text-to-Speech',
      artwork: options.artwork || [
        {
          src: '/pwa-icon.svg',
          sizes: '192x192',
          type: 'image/svg+xml',
        },
        {
          src: '/pwa-icon.svg',
          sizes: '512x512',
          type: 'image/svg+xml',
        },
      ],
    });

    // Update playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    // Set position state if available
    if (duration && currentTime !== undefined) {
      try {
        navigator.mediaSession.setPositionState({
          duration,
          playbackRate: 1,
          position: currentTime,
        });
      } catch (error) {
        // Some browsers don't support setPositionState
        console.debug('setPositionState not supported:', error);
      }
    }
  }, [options, isPlaying, duration, currentTime]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) {
      return;
    }

    // Register action handlers
    const actionHandlers: Array<[MediaSessionAction, ((details?: any) => void) | undefined]> = [
      ['play', handlers.onPlay],
      ['pause', handlers.onPause],
      ['previoustrack', handlers.onPreviousTrack],
      ['nexttrack', handlers.onNextTrack],
      ['seekbackward', handlers.onSeekBackward],
      ['seekforward', handlers.onSeekForward],
      ['seekto', handlers.onSeekTo],
    ];

    // Set all handlers
    actionHandlers.forEach(([action, handler]) => {
      if (handler) {
        try {
          navigator.mediaSession.setActionHandler(action, handler);
        } catch (error) {
          console.debug(`Action "${action}" not supported:`, error);
        }
      }
    });

    // Cleanup
    return () => {
      actionHandlers.forEach(([action]) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch (error) {
          // Ignore cleanup errors
        }
      });
    };
  }, [handlers]);
}

// Hook for wake lock to prevent screen sleep during playback
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) {
      return;
    }

    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.debug('Wake lock acquired');
      } catch (error) {
        console.debug('Wake lock request failed:', error);
      }
    };

    requestWakeLock();

    // Re-acquire wake lock when page becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLock === null) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock) {
        wakeLock.release();
        console.debug('Wake lock released');
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled]);
}