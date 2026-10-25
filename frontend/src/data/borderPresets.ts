export interface BorderPreset {
  id: string;
  name: string;
  category: 'Modern' | 'Luxury' | 'Cyber & Tech' | 'Academic' | 'Corporate' | 'Celebration' | 'Sports & Bold';
  description: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge';
  borderRadius: number;
  borderInset: number;
  borderOpacity: number;
  borderGlow: boolean;
  borderGlowColor: string;
  borderGlowBlur: number;
  hasInnerBorder?: boolean;
  innerBorderColor?: string;
  innerBorderWidth?: number;
  innerBorderStyle?: 'solid' | 'double' | 'dashed' | 'dotted';
  innerBorderInset?: number;
  isTechBrackets?: boolean;
}

export const BORDER_PRESETS: BorderPreset[] = [
  {
    id: 'minimalist-thin',
    name: 'Thin Minimalist',
    category: 'Modern',
    description: 'Clean, modern 1.5px frame with subtle 20px margin',
    borderColor: '#ffffff',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderRadius: 0,
    borderInset: 18,
    borderOpacity: 45,
    borderGlow: false,
    borderGlowColor: 'rgba(255, 255, 255, 0.2)',
    borderGlowBlur: 0
  },
  {
    id: 'double-classic',
    name: 'Double-Line Classic',
    category: 'Academic',
    description: 'Timeless double line frame with formal certificate elegance',
    borderColor: '#ffffff',
    borderWidth: 4,
    borderStyle: 'double',
    borderRadius: 0,
    borderInset: 20,
    borderOpacity: 70,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0
  },
  {
    id: 'rounded-modern',
    name: 'Rounded Frame',
    category: 'Modern',
    description: 'Contemporary soft 24px rounded rectangular border',
    borderColor: '#93c5fd',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 24,
    borderInset: 18,
    borderOpacity: 75,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0
  },
  {
    id: 'gold-luxury',
    name: 'Elegant Gold Luxury',
    category: 'Luxury',
    description: 'Metallic gold double border with warm ambient illumination',
    borderColor: '#d4af37',
    borderWidth: 2.5,
    borderStyle: 'solid',
    borderRadius: 4,
    borderInset: 18,
    borderOpacity: 95,
    borderGlow: true,
    borderGlowColor: 'rgba(212, 175, 55, 0.55)',
    borderGlowBlur: 14,
    hasInnerBorder: true,
    innerBorderColor: '#fef08a',
    innerBorderWidth: 1,
    innerBorderStyle: 'solid',
    innerBorderInset: 6
  },
  {
    id: 'metallic-chrome',
    name: 'Metallic Chrome',
    category: 'Luxury',
    description: 'Refined liquid silver frame with subtle chrome glow',
    borderColor: '#cbd5e1',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 8,
    borderInset: 16,
    borderOpacity: 90,
    borderGlow: true,
    borderGlowColor: 'rgba(203, 213, 225, 0.5)',
    borderGlowBlur: 10
  },
  {
    id: 'neon-cyber-glow',
    name: 'Neon Cyber Glow',
    category: 'Cyber & Tech',
    description: 'Electric cyan glowing frame for hackathons and tech events',
    borderColor: '#06b6d4',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 12,
    borderInset: 16,
    borderOpacity: 100,
    borderGlow: true,
    borderGlowColor: 'rgba(6, 182, 212, 0.85)',
    borderGlowBlur: 20
  },
  {
    id: 'tech-brackets',
    name: 'Futuristic Tech Brackets',
    category: 'Cyber & Tech',
    description: 'Sci-fi corner brackets with technical precision framing',
    borderColor: '#38bdf8',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderRadius: 0,
    borderInset: 18,
    borderOpacity: 80,
    borderGlow: true,
    borderGlowColor: 'rgba(56, 189, 248, 0.65)',
    borderGlowBlur: 12,
    isTechBrackets: true
  },
  {
    id: 'geometric-dashed',
    name: 'Geometric Tech Dashed',
    category: 'Cyber & Tech',
    description: 'Technical dashed frame with blueprint aesthetic',
    borderColor: '#64748b',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 0,
    borderInset: 16,
    borderOpacity: 85,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0
  },
  {
    id: 'academic-formal',
    name: 'Academic Institutional',
    category: 'Academic',
    description: 'Formal collegiate double frame with navy and gold accents',
    borderColor: '#d4af37',
    borderWidth: 3.5,
    borderStyle: 'double',
    borderRadius: 0,
    borderInset: 20,
    borderOpacity: 95,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0,
    hasInnerBorder: true,
    innerBorderColor: '#3b82f6',
    innerBorderWidth: 1,
    innerBorderStyle: 'solid',
    innerBorderInset: 6
  },
  {
    id: 'corporate-slate',
    name: 'Premium Corporate Slate',
    category: 'Corporate',
    description: 'Executive minimalist border with high-trust slate styling',
    borderColor: '#94a3b8',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 4,
    borderInset: 22,
    borderOpacity: 70,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0
  },
  {
    id: 'floral-rose',
    name: 'Floral & Celebration',
    category: 'Celebration',
    description: 'Soft rose-gold frame with smooth curved corners for celebrations',
    borderColor: '#f43f5e',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 32,
    borderInset: 20,
    borderOpacity: 85,
    borderGlow: true,
    borderGlowColor: 'rgba(244, 63, 94, 0.4)',
    borderGlowBlur: 12
  },
  {
    id: 'sports-bold',
    name: 'Sports Bold Frame',
    category: 'Sports & Bold',
    description: 'High-energy 6px heavy athletic stroke with tournament impact',
    borderColor: '#eab308',
    borderWidth: 6,
    borderStyle: 'solid',
    borderRadius: 0,
    borderInset: 12,
    borderOpacity: 100,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0
  },
  {
    id: 'cyberpunk-violet',
    name: 'Cyberpunk Violet Glow',
    category: 'Cyber & Tech',
    description: 'Vibrant neon purple glow for esports and cultural festivals',
    borderColor: '#a855f7',
    borderWidth: 2,
    borderStyle: 'solid',
    borderRadius: 16,
    borderInset: 18,
    borderOpacity: 100,
    borderGlow: true,
    borderGlowColor: 'rgba(168, 85, 247, 0.85)',
    borderGlowBlur: 20
  },
  {
    id: 'dotted-minimal',
    name: 'Fine Dotted Minimal',
    category: 'Modern',
    description: 'Subtle dotted technical border for workshops and webinars',
    borderColor: '#ffffff',
    borderWidth: 2,
    borderStyle: 'dotted',
    borderRadius: 8,
    borderInset: 16,
    borderOpacity: 55,
    borderGlow: false,
    borderGlowColor: 'transparent',
    borderGlowBlur: 0
  }
];
