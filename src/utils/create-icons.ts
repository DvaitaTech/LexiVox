// Utility to create PWA icons - this can be run to generate the needed icons
// For now, we'll create simple colored square icons as placeholders

export const createPWAIcon = (size: number, color: string = '#3b82f6', maskable: boolean = false) => {
  const padding = maskable ? size * 0.1 : 0; // 10% padding for maskable icons
  const iconSize = size - (padding * 2);
  const iconOffset = padding;
  
  // Create waveform path scaled to icon size
  const waveformPath = `M${iconOffset + iconSize * 0.08} ${iconOffset + iconSize * 0.54}a${iconSize * 0.08} ${iconSize * 0.08} 0 0 0 ${iconSize * 0.16} -${iconSize * 0.08}V${iconOffset + iconSize * 0.29}a${iconSize * 0.08} ${iconSize * 0.08} 0 0 1 ${iconSize * 0.16} 0v${iconSize * 0.54}a${iconSize * 0.08} ${iconSize * 0.08} 0 0 0 ${iconSize * 0.16} 0V${iconOffset + iconSize * 0.17}a${iconSize * 0.08} ${iconSize * 0.08} 0 0 1 ${iconSize * 0.16} 0v${iconSize * 0.54}a${iconSize * 0.08} ${iconSize * 0.08} 0 0 0 ${iconSize * 0.16} 0v-${iconSize * 0.17}a${iconSize * 0.08} ${iconSize * 0.08} 0 0 1 ${iconSize * 0.08} -${iconSize * 0.08}`;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${maskable ? `<rect width="${size}" height="${size}" fill="${color}" rx="${size * 0.1}"/>` : ''}
    <rect x="${iconOffset}" y="${iconOffset}" width="${iconSize}" height="${iconSize}" fill="${maskable ? 'rgba(255,255,255,0.1)' : color}" rx="${iconSize * 0.1}"/>
    <path d="${waveformPath}" fill="none" stroke="${maskable ? 'white' : 'white'}" stroke-width="${iconSize * 0.08}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
};

// This is a utility file - the actual icon creation will be done manually or with a build script
console.log('Icon creation utility loaded');