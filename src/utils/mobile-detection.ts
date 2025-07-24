// Mobile and device detection utilities

export function isMobile(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);
}

export function isAndroid(): boolean {
  return /Android/.test(navigator.userAgent);
}

export function isTouchDevice(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
}

export function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  
  if (isMobile()) {
    if (width >= 768) {
      return 'tablet';
    }
    return 'mobile';
  }
  
  return 'desktop';
}

export function supportsWebGPU(): boolean {
  return 'gpu' in navigator;
}

export function getConnectionType(): 'slow' | 'fast' | 'unknown' {
  const nav = navigator as any;
  
  if ('connection' in nav) {
    const connection = nav.connection;
    
    if (connection.saveData) {
      return 'slow';
    }
    
    const effectiveType = connection.effectiveType;
    if (effectiveType === 'slow-2g' || effectiveType === '2g') {
      return 'slow';
    }
    
    return 'fast';
  }
  
  return 'unknown';
}

export function getBatteryLevel(): Promise<number | null> {
  if ('getBattery' in navigator) {
    return (navigator as any).getBattery().then((battery: any) => {
      return battery.level;
    }).catch(() => null);
  }
  
  return Promise.resolve(null);
}

export function isPWA(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches ||
         (window.navigator as any).standalone === true ||
         document.referrer.includes('android-app://');
}

export function hasNotch(): boolean {
  const hasNotchCSS = 
    parseInt(getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)') || '0') > 0;
  
  return hasNotchCSS || isIOS();
}