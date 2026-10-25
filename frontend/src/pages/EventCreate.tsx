import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Sparkles, 
  Upload, 
  Share2, 
  Copy, 
  Check, 
  Link2, 
  CheckCircle, 
  ArrowRight, 
  ExternalLink 
} from 'lucide-react';
import ShareRegistrationModal, { copyToClipboard } from '../components/ShareRegistrationModal';

export default function EventCreate() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    venue: '',
    max_participants: '',
    min_team_size: '1',
    max_team_size: '1',
    registration_mode: 'individual',
    registration_start_date: '',
    registration_deadline: '',
    status: 'Published',
    poster_url: '',
    form_schema: [] as any[]
  });
  const [selectedPosterOption, setSelectedPosterOption] = useState<'none' | 'ai' | 'upload'>('none');
  const [uploadedPosterMeta, setUploadedPosterMeta] = useState<{
    url: string;
    filename: string;
    width?: number;
    height?: number;
    aspect_ratio?: number;
    size?: number;
  } | null>(null);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [createdEvent, setCreatedEvent] = useState<any | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const posterFileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handlePosterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setIsUploadingPoster(true);
    const data = new FormData();
    data.append('file', file);

    try {
      const res = await axios.post('/api/posters/upload-image', data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const meta = res.data;
      setUploadedPosterMeta(meta);
      setFormData(prev => ({ ...prev, poster_url: meta.url }));
      setSelectedPosterOption('upload');
    } catch (err: any) {
      alert('Failed to upload poster: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploadingPoster(false);
      if (posterFileInputRef.current) posterFileInputRef.current.value = '';
    }
  };

  const handleAIGeneration = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    const file = e?.target?.files?.[0];
    if (!file && !aiPrompt) return;

    setIsGenerating(true);
    const token = localStorage.getItem('token');
    const data = new FormData();
    if (file) data.append('file', file);
    if (aiPrompt) data.append('text', aiPrompt);

    try {
      const res = await axios.post('/api/ai/generate-event', data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      const evt = res.data;
      setFormData(prev => ({
        ...prev,
        title: evt.title || prev.title,
        description: evt.description || prev.description,
        category: evt.category || prev.category,
        venue: evt.venue || prev.venue,
        min_team_size: evt.min_team_size ? String(evt.min_team_size) : prev.min_team_size,
        max_team_size: evt.max_team_size ? String(evt.max_team_size) : prev.max_team_size,
        max_participants: evt.max_participants ? String(evt.max_participants) : prev.max_participants,
        registration_start_date: evt.registration_start_date ? evt.registration_start_date.substring(0, 16) : prev.registration_start_date,
        registration_deadline: evt.registration_deadline ? evt.registration_deadline.substring(0, 16) : prev.registration_deadline,
        form_schema: evt.form_schema || prev.form_schema
      }));
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to generate event.');
    } finally {
      setIsGenerating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        min_team_size: parseInt(formData.min_team_size) || 1,
        max_team_size: parseInt(formData.max_team_size) || 1,
        registration_start_date: formData.registration_start_date ? new Date(formData.registration_start_date).toISOString() : null,
        registration_deadline: formData.registration_deadline ? new Date(formData.registration_deadline).toISOString() : null
      };
      const res = await axios.post('/api/events', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCreatedEvent(res.data);
    } catch (err) {
      console.error(err);
      alert('Failed to create event');
    }
  };

  if (createdEvent) {
    const regUrl = `${window.location.origin}/events/${createdEvent.id}#register`;
    return (
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-2xl shadow-lg border border-gray-100 text-center animate-in fade-in duration-300">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-xs">
          <CheckCircle className="w-8 h-8" />
        </div>
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Published & Live
        </span>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mt-3 mb-2">
          Event Created Successfully!
        </h2>
        <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
          <strong className="text-gray-900">"{createdEvent.title}"</strong> is now live and accepting registrations. Share your registration form with participants now!
        </p>

        {/* Shareable Registration Link Box */}
        <div className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-5 text-left mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
              <Link2 className="w-4 h-4 text-indigo-600" /> Shareable Registration Link
            </span>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">
              Ready to Share
            </span>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <input
              type="text"
              readOnly
              value={regUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 text-xs sm:text-sm font-mono bg-white border border-indigo-200 rounded-xl px-3.5 py-2.5 text-indigo-950 focus:outline-none"
            />
            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(regUrl);
                if (ok) {
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }}
              className="px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition shadow-xs flex-shrink-0 cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4" />}
              {copiedLink ? 'Copied!' : 'Copy Link'}
            </button>
          </div>

          <div className="mt-4 pt-3 border-t border-indigo-100 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-gray-500">
              Need WhatsApp, QR Code, or website embed?
            </span>
            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-900"
            >
              <Share2 className="w-3.5 h-3.5" />
              Open All Share Options & QR Code &rarr;
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={`/events/${createdEvent.id}`}
            target="_blank"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs sm:text-sm border border-gray-200 transition"
          >
            <ExternalLink className="w-4 h-4 text-gray-600" />
            View Registration Page
          </Link>
          <Link
            to={`/dashboard/events/${createdEvent.id}/participants`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm transition shadow-xs"
          >
            Go to Attendee Hub
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to="/dashboard/events"
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-gray-600 hover:text-gray-900 font-bold text-xs sm:text-sm transition"
          >
            My Events List
          </Link>
        </div>

        <ShareRegistrationModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          event={createdEvent}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Event</h2>

      {/* AI EVENT ASSISTANT */}
      <div className="bg-purple-50 border border-indigo-100 p-6 rounded-xl mb-8">
        <h3 className="text-lg font-semibold text-indigo-900 flex items-center mb-4">
          <Sparkles className="w-5 h-5 mr-2" />
          AI Event Creation Assistant
        </h3>
        <p className="text-sm text-[var(--color-primary-hover)] mb-4">
          Describe your event or upload a poster, and AI will automatically fill out all details and build your custom registration form!
        </p>
        <div className="space-y-4">
          <textarea 
            rows={3} 
            value={aiPrompt}
            onChange={e => setAiPrompt(e.target.value)}
            className="block w-full border border-indigo-200 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm"
            placeholder="E.g., A 48-hour Web3 hackathon called ChainCraft next weekend in the main auditorium. Max 200 participants, teams of 2 to 4. We need to ask for their GitHub profile and dietary restrictions."
          />
          <div className="flex items-center space-x-4">
            <input type="file" ref={fileInputRef} onChange={handleAIGeneration} accept=".pdf,.txt,.md,.png,.jpg,.jpeg" className="hidden" />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              disabled={isGenerating} 
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
            >
              <Upload className="w-4 h-4 mr-2" /> Upload Poster & Generate
            </button>
            <button 
              type="button" 
              onClick={() => handleAIGeneration()} 
              disabled={isGenerating || !aiPrompt} 
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50"
            >
              {isGenerating ? <span className="animate-pulse">Generating...</span> : 'Generate from Text'}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Event Title</label>
          <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea rows={8} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm font-mono text-sm" placeholder="Markdown supported..." />
        </div>

        {/* ================================================== */}
        {/* POSTER CREATION & UPLOAD SYSTEM (OPTIONAL)        */}
        {/* ================================================== */}
        <div className="bg-gray-50/70 border border-gray-200 p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <span>🎨 Event Poster</span>
                <span className="text-[10px] bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-full lowercase">optional</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Choose how you want to design your poster, upload your own existing design, or skip for now.
              </p>
            </div>
            {formData.poster_url && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span>✓ Poster Attached</span>
              </span>
            )}
          </div>

          {/* 2 Clear Choice Option Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* OPTION A: Generate with AI */}
            <div 
              onClick={() => setSelectedPosterOption('ai')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${selectedPosterOption === 'ai' ? 'border-blue-600 bg-blue-50/50 shadow-xs' : 'border-gray-200 bg-white hover:border-blue-300'}`}
            >
              <div>
                <span className="text-2xl mb-1.5 block">✨</span>
                <h4 className="text-xs font-bold text-gray-900">Option A: Generate with AI</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                  Create a new poster using event details & visual style themes in the Universal AI Studio.
                </p>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/dashboard/poster-generator?title=${encodeURIComponent(formData.title)}&desc=${encodeURIComponent(formData.description)}`);
                }}
                className="mt-3.5 w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>✨</span>
                <span>Open AI Studio →</span>
              </button>
            </div>

            {/* OPTION B: Upload Existing Poster */}
            <div 
              onClick={() => {
                setSelectedPosterOption('upload');
                if (!uploadedPosterMeta) posterFileInputRef.current?.click();
              }}
              className={`p-4 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between ${selectedPosterOption === 'upload' ? 'border-emerald-600 bg-emerald-50/50 shadow-xs' : 'border-gray-200 bg-white hover:border-emerald-300'}`}
            >
              <div>
                <span className="text-2xl mb-1.5 block">📤</span>
                <h4 className="text-xs font-bold text-gray-900">Option B: Upload Existing Poster</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                  Already designed your poster? Upload PNG, JPG, or WEBP directly to attach or edit.
                </p>
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  posterFileInputRef.current?.click();
                }}
                className="mt-3.5 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2 rounded-lg transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>📤</span>
                <span>{uploadedPosterMeta ? 'Change Image' : 'Select Poster File'}</span>
              </button>
            </div>
          </div>

          <input 
            type="file" 
            ref={posterFileInputRef} 
            onChange={handlePosterUpload} 
            accept="image/png,image/jpeg,image/webp" 
            className="hidden" 
          />

          {/* UPLOAD PROGRESS & PREVIEW CARD */}
          {isUploadingPoster && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <span className="text-xs font-bold text-gray-700 animate-pulse">Uploading & detecting image dimensions...</span>
            </div>
          )}

          {uploadedPosterMeta && !isUploadingPoster && (
            <div className="bg-white border-2 border-emerald-300 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-24 h-32 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative">
                  <img 
                    src={uploadedPosterMeta.url} 
                    alt="Uploaded Poster" 
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="flex-1 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-sm">{uploadedPosterMeta.filename}</span>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ✓ Ready
                    </span>
                  </div>
                  <p className="text-gray-500 text-[11px]">
                    Dimensions: <strong className="text-gray-800">{uploadedPosterMeta.width || 800} × {uploadedPosterMeta.height || 1131} px</strong>
                    {uploadedPosterMeta.aspect_ratio && ` • Aspect Ratio: ${uploadedPosterMeta.aspect_ratio}`}
                    {uploadedPosterMeta.size && ` • Size: ${Math.round(uploadedPosterMeta.size / 1024)} KB`}
                  </p>
                  <p className="text-gray-600 text-[11px]">
                    Preserved in high fidelity. You can use it as-is for registration or customize it in Poster Studio.
                  </p>

                  {/* 5 Required Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({ ...prev, poster_url: uploadedPosterMeta.url }));
                        alert('This image will be used as the official event poster.');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
                    >
                      ✓ Use as Poster
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        navigate(`/dashboard/poster-generator?posterUrl=${encodeURIComponent(uploadedPosterMeta.url)}&title=${encodeURIComponent(formData.title || 'Event')}`);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
                    >
                      ✏️ Edit Poster
                    </button>
                    <button 
                      type="button"
                      onClick={() => posterFileInputRef.current?.click()}
                      className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                    >
                      🔄 Replace Image
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (confirm('Remove this poster from draft?')) {
                          setUploadedPosterMeta(null);
                          setFormData(prev => ({ ...prev, poster_url: '' }));
                          setSelectedPosterOption('none');
                        }
                      }}
                      className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                    >
                      ✕ Remove Poster
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        navigate(`/dashboard/poster-generator?title=${encodeURIComponent(formData.title)}&desc=${encodeURIComponent(formData.description)}`);
                      }}
                      className="bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold px-3 py-1.5 rounded-lg text-xs transition ml-auto"
                    >
                      ✨ Generate New Poster
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Category</label>
            <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Venue / Meeting Link</label>
            <input type="text" value={formData.venue} onChange={e => setFormData({...formData, venue: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Maximum Participants</label>
            <input type="number" value={formData.max_participants} onChange={e => setFormData({...formData, max_participants: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" placeholder="Leave blank for unlimited" />
          </div>
          <div className="sm:col-span-2 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
            <label className="block text-sm font-bold text-gray-900 mb-2">Registration Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, registration_mode: 'individual', min_team_size: '1', max_team_size: '1' })}
                className={`p-3 rounded-lg border text-left transition ${
                  formData.registration_mode === 'individual'
                    ? 'border-indigo-600 bg-white ring-2 ring-indigo-500 shadow-xs'
                    : 'border-gray-200 bg-white/70 hover:bg-white'
                }`}
              >
                <div className="font-semibold text-sm text-gray-900">👤 Individual Registration</div>
                <div className="text-xs text-gray-500 mt-0.5">Participants sign up solo</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, registration_mode: 'team', min_team_size: formData.min_team_size === '1' ? '2' : formData.min_team_size, max_team_size: formData.max_team_size === '1' ? '4' : formData.max_team_size })}
                className={`p-3 rounded-lg border text-left transition ${
                  formData.registration_mode === 'team'
                    ? 'border-indigo-600 bg-white ring-2 ring-indigo-500 shadow-xs'
                    : 'border-gray-200 bg-white/70 hover:bg-white'
                }`}
              >
                <div className="font-semibold text-sm text-gray-900">👥 Team Registration</div>
                <div className="text-xs text-gray-500 mt-0.5">Leader creates team & shares invite link</div>
              </button>
            </div>

            {formData.registration_mode === 'team' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-indigo-100">
                <div>
                  <label className="block text-xs font-bold text-gray-700">Min Team Size</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.min_team_size}
                    onChange={e => setFormData({ ...formData, min_team_size: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm bg-white"
                  />
                  <span className="text-[11px] text-gray-500">Minimum members required for a valid team</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700">Max Team Size</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.max_team_size}
                    onChange={e => setFormData({ ...formData, max_team_size: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm bg-white"
                  />
                  <span className="text-[11px] text-gray-500">Maximum members allowed per team</span>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Registration Start Date</label>
            <input type="datetime-local" value={formData.registration_start_date} onChange={e => setFormData({...formData, registration_start_date: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Registration Deadline</label>
            <input type="datetime-local" value={formData.registration_deadline} onChange={e => setFormData({...formData, registration_deadline: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="mt-1 block w-full border border-gray-300 bg-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm">
              <option value="Draft">Draft</option>
              <option value="Published">Published</option>
            </select>
          </div>
        </div>

        {/* FORM SCHEMA BUILDER */}
        <div className="mt-8 border-t border-gray-200 pt-8">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">Registration Form Fields</h3>
            <button
              type="button"
              onClick={() => {
                const newField = { id: `custom_${Date.now()}`, label: 'New Field', type: 'text', required: false, options: [] };
                setFormData({...formData, form_schema: [...(formData.form_schema || []), newField]});
              }}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]"
            >
              + Add Field
            </button>
          </div>
          
          <div className="space-y-4">
            {(formData.form_schema || []).map((field: any, idx: number) => (
              <div key={idx} className="bg-white p-4 rounded-md shadow-sm border border-gray-200 flex flex-col space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Field Label</label>
                      <input 
                        type="text" 
                        value={field.label} 
                        onChange={(e) => {
                          const newSchema = [...formData.form_schema];
                          newSchema[idx].label = e.target.value;
                          setFormData({...formData, form_schema: newSchema});
                        }} 
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700">Field Type</label>
                      <select 
                        value={field.type}
                        onChange={(e) => {
                          const newSchema = [...formData.form_schema];
                          newSchema[idx].type = e.target.value;
                          setFormData({...formData, form_schema: newSchema});
                        }}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 sm:text-sm"
                      >
                        <option value="text">Short Text</option>
                        <option value="longtext">Long Text</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="number">Number</option>
                        <option value="dropdown">Dropdown (Single Choice)</option>
                        <option value="radio">Radio (Single Choice)</option>
                        <option value="checkbox">Checkbox (Multiple Choice)</option>
                        <option value="date">Date</option>
                        <option value="url">URL</option>
                      </select>
                    </div>
                    <div className="flex items-center mt-6">
                      <input 
                        type="checkbox" 
                        checked={field.required}
                        onChange={(e) => {
                          const newSchema = [...formData.form_schema];
                          newSchema[idx].required = e.target.checked;
                          setFormData({...formData, form_schema: newSchema});
                        }}
                        className="h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-gray-300 rounded"
                      />
                      <label className="ml-2 block text-sm text-gray-900">Required Field</label>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2 ml-4">
                    <button type="button" disabled={idx === 0} onClick={() => {
                      const newSchema = [...formData.form_schema];
                      [newSchema[idx - 1], newSchema[idx]] = [newSchema[idx], newSchema[idx - 1]];
                      setFormData({...formData, form_schema: newSchema});
                    }} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      &#8593;
                    </button>
                    <button type="button" disabled={idx === formData.form_schema.length - 1} onClick={() => {
                      const newSchema = [...formData.form_schema];
                      [newSchema[idx + 1], newSchema[idx]] = [newSchema[idx], newSchema[idx + 1]];
                      setFormData({...formData, form_schema: newSchema});
                    }} className="text-gray-400 hover:text-gray-600 disabled:opacity-30">
                      &#8595;
                    </button>
                    <button type="button" onClick={() => {
                      if (confirm('Delete this field?')) {
                        const newSchema = formData.form_schema.filter((_, i) => i !== idx);
                        setFormData({...formData, form_schema: newSchema});
                      }
                    }} className="text-red-400 hover:text-red-600 ml-2">
                      &#10005;
                    </button>
                  </div>
                </div>
                
                {['dropdown', 'radio', 'checkbox'].includes(field.type) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Options (comma separated)</label>
                    <input 
                      type="text"
                      value={(field.options || []).join(', ')}
                      onChange={(e) => {
                        const newSchema = [...formData.form_schema];
                        newSchema[idx].options = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                        setFormData({...formData, form_schema: newSchema});
                      }}
                      placeholder="e.g. Vegetarian, Vegan, None"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-1 px-2 sm:text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
            {(!formData.form_schema || formData.form_schema.length === 0) && (
              <p className="text-sm text-gray-500 text-center py-4 bg-gray-50 rounded border border-dashed border-gray-300">
                No custom registration fields defined.
              </p>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">These fields will be shown to participants when they register.</p>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button type="button" onClick={() => navigate('/dashboard')} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]">
            Cancel
          </button>
          <button type="submit" className="bg-[var(--color-primary)] border border-transparent rounded-md shadow-sm py-2 px-4 inline-flex justify-center text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)]">
            Save Event
          </button>
        </div>
      </form>
    </div>
  );
}
