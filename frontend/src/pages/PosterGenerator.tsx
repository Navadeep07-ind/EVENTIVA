import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';

// --- CONFIGURATION ---
const FONTS = [
  "Anton", "Bebas Neue", "Oswald", "Barlow Condensed", "Archivo Black",
  "Inter", "Poppins", "Montserrat", "Roboto", "Open Sans",
  "Playfair Display", "Cinzel", "Cormorant Garamond", "Libre Baskerville",
  "Orbitron", "Rajdhani", "Exo 2", "Space Grotesk",
  "Pacifico", "Dancing Script", "Caveat", "Permanent Marker", "Yellowtail",
  "Merriweather", "Lora", "DM Serif Display"
];

const BACKGROUND_GALLERY = [
  { name: 'Midnight Cosmic Nebula', category: 'Cyber & Space', url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Cyber Blue Circuitry', category: 'Technology', url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Modern University Quad', category: 'Campus & Venue', url: 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1200&q=80', isVenue: true },
  { name: 'Grand Summit Auditorium', category: 'Campus & Venue', url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80', isVenue: true },
  { name: 'Luxury Black & Gold', category: 'Elegant & Gold', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Neon Concert Fest', category: 'Cultural & Party', url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Deep Royal Mesh', category: 'Abstract', url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Executive Dark Slate', category: 'Corporate', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80' }
];

import { BORDER_PRESETS, type BorderPreset } from '../data/borderPresets';
import { 
  type InstitutionKit, 
  type InstitutionSummary, 
  type BrandingDiscoveryResult, 
  PRESET_INSTITUTION_KITS 
} from '../data/institutionKits';

type LayerType = 'text' | 'image' | 'qr';

interface Layer {
  id: string;
  type: LayerType;
  name: string;
  locked: boolean;
  hidden: boolean;
  x: number;
  y: number;
  zIndex: number;
  
  // Text Specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  fontStyle?: string;
  color?: string;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  letterSpacing?: number;
  lineHeight?: number;
  opacity?: number;
  textShadow?: string;
  backgroundClip?: string;
  WebkitBackgroundClip?: string;
  textFillColor?: string;
  WebkitTextFillColor?: string;
  background?: string;
  textStroke?: string;
  WebkitTextStroke?: string;
  filter?: string;
  rotation?: number;
  
  // Image Specific
  src?: string;
  width?: number;
  height?: number;
  borderRadius?: number;

  // Box / Information Card Container Properties
  hasBox?: boolean;
  boxBg?: string;
  boxBorderColor?: string;
  boxBorderWidth?: number;
  boxBorderStyle?: 'solid' | 'double' | 'dashed' | 'dotted';
  boxRadius?: number;
  boxPadding?: number;
  boxShadow?: string;
  boxBackdropFilter?: string;
}

interface CanvasConfig {
  width: number;
  height: number;
  bgImage: string;
  bgColor: string;
  venueBackdrop: string;
  venueOpacity: number;
  
  // Border System
  hasBorder: boolean;
  borderPreset: string;
  borderColor: string;
  borderWidth: number;
  borderStyle: 'solid' | 'double' | 'dashed' | 'dotted' | 'groove' | 'ridge';
  borderRadius: number;
  borderOpacity: number;
  borderInset: number;
  borderGlow: boolean;
  borderGlowColor: string;
  borderGlowBlur: number;
  borderSides: { top: boolean; right: boolean; bottom: boolean; left: boolean };
  borderPosition: 'behind' | 'front';
  hasInnerBorder: boolean;
  innerBorderColor: string;
  innerBorderWidth: number;
  innerBorderStyle: 'solid' | 'double' | 'dashed' | 'dotted';
  innerBorderInset: number;

  // Radial Aura Glow
  radialAura: boolean;
  auraColor: string;
  brightness: number;
  contrast: number;
  blur: number;
  overlayColor: string;
  overlayOpacity: number;
}

// --- MAIN COMPONENT ---
export default function PosterEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // Neutral Default Canvas State
  const [layers, setLayers] = useState<Layer[]>([]);
  const [canvasConfig, setCanvasConfig] = useState<CanvasConfig>({
    width: 800,
    height: 1131, // A4 ratio Portrait
    bgImage: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
    bgColor: '#030712',
    venueBackdrop: '', // Neutral default: NO institutional venue photo by default
    venueOpacity: 95,
    hasBorder: true,
    borderPreset: 'minimalist-thin',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1.5,
    borderStyle: 'solid',
    borderRadius: 0,
    borderOpacity: 85,
    borderInset: 18,
    borderGlow: false,
    borderGlowColor: 'rgba(56, 189, 248, 0.6)',
    borderGlowBlur: 14,
    borderSides: { top: true, right: true, bottom: true, left: true },
    borderPosition: 'front',
    hasInnerBorder: false,
    innerBorderColor: '#fef08a',
    innerBorderWidth: 1,
    innerBorderStyle: 'solid',
    innerBorderInset: 6,
    radialAura: true,
    auraColor: 'rgba(56, 189, 248, 0.28)',
    brightness: 100,
    contrast: 100,
    blur: 0,
    overlayColor: '#000000',
    overlayOpacity: 35
  });
  
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.6);
  const [activeTab, setActiveTab] = useState<'ai' | 'chat' | 'kits' | 'borders' | 'layers' | 'backgrounds'>('ai');
  const [mobileTab, setMobileTab] = useState<'ai' | 'chat' | 'kits' | 'borders' | 'layers' | 'backgrounds' | 'properties' | null>(null);
  const [eventTitle, setEventTitle] = useState<string>('');
  const [showSettingsMenu, setShowSettingsMenu] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [isUploadedPosterMode, setIsUploadedPosterMode] = useState<boolean>(false);
  const [uploadedOriginalUrl, setUploadedOriginalUrl] = useState<string | null>(null);
  const [ocrDetecting, setOcrDetecting] = useState<boolean>(false);
  const [ocrElementsModal, setOcrElementsModal] = useState<any[] | null>(null);
  const posterUploadInputRef = useRef<HTMLInputElement>(null);

  // India-Wide Institution Directory & Kits State
  const [institutions, setInstitutions] = useState<InstitutionSummary[]>([]);
  const [institutionsLoading, setInstitutionsLoading] = useState(false);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [instCategory, setInstCategory] = useState<string>('All');
  const [instState, setInstState] = useState<string>('All');
  const [previewModalKit, setPreviewModalKit] = useState<InstitutionKit | null>(null);
  const [discoveryModalState, setDiscoveryModalState] = useState<{
    institution: InstitutionSummary;
    isDiscovering: boolean;
    result: BrandingDiscoveryResult | null;
    error?: string;
  } | null>(null);
  const [activeAppliedKit, setActiveAppliedKit] = useState<InstitutionKit | null>(null);
  const [showDirectoryModal, setShowDirectoryModal] = useState(false);

  const [institutionKits, setInstitutionKits] = useState<InstitutionKit[]>(PRESET_INSTITUTION_KITS);
  const [showCustomKitModal, setShowCustomKitModal] = useState(false);
  const [editingKitId, setEditingKitId] = useState<number | string | null>(null);
  const [kitForm, setKitForm] = useState<Partial<InstitutionKit>>({
    name: '',
    short_name: '',
    institution_type: 'Autonomous Engineering College',
    location: '',
    department: '',
    logo_url: '',
    badge_url: '',
    backdrop_url: '',
    primary_color: '#1e3a8a',
    secondary_color: '#f59e0b',
    dark_bg: '#030712',
    accent_color: '#38bdf8',
    preferred_font: 'Inter',
    recommended_border: 'academic-double-gold',
    signoff_text: '',
    website: ''
  });

  // Border & Box Studio State
  const [borderSearch, setBorderSearch] = useState('');
  const [borderCategory, setBorderCategory] = useState('All');

  // HD Poster Export State
  const [downloadingHD, setDownloadingHD] = useState(false);
  const [hdScale, setHdScale] = useState<number>(2); // 2: HD (1600x2262), 3: Ultra HD 4K (2400x3393), 4: Print 300 DPI (3200x4524)
  const [hdFormat, setHdFormat] = useState<'png' | 'jpeg'>('png');
  const [showHdExportModal, setShowHdExportModal] = useState(false);

  // AI & History State
  const [historyStack, setHistoryStack] = useState<{layers: Layer[], canvasConfig: CanvasConfig}[]>([]);
  const [redoStack, setRedoStack] = useState<{layers: Layer[], canvasConfig: CanvasConfig}[]>([]);
  const [chatHistory, setChatHistory] = useState<{role: 'user'|'ai', content: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [aiTyping, setAiTyping] = useState(false);

  const pushStateToHistory = (currentLayers: Layer[], currentConfig: CanvasConfig) => {
    setHistoryStack(prev => [...prev, { layers: JSON.parse(JSON.stringify(currentLayers)), canvasConfig: JSON.parse(JSON.stringify(currentConfig)) }]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previousState = historyStack[historyStack.length - 1];
    setRedoStack(prev => [...prev, { layers: JSON.parse(JSON.stringify(layers)), canvasConfig: JSON.parse(JSON.stringify(canvasConfig)) }]);
    setLayers(previousState.layers);
    setCanvasConfig(previousState.canvasConfig);
    setHistoryStack(prev => prev.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setHistoryStack(prev => [...prev, { layers: JSON.parse(JSON.stringify(layers)), canvasConfig: JSON.parse(JSON.stringify(canvasConfig)) }]);
    setLayers(nextState.layers);
    setCanvasConfig(nextState.canvasConfig);
    setRedoStack(prev => prev.slice(0, -1));
  };
  
  // AI Form State
  const [eventDetails, setEventDetails] = useState('');
  const [style, setStyle] = useState('Cinematic Blue, 3D Typography, Modern Aesthetic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const posterRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic Google Fonts Loader
  useEffect(() => {
    const fontFamilies = FONTS.map(f => f.replace(/ /g, '+')).join('&family=');
    const link = document.createElement('link');
    link.href = `https://fonts.googleapis.com/css2?family=${fontFamilies}&display=swap`;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

  // Fetch Event Details if ID provided or query params provided
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const queryPosterUrl = searchParams.get('posterUrl');
    const queryTitle = searchParams.get('title');
    const queryDesc = searchParams.get('desc');
    const queryTab = searchParams.get('tab');

    if (queryTitle) {
      setEventTitle(queryTitle);
      if (queryDesc) {
        setEventDetails(`Event: ${queryTitle}\nDescription: ${queryDesc}`);
      } else {
        setEventDetails(`Event: ${queryTitle}`);
      }
    } else if (queryDesc) {
      setEventDetails(`Description: ${queryDesc}`);
    }

    if (queryTab && ['ai', 'chat', 'kits', 'borders', 'layers', 'backgrounds'].includes(queryTab)) {
      setActiveTab(queryTab as any);
      setMobileTab(queryTab as any);
    }

    if (queryPosterUrl) {
      setIsUploadedPosterMode(true);
      setUploadedOriginalUrl(queryPosterUrl);
      setCanvasConfig(prev => ({
        ...prev,
        bgImage: queryPosterUrl,
        bgColor: '#000000',
        overlayOpacity: 0
      }));
      setLayers([]);
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const standardW = 800;
          const standardH = Math.round((standardW * h) / w);
          setCanvasConfig(prev => ({
            ...prev,
            width: standardW,
            height: standardH
          }));
        }
      };
      img.src = queryPosterUrl;
    }

    if (id) {
      const loadExisting = async () => {
        try {
          const res = await axios.get(`/api/events/${id}`);
          const ev = res.data;
          setEventTitle(ev.title || 'Untitled Poster');
          setEventDetails(`Title: ${ev.title}\nCategory: ${ev.category || ''}\nVenue: ${ev.venue || ''}\nDates: ${ev.start_time || ''}\nDescription: ${ev.description || ''}`);
          
          if (ev.poster_url) {
            const jsonUrl = ev.poster_url.replace(/\.png|\.jpg|\.jpeg|\.webp/g, '.json');
            let loadedJson = false;
            try {
              const stateRes = await axios.get(jsonUrl);
              if (stateRes.data && stateRes.data.layers) {
                setLayers(stateRes.data.layers);
                setCanvasConfig(stateRes.data.canvasConfig);
                loadedJson = true;
              }
            } catch (e) { /* No saved json found */ }

            if (!loadedJson) {
              // The event has an uploaded flattened poster!
              setIsUploadedPosterMode(true);
              setUploadedOriginalUrl(ev.poster_url);
              setCanvasConfig(prev => ({
                ...prev,
                bgImage: ev.poster_url,
                overlayOpacity: 0,
                bgColor: '#000000'
              }));
              setLayers([]);
              const img = new Image();
              img.onload = () => {
                if (img.naturalWidth && img.naturalHeight) {
                  const w = img.naturalWidth;
                  const h = img.naturalHeight;
                  const standardW = 800;
                  const standardH = Math.round((standardW * h) / w);
                  setCanvasConfig(prev => ({
                    ...prev,
                    width: standardW,
                    height: standardH
                  }));
                }
              };
              img.src = ev.poster_url;
            }
          }
        } catch (e) {}
      };
      loadExisting();
    }
  }, [id]);

  // Zoom to Fit Canvas Calculation
  const handleFitCanvas = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const padX = isMobile ? 16 : 80;
    const padY = isMobile ? 24 : 80;
    const scaleW = (clientWidth - padX) / canvasConfig.width;
    const scaleH = (clientHeight - padY) / canvasConfig.height;
    const calculatedZoom = Math.min(scaleW, scaleH);
    setZoom(Math.max(0.18, Math.min(2.5, calculatedZoom)));
  };

  useEffect(() => {
    const timer = setTimeout(() => handleFitCanvas(), 100);
    window.addEventListener('resize', handleFitCanvas);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleFitCanvas);
    };
  }, [canvasConfig.width, canvasConfig.height]);

  // Fetch Branding Kits from Backend + LocalStorage
  const fetchBrandingKits = async () => {
    try {
      const res = await axios.get('/api/branding-kits');
      if (res.data && res.data.length > 0) {
        const localCustomRaw = localStorage.getItem('eventiva_custom_kits');
        let localCustom: InstitutionKit[] = [];
        if (localCustomRaw) {
          try { localCustom = JSON.parse(localCustomRaw); } catch (e) {}
        }
        const existingIds = new Set(res.data.map((k: any) => k.id));
        const combined = [...res.data, ...localCustom.filter(k => !existingIds.has(k.id))];
        setInstitutionKits(combined);
      }
    } catch (e) {
      const localCustomRaw = localStorage.getItem('eventiva_custom_kits');
      let localCustom: InstitutionKit[] = [];
      if (localCustomRaw) {
        try { localCustom = JSON.parse(localCustomRaw); } catch (e) {}
      }
      setInstitutionKits([...PRESET_INSTITUTION_KITS, ...localCustom]);
    }
  };

  // Fetch India-Wide Institutions Directory
  const fetchInstitutions = async () => {
    setInstitutionsLoading(true);
    try {
      const params = new URLSearchParams();
      if (institutionSearch.trim()) params.append('q', institutionSearch.trim());
      if (instCategory && instCategory !== 'All') params.append('category', instCategory);
      if (instState && instState !== 'All') params.append('state', instState);

      const res = await axios.get(`/api/institutions?${params.toString()}`);
      if (res.data) {
        setInstitutions(res.data);
      }
    } catch (e) {
      console.error('Failed to load institutions directory:', e);
    } finally {
      setInstitutionsLoading(false);
    }
  };

  useEffect(() => {
    fetchBrandingKits();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchInstitutions();
    }, 200);
    return () => clearTimeout(timer);
  }, [institutionSearch, instCategory, instState]);

  // --- BORDER STUDIO HANDLERS ---
  const applyBorderPreset = (preset: BorderPreset) => {
    pushStateToHistory(layers, canvasConfig);
    setCanvasConfig({
      ...canvasConfig,
      hasBorder: true,
      borderPreset: preset.id,
      borderColor: preset.borderColor,
      borderWidth: preset.borderWidth,
      borderStyle: preset.borderStyle,
      borderRadius: preset.borderRadius,
      borderInset: preset.borderInset,
      borderOpacity: preset.borderOpacity,
      borderGlow: preset.borderGlow,
      borderGlowColor: preset.borderGlowColor,
      borderGlowBlur: preset.borderGlowBlur,
      hasInnerBorder: Boolean(preset.hasInnerBorder),
      innerBorderColor: preset.innerBorderColor || '#fef08a',
      innerBorderWidth: preset.innerBorderWidth || 1,
      innerBorderStyle: preset.innerBorderStyle || 'solid',
      innerBorderInset: preset.innerBorderInset || 6
    });
  };

  const removeBorder = () => {
    pushStateToHistory(layers, canvasConfig);
    setCanvasConfig({ ...canvasConfig, hasBorder: false, hasInnerBorder: false });
  };

  // --- BOX & CARD CONTAINER HANDLERS ---
  const handleAddBoxAroundSelection = () => {
    if (!selectedId) return;
    pushStateToHistory(layers, canvasConfig);
    setLayers(layers.map(l => l.id === selectedId ? {
      ...l,
      hasBox: true,
      boxBg: l.boxBg || 'rgba(15, 23, 42, 0.85)',
      boxBorderColor: l.boxBorderColor || (canvasConfig.borderColor?.startsWith('#') ? canvasConfig.borderColor : '#38bdf8'),
      boxBorderWidth: l.boxBorderWidth ?? 1.5,
      boxBorderStyle: l.boxBorderStyle || 'solid',
      boxRadius: l.boxRadius ?? 8,
      boxPadding: l.boxPadding ?? 12,
      boxShadow: l.boxShadow || '0 8px 24px rgba(0,0,0,0.6)',
      boxBackdropFilter: l.boxBackdropFilter || 'blur(8px)'
    } : l));
  };

  const handleRemoveBoxFromSelection = () => {
    if (!selectedId) return;
    pushStateToHistory(layers, canvasConfig);
    setLayers(layers.map(l => l.id === selectedId ? { ...l, hasBox: false } : l));
  };

  const handleAddInfoCard = (cardType: 'prize' | 'datetime' | 'venue' | 'registration' | 'speaker' | 'notice' | 'accreditation' | 'badge' | 'signoff') => {
    pushStateToHistory(layers, canvasConfig);
    const id = `l-card-${Date.now()}`;
    let name = 'Info Card';
    let text = 'INFORMATION';
    let boxBg = 'rgba(15, 23, 42, 0.85)';
    let boxBorderColor = '#38bdf8';
    let color = '#ffffff';
    let fontSize = 22;
    let y = 600;

    if (cardType === 'prize') {
      name = 'Prize Pool Card';
      text = '🏆 PRIZE POOL: ₹1,50,000';
      boxBg = 'rgba(30, 20, 10, 0.9)';
      boxBorderColor = '#f59e0b';
      color = '#fef08a';
      fontSize = 24;
      y = 700;
    } else if (cardType === 'datetime') {
      name = 'Date & Time Card';
      text = '📅 OCTOBER 24 - 25, 2026\n⏰ 09:00 AM ONWARDS';
      boxBg = 'rgba(15, 23, 42, 0.85)';
      boxBorderColor = '#60a5fa';
      color = '#e0f2fe';
      fontSize = 20;
      y = 560;
    } else if (cardType === 'venue') {
      name = 'Venue Card';
      text = '📍 MAIN AUDITORIUM, TECH CAMPUS';
      boxBg = 'rgba(15, 23, 42, 0.85)';
      boxBorderColor = '#34d399';
      color = '#d1fae5';
      fontSize = 20;
      y = 620;
    } else if (cardType === 'registration') {
      name = 'Registration Fee Card';
      text = '⚡ FREE ENTRY • OPEN TO ALL';
      boxBg = 'rgba(24, 24, 27, 0.9)';
      boxBorderColor = '#a855f7';
      color = '#f3e8ff';
      fontSize = 20;
      y = 780;
    } else if (cardType === 'speaker') {
      name = 'Keynote Speaker Badge';
      text = '🎙️ KEYNOTE SPEAKER: DR. ARUN VERMA';
      boxBg = 'rgba(15, 23, 42, 0.85)';
      boxBorderColor = '#38bdf8';
      color = '#ffffff';
      fontSize = 20;
      y = 840;
    } else if (cardType === 'notice') {
      name = 'Important Notice Box';
      text = '⚠️ BRING COLLEGE ID & LAPTOP';
      boxBg = 'rgba(69, 10, 10, 0.85)';
      boxBorderColor = '#ef4444';
      color = '#fecaca';
      fontSize = 18;
      y = 900;
    } else if (cardType === 'accreditation') {
      name = 'Accreditation Badge';
      text = '★ NAAC "A++" GRADE | NBA ACCREDITED\nAUTONOMOUS INSTITUTION';
      boxBg = 'rgba(15, 23, 42, 0.92)';
      boxBorderColor = '#d4af37';
      color = '#fef08a';
      fontSize = 16;
      y = 120;
    } else if (cardType === 'badge') {
      name = 'Event Status Badge';
      text = '★ OFFICIAL PARTICIPATION CERTIFICATE ★';
      boxBg = 'rgba(30, 58, 138, 0.88)';
      boxBorderColor = '#38bdf8';
      color = '#ffffff';
      fontSize = 18;
      y = 480;
    } else if (cardType === 'signoff') {
      name = 'Organizing Unit Signoff';
      text = 'ORGANIZED BY TECHNICAL EVENTS COMMITTEE\nCONTACT: EVENTS@CAMPUS.EDU';
      boxBg = 'rgba(15, 23, 42, 0.82)';
      boxBorderColor = 'rgba(255, 255, 255, 0.28)';
      color = '#e2e8f0';
      fontSize = 15;
      y = 1000;
    }

    setLayers([...layers, {
      id,
      type: 'text',
      name,
      text,
      x: canvasConfig.width / 2,
      y,
      fontSize,
      fontFamily: 'Inter',
      fontWeight: 700,
      color,
      textAlign: 'center',
      zIndex: layers.length + 12,
      locked: false,
      hidden: false,
      hasBox: true,
      boxBg,
      boxBorderColor,
      boxBorderWidth: 1.5,
      boxBorderStyle: 'solid',
      boxRadius: 8,
      boxPadding: 14,
      boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
      boxBackdropFilter: 'blur(8px)'
    }]);
    setSelectedId(id);
  };

  // --- ACTIONS ---
  
  const handleAIGenerate = async () => {
    if (!eventDetails.trim()) return setError('Please provide event details');
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/ai/generate-poster-content', 
        { event_details: eventDetails, style }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      pushStateToHistory(layers, canvasConfig);
      mapAIToCanvas(res.data);
      setActiveTab('layers');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'AI generation failed.');
    } finally {
      setLoading(false);
    }
  };

  // --- DEDICATED AUTO ARRANGE ENGINE (UNIVERSAL HIERARCHY ACROSS 800 x 1131 CANVAS) ---
  const autoArrangeLayers = (currentLayers: Layer[], currentConfig: CanvasConfig): Layer[] => {
    const cw = currentConfig.width;

    const headerLayers: Layer[] = [];
    const subHeaderLayers: Layer[] = [];
    const titleLayers: Layer[] = [];
    const subtitleLayers: Layer[] = [];
    const descLayers: Layer[] = [];
    const infoDateLayers: Layer[] = [];
    const infoTimeLayers: Layer[] = [];
    const infoVenueLayers: Layer[] = [];
    const infoDividerLayers: Layer[] = [];
    const taglineLeftLayers: Layer[] = [];
    const taglineRightLayers: Layer[] = [];
    const otherTaglineLayers: Layer[] = [];
    const qrLayers: Layer[] = [];
    const signoffLayers: Layer[] = [];
    const otherLayers: Layer[] = [];

    currentLayers.forEach(l => {
      const name = (l.name || '').toLowerCase();
      const text = (l.text || '').toLowerCase();
      const fontSz = l.fontSize || 20;

      if (l.type === 'qr' || name.includes('qr')) {
        qrLayers.push(l);
      } else if (name.includes('logo') || name.includes('badge') || name.includes('institution') || name.includes('college') || name.includes('university')) {
        headerLayers.push(l);
      } else if (name.includes('header divider') || (text.startsWith('―') && l.y < 160)) {
        headerLayers.push(l);
      } else if (name.includes('department') || name.includes('dept') || name.includes('club') || name.includes('host') || name.includes('invite')) {
        subHeaderLayers.push(l);
      } else if (name.includes('event title') || name.includes('main heading') || name.includes('main event title') || (l.type === 'text' && fontSz >= 45)) {
        titleLayers.push(l);
      } else if (name.includes('subtitle') || name.includes('edition') || name.includes('theme')) {
        subtitleLayers.push(l);
      } else if (name.includes('description') || name.includes('desc') || (l.type === 'text' && fontSz <= 18 && text.length > 40)) {
        descLayers.push(l);
      } else if (name.includes('date') || text.includes('date:') || text.includes('📅')) {
        infoDateLayers.push(l);
      } else if (name.includes('time') || text.includes('time:') || text.includes('🕒')) {
        infoTimeLayers.push(l);
      } else if (name.includes('venue') || text.includes('venue:') || text.includes('📍')) {
        infoVenueLayers.push(l);
      } else if (name.includes('divider') || text === '|' || (text.startsWith('―') && l.y >= 160)) {
        infoDividerLayers.push(l);
      } else if (name.includes('tagline left') || name.includes('tag left')) {
        taglineLeftLayers.push(l);
      } else if (name.includes('tagline right') || name.includes('tag right')) {
        taglineRightLayers.push(l);
      } else if (name.includes('tagline')) {
        otherTaglineLayers.push(l);
      } else if (name.includes('signoff') || name.includes('footer') || name.includes('rsvp') || name.includes('contact') || l.y > 950) {
        signoffLayers.push(l);
      } else if (!name.includes('border')) {
        otherLayers.push(l);
      }
    });

    const hasHeader = headerLayers.length > 0 || subHeaderLayers.length > 0;
    const movedMap = new Map<string, Partial<Layer>>();

    // 1. Header Layers
    headerLayers.forEach(hl => {
      const hName = (hl.name || '').toLowerCase();
      if (hName.includes('logo')) {
        movedMap.set(hl.id, { x: 75, y: 70 });
      } else if (hName.includes('badge')) {
        movedMap.set(hl.id, { x: cw - 75, y: 70 });
      } else if (hName.includes('details')) {
        movedMap.set(hl.id, { x: cw / 2, y: 84, textAlign: 'center' });
      } else if (hName.includes('divider') || (hl.text || '').includes('―')) {
        movedMap.set(hl.id, { x: cw / 2, y: 120, textAlign: 'center' });
      } else {
        movedMap.set(hl.id, { x: cw / 2, y: 48, textAlign: 'center' });
      }
    });

    // Sub-header (Dept / Host)
    const deptY = hasHeader ? 152 : 60;
    const hostY = hasHeader ? 186 : 95;
    subHeaderLayers.forEach(sh => {
      const shName = (sh.name || '').toLowerCase();
      if (shName.includes('host') || shName.includes('invite')) {
        movedMap.set(sh.id, { x: cw / 2, y: hostY, textAlign: 'center' });
      } else {
        movedMap.set(sh.id, { x: cw / 2, y: deptY, textAlign: 'center' });
      }
    });

    // 2. Hero Title
    const titleY = hasHeader ? 295 : 220;
    titleLayers.forEach(tl => {
      movedMap.set(tl.id, { x: cw / 2, y: titleY, textAlign: 'center' });
    });

    // 3. Subtitle
    const subY = titleY + 80;
    subtitleLayers.forEach(sl => {
      movedMap.set(sl.id, { x: cw / 2, y: subY, textAlign: 'center' });
    });

    // 4. Description
    const descY = subtitleLayers.length > 0 ? (subY + 65) : (titleY + 110);
    descLayers.forEach(dl => {
      movedMap.set(dl.id, { x: cw / 2, y: descY, textAlign: 'center' });
    });

    // 5. Key Info Bar (Date, Time, Venue)
    const infoY = hasHeader ? 645 : 580;
    if (infoDateLayers.length > 0 && infoVenueLayers.length > 0) {
      infoDateLayers.forEach(d => movedMap.set(d.id, { x: 215, y: infoY, textAlign: 'center' }));
      infoTimeLayers.forEach(t => movedMap.set(t.id, { x: 400, y: infoY, textAlign: 'center' }));
      infoVenueLayers.forEach(v => movedMap.set(v.id, { x: 585, y: infoY, textAlign: 'center' }));
      infoDividerLayers.forEach(div => {
        const divText = (div.text || '').trim();
        if (divText === '|') {
          movedMap.set(div.id, { x: (div.name || '').includes('1') ? 315 : 485, y: infoY, textAlign: 'center' });
        } else if (divText.includes('―')) {
          movedMap.set(div.id, { x: cw / 2, y: infoY + 35, textAlign: 'center' });
        }
      });
    } else {
      let curY = infoY;
      [...infoDateLayers, ...infoTimeLayers, ...infoVenueLayers].forEach(l => {
        movedMap.set(l.id, { x: cw / 2, y: curY, textAlign: 'center' });
        curY += 35;
      });
    }

    // 6. Taglines & Accent Badges
    const tagY = hasHeader ? 785 : 730;
    taglineLeftLayers.forEach(tl => movedMap.set(tl.id, { x: 145, y: tagY }));
    taglineRightLayers.forEach(tr => movedMap.set(tr.id, { x: 655, y: tagY }));
    otherTaglineLayers.forEach(ot => movedMap.set(ot.id, { x: cw / 2, y: tagY + 40, textAlign: 'center' }));

    // 7. QR Code
    qrLayers.forEach(qr => movedMap.set(qr.id, { x: 690, y: 910 }));

    // 8. Footer / Signoff
    signoffLayers.forEach(sf => movedMap.set(sf.id, { x: cw / 2, y: 1030, textAlign: 'center' }));

    // 9. Other miscellaneous layers
    let otherStartY = 850;
    otherLayers.forEach(ol => {
      movedMap.set(ol.id, { x: cw / 2, y: otherStartY, textAlign: 'center' });
      otherStartY += 35;
    });

    return currentLayers.map(l => {
      const updates = movedMap.get(l.id);
      return updates ? { ...l, ...updates } : l;
    });
  };

  const handleAutoArrange = () => {
    pushStateToHistory(layers, canvasConfig);
    const arranged = autoArrangeLayers(layers, canvasConfig);
    setLayers(arranged);
    setChatHistory(prev => [
      ...prev,
      { role: 'ai', content: '🪄 Auto-arranged all elements evenly across the full canvas height (800 × 1131) with optimal visual hierarchy.' }
    ]);
  };

  // Structured AI Poster Editing Handler
  const handleAIChat = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMessage }]);
    setAiTyping(true);
    
    const isArrangeRequest = /arrange|distribute|fix overlap|spread|use lower half|layout cramming/i.test(userMessage);

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('/api/ai/edit-poster', 
        { 
          prompt: userMessage, 
          selected_id: selectedId,
          chat_history: chatHistory.slice(-8),
          current_state: { layers, canvasConfig } 
        }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { message, mutations } = res.data;
      setChatHistory(prev => [...prev, { role: 'ai', content: message }]);
      
      if (mutations && mutations.length > 0) {
        if (mutations[0]?.action === 'undo') {
          handleUndo();
          return;
        } else if (mutations[0]?.action === 'redo') {
          handleRedo();
          return;
        }

        pushStateToHistory(layers, canvasConfig);
        
        let newLayers = [...layers];
        let newConfig = { ...canvasConfig };

        // Helper to locate target layer with fuzzy & keyword resolution
        const findTargetLayer = (targetId?: string): Layer | undefined => {
          if (targetId) {
            // 1. Direct ID match
            const exact = newLayers.find(l => l.id === targetId);
            if (exact) return exact;
            
            // 2. Name or text keyword match
            const lower = targetId.toLowerCase();
            const byName = newLayers.find(l => 
              l.name?.toLowerCase().includes(lower) || 
              (l.type === 'text' && l.text?.toLowerCase().includes(lower))
            );
            if (byName) return byName;
          }
          
          // 3. Fallback to currently selected element if available
          if (selectedId) {
            const selected = newLayers.find(l => l.id === selectedId);
            if (selected) return selected;
          }
          return undefined;
        };
        
        mutations.forEach((m: any) => {
          const action = m.action;

          // 1. Update Font Family
          if (action === 'update_font') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { ...l, fontFamily: m.fontFamily } : l);
            }
          }
          // 2. Update Font Size
          else if (action === 'update_font_size') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { ...l, fontSize: Number(m.fontSize) } : l);
            }
          }
          // 3. Update Color & Material Styles
          else if (action === 'update_color') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              const preset = m.stylePreset?.toLowerCase();
              const colorStr = (m.color || '').toLowerCase();
              
              if (preset === '3d-gold-foil' || colorStr.includes('gold')) {
                newLayers = newLayers.map(l => l.id === target.id ? { ...l, ...getTypographyStyle('3d-gold-foil') } : l);
              } else if (preset === '3d-noventrix-blue' || colorStr.includes('blue')) {
                newLayers = newLayers.map(l => l.id === target.id ? { ...l, ...getTypographyStyle('3d-noventrix-blue') } : l);
              } else if (preset === '3d-liquid-chrome' || colorStr.includes('chrome')) {
                newLayers = newLayers.map(l => l.id === target.id ? { ...l, ...getTypographyStyle('3d-liquid-chrome') } : l);
              } else {
                // Solid plain color: Reset all gradient background clips
                newLayers = newLayers.map(l => l.id === target.id ? { 
                  ...l, 
                  color: m.color,
                  background: undefined,
                  backgroundClip: undefined,
                  WebkitBackgroundClip: undefined,
                  textFillColor: undefined,
                  WebkitTextFillColor: undefined,
                  textStroke: undefined
                } : l);
              }
            }
          }
          // 4. Update Position
          else if (action === 'update_position') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { 
                ...l, 
                x: m.x !== undefined ? m.x : l.x, 
                y: m.y !== undefined ? m.y : l.y 
              } : l);
            }
          }
          // 5. Update Text Content
          else if (action === 'update_text') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { ...l, text: m.text } : l);
            }
          }
          // 6. Update Background (Preserving all layers!)
          else if (action === 'update_background' || action === 'update_canvas') {
            const updates = m.updates || m;
            if (updates.bgImage) newConfig.bgImage = updates.bgImage;
            if (updates.bgColor) newConfig.bgColor = updates.bgColor;
            if (updates.brightness !== undefined) newConfig.brightness = updates.brightness;
            if (updates.contrast !== undefined) newConfig.contrast = updates.contrast;
            if (updates.venueBackdrop !== undefined) newConfig.venueBackdrop = updates.venueBackdrop;
          }
          // 7. Add New Text Element
          else if (action === 'add_text') {
            const id = `l-text-${Date.now()}`;
            newLayers.push({
              id,
              type: 'text',
              name: m.name || 'New Text',
              text: m.text || 'New Text',
              x: m.x || canvasConfig.width / 2,
              y: m.y || canvasConfig.height / 2,
              fontSize: m.fontSize || 28,
              fontFamily: m.fontFamily || 'Inter',
              fontWeight: m.fontWeight || 700,
              color: m.color || '#ffffff',
              textAlign: m.textAlign || 'center',
              zIndex: newLayers.length + 10,
              locked: false,
              hidden: false
            });
          }
          // 8. Remove Element
          else if (action === 'remove_element' || action === 'delete_layer') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.filter(l => l.id !== target.id);
            }
          }
          // 9. Resize Element
          else if (action === 'resize_element') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { 
                ...l, 
                width: m.width !== undefined ? m.width : l.width, 
                height: m.height !== undefined ? m.height : l.height 
              } : l);
            }
          }
          // 10. Update Visual Effects
          else if (action === 'update_effects') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { 
                ...l, 
                textShadow: m.textShadow !== undefined ? m.textShadow : l.textShadow,
                filter: m.filter !== undefined ? m.filter : l.filter,
                textStroke: m.textStroke !== undefined ? m.textStroke : l.textStroke
              } : l);
            }
          }
          // 11. Generic Update Layer
          else if (action === 'update_layer') {
            const target = findTargetLayer(m.target_id);
            if (target && m.updates) {
              newLayers = newLayers.map(l => l.id === target.id ? { ...l, ...m.updates } : l);
            }
          }
          // 12. Add Generic Layer
          else if (action === 'add_layer' && m.layer) {
            newLayers.push(m.layer);
          }
          // 13. Add / Update Border
          else if (action === 'add_border' || action === 'update_border') {
            newConfig.hasBorder = true;
            if (m.borderColor) newConfig.borderColor = m.borderColor;
            if (m.borderWidth !== undefined) newConfig.borderWidth = Number(m.borderWidth);
            if (m.borderStyle) newConfig.borderStyle = m.borderStyle;
            if (m.borderRadius !== undefined) newConfig.borderRadius = Number(m.borderRadius);
            if (m.borderInset !== undefined || m.inset !== undefined) newConfig.borderInset = Number(m.borderInset ?? m.inset);
            if (m.borderOpacity !== undefined) newConfig.borderOpacity = Number(m.borderOpacity);
            if (m.borderGlow !== undefined) newConfig.borderGlow = Boolean(m.borderGlow);
            if (m.borderGlowColor) newConfig.borderGlowColor = m.borderGlowColor;
            if (m.borderPreset) newConfig.borderPreset = m.borderPreset;
            if (m.hasInnerBorder !== undefined) newConfig.hasInnerBorder = Boolean(m.hasInnerBorder);
            if (m.innerBorderColor) newConfig.innerBorderColor = m.innerBorderColor;
          }
          // 14. Remove Border
          else if (action === 'remove_border') {
            newConfig.hasBorder = false;
          }
          // 15. Wrap Selection / Target with Container Box
          else if (action === 'wrap_selection_box' || action === 'add_box') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? {
                ...l,
                hasBox: true,
                boxBg: m.boxBg || 'rgba(15, 23, 42, 0.85)',
                boxBorderColor: m.boxBorderColor || '#38bdf8',
                boxBorderWidth: m.boxBorderWidth !== undefined ? Number(m.boxBorderWidth) : 1.5,
                boxBorderStyle: m.boxBorderStyle || 'solid',
                boxRadius: m.boxRadius !== undefined ? Number(m.boxRadius) : 8,
                boxPadding: m.boxPadding !== undefined ? Number(m.boxPadding) : 12,
                boxShadow: m.boxShadow || '0 8px 24px rgba(0,0,0,0.6)',
                boxBackdropFilter: m.boxBackdropFilter || 'blur(8px)'
              } : l);
            }
          }
          // 16. Remove Box Container
          else if (action === 'remove_box') {
            const target = findTargetLayer(m.target_id);
            if (target) {
              newLayers = newLayers.map(l => l.id === target.id ? { ...l, hasBox: false } : l);
            }
          }
          // 17. Add Information Box / Badge Element
          else if (action === 'add_box_element') {
            const id = `l-box-${Date.now()}`;
            newLayers.push({
              id,
              type: 'text',
              name: m.name || 'Information Box',
              text: m.text || 'Info Card',
              x: m.x || canvasConfig.width / 2,
              y: m.y || canvasConfig.height / 2,
              fontSize: m.fontSize || 22,
              fontFamily: m.fontFamily || 'Inter',
              fontWeight: 700,
              color: m.color || '#ffffff',
              textAlign: 'center',
              zIndex: newLayers.length + 15,
              locked: false,
              hidden: false,
              hasBox: true,
              boxBg: m.boxBg || 'rgba(15, 23, 42, 0.85)',
              boxBorderColor: m.boxBorderColor || '#38bdf8',
              boxBorderWidth: m.boxBorderWidth !== undefined ? Number(m.boxBorderWidth) : 1.5,
              boxBorderStyle: m.boxBorderStyle || 'solid',
              boxRadius: m.boxRadius !== undefined ? Number(m.boxRadius) : 8,
              boxPadding: m.boxPadding !== undefined ? Number(m.boxPadding) : 12,
              boxShadow: m.boxShadow || '0 8px 24px rgba(0,0,0,0.6)'
            });
          }
        });
        
        setLayers(newLayers);
        setCanvasConfig(newConfig);
      } else if (isArrangeRequest) {
        // Fallback auto-arrange if mutations array was empty
        handleAutoArrange();
      }
      
    } catch (err: any) {
      console.error('AI Edit Error:', err);
      if (isArrangeRequest) {
        handleAutoArrange();
      } else {
        const errorDetail = err.response?.data?.detail || err.message || 'AI failed to apply edits.';
        setChatHistory(prev => [...prev, { role: 'ai', content: `⚠️ ${errorDetail}` }]);
      }
    } finally {
      setAiTyping(false);
    }
  };

  // Typography Presets Engine
  const getTypographyStyle = (type: string) => {
    switch (type) {
      case '3d-noventrix-blue':
        return {
          fontFamily: 'Orbitron',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #E0F2FE 18%, #7DD3FC 40%, #0284C7 55%, #0369A1 78%, #38BDF8 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          textFillColor: 'transparent',
          WebkitTextFillColor: 'transparent',
          textStroke: '1.5px rgba(56, 189, 248, 0.85)',
          WebkitTextStroke: '1.5px rgba(56, 189, 248, 0.85)',
          textShadow: '0 1px 0 #38bdf8, 0 2px 0 #0284c7, 0 3px 0 #0369a1, 0 4px 0 #075985, 0 6px 14px rgba(0,0,0,0.9)',
          filter: 'drop-shadow(0 0 25px rgba(56, 189, 248, 0.8)) drop-shadow(0 12px 24px rgba(0,0,0,0.95))'
        };
      case '3d-gold-foil':
        return {
          fontFamily: 'Cinzel',
          background: 'linear-gradient(180deg, #FFFDF0 0%, #FEF08A 20%, #F59E0B 45%, #B45309 60%, #78350F 80%, #FBBF24 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          textFillColor: 'transparent',
          WebkitTextFillColor: 'transparent',
          textStroke: '1.5px rgba(251, 191, 36, 0.9)',
          WebkitTextStroke: '1.5px rgba(251, 191, 36, 0.9)',
          textShadow: '0 1px 0 #fbbf24, 0 2px 0 #d97706, 0 3px 0 #b45309, 0 5px 12px rgba(0,0,0,0.9)',
          filter: 'drop-shadow(0 0 22px rgba(245, 158, 11, 0.7)) drop-shadow(0 10px 20px rgba(0,0,0,0.95))'
        };
      case '3d-liquid-chrome':
        return {
          fontFamily: 'Montserrat',
          background: 'linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 25%, #64748B 50%, #1E293B 55%, #94A3B8 80%, #FFFFFF 100%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          textFillColor: 'transparent',
          WebkitTextFillColor: 'transparent',
          textStroke: '1.5px rgba(255, 255, 255, 0.85)',
          WebkitTextStroke: '1.5px rgba(255, 255, 255, 0.85)',
          textShadow: '0 1px 0 #cbd5e1, 0 2px 0 #94a3b8, 0 3px 0 #475569, 0 5px 12px rgba(0,0,0,0.9)',
          filter: 'drop-shadow(0 0 18px rgba(255, 255, 255, 0.5)) drop-shadow(0 10px 20px rgba(0,0,0,0.95))'
        };
      case 'neon-tube':
        return {
          fontFamily: 'Rajdhani',
          color: '#ffffff',
          textStroke: '1px #06b6d4',
          WebkitTextStroke: '1px #06b6d4',
          textShadow: '0 0 10px #ffffff, 0 0 20px #06b6d4, 0 0 40px #0284c7'
        };
      case 'elegant-serif':
        return {
          fontFamily: 'Playfair Display',
          color: '#f8fafc',
          textShadow: '0 2px 10px rgba(0,0,0,0.9)'
        };
      default:
        return {
          fontFamily: 'Inter',
          color: '#ffffff',
          textShadow: '0 2px 8px rgba(0,0,0,0.7)'
        };
    }
  };

  // Universal Layout Mapping (Neutral Defaults — Never Injects Fake Logos)
  const mapAIToCanvas = (data: any) => {
    const newLayers: Layer[] = [];
    let z = 10;
    
    const cw = canvasConfig.width;
    const typo = getTypographyStyle(data.typography_style || '3d-noventrix-blue');
    
    // 1. BRANDING & INSTITUTIONAL HEADER (ONLY IF PROVIDED)
    const hasInst = Boolean(data.institution_name && data.institution_name.trim());
    const hasDept = Boolean(data.department_name && data.department_name.trim());
    const hasHeader = hasInst || hasDept;

    // College / Org Logo (ONLY if explicitly specified and matches event details)
    if (data.left_logo_asset === 'tkrcet_logo' && data.institution_name?.toLowerCase().includes('tkr')) {
      newLayers.push({
        id: `l-logo-${Date.now()}`,
        type: 'image',
        name: 'Institution Logo',
        src: '/assets/tkrcet_logo.png',
        x: 75,
        y: 70,
        width: 75,
        height: 75,
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // Accreditation Badge (ONLY if explicitly mentioned in event text)
    if (data.right_badge_asset === 'naac_badge' && data.institution_details?.toLowerCase().includes('naac')) {
      newLayers.push({
        id: `l-badge-${Date.now()}`,
        type: 'image',
        name: 'Accreditation Badge',
        src: '/assets/naac_badge.png',
        x: cw - 75,
        y: 70,
        width: 75,
        height: 75,
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // Institution Name
    if (hasInst) {
      newLayers.push({
        id: `l-inst-${Date.now()}`,
        type: 'text',
        name: 'Institution Name',
        text: data.institution_name,
        x: cw / 2,
        y: 44,
        fontSize: 19.5,
        fontFamily: 'Inter',
        fontWeight: 900,
        textAlign: 'center',
        color: '#ffffff',
        letterSpacing: 0.5,
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // Institution Details / Autonomy / Approvals
    if (data.institution_details && data.institution_details.trim()) {
      newLayers.push({
        id: `l-inst-sub-${Date.now()}`,
        type: 'text',
        name: 'Institution Details',
        text: data.institution_details,
        x: cw / 2,
        y: 84,
        fontSize: 10,
        fontFamily: 'Inter',
        fontWeight: 500,
        lineHeight: 1.35,
        textAlign: 'center',
        color: '#cbd5e1',
        zIndex: z++,
        locked: false,
        hidden: false
      });

      newLayers.push({
        id: `l-div-head-${Date.now()}`,
        type: 'text',
        name: 'Header Divider',
        text: '―'.repeat(45),
        x: cw / 2,
        y: 122,
        fontSize: 16,
        fontFamily: 'Inter',
        color: 'rgba(255,255,255,0.22)',
        textAlign: 'center',
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // Department / Team Name
    if (hasDept) {
      newLayers.push({
        id: `l-dept-${Date.now()}`,
        type: 'text',
        name: 'Department Name',
        text: data.department_name,
        x: cw / 2,
        y: hasInst ? 154 : 60,
        fontSize: 20,
        fontFamily: 'Inter',
        fontWeight: 700,
        textAlign: 'center',
        color: '#ffffff',
        letterSpacing: 0.5,
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // Host & Invitation Line
    if (data.host_and_invite && data.host_and_invite.trim()) {
      newLayers.push({
        id: `l-host-${Date.now()}`,
        type: 'text',
        name: 'Host & Invitation',
        text: data.host_and_invite,
        x: cw / 2,
        y: hasInst ? 184 : 95,
        fontSize: 14.5,
        fontFamily: 'Inter',
        fontWeight: 500,
        textAlign: 'center',
        color: '#e2e8f0',
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // 2. DOMINANT HERO 3D EVENT TITLE (Adapts position if header is absent)
    const titleY = hasHeader ? 295 : 220;
    const fullTitle = data.full_title_lockup || (data.title + (data.subtitle ? ` ${data.subtitle}` : ''));
    newLayers.push({
      id: `l-title-${Date.now()}`,
      type: 'text',
      name: 'Main Event Title',
      text: fullTitle,
      x: cw / 2,
      y: titleY,
      fontSize: 78,
      fontWeight: 900,
      textAlign: 'center',
      letterSpacing: 2,
      zIndex: z + 5,
      locked: false,
      hidden: false,
      ...typo
    });

    // 3. EVENT DESCRIPTION
    const descY = hasHeader ? 430 : 360;
    if (data.description && data.description.trim()) {
      newLayers.push({
        id: `l-desc-${Date.now()}`,
        type: 'text',
        name: 'Event Description',
        text: data.description,
        x: cw / 2,
        y: descY,
        fontSize: 14.5,
        fontFamily: 'Inter',
        fontWeight: 400,
        lineHeight: 1.55,
        textAlign: 'center',
        color: '#cbd5e1',
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // 4. STRUCTURED KEY INFO BAR (Date | Time | Venue)
    const infoY = hasHeader ? 645 : 580;
    if (data.date || data.time || data.venue) {
      newLayers.push({
        id: `l-date-${Date.now()}`,
        type: 'text',
        name: 'Date Info',
        text: `📅 Date: ${data.date || 'TBA'}`,
        x: 215,
        y: infoY,
        fontSize: 15,
        fontFamily: 'Inter',
        fontWeight: 700,
        textAlign: 'center',
        color: '#ffffff',
        zIndex: z++,
        locked: false,
        hidden: false
      });

      newLayers.push({
        id: `l-div1-${Date.now()}`,
        type: 'text',
        name: 'Divider 1',
        text: '|',
        x: 325,
        y: infoY,
        fontSize: 16,
        fontFamily: 'Inter',
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        zIndex: z++,
        locked: false,
        hidden: false
      });

      newLayers.push({
        id: `l-time-${Date.now()}`,
        type: 'text',
        name: 'Time Info',
        text: `🕒 Time: ${data.time || 'TBA'}`,
        x: 400,
        y: infoY,
        fontSize: 15,
        fontFamily: 'Inter',
        fontWeight: 700,
        textAlign: 'center',
        color: '#ffffff',
        zIndex: z++,
        locked: false,
        hidden: false
      });

      newLayers.push({
        id: `l-div2-${Date.now()}`,
        type: 'text',
        name: 'Divider 2',
        text: '|',
        x: 475,
        y: infoY,
        fontSize: 16,
        fontFamily: 'Inter',
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        zIndex: z++,
        locked: false,
        hidden: false
      });

      newLayers.push({
        id: `l-venue-${Date.now()}`,
        type: 'text',
        name: 'Venue Info',
        text: `📍 Venue: ${data.venue || 'Main Venue'}`,
        x: 585,
        y: infoY,
        fontSize: 15,
        fontFamily: 'Inter',
        fontWeight: 700,
        textAlign: 'center',
        color: '#ffffff',
        zIndex: z++,
        locked: false,
        hidden: false
      });

      newLayers.push({
        id: `l-div-info-${Date.now()}`,
        type: 'text',
        name: 'Info Divider',
        text: '―'.repeat(45),
        x: cw / 2,
        y: infoY + 35,
        fontSize: 16,
        fontFamily: 'Inter',
        color: 'rgba(255,255,255,0.18)',
        textAlign: 'center',
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // 5. SIDE ACCENTS & TAGLINES (ZERO CLIPPING — Safely Indented)
    const tagY = hasHeader ? 785 : 730;
    if (data.tagline_left || data.diagonal_tagline) {
      const tagText = data.tagline_left || data.diagonal_tagline;
      newLayers.push({
        id: `l-tag-left-${Date.now()}`,
        type: 'text',
        name: 'Tagline Left',
        text: tagText.replace(/\. /g, '.\n'),
        x: 145,
        y: tagY,
        fontSize: 32,
        fontFamily: 'Caveat',
        fontWeight: 700,
        lineHeight: 1.15,
        textAlign: 'left',
        color: '#facc15',
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    if (data.tagline_right) {
      newLayers.push({
        id: `l-tag-right-${Date.now()}`,
        type: 'text',
        name: 'Tagline Right',
        text: data.tagline_right.includes('\n') ? data.tagline_right : data.tagline_right.replace(/ /g, '\n'),
        x: 655,
        y: tagY,
        fontSize: 17,
        fontFamily: 'Montserrat',
        fontWeight: 800,
        letterSpacing: 4,
        lineHeight: 1.35,
        textAlign: 'right',
        color: '#f59e0b',
        zIndex: z++,
        locked: false,
        hidden: false
      });
    }

    // 6. BOTTOM SIGNOFF BLOCK (ONLY IF PROVIDED)
    const signoffParts = [
      data.signoff_title,
      data.signoff_team,
      data.signoff_dept,
      data.signoff_brand
    ].filter(Boolean);

    if (signoffParts.length > 0) {
      newLayers.push({
        id: `l-signoff-${Date.now()}`,
        type: 'text',
        name: 'Bottom Signoff',
        text: signoffParts.join('\n'),
        x: cw / 2,
        y: 1030,
        fontSize: 14.5,
        fontFamily: 'Inter',
        fontWeight: 600,
        lineHeight: 1.45,
        textAlign: 'center',
        color: '#ffffff',
        zIndex: z + 10,
        locked: false,
        hidden: false
      });
    }

    // 7. REGISTRATION QR CODE CARD
    if (data.contact_info || data.registration_link) {
      const qrData = data.registration_link || data.contact_info;
      newLayers.push({
        id: `l-qr-${Date.now()}`,
        type: 'qr',
        name: 'Registration QR Code',
        src: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`,
        x: 690,
        y: 910,
        width: 85,
        height: 85,
        zIndex: z + 10,
        locked: false,
        hidden: false
      });
    }

    setLayers(newLayers);
    
    // Background Configuration (Universal Neutral Defaults)
    const isExplicitTkrCampus = data.venue_backdrop_asset === 'tkrcet_campus' && 
      ((data.institution_name && data.institution_name.toLowerCase().includes('tkr')) || 
       (data.venue && data.venue.toLowerCase().includes('tkr')));

    setCanvasConfig({
      ...canvasConfig,
      bgImage: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1200&q=80',
      bgColor: '#030712',
      venueBackdrop: isExplicitTkrCampus ? '/assets/tkrcet_campus.png' : '',
      venueOpacity: 95,
      hasBorder: true,
      borderColor: 'rgba(255, 255, 255, 0.18)',
      radialAura: true,
      auraColor: data.typography_style === '3d-gold-foil' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(56, 189, 248, 0.28)'
    });
  };

  // --- DRAG & DROP ENGINE ---
  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    setSelectedId(id);
    const el = layers.find(l => l.id === id);
    if (!el || el.locked) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y; 
    pushStateToHistory(layers, canvasConfig);

    const onPointerMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      updateLayer(id, { x: origX + dx, y: origY + dy });
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // --- LAYER MANAGEMENT ---
  const updateLayer = (id: string, updates: Partial<Layer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  };
  
  const addTextLayer = () => { 
    pushStateToHistory(layers, canvasConfig);
    const id = `l-${Date.now()}`;
    setLayers([...layers, { 
      id, 
      type: 'text', 
      name: 'New Text', 
      text: 'Double click to edit', 
      x: canvasConfig.width / 2, 
      y: canvasConfig.height / 2, 
      zIndex: layers.length + 10, 
      locked: false, 
      hidden: false, 
      fontSize: 32, 
      fontFamily: 'Inter', 
      color: '#ffffff', 
      textAlign: 'center' 
    }]);
    setSelectedId(id);
  };

  const duplicateLayer = (id: string) => { 
    pushStateToHistory(layers, canvasConfig);
    const el = layers.find(l => l.id === id);
    if (!el) return;
    const newId = `l-${Date.now()}`;
    setLayers([...layers, { ...el, id: newId, x: el.x + 20, y: el.y + 20, zIndex: layers.length + 10 }]);
    setSelectedId(newId);
  };

  const deleteLayer = (id: string) => { 
    pushStateToHistory(layers, canvasConfig);
    setLayers(layers.filter(l => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const bringForward = (id: string) => { 
    pushStateToHistory(layers, canvasConfig);
    setLayers(layers.map(l => l.id === id ? { ...l, zIndex: l.zIndex + 1 } : l));
  };

  const sendBackward = (id: string) => { 
    pushStateToHistory(layers, canvasConfig);
    setLayers(layers.map(l => l.id === id ? { ...l, zIndex: Math.max(1, l.zIndex - 1) } : l));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      pushStateToHistory(layers, canvasConfig);
      const url = URL.createObjectURL(e.target.files[0]);
      const id = `l-img-${Date.now()}`;
      setLayers([...layers, { 
        id, 
        type: 'image', 
        name: 'Uploaded Image', 
        src: url, 
        x: canvasConfig.width / 2, 
        y: canvasConfig.height / 2, 
        width: 150, 
        height: 150, 
        zIndex: layers.length + 10, 
        locked: false, 
        hidden: false 
      }]);
      setSelectedId(id);
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      pushStateToHistory(layers, canvasConfig);
      setCanvasConfig({ ...canvasConfig, bgImage: URL.createObjectURL(e.target.files[0]) });
    }
  };

  const handleVenueUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      pushStateToHistory(layers, canvasConfig);
      setCanvasConfig({ ...canvasConfig, venueBackdrop: URL.createObjectURL(e.target.files[0]) });
    }
  };

  // --- UPLOAD EXISTING POSTER WORKFLOW ---
  const handlePosterFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
      alert('Supported poster formats: PNG, JPG, JPEG, WEBP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      alert('File size exceeds the 15MB limit.');
      return;
    }

    try {
      const data = new FormData();
      data.append('file', file);
      const res = await axios.post('/api/posters/upload-image', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const imgUrl = res.data.url;
      const detectedW = res.data.width;
      const detectedH = res.data.height;

      pushStateToHistory(layers, canvasConfig);
      setIsUploadedPosterMode(true);
      setUploadedOriginalUrl(imgUrl);

      let finalW = 800;
      let finalH = 1131;
      if (detectedW && detectedH) {
        finalH = Math.round((finalW * detectedH) / detectedW);
      }

      setCanvasConfig(prev => ({
        ...prev,
        width: finalW,
        height: finalH,
        bgImage: imgUrl,
        overlayOpacity: 0,
        bgColor: '#000000'
      }));

      // In Mode A (image-based editing), preserve uploaded image as clean background
      setLayers([]);
      setSelectedId(null);
      setTimeout(() => handleFitCanvas(), 120);
    } catch (err: any) {
      alert('Failed to upload poster: ' + (err.response?.data?.detail || err.message));
    } finally {
      if (posterUploadInputRef.current) posterUploadInputRef.current.value = '';
    }
  };

  // --- AI OCR TEXT EXTRACTION ---
  const handleDetectTextLayers = async () => {
    const imgUrl = canvasConfig.bgImage || uploadedOriginalUrl;
    if (!imgUrl) {
      alert('Please upload or select a poster image first.');
      return;
    }

    setOcrDetecting(true);
    try {
      const res = await axios.post('/api/ai/extract-poster-text', { image_url: imgUrl });
      if (res.data && res.data.detected_elements && res.data.detected_elements.length > 0) {
        setOcrElementsModal(res.data.detected_elements);
      } else {
        alert(res.data?.message || 'No text elements detected in this image.');
      }
    } catch (err: any) {
      alert('OCR detection failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setOcrDetecting(false);
    }
  };

  const handleApplyDetectedLayers = (selectedDetected: any[]) => {
    pushStateToHistory(layers, canvasConfig);
    const newLayers: Layer[] = selectedDetected.map((det, idx) => ({
      id: `ocr-${Date.now()}-${idx}`,
      type: 'text',
      name: `${det.role ? det.role.toUpperCase() : 'Layer'}: ${det.text.slice(0, 16)}`,
      text: det.text,
      x: canvasConfig.width / 2,
      y: det.approx_y || (160 + idx * 75),
      zIndex: layers.length + 10 + idx,
      locked: false,
      hidden: false,
      fontSize: det.approx_font_size || (det.role === 'title' ? 44 : 22),
      fontFamily: det.role === 'title' ? 'Montserrat' : 'Inter',
      fontWeight: det.role === 'title' ? 800 : 600,
      color: '#ffffff',
      textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,0.85)'
    }));
    setLayers(prev => [...prev, ...newLayers]);
    setOcrElementsModal(null);
  };

  // --- INDIA-WIDE INSTITUTION BRANDING APPLICATION MODES ---

  // OPTION A: Logo Only (Strict preservation: adds logo only without changing text or colors)
  const applyKitLogoOnly = (kit: InstitutionKit) => {
    pushStateToHistory(layers, canvasConfig);
    const cleanLayers = layers.filter(l => l.name !== 'Institution Logo');
    if (kit.logo_url) {
      cleanLayers.push({
        id: `l-logo-${Date.now()}`,
        type: 'image',
        name: 'Institution Logo',
        src: kit.logo_url,
        x: 75,
        y: 70,
        width: 75,
        height: 75,
        zIndex: 15,
        locked: false,
        hidden: false
      });
    }
    setLayers(cleanLayers);
    setActiveAppliedKit(kit);
    setPreviewModalKit(null);
  };

  // OPTION B: Branding Colors
  const applyKitLogoAndColors = (kit: InstitutionKit) => {
    pushStateToHistory(layers, canvasConfig);
    const cleanLayers = layers.filter(l => l.name !== 'Institution Logo');
    if (kit.logo_url) {
      cleanLayers.push({
        id: `l-logo-${Date.now()}`,
        type: 'image',
        name: 'Institution Logo',
        src: kit.logo_url,
        x: 75,
        y: 70,
        width: 75,
        height: 75,
        zIndex: 15,
        locked: false,
        hidden: false
      });
    }

    const updatedLayers = cleanLayers.map(l => {
      if (l.name === 'Event Title' || l.name === 'Main Heading') {
        return { ...l, color: kit.primary_color || '#ffffff' };
      }
      if (l.name.includes('Tagline') || l.name.includes('Category') || l.name.includes('Badge')) {
        return { ...l, color: kit.accent_color || kit.secondary_color };
      }
      return l;
    });

    setLayers(updatedLayers);
    setCanvasConfig({
      ...canvasConfig,
      borderColor: kit.secondary_color || kit.primary_color,
      auraColor: kit.accent_color || 'rgba(56, 189, 248, 0.28)'
    });
    setActiveAppliedKit(kit);
    setPreviewModalKit(null);
  };

  // OPTION C: Complete Branding Kit (Strict Isolation: eliminates prior institution assets)
  const applyKitComplete = (kit: InstitutionKit) => {
    pushStateToHistory(layers, canvasConfig);
    // Remove any prior institution layers
    const cleanLayers = layers.filter(l => 
      !l.name.includes('Institution') && 
      !l.name.includes('Badge') && 
      !l.name.includes('Department') &&
      !l.name.includes('College Seal') &&
      !l.name.includes('Signoff')
    );

    const newInstLayers: Layer[] = [];

    // Official Logo
    if (kit.logo_url) {
      newInstLayers.push({
        id: `l-logo-${Date.now()}`,
        type: 'image',
        name: 'Institution Logo',
        src: kit.logo_url,
        x: 75,
        y: 70,
        width: 75,
        height: 75,
        zIndex: 15,
        locked: false,
        hidden: false
      });
    }

    // Official Accreditation / Partner Badge
    if (kit.badge_url) {
      newInstLayers.push({
        id: `l-badge-${Date.now()}`,
        type: 'image',
        name: 'Accreditation Badge',
        src: kit.badge_url,
        x: canvasConfig.width - 75,
        y: 70,
        width: 75,
        height: 75,
        zIndex: 15,
        locked: false,
        hidden: false
      });
    }

    // Institution Name Header
    newInstLayers.push({
      id: `l-inst-${Date.now()}`,
      type: 'text',
      name: 'Institution Name',
      text: kit.name.toUpperCase(),
      x: canvasConfig.width / 2,
      y: 44,
      fontSize: 18,
      fontFamily: kit.preferred_font || 'Inter',
      fontWeight: 900,
      textAlign: 'center',
      color: '#ffffff',
      letterSpacing: 0.5,
      zIndex: 14,
      locked: false,
      hidden: false
    });

    // Department / Organizing Unit
    if (kit.department) {
      newInstLayers.push({
        id: `l-dept-${Date.now()}`,
        type: 'text',
        name: 'Department Name',
        text: kit.department,
        x: canvasConfig.width / 2,
        y: 72,
        fontSize: 12,
        fontFamily: kit.preferred_font || 'Inter',
        fontWeight: 600,
        textAlign: 'center',
        color: kit.accent_color || '#93c5fd',
        letterSpacing: 0.3,
        zIndex: 14,
        locked: false,
        hidden: false
      });
    }

    // Official Signoff Footer
    if (kit.signoff_text) {
      newInstLayers.push({
        id: `l-signoff-${Date.now()}`,
        type: 'text',
        name: 'Institution Signoff',
        text: kit.signoff_text,
        x: canvasConfig.width / 2,
        y: canvasConfig.height - 40,
        fontSize: 10,
        fontFamily: kit.preferred_font || 'Inter',
        fontWeight: 500,
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.75)',
        lineHeight: 1.25,
        zIndex: 14,
        locked: false,
        hidden: false
      });
    }

    setLayers([...cleanLayers, ...newInstLayers]);
    setCanvasConfig({
      ...canvasConfig,
      borderColor: kit.secondary_color || kit.primary_color,
      auraColor: kit.accent_color || 'rgba(56, 189, 248, 0.28)'
    });
    setActiveAppliedKit(kit);
    setPreviewModalKit(null);
  };

  // OPTION D: Institutional Poster Template
  const applyKitThemeAndLayout = (kit: InstitutionKit) => {
    applyKitComplete(kit);
    
    // Apply recommended border if available
    if (kit.recommended_border) {
      const preset = BORDER_PRESETS.find(b => b.id === kit.recommended_border);
      if (preset) {
        applyBorderPreset(preset);
      }
    }

    // Apply preferred font to title
    setLayers(prev => prev.map(l => {
      if (l.name === 'Event Title' || l.name === 'Main Heading') {
        return { ...l, fontFamily: kit.preferred_font || 'Inter', color: kit.primary_color || '#ffffff' };
      }
      return l;
    }));
    setActiveAppliedKit(kit);
    setPreviewModalKit(null);
  };

  const handleClearAllBranding = () => {
    pushStateToHistory(layers, canvasConfig);
    // Remove institutional layers from canvas
    setLayers(layers.filter(l => 
      !l.name.includes('Institution') && 
      !l.name.includes('Badge') && 
      !l.name.includes('Department') &&
      !l.name.includes('College Seal') &&
      !l.name.includes('Signoff')
    ));
    setCanvasConfig({ ...canvasConfig, venueBackdrop: '' });
    setActiveAppliedKit(null);
  };

  // Automated Discovery Runner
  const handleRunDiscovery = async (inst: InstitutionSummary) => {
    setDiscoveryModalState({
      institution: inst,
      isDiscovering: true,
      result: null
    });
    try {
      const res = await axios.post(`/api/institutions/${inst.id}/discover`);
      setDiscoveryModalState({
        institution: inst,
        isDiscovering: false,
        result: res.data
      });
      fetchInstitutions();
    } catch (err: any) {
      setDiscoveryModalState({
        institution: inst,
        isDiscovering: false,
        result: null,
        error: err.response?.data?.detail || err.message || 'Discovery service failed to reach institution portal'
      });
    }
  };

  // Save Discovered Draft Kit
  const handleSaveDiscoveredKit = (draftKit: InstitutionKit) => {
    setInstitutionKits(prev => [draftKit, ...prev.filter(k => k.id !== draftKit.id)]);
    setDiscoveryModalState(null);
    setPreviewModalKit(draftKit);
  };

  // Duplicate Kit
  const handleDuplicateKit = async (kit: InstitutionKit) => {
    try {
      const res = await axios.post(`/api/branding-kits/${kit.id}/duplicate`);
      if (res.data) {
        setInstitutionKits([res.data, ...institutionKits]);
        alert(`Cloned kit created: ${res.data.name}`);
      }
    } catch (err) {
      // Fallback local clone
      const cloned: InstitutionKit = {
        ...kit,
        id: `custom-${Date.now()}`,
        name: `${kit.name} (Custom Copy)`,
        is_verified: false,
        status: 'Assets Collected'
      };
      setInstitutionKits([cloned, ...institutionKits]);
      alert(`Local copy created: ${cloned.name}`);
    }
  };

  // Custom Kit CRUD
  const handleSaveCustomKit = async () => {
    if (!kitForm.name?.trim()) {
      alert('Please provide an institution name');
      return;
    }
    try {
      if (editingKitId) {
        const res = await axios.put(`/api/branding-kits/${editingKitId}`, kitForm);
        setInstitutionKits(institutionKits.map(k => k.id === editingKitId ? res.data : k));
      } else {
        const res = await axios.post('/api/branding-kits', kitForm);
        setInstitutionKits([res.data, ...institutionKits]);
      }
      setShowCustomKitModal(false);
      setEditingKitId(null);
    } catch (err: any) {
      // Local storage fallback
      const newKit: InstitutionKit = {
        ...kitForm as InstitutionKit,
        id: editingKitId || `custom-${Date.now()}`,
        is_verified: false
      };
      const updated = editingKitId
        ? institutionKits.map(k => k.id === editingKitId ? newKit : k)
        : [newKit, ...institutionKits];
      setInstitutionKits(updated);
      const customOnly = updated.filter(k => !k.is_verified);
      localStorage.setItem('eventiva_custom_kits', JSON.stringify(customOnly));
      setShowCustomKitModal(false);
      setEditingKitId(null);
    }
  };

  const handleDeleteCustomKit = async (kitId: number | string) => {
    if (!confirm('Are you sure you want to delete this custom branding kit?')) return;
    try {
      await axios.delete(`/api/branding-kits/${kitId}`);
    } catch (e) {}
    const updated = institutionKits.filter(k => k.id !== kitId);
    setInstitutionKits(updated);
    const customOnly = updated.filter(k => !k.is_verified);
    localStorage.setItem('eventiva_custom_kits', JSON.stringify(customOnly));
  };

  // High-Definition Poster Download (Standalone HD / 4K / Print 300 DPI)
  const handleDownloadHD = async (format: 'png' | 'jpeg' = hdFormat, scale: number = hdScale) => {
    if (!posterRef.current) return;
    setDownloadingHD(true);
    try {
      // 1. Temporarily deselect any active element so bounding box rings/handles don't appear in export
      setSelectedId(null);
      await new Promise(res => setTimeout(res, 120));

      // 2. Render canvas at high-definition scale
      const canvas = await html2canvas(posterRef.current, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: canvasConfig.bgColor,
        logging: false,
        imageTimeout: 20000
      });

      // 3. Find event title or fallback for filename
      const titleLayer = layers.find(l => l.name === 'Event Title' || l.name === 'Main Heading');
      const safeTitle = (titleLayer?.text || 'eventiva-poster')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 32);
      const qualityTag = scale === 4 ? 'print-300dpi' : scale === 3 ? '4k-uhd' : 'hd';
      const filename = `${safeTitle || 'eventiva-poster'}-${qualityTag}.${format}`;

      // 4. Download file directly to browser
      const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
      const dataUrl = canvas.toDataURL(mimeType, format === 'jpeg' ? 0.95 : 1.0);
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('HD Export failed: ' + (err.message || 'Unknown error'));
    } finally {
      setDownloadingHD(false);
      setShowHdExportModal(false);
    }
  };

  // High-Resolution Export
  const handleSave = async () => {
    if (!posterRef.current || !id) return;
    setSaving(true);
    try {
      setSelectedId(null);
      await new Promise(res => setTimeout(res, 120));
      
      const canvas = await html2canvas(posterRef.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: canvasConfig.bgColor 
      });
      
      const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/png'));
      if (!blob) throw new Error('Render export failed');
      
      const formData = new FormData();
      formData.append('file', blob, 'poster.png');
      formData.append('poster_data', JSON.stringify({ layers, canvasConfig }));
      
      const token = localStorage.getItem('token');
      await axios.post(`/api/events/${id}/poster`, formData, {
        headers: { 
          'Content-Type': 'multipart/form-data', 
          Authorization: `Bearer ${token}` 
        }
      });
      navigate(`/events/${id}`);
    } catch (e: any) {
      alert('Failed to save poster: ' + (e.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const selectedElement = layers.find(l => l.id === selectedId);

  return (
    <div className="flex h-screen bg-gray-50 flex-col overflow-hidden">
      
      {/* 1. TOP HEADER (BRAND & EVENT TITLE & PRIMARY ACTIONS) */}
      <header className="bg-white border-b border-gray-200 px-3 md:px-6 h-13 md:h-14 flex items-center justify-between shrink-0 z-30 select-none">
        {/* MOBILE TOP BAR (md:hidden) — Sleek, compact touch targets without clumsy wrapping */}
        <div className="flex md:hidden items-center justify-between w-full h-12 gap-1.5">
          {/* Mobile Left: Back + Poster Title */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button 
              type="button"
              onClick={() => navigate('/dashboard/events')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition shrink-0 font-bold text-sm active:scale-95"
              title="Back to Events"
            >
              ←
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-black text-gray-900 truncate leading-tight">
                {eventTitle || 'Poster Studio'}
              </h2>
              <span className="text-[9.5px] font-semibold text-gray-400 block truncate leading-none mt-0.5">
                {isUploadedPosterMode ? 'Custom Poster Base' : 'Universal AI Studio'}
              </span>
            </div>
          </div>

          {/* Mobile Right: Sleek Action Pills for Save, Export HD, and Settings Menu */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Save Button */}
            <button 
              type="button"
              onClick={id ? handleSave : () => handleDownloadHD('png', hdScale)} 
              disabled={id ? saving : downloadingHD} 
              className="h-8 px-2.5 bg-gray-900 active:bg-black text-white rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50 shadow-2xs"
              title={id ? 'Save changes to event poster' : 'Save poster'}
            >
              <span>💾</span>
              <span>{saving ? '...' : 'Save'}</span>
            </button>

            {/* Mobile Export HD Button */}
            <button 
              type="button"
              onClick={() => setShowHdExportModal(true)} 
              disabled={downloadingHD}
              className="h-8 px-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 active:from-blue-700 active:to-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 active:scale-95 disabled:opacity-50 shadow-2xs"
              title="Export High-Definition Poster"
            >
              <span>⬇️</span>
              <span>{downloadingHD ? '...' : 'Export'}</span>
            </button>

            {/* Mobile 3-Dots Menu Dropdown */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="h-8 w-8 flex items-center justify-center rounded-lg border border-gray-200 active:bg-gray-100 text-gray-700 text-sm font-bold transition active:scale-95"
                title="More Studio Options"
              >
                ⋮
              </button>

              {showSettingsMenu && (
                <div 
                  className="absolute right-0 mt-1.5 w-52 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowSettingsMenu(false)}
                >
                  <button 
                    onClick={() => setShowHdExportModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>⚙️ Export Resolution ({hdScale}x)</span>
                  </button>
                  <button 
                    onClick={() => setShowPreviewModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>👁️ Full-Screen Preview</span>
                  </button>
                  <button 
                    onClick={() => posterUploadInputRef.current?.click()} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>📤 Upload Poster File</span>
                  </button>
                  <button 
                    onClick={() => setShowDirectoryModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>🏛️ Institutions Directory</span>
                  </button>
                  {activeAppliedKit && (
                    <button 
                      onClick={handleClearAllBranding} 
                      className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium border-t border-gray-100 mt-1"
                    >
                      <span>✕ Clear Institutional Branding</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* DESKTOP TOP BAR (hidden md:flex) — Spacious & Full Featured */}
        <div className="hidden md:flex items-center justify-between w-full">
          {/* Left: EVENTIVA Logo & Poster Studio */}
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => navigate('/dashboard')}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
              title="Back to Dashboard"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm md:text-base tracking-tight text-gray-950 flex items-center gap-1.5">
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 text-transparent bg-clip-text">EVENTIVA</span>
                <span className="text-gray-300 font-light">|</span>
                <span className="text-xs md:text-sm font-bold text-gray-700">Poster Studio</span>
              </span>
            </div>

            <div className="hidden sm:block h-4 w-px bg-gray-200 mx-1" />

            {/* Center/Left: Current Event / Poster Name */}
            <div className="hidden sm:flex items-center gap-2">
              <input 
                type="text"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                placeholder="Untitled Poster"
                className="text-xs font-semibold text-gray-800 bg-transparent hover:bg-gray-50 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded px-2 py-1 max-w-[180px] md:max-w-[260px] truncate border border-transparent hover:border-gray-200 transition outline-none"
                title="Click to edit poster title"
              />
              {isUploadedPosterMode && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  Uploaded Base
                </span>
              )}
            </div>
          </div>

          {/* Right: Save, Export, Settings Menu */}
          <div className="flex items-center gap-2">
            {/* Active Applied Kit Pill */}
            {activeAppliedKit && (
              <div className="hidden lg:flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[120px]">{activeAppliedKit.short_name || activeAppliedKit.name}</span>
                <button onClick={handleClearAllBranding} className="text-red-500 hover:text-red-700 ml-0.5 font-bold text-xs" title="Clear Kit">✕</button>
              </div>
            )}

            {/* Save Draft / Save Button */}
            {id ? (
              <button 
                type="button"
                onClick={handleSave} 
                disabled={saving} 
                className="h-8.5 px-3.5 bg-gray-900 hover:bg-black active:scale-98 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="Save changes to event poster"
              >
                <span>{saving ? 'Saving...' : '💾 Save Draft'}</span>
              </button>
            ) : (
              <button 
                type="button"
                onClick={() => handleDownloadHD('png', hdScale)} 
                disabled={downloadingHD} 
                className="h-8.5 px-3.5 bg-gray-900 hover:bg-black active:scale-98 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                title="Save / Download poster"
              >
                <span>💾 Save</span>
              </button>
            )}

            {/* Primary Export Button */}
            <div className="flex items-center shadow-xs">
              <button 
                type="button"
                onClick={() => handleDownloadHD('png', hdScale)} 
                disabled={downloadingHD}
                className="h-8.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-l-lg text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
                title="Export high-definition poster image"
              >
                {downloadingHD ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Rendering...</span>
                  </>
                ) : (
                  <>
                    <span>⬇️ Export HD</span>
                    <span className="bg-white/20 text-[9px] px-1 py-0.2 rounded font-mono">
                      {hdScale}x
                    </span>
                  </>
                )}
              </button>
              <button 
                type="button"
                onClick={() => setShowHdExportModal(true)}
                className="h-8.5 px-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-r-lg border-l border-indigo-500 text-xs font-bold transition flex items-center justify-center"
                title="HD Resolution & Export Format Settings"
              >
                ⚙️
              </button>
            </div>

            {/* Compact Settings Menu Dropdown */}
            <div className="relative">
              <button 
                type="button"
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="h-8.5 w-8.5 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-700 transition text-sm font-bold"
                title="Studio Settings & Options"
              >
                ⋮
              </button>

              {showSettingsMenu && (
                <div 
                  className="absolute right-0 mt-1.5 w-56 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 text-xs text-gray-700 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setShowSettingsMenu(false)}
                >
                  <button 
                    onClick={() => setShowDirectoryModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>🏛️ Institutions Directory</span>
                  </button>
                  <button 
                    onClick={() => setShowCustomKitModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>➕ Create Branding Kit</span>
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button 
                    onClick={() => setShowHdExportModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>⚙️ Export HD Settings</span>
                  </button>
                  <button 
                    onClick={() => setShowPreviewModal(true)} 
                    className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 font-medium"
                  >
                    <span>👁️ Full-Screen Preview</span>
                  </button>
                  {activeAppliedKit && (
                    <button 
                      onClick={handleClearAllBranding} 
                      className="w-full text-left px-3.5 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2 font-medium"
                    >
                      <span>✕ Clear Institutional Branding</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. EDITOR SUB-TOOLBAR (ORGANIZED INTO 3 LOGICAL GROUPS) */}
      <div className="bg-gray-50 border-b border-gray-200 px-2 sm:px-3 md:px-6 h-10 md:h-11 flex items-center justify-between shrink-0 z-20 select-none overflow-x-auto text-xs">
        
        {/* GROUP 1 — Editing */}
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 hidden lg:inline">Edit</span>
          <button 
            type="button"
            onClick={handleUndo} 
            disabled={historyStack.length === 0} 
            className="h-7.5 md:h-8 px-2 md:px-2.5 rounded-md font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-40 transition flex items-center gap-1 shadow-2xs"
            title="Undo (Ctrl+Z)"
          >
            <span>↩️</span>
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button 
            type="button"
            onClick={handleRedo} 
            disabled={redoStack.length === 0} 
            className="h-7.5 md:h-8 px-2 md:px-2.5 rounded-md font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 disabled:opacity-40 transition flex items-center gap-1 shadow-2xs"
            title="Redo (Ctrl+Y)"
          >
            <span>↪️</span>
            <span className="hidden sm:inline">Redo</span>
          </button>
          <button 
            type="button"
            onClick={handleAutoArrange} 
            className="h-7.5 md:h-8 px-2.5 md:px-3 rounded-md font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 active:scale-98 transition flex items-center gap-1 shadow-2xs"
            title="Auto-Arrange: Distribute layers evenly across poster height"
          >
            <span>🪄</span>
            <span className="hidden sm:inline">Auto Arrange</span>
          </button>
        </div>

        {/* GROUP 2 — Canvas */}
        <div className="flex items-center gap-1 shrink-0 mx-1.5 md:mx-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 hidden lg:inline">Canvas</span>
          <button 
            type="button"
            onClick={handleFitCanvas} 
            className="h-7.5 md:h-8 px-2 md:px-2.5 rounded-md font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 transition text-[11px] uppercase shadow-2xs"
            title="Fit poster to screen"
          >
            ⛶ Fit
          </button>
          <div className="flex items-center bg-white border border-gray-200 rounded-md overflow-hidden shadow-2xs h-7.5 md:h-8">
            <button 
              type="button"
              onClick={() => setZoom(z => Math.max(0.18, z - 0.05))} 
              className="w-6 md:w-7 h-full flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition"
              title="Zoom Out"
            >
              -
            </button>
            <button 
              type="button"
              onClick={() => setZoom(1)}
              className="px-1.5 md:px-2 text-[10px] md:text-[11px] font-bold text-gray-800 w-10 md:w-12 text-center hover:bg-gray-50 transition border-x border-gray-100"
              title="Reset Zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button 
              type="button"
              onClick={() => setZoom(z => Math.min(2.5, z + 0.05))} 
              className="w-6 md:w-7 h-full flex items-center justify-center font-bold text-gray-700 hover:bg-gray-100 transition"
              title="Zoom In"
            >
              +
            </button>
          </div>
        </div>

        {/* GROUP 3 — Output & Poster Upload */}
        <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1 hidden lg:inline">Output</span>
          
          {/* Upload Poster Button */}
          <input 
            type="file" 
            ref={posterUploadInputRef} 
            onChange={handlePosterFileUpload} 
            accept="image/png,image/jpeg,image/webp" 
            className="hidden" 
          />
          <button 
            type="button"
            onClick={() => posterUploadInputRef.current?.click()} 
            className="h-7.5 md:h-8 px-2 md:px-2.5 rounded-md font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 transition flex items-center gap-1 shadow-2xs"
            title="Upload an existing poster (PNG, JPG, WEBP)"
          >
            <span>📤</span>
            <span className="hidden sm:inline">Upload</span>
          </button>

          {/* Preview Button */}
          <button 
            type="button"
            onClick={() => setShowPreviewModal(true)} 
            className="h-7.5 md:h-8 px-2 md:px-2.5 rounded-md font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 transition flex items-center gap-1 shadow-2xs"
            title="Preview full poster"
          >
            <span>👁️</span>
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Download HD Button */}
          <button 
            type="button"
            onClick={() => handleDownloadHD('png', hdScale)} 
            disabled={downloadingHD}
            className="h-7.5 md:h-8 px-2.5 md:px-3 rounded-md font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition flex items-center gap-1 shadow-2xs disabled:opacity-50"
            title="Download HD Poster"
          >
            <span>⬇️</span>
            <span className="hidden sm:inline">Download HD</span>
          </button>
        </div>
      </div>

      {/* WORKSPACE AREA */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* LEFT SIDEBAR (TOOLS) */}
        <aside className={`
          bg-white border-gray-200 flex flex-col shrink-0
          md:w-80 md:flex md:border-r md:static md:z-auto md:max-h-none md:rounded-none
          ${mobileTab && mobileTab !== 'properties' 
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[78vh] rounded-t-2xl shadow-2xl border-t animate-in slide-in-from-bottom duration-200' 
            : 'hidden md:flex'}
        `}>
          {/* Mobile Sheet Handle & Close Bar */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-2xl">
            <div className="flex items-center gap-2">
              <span className="w-8 h-1 bg-gray-300 rounded-full" />
              <span className="text-[11px] font-black uppercase text-gray-700 tracking-wider">
                {activeTab === 'ai' && '✨ AI Studio'}
                {activeTab === 'chat' && '💬 AI Edit'}
                {activeTab === 'kits' && '🏛️ Templates / Kits'}
                {activeTab === 'borders' && '🔲 Borders'}
                {activeTab === 'layers' && '📑 Layers'}
                {activeTab === 'backgrounds' && '🖼️ Backgrounds'}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setMobileTab(null)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 font-bold text-xs"
            >
              ✕
            </button>
          </div>

          <div className="flex text-[11px] font-bold uppercase text-gray-500 border-b overflow-x-auto bg-gray-50/50">
            <button className={`px-3 py-3 shrink-0 flex items-center gap-1 ${activeTab === 'ai' ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-black' : 'hover:bg-gray-100'}`} onClick={() => { setActiveTab('ai'); setMobileTab('ai'); }}>
              <span>✨</span><span>AI Studio</span>
            </button>
            <button className={`px-3 py-3 shrink-0 flex items-center gap-1 ${activeTab === 'chat' ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-black' : 'hover:bg-gray-100'}`} onClick={() => { setActiveTab('chat'); setMobileTab('chat'); }}>
              <span>💬</span><span>AI Edit</span>
            </button>
            <button className={`px-3 py-3 shrink-0 flex items-center gap-1 ${activeTab === 'kits' ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-black' : 'hover:bg-gray-100'}`} onClick={() => { setActiveTab('kits'); setMobileTab('kits'); }}>
              <span>🏛️</span><span>Templates / Kits</span>
            </button>
            <button className={`px-3 py-3 shrink-0 flex items-center gap-1 ${activeTab === 'borders' ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-black' : 'hover:bg-gray-100'}`} onClick={() => { setActiveTab('borders'); setMobileTab('borders'); }}>
              <span>🔲</span><span>Borders</span>
            </button>
            <button className={`px-3 py-3 shrink-0 flex items-center gap-1 ${activeTab === 'layers' ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-black' : 'hover:bg-gray-100'}`} onClick={() => { setActiveTab('layers'); setMobileTab('layers'); }}>
              <span>📑</span><span>Layers</span>
            </button>
            <button className={`px-3 py-3 shrink-0 flex items-center gap-1 ${activeTab === 'backgrounds' ? 'text-blue-600 border-b-2 border-blue-600 bg-white font-black' : 'hover:bg-gray-100'}`} onClick={() => { setActiveTab('backgrounds'); setMobileTab('backgrounds'); }}>
              <span>🖼️</span><span>Backgrounds</span>
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto flex-1 flex flex-col">
            {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded-md text-xs font-bold border border-red-200">{error}</div>}
            
            {/* TAB: AI GENERATE */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                {/* Upload Existing Poster Option */}
                <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border border-blue-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                      <span>📤</span><span>Upload Existing Poster</span>
                    </span>
                    <span className="text-[9px] bg-blue-200/80 text-blue-800 font-bold px-1.5 py-0.5 rounded">PNG / JPG / WEBP</span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Already designed a poster? Upload it directly as your base layer or let AI detect editable text layers.
                  </p>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => posterUploadInputRef.current?.click()}
                      className="flex-1 bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
                    >
                      <span>📁 Choose File</span>
                    </button>
                    {isUploadedPosterMode && (
                      <button 
                        type="button" 
                        onClick={handleDetectTextLayers}
                        disabled={ocrDetecting}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-2xs disabled:opacity-50"
                        title="Extract text from poster into editable layers"
                      >
                        {ocrDetecting ? '🔍 Scanning...' : '🔍 Detect Text'}
                      </button>
                    )}
                  </div>
                </div>

                {isUploadedPosterMode && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-900">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🖼️</span>
                      <div>
                        <p className="font-bold text-emerald-950">Uploaded Base Poster Active</p>
                        <p className="text-[10px] text-emerald-700">Original image preserved as high-fidelity background</p>
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => posterUploadInputRef.current?.click()}
                      className="text-[10px] bg-white border border-emerald-300 text-emerald-800 px-2 py-1 rounded font-bold hover:bg-emerald-100"
                    >
                      Replace
                    </button>
                  </div>
                )}

                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase mb-1">Event Details</h3>
                  <p className="text-[11px] text-gray-500 mb-2">Paste any event details (conference, hackathon, wedding, party, fest).</p>
                  <textarea 
                    className="w-full border rounded-lg p-3 text-xs h-36 focus:ring-2 focus:ring-blue-500 font-sans" 
                    placeholder="Enter event name, dates, organizer, venue, description..." 
                    value={eventDetails} 
                    onChange={e => setEventDetails(e.target.value)} 
                  />
                </div>

                <div>
                  <h3 className="text-xs font-bold text-gray-700 uppercase mb-1">Visual Style & Theme</h3>
                  <select 
                    className="w-full border rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-blue-500" 
                    value={style} 
                    onChange={e => setStyle(e.target.value)}
                  >
                    <option value="Modern Corporate Summit, Executive Navy Slate, Clean">Corporate Conference / Tech Summit</option>
                    <option value="Epic Hackathon, Cyber Nebula, 3D Chrome, Tech Grid">National Hackathon / Coding Event</option>
                    <option value="Cinematic Blue, 3D Typography, College Fest">Academic Symposium / College Fest</option>
                    <option value="Regal Gold Foil, Luxury Black Marble, Grand Gala">Luxury Gala / Award Ceremony</option>
                    <option value="Electric Cyber Neon, Vibrant Party, Concert Stage">Music Concert / Cultural Festival</option>
                    <option value="Clean Minimalist, Elegant Typography, Soft Lighting">Social / Celebration / Birthday</option>
                  </select>
                </div>

                <button 
                  onClick={handleAIGenerate} 
                  disabled={loading} 
                  className="w-full bg-gray-900 text-white py-3 rounded-lg font-bold uppercase text-xs hover:bg-black transition shadow-md"
                >
                  {loading ? 'Analyzing & Generating...' : 'Auto-Generate Poster'}
                </button>
              </div>
            )}

            {/* TAB: AI CONVERSATIONAL EDIT */}
            {activeTab === 'chat' && (
              <div className="flex flex-col h-full">
                {/* Quick 1-Click Auto Arrange Button */}
                <div className="mb-2.5">
                  <button
                    onClick={handleAutoArrange}
                    className="w-full text-left p-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-950 flex items-center justify-between transition shadow-xs"
                    title="Evenly space and balance elements across the entire 800 x 1131 canvas height"
                  >
                    <span className="flex items-center gap-1.5">
                      <span>🪄</span>
                      <span>Auto-Arrange Elements</span>
                    </span>
                    <span className="text-[9.5px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold">1-Click</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto mb-3 space-y-3 bg-gray-50 p-3 rounded-lg border">
                  {chatHistory.length === 0 ? (
                    <div className="text-xs text-gray-500 text-center mt-2 space-y-2.5">
                      <p className="font-bold text-gray-700">Conversational AI Poster Designer</p>
                      <p className="text-[11px] text-gray-400">Type instructions or click any quick prompt:</p>
                      <div className="space-y-1.5 text-left">
                        {[
                          "arrange texts",
                          "center the event title",
                          "move the date and venue into a single aligned section",
                          "make the poster more professional",
                          "increase the spacing between the title and description",
                          "use the lower half of the poster effectively",
                          "change background to dark blue futuristic",
                          "undo the last change"
                        ].map((promptText, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setChatInput(promptText);
                            }}
                            className="w-full text-left font-mono text-[10px] bg-white hover:bg-blue-50 hover:border-blue-300 p-1.5 rounded border text-gray-700 transition flex items-center justify-between"
                          >
                            <span>"{promptText}"</span>
                            <span className="text-blue-500 text-[10px] font-sans">↗</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    chatHistory.map((msg, i) => (
                      <div key={i} className={`p-2.5 rounded-lg text-xs ${msg.role === 'user' ? 'bg-blue-600 text-white ml-6 shadow-sm' : 'bg-white border mr-6 text-gray-800 shadow-sm'}`}>
                        {msg.content}
                      </div>
                    ))
                  )}
                  {aiTyping && <div className="text-xs text-blue-600 font-bold animate-pulse">AI Designer is updating canvas...</div>}
                </div>
                
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                    placeholder="Describe changes..." 
                    value={chatInput} 
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAIChat()}
                    disabled={aiTyping}
                  />
                  <button onClick={handleAIChat} disabled={aiTyping} className="bg-blue-600 text-white px-3.5 py-2 rounded-lg font-bold text-xs uppercase hover:bg-blue-700 transition">
                    Send
                  </button>
                </div>
              </div>
            )}

            {/* TAB: INSTITUTION BRANDING KITS & DIRECTORY */}
            {activeTab === 'kits' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-xs font-black text-gray-800 uppercase flex items-center gap-1.5">
                      <span>🏛️ Institution Kits</span>
                      <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-bold">India-Wide</span>
                    </h4>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => setShowDirectoryModal(true)}
                        className="text-[9.5px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-200 transition"
                      >
                        Explore All
                      </button>
                      <button 
                        onClick={() => {
                          setEditingKitId(null);
                          setKitForm({
                            name: '',
                            short_name: '',
                            institution_type: 'Autonomous Engineering College',
                            location: '',
                            department: '',
                            logo_url: '',
                            badge_url: '',
                            backdrop_url: '',
                            primary_color: '#1e3a8a',
                            secondary_color: '#f59e0b',
                            dark_bg: '#030712',
                            accent_color: '#38bdf8',
                            preferred_font: 'Inter',
                            recommended_border: 'academic-double-gold',
                            signoff_text: '',
                            website: ''
                          });
                          setShowCustomKitModal(true);
                        }}
                        className="text-[9.5px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded shadow-xs transition"
                      >
                        + Custom
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">Search 34+ recognized Indian colleges & universities with official accreditations.</p>

                  {/* Search by Name / Abbreviation / City */}
                  <input 
                    type="text" 
                    placeholder="Search TKRCET, IIT, Vignan, CBIT, city..." 
                    className="w-full border rounded-lg px-2.5 py-1.5 text-xs mb-2 focus:ring-2 focus:ring-blue-500 outline-none" 
                    value={institutionSearch} 
                    onChange={e => setInstitutionSearch(e.target.value)} 
                  />

                  {/* State Filter Dropdown & Category Pills */}
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    <div>
                      <select 
                        value={instState}
                        onChange={e => setInstState(e.target.value)}
                        className="w-full border rounded text-[10px] p-1 bg-white font-medium"
                      >
                        <option value="All">All States (India)</option>
                        <option value="Telangana">Telangana</option>
                        <option value="Andhra Pradesh">Andhra Pradesh</option>
                        <option value="Karnataka">Karnataka</option>
                        <option value="Maharashtra">Maharashtra</option>
                        <option value="Tamil Nadu">Tamil Nadu</option>
                        <option value="Delhi">Delhi / NCR</option>
                        <option value="West Bengal">West Bengal</option>
                        <option value="Uttar Pradesh">Uttar Pradesh</option>
                        <option value="Kerala">Kerala</option>
                        <option value="Gujarat">Gujarat</option>
                      </select>
                    </div>
                    <div>
                      <select 
                        value={instCategory}
                        onChange={e => setInstCategory(e.target.value)}
                        className="w-full border rounded text-[10px] p-1 bg-white font-medium"
                      >
                        <option value="All">All Disciplines</option>
                        <option value="Engineering">Engineering Colleges</option>
                        <option value="University">Universities</option>
                        <option value="Medical">Medical Institutes</option>
                        <option value="Management">Management Institutes</option>
                        <option value="Polytechnic">Polytechnics</option>
                        <option value="School">Schools (K-12)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Directory Results List */}
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {institutionsLoading ? (
                    <div className="p-6 text-center text-xs text-gray-400 font-medium animate-pulse">
                      Searching directory...
                    </div>
                  ) : institutions.length === 0 ? (
                    <div className="p-4 text-center border rounded-xl bg-gray-50">
                      <p className="text-xs text-gray-500 mb-1">No institutions matched "{institutionSearch}".</p>
                      <button 
                        onClick={() => {
                          setKitForm({ ...kitForm, name: institutionSearch });
                          setShowCustomKitModal(true);
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline"
                      >
                        Create kit for "{institutionSearch}"?
                      </button>
                    </div>
                  ) : (
                    institutions.map(inst => (
                      <div key={inst.id} className="border rounded-xl p-2.5 bg-white shadow-xs hover:border-blue-400 transition space-y-2">
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[8.5px] font-mono font-bold bg-gray-100 text-gray-600 px-1 py-0.2 rounded">
                                {inst.code}
                              </span>
                              <span className="text-[8.5px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded font-medium">
                                {inst.category}
                              </span>
                            </div>
                            <h5 className="text-[11px] font-black text-gray-900 leading-tight mt-0.5">
                              {inst.official_name}
                            </h5>
                            <p className="text-[9.5px] text-gray-400">
                              📍 {inst.city}, {inst.state}
                            </p>
                          </div>
                          {inst.logo_url && (
                            <img src={inst.logo_url} alt={inst.code} className="w-6 h-6 object-contain rounded border p-0.5 bg-gray-50 shrink-0" />
                          )}
                        </div>

                        {/* Recognitions & Accreditations */}
                        {inst.recognition_summary.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {inst.recognition_summary.map((rec, i) => (
                              <span key={i} className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-100 font-medium">
                                ✓ {rec}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Action Buttons: Preview or Auto-Discover */}
                        <div className="flex items-center justify-between pt-1 border-t text-[10px]">
                          {inst.website && (
                            <a 
                              href={inst.website} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-gray-400 hover:text-blue-600 text-[9px] flex items-center gap-0.5"
                            >
                              <span>Website ↗</span>
                            </a>
                          )}
                          <div className="flex gap-1.5">
                            {inst.has_branding_kit ? (
                              <button 
                                onClick={async () => {
                                  if (inst.branding_kit_id) {
                                    try {
                                      const res = await axios.get(`/api/branding-kits/${inst.branding_kit_id}`);
                                      setPreviewModalKit(res.data);
                                    } catch (e) {
                                      const fallback = institutionKits.find(k => k.id === inst.branding_kit_id);
                                      if (fallback) setPreviewModalKit(fallback);
                                    }
                                  }
                                }}
                                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-[9.5px] shadow-xs transition"
                              >
                                Preview & Apply Kit
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleRunDiscovery(inst)}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-[9.5px] shadow-xs transition flex items-center gap-1"
                              >
                                <span>⚡ Auto-Discover Kit</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Custom Organization Kits & Community Section */}
                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between items-center">
                    <h5 className="text-[10px] font-bold text-gray-600 uppercase">Custom & Saved Kits</h5>
                    <span className="text-[9px] text-gray-400">({institutionKits.filter(k => !k.is_verified).length} kits)</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {institutionKits
                      .filter(k => !k.is_verified)
                      .map(kit => (
                        <div key={kit.id} className="p-2 border rounded-lg bg-gray-50 flex items-center justify-between text-[10px]">
                          <div>
                            <span className="font-bold text-gray-800 block">{kit.name}</span>
                            <span className="text-[8.5px] text-gray-400">{kit.location || 'Custom'}</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => setPreviewModalKit(kit)} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-bold text-[9px]">Apply</button>
                            <button onClick={() => handleDuplicateKit(kit)} className="px-1 text-gray-500 hover:text-gray-800 text-[9px]" title="Duplicate">📋</button>
                            <button onClick={() => handleDeleteCustomKit(kit.id)} className="px-1 text-red-500 hover:text-red-700 text-[9px]" title="Delete">✕</button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Custom Asset Uploads Section */}
                <div className="pt-2 border-t space-y-2">
                  <h4 className="text-[10px] font-bold text-gray-700 uppercase">Custom Asset Uploads (SVG / PNG)</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block w-full bg-blue-50 text-blue-700 py-1.5 rounded-lg text-[10px] font-bold text-center cursor-pointer hover:bg-blue-100 transition border border-blue-200">
                      + Custom Logo
                      <input type="file" className="hidden" accept="image/*" onChange={async e => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await axios.post('/api/branding-kits/upload-asset', fd);
                            pushStateToHistory(layers, canvasConfig);
                            const url = res.data.url;
                            const existing = layers.find(l => l.name === 'Institution Logo');
                            if (existing) {
                              setLayers(layers.map(l => l.id === existing.id ? { ...l, src: url } : l));
                            } else {
                              setLayers([...layers, {
                                id: `l-logo-${Date.now()}`,
                                type: 'image',
                                name: 'Institution Logo',
                                src: url,
                                x: 75,
                                y: 70,
                                width: 75,
                                height: 75,
                                zIndex: 15,
                                locked: false,
                                hidden: false
                              }]);
                            }
                          } catch (err) {
                            alert('Asset upload failed: Format must be PNG, JPG, JPEG, SVG or WEBP (<10MB)');
                          }
                        }
                      }} />
                    </label>
                    <label className="block w-full bg-indigo-50 text-indigo-700 py-1.5 rounded-lg text-[10px] font-bold text-center cursor-pointer hover:bg-indigo-100 transition border border-indigo-200">
                      + Partner Badge
                      <input type="file" className="hidden" accept="image/*" onChange={async e => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await axios.post('/api/branding-kits/upload-asset', fd);
                            pushStateToHistory(layers, canvasConfig);
                            const url = res.data.url;
                            const existing = layers.find(l => l.name === 'Accreditation Badge');
                            if (existing) {
                              setLayers(layers.map(l => l.id === existing.id ? { ...l, src: url } : l));
                            } else {
                              setLayers([...layers, {
                                id: `l-badge-${Date.now()}`,
                                type: 'image',
                                name: 'Accreditation Badge',
                                src: url,
                                x: canvasConfig.width - 75,
                                y: 70,
                                width: 75,
                                height: 75,
                                zIndex: 15,
                                locked: false,
                                hidden: false
                              }]);
                            }
                          } catch (err) {
                            alert('Badge upload failed: Format must be PNG, JPG, JPEG, SVG or WEBP (<10MB)');
                          }
                        }
                      }} />
                    </label>
                  </div>
                  <button 
                    onClick={handleClearAllBranding}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-red-600 py-1.5 rounded-lg text-xs font-bold transition"
                  >
                    Clear All Institutional Branding
                  </button>
                </div>
              </div>
            )}

            {/* TAB: BORDER & BOX STUDIO */}
            {activeTab === 'borders' && (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="text-xs font-bold text-gray-700 uppercase">Border & Box Studio</h4>
                    {canvasConfig.hasBorder && (
                      <button onClick={removeBorder} className="text-[10px] text-red-600 hover:underline font-bold">Remove Border</button>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2.5">Add frames, borders, and editable container boxes anywhere on the poster.</p>

                  {/* Filter Pills */}
                  <div className="flex gap-1 overflow-x-auto pb-1 text-[10px]">
                    {(['All', 'Modern', 'Luxury', 'Cyber & Tech', 'Academic', 'Corporate', 'Celebration', 'Sports & Bold'] as const).map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setBorderCategory(cat)} 
                        className={`px-2 py-0.5 rounded font-bold whitespace-nowrap transition ${borderCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Border Presets Gallery */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase">Border Presets Gallery</h5>
                  </div>
                  <input 
                    type="text" 
                    placeholder="Search borders (e.g. gold, neon, double)..." 
                    value={borderSearch} 
                    onChange={e => setBorderSearch(e.target.value)} 
                    className="w-full border rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none" 
                  />
                  <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {BORDER_PRESETS
                      .filter(b => (borderCategory === 'All' || b.category === borderCategory) && (!borderSearch || b.name.toLowerCase().includes(borderSearch.toLowerCase())))
                      .map(preset => (
                        <div 
                          key={preset.id}
                          onClick={() => applyBorderPreset(preset)}
                          className={`p-2 rounded-lg border cursor-pointer hover:border-blue-500 transition flex flex-col justify-between ${canvasConfig.borderPreset === preset.id && canvasConfig.hasBorder ? 'ring-2 ring-blue-500 bg-blue-50/40' : 'bg-white'}`}
                        >
                          <div 
                            className="w-full h-10 rounded mb-1.5 flex items-center justify-center bg-gray-900"
                            style={{
                              border: `${preset.borderWidth}px ${preset.borderStyle} ${preset.borderColor}`,
                              borderRadius: `${Math.min(12, preset.borderRadius)}px`,
                              boxShadow: preset.borderGlow ? `0 0 10px ${preset.borderGlowColor}` : undefined
                            }}
                          >
                            <span className="text-[8px] text-white/70 font-mono">FRAME</span>
                          </div>
                          <span className="text-[10px] font-bold text-gray-800 truncate">{preset.name}</span>
                          <span className="text-[8px] text-gray-400">{preset.category}</span>
                        </div>
                      ))}
                  </div>
                </div>

                {/* Custom Border Controls */}
                <div className="pt-3 border-t space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-[10px] font-bold text-gray-500 uppercase">Custom Border Adjustments</h5>
                    <label className="flex items-center gap-1.5 text-xs font-bold text-gray-700">
                      <span>Enabled</span>
                      <input 
                        type="checkbox" 
                        checked={canvasConfig.hasBorder} 
                        onChange={e => setCanvasConfig({ ...canvasConfig, hasBorder: e.target.checked })} 
                      />
                    </label>
                  </div>

                  {canvasConfig.hasBorder && (
                    <div className="space-y-2.5 bg-gray-50 p-3 rounded-lg border text-xs">
                      {/* Color & Quick Swatches */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between items-center">
                          <span>Border Color</span>
                          <input 
                            type="color" 
                            className="w-10 h-5 border rounded cursor-pointer p-0" 
                            value={canvasConfig.borderColor.startsWith('#') ? canvasConfig.borderColor : '#ffffff'} 
                            onChange={e => setCanvasConfig({ ...canvasConfig, borderColor: e.target.value })} 
                          />
                        </label>
                        <div className="flex gap-1.5 mt-1">
                          {[
                            { name: 'Gold', hex: '#d4af37' },
                            { name: 'Silver', hex: '#cbd5e1' },
                            { name: 'Cyan', hex: '#06b6d4' },
                            { name: 'Emerald', hex: '#10b981' },
                            { name: 'Crimson', hex: '#e11d48' },
                            { name: 'White', hex: '#ffffff' }
                          ].map(sw => (
                            <button 
                              key={sw.name}
                              onClick={() => setCanvasConfig({ ...canvasConfig, borderColor: sw.hex })}
                              className="w-4 h-4 rounded-full border shadow-xs" 
                              style={{ backgroundColor: sw.hex }}
                              title={sw.name}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Width & Inset */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Width ({canvasConfig.borderWidth || 2}px)</label>
                          <input 
                            type="range" min="1" max="24" step="0.5" className="w-full"
                            value={canvasConfig.borderWidth || 2} 
                            onChange={e => setCanvasConfig({ ...canvasConfig, borderWidth: Number(e.target.value) })} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Inset ({canvasConfig.borderInset || 18}px)</label>
                          <input 
                            type="range" min="6" max="60" className="w-full"
                            value={canvasConfig.borderInset || 18} 
                            onChange={e => setCanvasConfig({ ...canvasConfig, borderInset: Number(e.target.value) })} 
                          />
                        </div>
                      </div>

                      {/* Style & Radius */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Line Style</label>
                          <select 
                            className="w-full border rounded p-1 text-[11px]" 
                            value={canvasConfig.borderStyle || 'solid'} 
                            onChange={e => setCanvasConfig({ ...canvasConfig, borderStyle: e.target.value as any })}
                          >
                            <option value="solid">Solid</option>
                            <option value="double">Double</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                            <option value="groove">Groove</option>
                            <option value="ridge">Ridge</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Radius ({canvasConfig.borderRadius || 0}px)</label>
                          <input 
                            type="range" min="0" max="60" className="w-full"
                            value={canvasConfig.borderRadius || 0} 
                            onChange={e => setCanvasConfig({ ...canvasConfig, borderRadius: Number(e.target.value) })} 
                          />
                        </div>
                      </div>

                      {/* Opacity & Glow */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Opacity ({canvasConfig.borderOpacity ?? 85}%)</label>
                          <input 
                            type="range" min="10" max="100" className="w-full"
                            value={canvasConfig.borderOpacity ?? 85} 
                            onChange={e => setCanvasConfig({ ...canvasConfig, borderOpacity: Number(e.target.value) })} 
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center justify-between">
                            <span>Glow</span>
                            <input 
                              type="checkbox" 
                              checked={canvasConfig.borderGlow} 
                              onChange={e => setCanvasConfig({ ...canvasConfig, borderGlow: e.target.checked })} 
                            />
                          </label>
                          {canvasConfig.borderGlow && (
                            <input 
                              type="color" 
                              className="w-full h-5 border rounded cursor-pointer p-0" 
                              value={canvasConfig.borderGlowColor?.startsWith('#') ? canvasConfig.borderGlowColor : '#06b6d4'} 
                              onChange={e => setCanvasConfig({ ...canvasConfig, borderGlowColor: e.target.value })} 
                            />
                          )}
                        </div>
                      </div>

                      {/* Layering Z-Index */}
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Placement</label>
                        <div className="flex border rounded overflow-hidden">
                          <button 
                            onClick={() => setCanvasConfig({ ...canvasConfig, borderPosition: 'behind' })}
                            className={`flex-1 py-1 text-[10px] font-bold ${canvasConfig.borderPosition === 'behind' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
                          >
                            Behind Elements
                          </button>
                          <button 
                            onClick={() => setCanvasConfig({ ...canvasConfig, borderPosition: 'front' })}
                            className={`flex-1 py-1 text-[10px] font-bold ${canvasConfig.borderPosition === 'front' ? 'bg-blue-600 text-white' : 'bg-white hover:bg-gray-100'}`}
                          >
                            In Front
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Information Boxes & Badges Section */}
                <div className="pt-3 border-t space-y-2">
                  <h5 className="text-[10px] font-bold text-gray-500 uppercase">Information Cards & Badges</h5>
                  <p className="text-[10px] text-gray-400">Add editable information boxes directly onto the poster:</p>
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    <button 
                      onClick={() => handleAddInfoCard('prize')} 
                      className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>🏆 Prize Pool</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('datetime')} 
                      className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>📅 Date & Time</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('venue')} 
                      className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>📍 Venue Card</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('registration')} 
                      className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>⚡ Free Entry</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('speaker')} 
                      className="p-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-900 border border-cyan-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>🎙️ Speaker</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('notice')} 
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-900 border border-red-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>⚠️ Notice Box</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('accreditation')} 
                      className="p-2 bg-amber-100/70 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>★ Accreditation</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('badge')} 
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded text-left text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <span>🏷️ Status Badge</span>
                    </button>
                    <button 
                      onClick={() => handleAddInfoCard('signoff')} 
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded text-left text-xs font-bold transition flex items-center gap-1.5 col-span-2"
                    >
                      <span>🏛️ Organizing Unit Signoff</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: LAYERS */}
            {activeTab === 'layers' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button onClick={addTextLayer} className="flex-1 bg-gray-100 py-2 rounded text-xs font-bold hover:bg-gray-200 transition">+ Add Text</button>
                  <label className="flex-1 bg-gray-100 py-2 rounded text-xs font-bold hover:bg-gray-200 text-center cursor-pointer transition">
                    + Add Image <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
                
                <div className="border rounded-lg overflow-hidden mt-3 max-h-96 overflow-y-auto">
                  {[...layers].sort((a,b) => b.zIndex - a.zIndex).map(layer => (
                    <div 
                      key={layer.id} 
                      onClick={() => setSelectedId(layer.id)} 
                      className={`flex items-center justify-between p-2.5 border-b last:border-0 cursor-pointer ${selectedId === layer.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'hover:bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] font-mono text-gray-400">[{layer.type}]</span>
                        <span className="text-xs font-bold truncate">{layer.name || layer.text || 'Element'}</span>
                      </div>
                      <div className="flex gap-2 text-gray-400">
                        <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { hidden: !layer.hidden }); }} className="hover:text-black">
                          {layer.hidden ? '👁️‍🗨️' : '👁️'}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }} className="hover:text-black">
                          {layer.locked ? '🔒' : '🔓'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {layers.length === 0 && <p className="text-xs text-gray-400 p-4 text-center">No layers generated yet.</p>}
                </div>
              </div>
            )}

            {/* TAB: BACKGROUNDS */}
            {activeTab === 'backgrounds' && (
              <div className="space-y-4">
                <label className="block w-full bg-blue-50 text-blue-700 py-2.5 rounded-lg text-xs font-bold text-center cursor-pointer hover:bg-blue-100 transition border border-blue-200">
                  Upload Sky / Poster Background
                  <input type="file" className="hidden" accept="image/*" onChange={handleBgUpload} />
                </label>
                <label className="block w-full bg-emerald-50 text-emerald-700 py-2.5 rounded-lg text-xs font-bold text-center cursor-pointer hover:bg-emerald-100 transition border border-emerald-200">
                  🏢 Upload Venue / Building Backdrop Photo
                  <input type="file" className="hidden" accept="image/*" onChange={handleVenueUpload} />
                </label>
                
                <h4 className="text-xs font-bold text-gray-500 uppercase mt-4 mb-2">Curated Background Gallery</h4>
                <div className="grid grid-cols-2 gap-2">
                  {BACKGROUND_GALLERY.map((bg, i) => (
                    <div 
                      key={i} 
                      onClick={() => {
                        if (bg.isVenue) {
                          setCanvasConfig({...canvasConfig, venueBackdrop: bg.url});
                        } else {
                          setCanvasConfig({...canvasConfig, bgImage: bg.url});
                        }
                      }} 
                      className="aspect-[4/3] rounded overflow-hidden cursor-pointer border-2 border-transparent hover:border-blue-500 relative group shadow-sm"
                    >
                      <img src={bg.url} alt={bg.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-1 text-center transition">
                        <span className="text-[10px] font-bold text-white uppercase">{bg.name}</span>
                        <span className="text-[8px] text-gray-300">{bg.isVenue ? 'Set Venue Backdrop' : 'Set Sky Background'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* CENTER (CANVAS PREVIEW & WORKSPACE) */}
        <main className="flex-1 overflow-auto bg-gray-200 relative p-2 sm:p-4 md:p-10 select-none" ref={containerRef} onClick={() => setSelectedId(null)}>
          
          <div className="flex items-center justify-center min-h-full min-w-full">
            {/* Dimension Spacer for Scrollbars */}
            <div 
              className="relative shrink-0 shadow-2xl origin-top-left"
              style={{ width: canvasConfig.width * zoom, height: canvasConfig.height * zoom }}
            >
              {/* Scale Zoom Wrapper */}
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{ transform: `scale(${zoom})`, width: canvasConfig.width, height: canvasConfig.height }}
              >
                {/* Master Render Target for html2canvas */}
                <div 
                  ref={posterRef}
                  className="relative bg-white overflow-hidden w-full h-full select-none"
                  style={{ backgroundColor: canvasConfig.bgColor }}
                >
                  {/* LAYER 1: BASE SKY / COSMIC BACKGROUND */}
                  <div className="absolute inset-0 z-0 pointer-events-none">
                    {canvasConfig.bgImage && (
                      <img 
                        src={canvasConfig.bgImage} 
                        className="w-full h-full object-cover absolute inset-0" 
                        style={{ filter: `brightness(${canvasConfig.brightness}%) contrast(${canvasConfig.contrast}%) blur(${canvasConfig.blur}px)` }} 
                        crossOrigin="anonymous" 
                        alt="bg"
                      />
                    )}
                    <div className="absolute inset-0" style={{ backgroundColor: canvasConfig.overlayColor, opacity: canvasConfig.overlayOpacity / 100 }}></div>
                  </div>

                  {/* LAYER 2: ATMOSPHERIC RADIAL GLOW */}
                  {canvasConfig.radialAura && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        top: '16%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '680px',
                        height: '340px',
                        background: `radial-gradient(ellipse at center, ${canvasConfig.auraColor || 'rgba(56, 189, 248, 0.28)'} 0%, rgba(2, 132, 199, 0.08) 50%, transparent 75%)`,
                        zIndex: 1
                      }}
                    />
                  )}

                  {/* LAYER 3: LOWER VENUE PHOTO BACKDROP (ONLY IF CONFIGURED) */}
                  {canvasConfig.venueBackdrop && (
                    <div 
                      className="absolute inset-x-0 bottom-0 pointer-events-none overflow-hidden"
                      style={{
                        height: '40%',
                        maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 40%, rgba(0,0,0,0.85) 65%, rgba(0,0,0,0) 100%)',
                        WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 40%, rgba(0,0,0,0.85) 65%, rgba(0,0,0,0) 100%)',
                        opacity: (canvasConfig.venueOpacity ?? 95) / 100,
                        zIndex: 2
                      }}
                    >
                      <img 
                        src={canvasConfig.venueBackdrop} 
                        alt="Venue Backdrop" 
                        className="w-full h-full object-cover object-bottom" 
                        crossOrigin="anonymous"
                      />
                    </div>
                  )}

                  {/* LAYER 4: CUSTOM BORDER FRAME */}
                  {canvasConfig.hasBorder && (
                    <>
                      {/* Outer Border Frame */}
                      <div 
                        className="absolute pointer-events-none"
                        style={{
                          inset: `${canvasConfig.borderInset || 18}px`,
                          borderTop: canvasConfig.borderSides?.top !== false ? `${canvasConfig.borderWidth || 1.5}px ${canvasConfig.borderStyle || 'solid'} ${canvasConfig.borderColor || 'rgba(255, 255, 255, 0.22)'}` : 'none',
                          borderRight: canvasConfig.borderSides?.right !== false ? `${canvasConfig.borderWidth || 1.5}px ${canvasConfig.borderStyle || 'solid'} ${canvasConfig.borderColor || 'rgba(255, 255, 255, 0.22)'}` : 'none',
                          borderBottom: canvasConfig.borderSides?.bottom !== false ? `${canvasConfig.borderWidth || 1.5}px ${canvasConfig.borderStyle || 'solid'} ${canvasConfig.borderColor || 'rgba(255, 255, 255, 0.22)'}` : 'none',
                          borderLeft: canvasConfig.borderSides?.left !== false ? `${canvasConfig.borderWidth || 1.5}px ${canvasConfig.borderStyle || 'solid'} ${canvasConfig.borderColor || 'rgba(255, 255, 255, 0.22)'}` : 'none',
                          borderRadius: `${canvasConfig.borderRadius || 0}px`,
                          opacity: (canvasConfig.borderOpacity ?? 85) / 100,
                          boxShadow: canvasConfig.borderGlow ? `0 0 ${canvasConfig.borderGlowBlur || 14}px ${canvasConfig.borderGlowColor || 'rgba(56, 189, 248, 0.6)'}` : undefined,
                          zIndex: canvasConfig.borderPosition === 'behind' ? 5 : 25
                        }}
                      />

                      {/* Secondary Inner Border */}
                      {canvasConfig.hasInnerBorder && (
                        <div 
                          className="absolute pointer-events-none"
                          style={{
                            inset: `${(canvasConfig.borderInset || 18) + (canvasConfig.innerBorderInset || 6)}px`,
                            border: `${canvasConfig.innerBorderWidth || 1}px ${canvasConfig.innerBorderStyle || 'solid'} ${canvasConfig.innerBorderColor || '#fef08a'}`,
                            borderRadius: `${Math.max(0, (canvasConfig.borderRadius || 0) - 4)}px`,
                            opacity: (canvasConfig.borderOpacity ?? 85) / 100,
                            zIndex: canvasConfig.borderPosition === 'behind' ? 5 : 25
                          }}
                        />
                      )}

                      {/* Futuristic Tech Corner Brackets */}
                      {(canvasConfig.borderPreset === 'tech-brackets' || canvasConfig.borderPreset === 'futuristic-tech-brackets') && (
                        <>
                          <div 
                            className="absolute pointer-events-none" 
                            style={{
                              top: `${canvasConfig.borderInset || 18}px`, 
                              left: `${canvasConfig.borderInset || 18}px`,
                              width: '24px', 
                              height: '24px', 
                              borderTop: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`, 
                              borderLeft: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`,
                              zIndex: 26,
                              filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))'
                            }} 
                          />
                          <div 
                            className="absolute pointer-events-none" 
                            style={{
                              top: `${canvasConfig.borderInset || 18}px`, 
                              right: `${canvasConfig.borderInset || 18}px`,
                              width: '24px', 
                              height: '24px', 
                              borderTop: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`, 
                              borderRight: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`,
                              zIndex: 26,
                              filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))'
                            }} 
                          />
                          <div 
                            className="absolute pointer-events-none" 
                            style={{
                              bottom: `${canvasConfig.borderInset || 18}px`, 
                              left: `${canvasConfig.borderInset || 18}px`,
                              width: '24px', 
                              height: '24px', 
                              borderBottom: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`, 
                              borderLeft: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`,
                              zIndex: 26,
                              filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))'
                            }} 
                          />
                          <div 
                            className="absolute pointer-events-none" 
                            style={{
                              bottom: `${canvasConfig.borderInset || 18}px`, 
                              right: `${canvasConfig.borderInset || 18}px`,
                              width: '24px', 
                              height: '24px', 
                              borderBottom: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`, 
                              borderRight: `3px solid ${canvasConfig.borderColor || '#38bdf8'}`,
                              zIndex: 26,
                              filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.8))'
                            }} 
                          />
                        </>
                      )}
                    </>
                  )}

                  {/* LAYER 5: INTERACTIVE CANVAS ELEMENTS */}
                  {layers.filter(l => !l.hidden).sort((a,b) => a.zIndex - b.zIndex).map(layer => {
                    const isSelected = selectedId === layer.id;
                    const hasBox = Boolean(layer.hasBox);
                    
                    return (
                      <div 
                        key={layer.id}
                        className={`absolute ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''} ${layer.locked ? 'pointer-events-none' : 'cursor-move'}`}
                        style={{
                          left: layer.x, 
                          top: layer.y, 
                          transform: `translate(-50%, -50%) ${layer.rotation ? `rotate(${layer.rotation}deg)` : ''}`,
                          zIndex: layer.zIndex, 
                          width: layer.width, 
                          height: layer.height,
                          opacity: layer.opacity ?? 1,
                          ...(hasBox ? {
                            backgroundColor: layer.boxBg || 'rgba(15, 23, 42, 0.85)',
                            border: `${layer.boxBorderWidth ?? 1.5}px ${layer.boxBorderStyle || 'solid'} ${layer.boxBorderColor || 'rgba(56, 189, 248, 0.7)'}`,
                            borderRadius: `${layer.boxRadius ?? 8}px`,
                            padding: `${layer.boxPadding ?? 12}px`,
                            boxShadow: layer.boxShadow || '0 8px 24px rgba(0,0,0,0.6)',
                            backdropFilter: layer.boxBackdropFilter || 'blur(8px)',
                            WebkitBackdropFilter: layer.boxBackdropFilter || 'blur(8px)',
                            boxSizing: 'border-box'
                          } : {})
                        }}
                        onPointerDown={(e) => handlePointerDown(e, layer.id)}
                      >
                        {layer.type === 'text' && (
                          <div
                            contentEditable={isSelected && !layer.locked}
                            suppressContentEditableWarning
                            onPointerDown={(e) => {
                              if (isSelected) {
                                e.stopPropagation();
                              }
                            }}
                            onInput={(e) => updateLayer(layer.id, { text: e.currentTarget.innerText })}
                            onBlur={(e) => updateLayer(layer.id, { text: e.currentTarget.innerText })}
                            style={{
                              fontFamily: layer.fontFamily,
                              fontSize: layer.fontSize,
                              fontWeight: layer.fontWeight,
                              fontStyle: layer.fontStyle,
                              color: layer.backgroundClip ? 'transparent' : (layer.color || '#fff'),
                              textAlign: layer.textAlign,
                              letterSpacing: layer.letterSpacing ? `${layer.letterSpacing}px` : undefined,
                              lineHeight: layer.lineHeight || 1.2,
                              textShadow: layer.textShadow,
                              background: layer.background,
                              WebkitBackgroundClip: layer.WebkitBackgroundClip || layer.backgroundClip,
                              WebkitTextFillColor: layer.WebkitTextFillColor || layer.textFillColor,
                              WebkitTextStroke: layer.WebkitTextStroke || layer.textStroke,
                              filter: layer.filter,
                              whiteSpace: 'pre-wrap',
                              outline: 'none',
                              minWidth: '50px',
                              cursor: isSelected ? 'text' : 'pointer'
                            }}
                          >
                            {layer.text}
                          </div>
                        )}

                        {layer.type === 'image' && (
                          <img 
                            src={layer.src} 
                            alt={layer.name || 'Image'} 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'contain', 
                              borderRadius: layer.borderRadius ? `${layer.borderRadius}px` : undefined 
                            }} 
                            crossOrigin="anonymous" 
                            draggable={false} 
                          />
                        )}
                        
                        {layer.type === 'qr' && (
                          <div className="bg-white p-1.5 rounded-lg shadow-2xl border-2 border-white flex flex-col items-center">
                            <img 
                              src={layer.src} 
                              alt="Scan QR" 
                              style={{ width: '100%', height: '100%' }} 
                              crossOrigin="anonymous" 
                              draggable={false} 
                            />
                            <span className="text-[7.5px] font-black uppercase text-black tracking-wider mt-1">Scan to Register</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Floating Zoom Controls for Mobile */}
          <div 
            className="md:hidden fixed bottom-14 right-3 z-30 flex items-center bg-white/95 backdrop-blur-xs rounded-full shadow-lg border border-gray-300 px-1 py-0.5 select-none"
            onClick={e => e.stopPropagation()}
          >
            <button 
              type="button"
              onClick={() => setZoom(z => Math.max(0.18, z - 0.05))} 
              className="w-7 h-7 flex items-center justify-center font-bold text-gray-700 text-sm active:bg-gray-100 rounded-full"
            >
              -
            </button>
            <button 
              type="button"
              onClick={handleFitCanvas} 
              className="px-2 text-[10px] font-black text-indigo-700 uppercase"
            >
              Fit
            </button>
            <button 
              type="button"
              onClick={() => setZoom(z => Math.min(2.5, z + 0.05))} 
              className="w-7 h-7 flex items-center justify-center font-bold text-gray-700 text-sm active:bg-gray-100 rounded-full"
            >
              +
            </button>
          </div>

          {/* Floating Selected Element Quick Bar for Mobile */}
          {selectedElement && (
            <div 
              className="md:hidden fixed top-28 inset-x-3 z-30 flex items-center justify-between bg-gray-900/95 backdrop-blur-xs text-white px-3 py-2 rounded-xl shadow-xl border border-white/10 select-none animate-in fade-in"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 overflow-hidden mr-2">
                <span className="text-xs">✏️</span>
                <span className="text-xs font-bold truncate max-w-[140px]">{selectedElement.name || 'Selected Layer'}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button 
                  type="button"
                  onClick={() => setMobileTab('properties')} 
                  className="bg-blue-600 active:bg-blue-700 text-white text-[11px] font-bold px-2.5 py-1 rounded-lg transition"
                >
                  Edit Style
                </button>
                <button 
                  type="button"
                  onClick={() => deleteLayer(selectedElement.id)} 
                  className="bg-red-600/80 active:bg-red-700 text-white text-[11px] font-bold px-2 py-1 rounded-lg transition"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR (PROPERTIES) */}
        <aside className={`
          bg-white border-gray-200 flex flex-col shrink-0 overflow-y-auto
          md:w-80 md:flex md:border-l md:static md:z-auto md:max-h-none md:rounded-none
          ${mobileTab === 'properties' 
            ? 'fixed inset-x-0 bottom-0 z-50 max-h-[78vh] rounded-t-2xl shadow-2xl border-t animate-in slide-in-from-bottom duration-200' 
            : 'hidden md:flex'}
        `}>
          {/* Mobile Sheet Close Bar for Properties */}
          <div className="md:hidden flex items-center justify-between px-4 py-2 border-b bg-gray-50 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-8 h-1 bg-gray-300 rounded-full" />
              <span className="text-[11px] font-black uppercase text-gray-700 tracking-wider">
                {selectedElement ? `✏️ ${selectedElement.name}` : '🎨 Canvas Properties'}
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setMobileTab(null)}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 text-gray-700 font-bold text-xs"
            >
              ✕
            </button>
          </div>
          {selectedElement ? (
            <div className="p-5 space-y-5">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-sm font-black uppercase text-gray-800">Edit Element</h3>
                <div className="flex gap-2">
                  <button onClick={() => bringForward(selectedElement.id)} className="p-1 bg-gray-100 rounded hover:bg-gray-200 text-xs font-bold" title="Bring Forward">↑</button>
                  <button onClick={() => sendBackward(selectedElement.id)} className="p-1 bg-gray-100 rounded hover:bg-gray-200 text-xs font-bold" title="Send Backward">↓</button>
                  <button onClick={() => duplicateLayer(selectedElement.id)} className="p-1 bg-gray-100 rounded hover:bg-gray-200 text-xs font-bold" title="Duplicate">📋</button>
                  <button onClick={() => deleteLayer(selectedElement.id)} className="p-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-xs font-bold" title="Delete">✕</button>
                </div>
              </div>
              
              {selectedElement.type === 'text' && (
                <>
                  {/* EDITABLE TEXT & BADGE CONTENT INSPECTOR */}
                  <div className="bg-gradient-to-br from-blue-50/90 to-indigo-50/70 p-3 rounded-xl border border-blue-200 shadow-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase text-blue-900 flex items-center gap-1.5">
                        <span>✏️ {selectedElement.hasBox ? (selectedElement.name.includes('Badge') ? 'Badge Text (Editable)' : 'Card Text (Editable)') : 'Text Content (Editable)'}</span>
                      </label>
                      <span className="text-[9px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded">Live Sync</span>
                    </div>

                    <textarea 
                      className="w-full border border-blue-300 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none bg-white text-gray-900 shadow-inner min-h-[72px]"
                      placeholder="Type text for this card, badge, or heading..."
                      value={selectedElement.text || ''} 
                      onChange={e => updateLayer(selectedElement.id, { text: e.target.value })} 
                    />

                    {/* Quick Insert Symbols & Badges */}
                    <div className="flex items-center gap-1 flex-wrap pt-0.5">
                      <span className="text-[9px] font-bold text-gray-400">Quick Badges:</span>
                      {[
                        { label: '🏆 Prize', insert: '🏆 ' },
                        { label: '📅 Date', insert: '📅 ' },
                        { label: '📍 Venue', insert: '📍 ' },
                        { label: '⚡ Free', insert: '⚡ ' },
                        { label: '★ Star', insert: '★ ' },
                        { label: '✓ Verified', insert: '✓ ' },
                        { label: '🎙️ Speaker', insert: '🎙️ ' },
                        { label: '⚠️ Alert', insert: '⚠️ ' },
                        { label: '🎓 NAAC A++', insert: '★ NAAC "A++" GRADE' },
                        { label: '🏛️ Autonomous', insert: 'AUTONOMOUS' }
                      ].map(chip => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            const current = selectedElement.text || '';
                            const updated = current ? `${current} • ${chip.insert}` : chip.insert;
                            updateLayer(selectedElement.id, { text: updated });
                          }}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 rounded text-gray-600 transition shadow-xs"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Font Family</label>
                    <select className="w-full border rounded p-2 text-xs" value={selectedElement.fontFamily || 'Inter'} onChange={e => updateLayer(selectedElement.id, { fontFamily: e.target.value })}>
                      {FONTS.map(f => <option key={f} value={f} style={{fontFamily: f}}>{f}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Preset Typography Styles</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button onClick={() => updateLayer(selectedElement.id, getTypographyStyle('3d-noventrix-blue'))} className="text-[10px] font-bold p-1.5 bg-blue-50 text-blue-800 rounded border border-blue-200 hover:bg-blue-100">3D Ice Blue</button>
                      <button onClick={() => updateLayer(selectedElement.id, getTypographyStyle('3d-gold-foil'))} className="text-[10px] font-bold p-1.5 bg-amber-50 text-amber-800 rounded border border-amber-200 hover:bg-amber-100">3D Gold Foil</button>
                      <button onClick={() => updateLayer(selectedElement.id, getTypographyStyle('3d-liquid-chrome'))} className="text-[10px] font-bold p-1.5 bg-slate-100 text-slate-800 rounded border border-slate-300 hover:bg-slate-200">3D Chrome</button>
                      <button onClick={() => updateLayer(selectedElement.id, getTypographyStyle('neon-tube'))} className="text-[10px] font-bold p-1.5 bg-cyan-50 text-cyan-800 rounded border border-cyan-200 hover:bg-cyan-100">Cyber Neon</button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Size (px)</label>
                      <input type="number" className="w-full border rounded p-2 text-xs" value={selectedElement.fontSize || 24} onChange={e => updateLayer(selectedElement.id, { fontSize: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Weight</label>
                      <select className="w-full border rounded p-2 text-xs" value={selectedElement.fontWeight || 400} onChange={e => updateLayer(selectedElement.id, { fontWeight: e.target.value })}>
                        <option value="400">Regular (400)</option>
                        <option value="600">SemiBold (600)</option>
                        <option value="700">Bold (700)</option>
                        <option value="900">Black (900)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Color</label>
                    <input type="color" className="w-full h-8 border rounded cursor-pointer p-0" value={selectedElement.color || '#ffffff'} onChange={e => updateLayer(selectedElement.id, { color: e.target.value, backgroundClip: undefined, textFillColor: undefined, background: undefined, WebkitBackgroundClip: undefined, WebkitTextFillColor: undefined })} />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Align</label>
                    <div className="flex border rounded overflow-hidden">
                      {['left', 'center', 'right', 'justify'].map(a => (
                        <button key={a} className={`flex-1 py-1 text-xs font-bold ${selectedElement.textAlign === a ? 'bg-blue-100 text-blue-700' : 'bg-gray-50 hover:bg-gray-100'}`} onClick={() => updateLayer(selectedElement.id, { textAlign: a as any })}>{a.charAt(0).toUpperCase()}</button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Letter Spacing</label>
                      <input type="number" className="w-full border rounded p-2 text-xs" value={selectedElement.letterSpacing || 0} onChange={e => updateLayer(selectedElement.id, { letterSpacing: Number(e.target.value) })} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Line Height</label>
                      <input type="number" step="0.1" className="w-full border rounded p-2 text-xs" value={selectedElement.lineHeight || 1.2} onChange={e => updateLayer(selectedElement.id, { lineHeight: Number(e.target.value) })} />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Advanced 3D Shadows & CSS</label>
                    <textarea className="w-full border rounded p-2 text-xs font-mono h-20" placeholder="text-shadow: 0 4px 10px #000;" value={selectedElement.textShadow || ''} onChange={e => updateLayer(selectedElement.id, { textShadow: e.target.value })} />
                  </div>

                  {/* CONTAINER BOX & INFORMATION CARD CONTROLS */}
                  <div className="pt-3 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-bold text-gray-700 uppercase flex items-center gap-1.5">
                        <span>📦 Info Box / Card Container</span>
                      </label>
                      <button 
                        onClick={() => updateLayer(selectedElement.id, { hasBox: !selectedElement.hasBox })} 
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded transition ${selectedElement.hasBox ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {selectedElement.hasBox ? 'Box Active' : 'Add Box'}
                      </button>
                    </div>

                    {!selectedElement.hasBox ? (
                      <button 
                        onClick={handleAddBoxAroundSelection}
                        className="w-full py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded text-xs font-bold border border-blue-200 flex items-center justify-center gap-1.5 transition"
                      >
                        <span>+ Add Box Around Selection</span>
                      </button>
                    ) : (
                      <div className="space-y-3 bg-gray-50 p-3 rounded-lg border text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Preset Card Themes</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button 
                              onClick={() => updateLayer(selectedElement.id, { 
                                boxBg: 'rgba(15, 23, 42, 0.85)', 
                                boxBorderColor: '#38bdf8', 
                                boxBorderWidth: 1.5,
                                boxRadius: 8,
                                color: '#ffffff'
                              })}
                              className="p-1.5 bg-slate-900 text-cyan-300 rounded border border-cyan-500/40 text-[10px] font-bold"
                            >
                              Cyber Blue Glass
                            </button>
                            <button 
                              onClick={() => updateLayer(selectedElement.id, { 
                                boxBg: 'rgba(30, 20, 10, 0.9)', 
                                boxBorderColor: '#f59e0b', 
                                boxBorderWidth: 2,
                                boxRadius: 8,
                                color: '#fef08a'
                              })}
                              className="p-1.5 bg-amber-950 text-amber-300 rounded border border-amber-500/40 text-[10px] font-bold"
                            >
                              Luxury Gold Card
                            </button>
                            <button 
                              onClick={() => updateLayer(selectedElement.id, { 
                                boxBg: 'rgba(6, 78, 59, 0.85)', 
                                boxBorderColor: '#10b981', 
                                boxBorderWidth: 1.5,
                                boxRadius: 8,
                                color: '#d1fae5'
                              })}
                              className="p-1.5 bg-emerald-950 text-emerald-300 rounded border border-emerald-500/40 text-[10px] font-bold"
                            >
                              Emerald Slate
                            </button>
                            <button 
                              onClick={() => updateLayer(selectedElement.id, { 
                                boxBg: '#ffffff', 
                                boxBorderColor: '#e2e8f0', 
                                boxBorderWidth: 1.5,
                                boxRadius: 8,
                                color: '#0f172a'
                              })}
                              className="p-1.5 bg-white text-slate-800 rounded border border-slate-300 text-[10px] font-bold"
                            >
                              Crisp Clean White
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Box Background</label>
                            <input 
                              type="color" 
                              className="w-full h-7 border rounded cursor-pointer p-0" 
                              value={selectedElement.boxBg?.startsWith('#') ? selectedElement.boxBg : '#0f172a'} 
                              onChange={e => updateLayer(selectedElement.id, { boxBg: e.target.value })} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Border Color</label>
                            <input 
                              type="color" 
                              className="w-full h-7 border rounded cursor-pointer p-0" 
                              value={selectedElement.boxBorderColor?.startsWith('#') ? selectedElement.boxBorderColor : '#38bdf8'} 
                              onChange={e => updateLayer(selectedElement.id, { boxBorderColor: e.target.value })} 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Thickness ({selectedElement.boxBorderWidth ?? 1.5}px)</label>
                            <input 
                              type="range" 
                              min="0" 
                              max="8" 
                              step="0.5" 
                              className="w-full" 
                              value={selectedElement.boxBorderWidth ?? 1.5} 
                              onChange={e => updateLayer(selectedElement.id, { boxBorderWidth: Number(e.target.value) })} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Radius ({selectedElement.boxRadius ?? 8}px)</label>
                            <input 
                              type="range" 
                              min="0" 
                              max="32" 
                              className="w-full" 
                              value={selectedElement.boxRadius ?? 8} 
                              onChange={e => updateLayer(selectedElement.id, { boxRadius: Number(e.target.value) })} 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Padding ({selectedElement.boxPadding ?? 12}px)</label>
                            <input 
                              type="range" 
                              min="4" 
                              max="32" 
                              className="w-full" 
                              value={selectedElement.boxPadding ?? 12} 
                              onChange={e => updateLayer(selectedElement.id, { boxPadding: Number(e.target.value) })} 
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Line Style</label>
                            <select 
                              className="w-full border rounded p-1 text-[11px]" 
                              value={selectedElement.boxBorderStyle || 'solid'} 
                              onChange={e => updateLayer(selectedElement.id, { boxBorderStyle: e.target.value as any })}
                            >
                              <option value="solid">Solid</option>
                              <option value="double">Double</option>
                              <option value="dashed">Dashed</option>
                              <option value="dotted">Dotted</option>
                            </select>
                          </div>
                        </div>

                        <button 
                          onClick={handleRemoveBoxFromSelection}
                          className="w-full py-1 text-center text-red-600 hover:text-red-700 text-[10px] font-bold"
                        >
                          Remove Box From Selection
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {(selectedElement.type === 'image' || selectedElement.type === 'qr') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Width (px)</label>
                    <input type="number" className="w-full border rounded p-2 text-xs" value={selectedElement.width || 100} onChange={e => updateLayer(selectedElement.id, { width: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Height (px)</label>
                    <input type="number" className="w-full border rounded p-2 text-xs" value={selectedElement.height || 100} onChange={e => updateLayer(selectedElement.id, { height: Number(e.target.value) })} />
                  </div>
                </div>
              )}
              
            </div>
          ) : (
            <div className="p-5 space-y-5">
              <h3 className="text-sm font-black uppercase text-gray-800 border-b pb-3">Canvas & Background</h3>
              
              {/* Venue Backdrop Option */}
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between">
                  <span>Venue Backdrop</span>
                  {canvasConfig.venueBackdrop && (
                    <button 
                      onClick={() => setCanvasConfig({ ...canvasConfig, venueBackdrop: '' })}
                      className="text-red-500 hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </label>
                {canvasConfig.venueBackdrop ? (
                  <div>
                    <span className="text-[10px] text-gray-400">Opacity: {canvasConfig.venueOpacity}%</span>
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      className="w-full" 
                      value={canvasConfig.venueOpacity} 
                      onChange={e => setCanvasConfig({...canvasConfig, venueOpacity: Number(e.target.value)})} 
                    />
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">No venue backdrop active.</p>
                )}
              </div>

              {/* Inset Border Frame */}
              <div className="pt-2 border-t">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between items-center">
                  <span>Border Framing</span>
                  <input 
                    type="checkbox" 
                    checked={canvasConfig.hasBorder} 
                    onChange={e => setCanvasConfig({ ...canvasConfig, hasBorder: e.target.checked })} 
                  />
                </label>
                {canvasConfig.hasBorder && (
                  <div className="flex gap-2 items-center mt-1">
                    <span className="text-[10px] text-gray-400">Color:</span>
                    <input 
                      type="color" 
                      className="w-12 h-6 border rounded cursor-pointer p-0" 
                      value={canvasConfig.borderColor.startsWith('#') ? canvasConfig.borderColor : '#ffffff'} 
                      onChange={e => setCanvasConfig({...canvasConfig, borderColor: e.target.value})} 
                    />
                  </div>
                )}
              </div>

              {/* Radial Aura Glow */}
              <div className="pt-2 border-t">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between items-center">
                  <span>Atmospheric Title Glow</span>
                  <input 
                    type="checkbox" 
                    checked={canvasConfig.radialAura} 
                    onChange={e => setCanvasConfig({ ...canvasConfig, radialAura: e.target.checked })} 
                  />
                </label>
              </div>

              {/* Brightness, Contrast & Blur */}
              <div className="pt-2 border-t space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between">Brightness <span>{canvasConfig.brightness}%</span></label>
                  <input type="range" min="0" max="200" className="w-full" value={canvasConfig.brightness} onChange={e => setCanvasConfig({...canvasConfig, brightness: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between">Contrast <span>{canvasConfig.contrast}%</span></label>
                  <input type="range" min="0" max="200" className="w-full" value={canvasConfig.contrast} onChange={e => setCanvasConfig({...canvasConfig, contrast: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1 flex justify-between">Blur <span>{canvasConfig.blur}px</span></label>
                  <input type="range" min="0" max="20" className="w-full" value={canvasConfig.blur} onChange={e => setCanvasConfig({...canvasConfig, blur: Number(e.target.value)})} />
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Canvas Aspect Ratio</label>
                <select className="w-full border rounded p-2 text-xs" value={`${canvasConfig.width}x${canvasConfig.height}`} onChange={e => {
                  const [w, h] = e.target.value.split('x').map(Number);
                  setCanvasConfig({...canvasConfig, width: w, height: h});
                }}>
                  <option value="800x1131">A4 / Portrait (1:1.414)</option>
                  <option value="1200x675">Landscape (16:9)</option>
                  <option value="1080x1080">Instagram Square (1:1)</option>
                  <option value="1080x1920">Instagram Story (9:16)</option>
                </select>
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {mobileTab && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 backdrop-blur-2xs z-40 animate-in fade-in duration-150"
          onClick={() => setMobileTab(null)}
        />
      )}

      {/* MOBILE BOTTOM TOOLBAR */}
      <nav className="md:hidden flex items-center justify-around bg-white border-t border-gray-200 px-1 py-1.5 z-40 shrink-0 shadow-lg select-none">
        <button 
          type="button"
          onClick={handleAutoArrange} 
          className="flex flex-col items-center justify-center px-1.5 py-0.5 text-indigo-600 active:scale-95 transition"
        >
          <span className="text-base leading-none mb-0.5">🪄</span>
          <span className="text-[9px] font-bold">Arrange</span>
        </button>
        <button 
          type="button"
          onClick={() => { setActiveTab('ai'); setMobileTab('ai'); }} 
          className={`flex flex-col items-center justify-center px-1.5 py-0.5 ${mobileTab === 'ai' ? 'text-blue-600 font-black' : 'text-gray-600'}`}
        >
          <span className="text-base leading-none mb-0.5">✨</span>
          <span className="text-[9px] font-bold">Studio</span>
        </button>
        <button 
          type="button"
          onClick={() => { setActiveTab('chat'); setMobileTab('chat'); }} 
          className={`flex flex-col items-center justify-center px-1.5 py-0.5 ${mobileTab === 'chat' ? 'text-blue-600 font-black' : 'text-gray-600'}`}
        >
          <span className="text-base leading-none mb-0.5">💬</span>
          <span className="text-[9px] font-bold">AI Edit</span>
        </button>
        <button 
          type="button"
          onClick={() => { setActiveTab('kits'); setMobileTab('kits'); }} 
          className={`flex flex-col items-center justify-center px-1.5 py-0.5 ${mobileTab === 'kits' ? 'text-blue-600 font-black' : 'text-gray-600'}`}
        >
          <span className="text-base leading-none mb-0.5">🏛️</span>
          <span className="text-[9px] font-bold">Kits</span>
        </button>
        <button 
          type="button"
          onClick={() => { setActiveTab('borders'); setMobileTab('borders'); }} 
          className={`flex flex-col items-center justify-center px-1.5 py-0.5 ${mobileTab === 'borders' ? 'text-blue-600 font-black' : 'text-gray-600'}`}
        >
          <span className="text-base leading-none mb-0.5">🔲</span>
          <span className="text-[9px] font-bold">Borders</span>
        </button>
        <button 
          type="button"
          onClick={() => { setActiveTab('layers'); setMobileTab('layers'); }} 
          className={`flex flex-col items-center justify-center px-1.5 py-0.5 ${mobileTab === 'layers' ? 'text-blue-600 font-black' : 'text-gray-600'}`}
        >
          <span className="text-base leading-none mb-0.5">📑</span>
          <span className="text-[9px] font-bold">Layers</span>
        </button>
        <button 
          type="button"
          onClick={() => setMobileTab('properties')} 
          className={`flex flex-col items-center justify-center px-1.5 py-0.5 ${mobileTab === 'properties' ? 'text-blue-600 font-black' : 'text-gray-600'}`}
        >
          <span className="text-base leading-none mb-0.5">🎨</span>
          <span className="text-[9px] font-bold">{selectedElement ? 'Edit' : 'Canvas'}</span>
        </button>
      </nav>

      {/* LIVE POSTER PREVIEW MODAL */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
            <div className="flex justify-between items-center border-b pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-base font-black text-gray-900 uppercase">👁️ Poster Preview</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-mono font-bold px-2 py-0.5 rounded">
                  {canvasConfig.width} × {canvasConfig.height}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDownloadHD('png', hdScale)} 
                  disabled={downloadingHD}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs"
                >
                  <span>⬇️ Download HD</span>
                </button>
                <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-700 font-bold text-lg p-1">✕</button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-100 rounded-xl my-3">
              <div 
                className="relative shadow-xl overflow-hidden rounded bg-white" 
                style={{
                  width: Math.min(420, canvasConfig.width * 0.5),
                  height: Math.min(420, canvasConfig.width * 0.5) * (canvasConfig.height / canvasConfig.width),
                  maxHeight: '65vh'
                }}
              >
                <div 
                  style={{
                    transform: `scale(${Math.min(420, canvasConfig.width * 0.5) / canvasConfig.width})`,
                    transformOrigin: 'top left',
                    width: canvasConfig.width,
                    height: canvasConfig.height,
                    backgroundColor: canvasConfig.bgColor,
                    position: 'relative'
                  }}
                >
                  {canvasConfig.bgImage && (
                    <img 
                      src={canvasConfig.bgImage} 
                      className="w-full h-full object-cover absolute inset-0 pointer-events-none" 
                      style={{ filter: `brightness(${canvasConfig.brightness}%) contrast(${canvasConfig.contrast}%) blur(${canvasConfig.blur}px)` }} 
                      crossOrigin="anonymous" 
                      alt="bg"
                    />
                  )}
                  {canvasConfig.hasBorder && (
                    <div 
                      className="absolute pointer-events-none" 
                      style={{ 
                        inset: `${canvasConfig.borderInset}px`,
                        borderWidth: `${canvasConfig.borderWidth}px`,
                        borderColor: canvasConfig.borderColor,
                        borderStyle: canvasConfig.borderStyle,
                        borderRadius: `${canvasConfig.borderRadius}px`,
                        opacity: canvasConfig.borderOpacity / 100,
                        zIndex: 35
                      }} 
                    />
                  )}
                  {layers.filter(l => !l.hidden).map(layer => (
                    <div 
                      key={layer.id} 
                      className="absolute pointer-events-none" 
                      style={{ 
                        left: `${layer.x}px`, 
                        top: `${layer.y}px`, 
                        transform: 'translate(-50%, -50%)',
                        zIndex: layer.zIndex
                      }}
                    >
                      {layer.type === 'text' && (
                        <div style={{
                          fontFamily: layer.fontFamily,
                          fontSize: `${layer.fontSize}px`,
                          fontWeight: layer.fontWeight,
                          color: layer.color,
                          textAlign: layer.textAlign,
                          textShadow: layer.textShadow,
                          whiteSpace: 'pre-wrap',
                          padding: layer.hasBox ? `${layer.boxPadding || 12}px` : undefined,
                          backgroundColor: layer.hasBox ? (layer.boxBg || 'rgba(0,0,0,0.6)') : undefined,
                          borderRadius: layer.hasBox ? `${layer.boxRadius || 8}px` : undefined,
                          border: layer.hasBox && layer.boxBorderWidth ? `${layer.boxBorderWidth}px ${layer.boxBorderStyle || 'solid'} ${layer.boxBorderColor || '#ffffff'}` : undefined
                        }}>
                          {layer.text}
                        </div>
                      )}
                      {layer.type === 'image' && layer.src && (
                        <img src={layer.src} alt={layer.name} style={{ width: `${layer.width}px`, height: `${layer.height}px`, borderRadius: `${layer.borderRadius || 0}px` }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
              <span>Eventiva High-Fidelity Vector & Canvas Engine</span>
              <button onClick={() => setShowPreviewModal(false)} className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-gray-700">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* OCR DETECTED ELEMENTS MODAL */}
      {ocrElementsModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase flex items-center gap-2">
                  <span>🔍 Detected Text Elements</span>
                  <span className="text-[10px] bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-full font-mono">{ocrElementsModal.length} Found</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Select the detected text items you wish to convert into editable layers on your poster.</p>
              </div>
              <button onClick={() => setOcrElementsModal(null)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <div className="space-y-2.5 overflow-y-auto p-1 my-4 flex-1">
              {ocrElementsModal.map((item, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-start gap-3 hover:bg-blue-50/50 transition">
                  <input 
                    type="checkbox" 
                    id={`ocr-item-${idx}`} 
                    defaultChecked 
                    className="mt-1 rounded text-blue-600 focus:ring-blue-500" 
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded font-mono">
                        {item.role || 'Text'}
                      </span>
                      {item.confidence && (
                        <span className="text-[9px] text-gray-400 font-semibold">{Math.round(item.confidence * 100)}% Confidence</span>
                      )}
                    </div>
                    <input 
                      type="text" 
                      defaultValue={item.text} 
                      id={`ocr-text-${idx}`}
                      className="w-full text-xs font-semibold text-gray-900 bg-white border border-gray-200 rounded p-1.5 focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t pt-3">
              <button 
                onClick={() => setOcrElementsModal(null)}
                className="px-4 py-2 border rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const selectedItems: any[] = [];
                  ocrElementsModal.forEach((item, idx) => {
                    const cb = document.getElementById(`ocr-item-${idx}`) as HTMLInputElement;
                    const txt = document.getElementById(`ocr-text-${idx}`) as HTMLInputElement;
                    if (cb && cb.checked) {
                      selectedItems.push({
                        ...item,
                        text: txt ? txt.value : item.text
                      });
                    }
                  });
                  handleApplyDetectedLayers(selectedItems);
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-xs"
              >
                ✓ Add as Editable Layers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM BRANDING KIT MODAL */}
      {showCustomKitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-base font-black text-gray-900 uppercase">
                {editingKitId ? 'Edit Custom Branding Kit' : 'Create Custom Branding Kit'}
              </h3>
              <button onClick={() => setShowCustomKitModal(false)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Institution / Organization Name *</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg p-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none" 
                  placeholder="e.g. Stanford University / Tech Corp"
                  value={kitForm.name || ''} 
                  onChange={e => setKitForm({ ...kitForm, name: e.target.value })} 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Short Name / Code</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-xs" 
                    placeholder="e.g. STANFORD"
                    value={kitForm.short_name || ''} 
                    onChange={e => setKitForm({ ...kitForm, short_name: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Institution Type</label>
                  <select 
                    className="w-full border rounded-lg p-2 text-xs"
                    value={kitForm.institution_type || 'College / University'}
                    onChange={e => setKitForm({ ...kitForm, institution_type: e.target.value })}
                  >
                    <option value="College / University">College / University</option>
                    <option value="Autonomous Engineering College">Autonomous Engineering College</option>
                    <option value="Deemed University">Deemed University</option>
                    <option value="Tech Community & Society">Tech Community & Society</option>
                    <option value="Corporate Organization">Corporate Organization</option>
                    <option value="School / Educational">School / Educational</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Department / Division</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-xs" 
                    placeholder="e.g. Dept of Computer Science"
                    value={kitForm.department || ''} 
                    onChange={e => setKitForm({ ...kitForm, department: e.target.value })} 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Location / City</label>
                  <input 
                    type="text" 
                    className="w-full border rounded-lg p-2 text-xs" 
                    placeholder="e.g. Hyderabad, Telangana"
                    value={kitForm.location || ''} 
                    onChange={e => setKitForm({ ...kitForm, location: e.target.value })} 
                  />
                </div>
              </div>

              {/* Logo Asset */}
              <div className="space-y-2 pt-2 border-t">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Official Logo Asset</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 border rounded-lg p-2 text-xs" 
                    placeholder="Paste Image URL or upload file..."
                    value={kitForm.logo_url || ''} 
                    onChange={e => setKitForm({ ...kitForm, logo_url: e.target.value })} 
                  />
                  <label className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 font-bold text-xs whitespace-nowrap">
                    Browse...
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*" 
                      onChange={async (e) => {
                        if (e.target.files && e.target.files[0]) {
                          const file = e.target.files[0];
                          try {
                            const fd = new FormData();
                            fd.append('file', file);
                            const res = await axios.post('/api/branding-kits/upload-logo', fd);
                            setKitForm({ ...kitForm, logo_url: res.data.url });
                          } catch (err) {
                            setKitForm({ ...kitForm, logo_url: URL.createObjectURL(file) });
                          }
                        }
                      }} 
                    />
                  </label>
                </div>
              </div>

              {/* Brand Colors */}
              <div className="pt-2 border-t">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Official Brand Color Palette</label>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">Primary</span>
                    <input 
                      type="color" 
                      className="w-full h-8 border rounded cursor-pointer p-0"
                      value={kitForm.primary_color || '#1e3a8a'}
                      onChange={e => setKitForm({ ...kitForm, primary_color: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">Secondary</span>
                    <input 
                      type="color" 
                      className="w-full h-8 border rounded cursor-pointer p-0"
                      value={kitForm.secondary_color || '#f59e0b'}
                      onChange={e => setKitForm({ ...kitForm, secondary_color: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">Dark BG</span>
                    <input 
                      type="color" 
                      className="w-full h-8 border rounded cursor-pointer p-0"
                      value={kitForm.dark_bg || '#030712'}
                      onChange={e => setKitForm({ ...kitForm, dark_bg: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-gray-400 block mb-0.5">Accent</span>
                    <input 
                      type="color" 
                      className="w-full h-8 border rounded cursor-pointer p-0"
                      value={kitForm.accent_color || '#38bdf8'}
                      onChange={e => setKitForm({ ...kitForm, accent_color: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Preferred Font & Border */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Recommended Font</label>
                  <select 
                    className="w-full border rounded-lg p-2 text-xs"
                    value={kitForm.preferred_font || 'Inter'}
                    onChange={e => setKitForm({ ...kitForm, preferred_font: e.target.value })}
                  >
                    {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Recommended Border</label>
                  <select 
                    className="w-full border rounded-lg p-2 text-xs"
                    value={kitForm.recommended_border || 'academic-formal'}
                    onChange={e => setKitForm({ ...kitForm, recommended_border: e.target.value })}
                  >
                    {BORDER_PRESETS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Signoff Text */}
              <div className="pt-2 border-t">
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Official Host Signoff Text</label>
                <textarea 
                  className="w-full border rounded-lg p-2 text-xs h-16 font-mono" 
                  placeholder="With Regards,&#10;Organizing Committee"
                  value={kitForm.signoff_text || ''} 
                  onChange={e => setKitForm({ ...kitForm, signoff_text: e.target.value })} 
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Official Website</label>
                <input 
                  type="text" 
                  className="w-full border rounded-lg p-2 text-xs" 
                  placeholder="https://www.institution.edu"
                  value={kitForm.website || ''} 
                  onChange={e => setKitForm({ ...kitForm, website: e.target.value })} 
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button 
                onClick={() => setShowCustomKitModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveCustomKit}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-md transition"
              >
                Save Branding Kit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BRANDING KIT PREVIEW & APPLICATION MODAL (4 MODES) */}
      {previewModalKit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-gray-900 uppercase tracking-tight">
                    {previewModalKit.short_name || previewModalKit.name}
                  </h3>
                  {previewModalKit.is_verified ? (
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      ✓ Officially Verified Kit
                    </span>
                  ) : (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Candidate / Discovered Kit
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{previewModalKit.name}</p>
                {previewModalKit.location && (
                  <p className="text-[11px] text-gray-400">📍 {previewModalKit.location}</p>
                )}
              </div>
              <button onClick={() => setPreviewModalKit(null)} className="text-gray-400 hover:text-gray-700 font-bold text-xl">✕</button>
            </div>

            {/* Asset Previews Grid */}
            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-xl border">
              {/* Logo Preview with checkerboard background */}
              <div className="text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Official Logo</span>
                <div className="w-24 h-24 mx-auto rounded-lg border bg-white flex items-center justify-center p-2 shadow-xs bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px]">
                  {previewModalKit.logo_url ? (
                    <img src={previewModalKit.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400 font-mono">No Logo</span>
                  )}
                </div>
              </div>

              {/* Partner Badge */}
              <div className="text-center">
                <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Accreditation Badge</span>
                <div className="w-24 h-24 mx-auto rounded-lg border bg-white flex items-center justify-center p-2 shadow-xs bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px]">
                  {previewModalKit.badge_url ? (
                    <img src={previewModalKit.badge_url} alt="Badge" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-gray-400 font-mono">None</span>
                  )}
                </div>
              </div>

              {/* Brand Typography & Borders */}
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Recommended Font</span>
                  <span className="font-bold text-gray-800 text-xs">{previewModalKit.preferred_font || 'Inter'}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Recommended Frame</span>
                  <span className="font-bold text-gray-800 text-xs">{previewModalKit.recommended_border || 'Academic Double'}</span>
                </div>
                {previewModalKit.website && (
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Official Website</span>
                    <a href={previewModalKit.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-[11px] truncate block">
                      {previewModalKit.website}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Brand Color Palette Swatches with Source Indicators */}
            <div>
              <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">
                Official Color Palette & Source Verification
              </span>
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 border rounded-lg bg-gray-50 text-center">
                  <div className="w-full h-7 rounded mb-1 border shadow-xs" style={{ backgroundColor: previewModalKit.primary_color }} />
                  <span className="text-[10px] font-bold block text-gray-800">Primary</span>
                  <span className="text-[8.5px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-mono font-medium block mt-0.5">
                    Published
                  </span>
                </div>
                <div className="p-2 border rounded-lg bg-gray-50 text-center">
                  <div className="w-full h-7 rounded mb-1 border shadow-xs" style={{ backgroundColor: previewModalKit.secondary_color }} />
                  <span className="text-[10px] font-bold block text-gray-800">Secondary</span>
                  <span className="text-[8.5px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-mono font-medium block mt-0.5">
                    Published
                  </span>
                </div>
                <div className="p-2 border rounded-lg bg-gray-50 text-center">
                  <div className="w-full h-7 rounded mb-1 border shadow-xs" style={{ backgroundColor: previewModalKit.accent_color }} />
                  <span className="text-[10px] font-bold block text-gray-800">Accent</span>
                  <span className="text-[8.5px] text-blue-700 bg-blue-50 px-1 py-0.2 rounded font-mono font-medium block mt-0.5">
                    AI Suggested
                  </span>
                </div>
                <div className="p-2 border rounded-lg bg-gray-50 text-center">
                  <div className="w-full h-7 rounded mb-1 border shadow-xs" style={{ backgroundColor: previewModalKit.dark_bg }} />
                  <span className="text-[10px] font-bold block text-gray-800">Dark BG</span>
                  <span className="text-[8.5px] text-blue-700 bg-blue-50 px-1 py-0.2 rounded font-mono font-medium block mt-0.5">
                    AI Suggested
                  </span>
                </div>
              </div>
            </div>

            {/* Official Signoff Notice Preview */}
            {previewModalKit.signoff_text && (
              <div className="p-2.5 bg-gray-50 rounded-lg border text-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Official Signoff Notice Preview</span>
                <pre className="text-[10.5px] text-gray-700 font-sans whitespace-pre-wrap leading-relaxed">{previewModalKit.signoff_text}</pre>
              </div>
            )}

            {/* Non-Destructive Preservation Guarantee Notice */}
            <div className="bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-[11px] text-blue-800">
              <span className="font-bold">✓ Non-Destructive Layer Guarantee: </span>
              Applying this branding kit preserves your event title, dates, venue, prize pool, QR code, and custom backgrounds. All elements remain 100% editable.
            </div>

            {/* 4 Distinct Application Options */}
            <div className="pt-2 border-t space-y-2">
              <span className="text-[10px] font-bold text-gray-600 uppercase block">Choose Application Mode:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => applyKitLogoOnly(previewModalKit)}
                  className="p-3 border rounded-xl bg-white hover:bg-gray-50 hover:border-gray-400 text-left transition shadow-xs flex flex-col justify-between"
                >
                  <span className="text-xs font-bold text-gray-900 block mb-0.5">OPTION A: Logo Only</span>
                  <span className="text-[10px] text-gray-500 block">Adds official high-res logo without modifying any colors or fonts.</span>
                </button>
                <button
                  onClick={() => applyKitLogoAndColors(previewModalKit)}
                  className="p-3 border rounded-xl bg-blue-50/60 hover:bg-blue-100 hover:border-blue-300 text-left transition shadow-xs flex flex-col justify-between"
                >
                  <span className="text-xs font-bold text-blue-900 block mb-0.5">OPTION B: Branding Colors</span>
                  <span className="text-[10px] text-blue-700 block">Applies official brand palette to headings, borders & atmospheric glow.</span>
                </button>
                <button
                  onClick={() => applyKitComplete(previewModalKit)}
                  className="p-3 border rounded-xl bg-indigo-50/60 hover:bg-indigo-100 hover:border-indigo-300 text-left transition shadow-xs flex flex-col justify-between"
                >
                  <span className="text-xs font-bold text-indigo-900 block mb-0.5">OPTION C: Complete Kit</span>
                  <span className="text-[10px] text-indigo-700 block">Applies Logo, Header, Department, Partner Badge, Signoff & Palette.</span>
                </button>
                <button
                  onClick={() => applyKitThemeAndLayout(previewModalKit)}
                  className="p-3 border-2 border-blue-600 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-left transition shadow-md flex flex-col justify-between"
                >
                  <span className="text-xs font-bold block mb-0.5">OPTION D: Institutional Template</span>
                  <span className="text-[10px] text-blue-100 block">Full formal academic layout with recommended border & typography.</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setPreviewModalKit(null)}
                className="px-4 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIC BRANDING DISCOVERY & DRAFT REVIEW MODAL */}
      {discoveryModalState && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 uppercase">
                  Automated Branding Discovery
                </h3>
                <p className="text-xs text-gray-500">{discoveryModalState.institution.official_name}</p>
              </div>
              {!discoveryModalState.isDiscovering && (
                <button onClick={() => setDiscoveryModalState(null)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
              )}
            </div>

            {discoveryModalState.isDiscovering ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                <div className="space-y-1">
                  <h4 className="text-sm font-black text-gray-800">Scanning Institutional Portal & Registry...</h4>
                  <p className="text-xs text-gray-500">
                    Inspecting official domain <span className="font-mono text-blue-600">{discoveryModalState.institution.website || 'Official Registry'}</span> for verified logos and color signatures.
                  </p>
                </div>
              </div>
            ) : discoveryModalState.error ? (
              <div className="space-y-3 py-4">
                <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs border border-red-200">
                  <span className="font-bold">Discovery Notice: </span>
                  {discoveryModalState.error}
                </div>
                <p className="text-xs text-gray-600">
                  You can still manually upload the institution's official logo and customize the palette:
                </p>
                <button
                  onClick={() => {
                    const inst = discoveryModalState.institution;
                    setDiscoveryModalState(null);
                    setKitForm({
                      name: inst.official_name,
                      short_name: inst.code,
                      institution_type: inst.institution_type,
                      location: `${inst.city}, ${inst.state}`,
                      website: inst.website || ''
                    });
                    setShowCustomKitModal(true);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg text-xs shadow-xs transition"
                >
                  Create Branding Kit Manually
                </button>
              </div>
            ) : discoveryModalState.result && (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                  <span className="text-base">✓</span>
                  <div>
                    <span className="font-bold">Draft Kit Created! </span>
                    Assets collected from official domain & regulatory registry.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Discovered Insignia</span>
                    <div className="w-20 h-20 mx-auto rounded-lg border bg-white p-2 flex items-center justify-center shadow-xs">
                      <img src={discoveryModalState.result.candidate_logo_url} alt="Discovered Emblem" className="max-w-full max-h-full object-contain" />
                    </div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Extracted Palette</span>
                      <div className="flex gap-1.5 mt-1">
                        {discoveryModalState.result.extracted_colors.map((c, i) => (
                          <span key={i} className="w-5 h-5 rounded-full border shadow-xs" style={{ backgroundColor: c.hex }} title={`${c.label} (${c.source})`} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Recommended Font</span>
                      <span className="font-bold text-gray-800">{discoveryModalState.result.recommended_font}</span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-500 uppercase block">Source</span>
                      <span className="text-[10px] text-gray-500 truncate block">{discoveryModalState.result.discovery_source}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <button 
                    onClick={() => setDiscoveryModalState(null)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => handleSaveDiscoveredKit(discoveryModalState.result!.draft_kit)}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs shadow-md transition"
                  >
                    Review & Apply Kit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* INDIA-WIDE INSTITUTION DIRECTORY EXPLORER MODAL */}
      {showDirectoryModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto flex flex-col">
            <div className="flex justify-between items-start border-b pb-3 shrink-0">
              <div>
                <h3 className="text-lg font-black text-gray-900 uppercase flex items-center gap-2">
                  <span>🏛️ India-Wide Educational Institutions Directory</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-bold">34+ Recognized Colleges</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Search authorized engineering colleges, medical institutes, universities, management schools, and polytechnics across India.
                </p>
              </div>
              <button onClick={() => setShowDirectoryModal(false)} className="text-gray-400 hover:text-gray-700 font-bold text-xl">✕</button>
            </div>

            {/* Modal Filters */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <input 
                type="text" 
                placeholder="Search college name, code (e.g. TKRCET, IIT, Vignan)..."
                className="w-full border rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                value={institutionSearch}
                onChange={e => setInstitutionSearch(e.target.value)}
              />
              <select 
                value={instState}
                onChange={e => setInstState(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="All">All Indian States</option>
                <option value="Telangana">Telangana</option>
                <option value="Andhra Pradesh">Andhra Pradesh</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Delhi">Delhi / NCR</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Uttar Pradesh">Uttar Pradesh</option>
                <option value="Kerala">Kerala</option>
                <option value="Gujarat">Gujarat</option>
              </select>
              <select 
                value={instCategory}
                onChange={e => setInstCategory(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-xs bg-white"
              >
                <option value="All">All Disciplines & Categories</option>
                <option value="Engineering">Engineering Colleges</option>
                <option value="University">Universities</option>
                <option value="Medical">Medical Institutes & Hospitals</option>
                <option value="Management">Management Institutes (IIMs & B-Schools)</option>
                <option value="Polytechnic">Polytechnics</option>
                <option value="School">Schools (K-12)</option>
              </select>
            </div>

            {/* Institutions Grid */}
            <div className="grid grid-cols-2 gap-3 overflow-y-auto flex-1 pr-1">
              {institutionsLoading ? (
                <div className="col-span-2 py-12 text-center text-gray-400 text-xs animate-pulse">
                  Querying database directory...
                </div>
              ) : institutions.length === 0 ? (
                <div className="col-span-2 py-12 text-center text-gray-400 text-xs">
                  No institutions matched your query.
                </div>
              ) : (
                institutions.map(inst => (
                  <div key={inst.id} className="border rounded-xl p-3 bg-white shadow-xs hover:border-blue-400 transition flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[9px] font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                          {inst.code}
                        </span>
                        <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                          {inst.category}
                        </span>
                      </div>
                      <h4 className="text-xs font-black text-gray-900 mt-1 leading-snug">{inst.official_name}</h4>
                      <p className="text-[10px] text-gray-500">📍 {inst.city}, {inst.state}</p>

                      {/* Recognitions */}
                      {inst.recognition_summary.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {inst.recognition_summary.map((rec, i) => (
                            <span key={i} className="text-[8px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded border border-emerald-100 font-medium">
                              ✓ {rec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 mt-2 border-t text-[10px]">
                      {inst.website ? (
                        <a href={inst.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-600 text-[9px]">
                          Official Website ↗
                        </a>
                      ) : <span />}
                      <div>
                        {inst.has_branding_kit ? (
                          <button
                            onClick={async () => {
                              setShowDirectoryModal(false);
                              if (inst.branding_kit_id) {
                                try {
                                  const res = await axios.get(`/api/branding-kits/${inst.branding_kit_id}`);
                                  setPreviewModalKit(res.data);
                                } catch (e) {
                                  const fallback = institutionKits.find(k => k.id === inst.branding_kit_id);
                                  if (fallback) setPreviewModalKit(fallback);
                                }
                              }
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-xs transition"
                          >
                            Preview & Apply Kit
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setShowDirectoryModal(false);
                              handleRunDiscovery(inst);
                            }}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded font-bold text-xs shadow-xs transition flex items-center gap-1"
                          >
                            <span>⚡ Auto-Discover Kit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t shrink-0">
              <span className="text-xs text-gray-500">Showing {institutions.length} institutions across India</span>
              <button 
                onClick={() => setShowDirectoryModal(false)}
                className="px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition"
              >
                Close Directory
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HD POSTER EXPORT & RESOLUTION MODAL */}
      {showHdExportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <span>⬇️ High-Definition Export</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase">Ultra Crisp</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Export high-resolution uncompressed poster ready for print & digital</p>
              </div>
              <button onClick={() => setShowHdExportModal(false)} className="text-gray-400 hover:text-gray-700 text-lg font-bold">✕</button>
            </div>

            {/* Resolution Quality Options */}
            <div className="space-y-2">
              <label className="block text-[11px] font-bold text-gray-700 uppercase">Export Resolution</label>
              
              <div className="space-y-2">
                {[
                  {
                    scale: 2,
                    tag: 'HD (2x Resolution)',
                    dimensions: `${canvasConfig.width * 2} × ${canvasConfig.height * 2} px`,
                    desc: 'Crisp & sharp. Ideal for Instagram, WhatsApp, LinkedIn & web displays.'
                  },
                  {
                    scale: 3,
                    tag: 'Ultra HD 4K (3x Resolution)',
                    dimensions: `${canvasConfig.width * 3} × ${canvasConfig.height * 3} px`,
                    desc: 'Crystal-clear 4K fidelity. Perfect for large screens, presentations & TV displays.'
                  },
                  {
                    scale: 4,
                    tag: 'Print HD 300 DPI (4x Resolution)',
                    dimensions: `${canvasConfig.width * 4} × ${canvasConfig.height * 4} px`,
                    desc: 'Maximum print shop fidelity (300 DPI equivalent). Optimal for physical banners & offset printing.'
                  }
                ].map(opt => (
                  <div
                    key={opt.scale}
                    onClick={() => setHdScale(opt.scale)}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition flex items-start justify-between ${hdScale === opt.scale ? 'border-emerald-500 bg-emerald-50/50 shadow-xs' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-xs text-gray-900">{opt.tag}</span>
                        <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-bold">{opt.dimensions}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{opt.desc}</p>
                    </div>
                    <input
                      type="radio"
                      name="hdScale"
                      checked={hdScale === opt.scale}
                      onChange={() => setHdScale(opt.scale)}
                      className="mt-1 text-emerald-600 focus:ring-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Format Selection */}
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1.5">File Format</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHdFormat('png')}
                  className={`p-2.5 rounded-xl border text-center transition ${hdFormat === 'png' ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-gray-200 hover:bg-gray-50 text-gray-700 text-xs'}`}
                >
                  <span className="block text-xs font-black">PNG (Lossless)</span>
                  <span className="block text-[10px] text-gray-500">Pure pixel clarity, transparent alpha</span>
                </button>
                <button
                  type="button"
                  onClick={() => setHdFormat('jpeg')}
                  className={`p-2.5 rounded-xl border text-center transition ${hdFormat === 'jpeg' ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold' : 'border-gray-200 hover:bg-gray-50 text-gray-700 text-xs'}`}
                >
                  <span className="block text-xs font-black">JPEG (95% Quality)</span>
                  <span className="block text-[10px] text-gray-500">Compact file size, vivid photos</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <button
                onClick={() => setShowHdExportModal(false)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDownloadHD(hdFormat, hdScale)}
                disabled={downloadingHD}
                className="flex-2 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-black shadow-lg transition flex items-center justify-center gap-2"
              >
                {downloadingHD ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Rendering {hdScale}x High-Definition...</span>
                  </>
                ) : (
                  <>
                    <span>⬇️ Download {hdScale === 4 ? 'Print 300 DPI' : hdScale === 3 ? '4K Ultra HD' : 'HD (2x)'} Now</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
