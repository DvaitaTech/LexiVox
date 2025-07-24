import { useEffect, useRef } from 'react';

interface AudioFocusOptions {
  onAudioFocusGain?: () => void;
  onAudioFocusLoss?: () => void;
  onAudioFocusLossTransient?: () => void;
  onAudioFocusLossTransientCanDuck?: () => void;
}

export function useAudioFocus(isPlaying: boolean, options: AudioFocusOptions) {
  const wasPlayingBeforeInterruption = useRef(false);

  useEffect(() => {
    if (!isPlaying) return;

    // Handle visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden, but we allow background playback
        console.debug('Tab hidden, continuing playback');
      } else {
        // Tab is visible again
        console.debug('Tab visible');
        options.onAudioFocusGain?.();
      }
    };

    // Handle page blur/focus (window switching)
    const handleBlur = () => {
      console.debug('Window lost focus, continuing playback');
    };

    const handleFocus = () => {
      console.debug('Window gained focus');
      options.onAudioFocusGain?.();
    };

    // Handle audio interruptions (phone calls, other audio apps)
    const handleAudioInterruption = (event: Event) => {
      const customEvent = event as CustomEvent;
      
      if (customEvent.detail?.reason === 'interrupt') {
        wasPlayingBeforeInterruption.current = isPlaying;
        options.onAudioFocusLossTransient?.();
      } else if (customEvent.detail?.reason === 'resume') {
        if (wasPlayingBeforeInterruption.current) {
          options.onAudioFocusGain?.();
        }
      }
    };

    // iOS-specific audio session handling
    const handleAudioSessionInterruption = (event: Event) => {
      console.debug('Audio session interruption:', event);
      wasPlayingBeforeInterruption.current = isPlaying;
      options.onAudioFocusLossTransient?.();
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    
    // Custom audio interruption events (if implemented by browser)
    window.addEventListener('audiointerruption', handleAudioInterruption);
    
    // iOS-specific
    if ('webkitAudioContext' in window) {
      window.addEventListener('interruption', handleAudioSessionInterruption);
    }

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('audiointerruption', handleAudioInterruption);
      
      if ('webkitAudioContext' in window) {
        window.removeEventListener('interruption', handleAudioSessionInterruption);
      }
    };
  }, [isPlaying, options]);

  // iOS audio context resume helper
  const resumeAudioContext = async () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const context = new AudioContext();
      if (context.state === 'suspended') {
        await context.resume();
        console.debug('Audio context resumed');
      }
    }
  };

  return { resumeAudioContext };
}