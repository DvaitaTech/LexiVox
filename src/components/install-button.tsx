import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { Button } from "./ui/button";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
    // Debug: Log PWA status
    console.log('PWA Debug: Checking install status...');
    console.log('Service Worker supported:', 'serviceWorker' in navigator);
    console.log('Display mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
    
    setDebugInfo(`SW: ${'serviceWorker' in navigator}, Standalone: ${window.matchMedia('(display-mode: standalone)').matches}`);
    
    // Check if app is already installed
    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (window.navigator as any).standalone === true;
    
    if (isRunningStandalone || isIOSStandalone) {
      setIsInstalled(true);
      return;
    }

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      console.log('PWA Debug: beforeinstallprompt event fired!');
      e.preventDefault();
      setDeferredPrompt(e);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // If no prompt available, show manual instructions
      alert('To install LexiVox:\n\n' +
            'Chrome/Edge: Click the install icon in the address bar\n' +
            'Firefox: Look for "Install" in the page options menu\n' +
            'Safari: Use "Add to Home Screen" from the share menu');
      return;
    }

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('User accepted the install prompt');
      }
    } catch (error) {
      console.error('Install prompt failed:', error);
    }

    setDeferredPrompt(null);
  };

  // Don't show if already installed
  if (isInstalled) {
    return null;
  }

  return (
    <Button
      onClick={handleInstallClick}
      variant="outline"
      size="sm"
      className="gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm touch-manipulation"
      title={`PWA Status: ${debugInfo} | Prompt: ${deferredPrompt ? 'Available' : 'Not Available'}`}
    >
      <Download className="h-3 w-3 sm:h-4 sm:w-4" />
      <span className="hidden sm:inline">Install App {deferredPrompt ? '✓' : '?'}</span>
      <span className="sm:hidden">Install {deferredPrompt ? '✓' : '?'}</span>
    </Button>
  );
}