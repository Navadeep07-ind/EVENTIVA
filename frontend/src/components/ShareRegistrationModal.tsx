import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Copy, 
  Check, 
  Share2, 
  QrCode, 
  Download, 
  Code2, 
  ExternalLink,
  MessageCircle,
  Send,
  Mail,
  Sparkles,
  Globe,
  FileText
} from 'lucide-react';

interface ShareRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: {
    id: number | string;
    title: string;
    category?: string;
    venue?: string;
    status?: string;
  } | null;
}

// 100% Reliable multi-tier clipboard helper (works on HTTP, HTTPS, WebViews, iframes)
export async function copyToClipboard(text: string): Promise<boolean> {
  // 1. Modern Async Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard failed, trying fallback:', err);
    }
  }

  // 2. Fallback to execCommand('copy') with invisible textarea
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.width = '2em';
    textArea.style.height = '2em';
    textArea.style.padding = '0';
    textArea.style.border = 'none';
    textArea.style.outline = 'none';
    textArea.style.boxShadow = 'none';
    textArea.style.background = 'transparent';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.warn('execCommand copy failed:', err);
  }

  // 3. Fallback prompt
  try {
    window.prompt('Copy this registration link (Ctrl+C, Enter):', text);
    return true;
  } catch (err) {
    return false;
  }
}

export default function ShareRegistrationModal({ isOpen, onClose, event }: ShareRegistrationModalProps) {
  // --- ALL HOOKS MUST BE UNCONDITIONALLY DECLARED AT THE TOP (Rules of Hooks) ---
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [activeTab, setActiveTab] = useState<'link' | 'qr' | 'embed'>('link');
  const [directToForm, setDirectToForm] = useState(true);
  const [usePublicHost, setUsePublicHost] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Close on Escape key (always hook, conditionally execute)
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Determine current origin vs public tunnel
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1' || 
    window.location.hostname.startsWith('192.168.') ||
    window.location.hostname.startsWith('10.')
  );

  // Known public ngrok tunnel
  const publicTunnelOrigin = 'https://unubiquitous-mariah-detachable.ngrok-free.dev';
  const activeOrigin = (usePublicHost && isLocalhost) ? publicTunnelOrigin : currentOrigin;

  const eventId = event?.id || '';
  const eventTitle = event?.title || 'Event';
  const eventVenue = event?.venue || 'Venue TBA';

  const registrationUrl = directToForm 
    ? `${activeOrigin}/events/${eventId}#register` 
    : `${activeOrigin}/events/${eventId}`;

  const shareText = `Register now for "${eventTitle}" on EVENTIVA! Fill out the registration form here: ${registrationUrl}`;

  // Generate QR Code (always hook, conditionally execute)
  useEffect(() => {
    if (!isOpen || !event) return;
    if (qrCanvasRef.current) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        registrationUrl,
        {
          width: 200,
          margin: 1.5,
          color: {
            dark: '#1e1b4b',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('QR rendering error:', err);
        }
      );
    }
  }, [isOpen, event, activeTab, registrationUrl]);

  // Safe early exit AFTER all hooks are declared
  if (!isOpen || !event) return null;

  const handleCopyLink = async () => {
    const success = await copyToClipboard(registrationUrl);
    if (success) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyMessage = async () => {
    const success = await copyToClipboard(shareText);
    if (success) {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  const handleCopyEmbed = async () => {
    const embedCode = `<a href="${registrationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;background:#6366f1;color:#ffffff;padding:10px 20px;border-radius:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:14px;text-decoration:none;box-shadow:0 4px 6px -1px rgba(99,102,241,0.3);">Register for ${eventTitle} &rarr;</a>`;
    const success = await copyToClipboard(embedCode);
    if (success) {
      setCopiedEmbed(true);
      setTimeout(() => setCopiedEmbed(false), 2000);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCanvasRef.current) return;
    try {
      const canvas = qrCanvasRef.current;
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-${event.id}-registration-qr.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download QR failed:', err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Register for ${eventTitle}`,
          text: `Register for ${eventTitle} on EVENTIVA`,
          url: registrationUrl
        });
      } catch (err) {
        // User cancelled or share dismissed
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 my-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-900 p-5 sm:p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="p-1.5 rounded-lg bg-white/15 backdrop-blur-md">
              <Share2 className="w-4 h-4 text-white" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">
              Shareable Registration Form
            </span>
          </div>

          <h3 className="text-lg sm:text-2xl font-black text-white leading-tight pr-6">
            {eventTitle}
          </h3>
          <p className="text-xs text-indigo-200 mt-1 flex items-center gap-2 flex-wrap">
            <span>📍 {eventVenue}</span>
            {event.category && <span>• {event.category}</span>}
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 bg-gray-50/70 px-4 sm:px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'link'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Share2 className="w-4 h-4" />
            Share Link & Apps
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('qr')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'qr'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <QrCode className="w-4 h-4" />
            Registration QR
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('embed')}
            className={`pb-3 px-3 text-xs sm:text-sm font-bold border-b-2 transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'embed'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Website Embed
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* TAB 1: SHARE LINK & SOCIAL */}
          {activeTab === 'link' && (
            <div className="space-y-4">
              {/* Localhost / Public URL Switcher Hint */}
              {isLocalhost && (
                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                      <Globe className="w-3.5 h-3.5 text-amber-600" />
                      Sharing with people on other devices or phones?
                    </span>
                    <button
                      type="button"
                      onClick={() => setUsePublicHost(!usePublicHost)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer ${
                        usePublicHost
                          ? 'bg-amber-600 text-white'
                          : 'bg-white text-amber-800 border border-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {usePublicHost ? 'Using Public Tunnel ✓' : 'Use Public Tunnel'}
                    </button>
                  </div>
                  <p className="text-[10px] text-amber-700 mt-1">
                    {usePublicHost 
                      ? 'The link below uses the public ngrok tunnel URL so anyone outside your computer can open it!'
                      : 'Localhost links only open on this computer. Click "Use Public Tunnel" if sending via WhatsApp/mobile.'}
                  </p>
                </div>
              )}

              {/* Destination Toggle */}
              <div className="flex items-center justify-between bg-indigo-50/60 p-2.5 sm:p-3 rounded-xl border border-indigo-100">
                <span className="text-xs font-semibold text-gray-700">
                  Direct to Registration Form Anchor (#register)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={directToForm}
                    onChange={(e) => setDirectToForm(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* URL Display and 1-Click Copy */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">
                  Registration URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={registrationUrl}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="flex-1 text-xs sm:text-sm font-mono bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3.5 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-xs cursor-pointer flex-shrink-0 ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Copy Full Message Button */}
              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-bold transition shadow-xs cursor-pointer ${
                    copiedMessage
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : 'bg-white hover:bg-gray-50 text-gray-800 border-gray-200'
                  }`}
                >
                  {copiedMessage ? <Check className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-indigo-600" />}
                  {copiedMessage ? 'Invite Message Copied!' : 'Copy Form Invitation Text'}
                </button>

                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    type="button"
                    onClick={handleNativeShare}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-bold text-xs transition shadow-xs cursor-pointer"
                  >
                    <Share2 className="w-4 h-4" />
                    Share Sheet
                  </button>
                )}
              </div>

              {/* Social Quick Share Grid */}
              <div>
                <label className="block text-[11px] font-bold text-gray-500 mb-2 uppercase tracking-wider">
                  One-Click App Sharing
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* WhatsApp (Universal wa.me) */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    WhatsApp
                  </a>

                  {/* WhatsApp Web Direct */}
                  <a
                    href={`https://web.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-100/70 hover:bg-emerald-200/70 text-emerald-900 border border-emerald-300 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    WhatsApp Web
                  </a>

                  {/* Telegram */}
                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(registrationUrl)}&text=${encodeURIComponent(`Register for ${eventTitle} on EVENTIVA`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Send className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    Telegram
                  </a>

                  {/* Twitter / X */}
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Register for ${eventTitle} on EVENTIVA!`)}&url=${encodeURIComponent(registrationUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-200 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-gray-800 fill-current flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    X / Twitter
                  </a>

                  {/* LinkedIn */}
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(registrationUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5 text-blue-600 fill-current flex-shrink-0" viewBox="0 0 24 24">
                      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45c-.96 0-1.74.78-1.74 1.74 0 .96.78 1.74 1.74 1.74.96 0 1.74-.78 1.74-1.74 0-.96-.78-1.74-1.74-1.74Z"/>
                    </svg>
                    LinkedIn
                  </a>

                  {/* Email */}
                  <a
                    href={`mailto:?subject=${encodeURIComponent(`Registration Form: ${eventTitle}`)}&body=${encodeURIComponent(shareText)}`}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Mail className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    Email
                  </a>
                </div>
              </div>

              {/* Direct Open in New Tab */}
              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <a
                  href={registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Test Open Registration Form in New Tab &rarr;
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: REGISTRATION QR CODE */}
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4">
              <p className="text-xs text-gray-500 max-w-sm">
                Display or print this QR code at booths, presentations, or on posters so attendees can scan and register immediately.
              </p>

              <div className="bg-white p-4 rounded-2xl border-2 border-indigo-100 shadow-md flex flex-col items-center">
                <canvas ref={qrCanvasRef} className="rounded-lg" />
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-widest mt-2 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Scan to Register
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 max-w-[200px] truncate">
                  {eventTitle}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 justify-center w-full">
                <button
                  type="button"
                  onClick={handleDownloadQR}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Download QR Code (.png)
                </button>

                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm border border-gray-200 transition cursor-pointer"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedLink ? 'Copied Link!' : 'Copy Form Link'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: WEBSITE EMBED SNIPPET */}
          {activeTab === 'embed' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Paste this HTML button directly into your college, company, or personal website to allow visitors to register with one click.
              </p>

              <div className="bg-gray-900 rounded-xl p-4 text-left">
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-800">
                  <span className="text-[11px] font-mono text-gray-400">HTML Registration Button</span>
                  <button
                    type="button"
                    onClick={handleCopyEmbed}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-1 transition cursor-pointer"
                  >
                    {copiedEmbed ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedEmbed ? 'Copied Snippet!' : 'Copy Snippet'}
                  </button>
                </div>
                <pre className="text-xs font-mono text-emerald-400 whitespace-pre-wrap break-all select-all">
                  {`<a href="${registrationUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;background:#6366f1;color:#ffffff;padding:10px 20px;border-radius:10px;font-family:system-ui,-apple-system,sans-serif;font-weight:600;font-size:14px;text-decoration:none;box-shadow:0 4px 6px -1px rgba(99,102,241,0.3);">Register for ${eventTitle} &rarr;</a>`}
                </pre>
              </div>

              {/* Preview */}
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-center">
                <span className="block text-[10px] uppercase font-bold text-gray-400 mb-2">Live Button Preview</span>
                <a
                  href={registrationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm py-2.5 px-5 rounded-xl shadow-xs transition"
                >
                  Register for {eventTitle} &rarr;
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span className="truncate max-w-[200px]">EVENTIVA • Public Registration Form</span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
