import { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { Sparkles, AlertTriangle, Share2 } from 'lucide-react';
import ShareRegistrationModal from '../components/ShareRegistrationModal';

export default function EventEdit() {
  const { id } = useParams();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    venue: '',
    start_time: '',
    end_time: '',
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterFileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Change notification modal
  const [changeModal, setChangeModal] = useState<{
    show: boolean;
    summary: string;
    affectedCount: number;
    customNote: string;
    pendingPayload: any;
  }>({
    show: false,
    summary: '',
    affectedCount: 0,
    customNote: '',
    pendingPayload: null
  });

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await axios.get(`/api/events/${id}`);
        const ev = res.data;
        setFormData({
          title: ev.title || '',
          description: ev.description || '',
          category: ev.category || '',
          venue: ev.venue || '',
          start_time: ev.start_time ? ev.start_time.slice(0, 16) : '',
          end_time: ev.end_time ? ev.end_time.slice(0, 16) : '',
          max_participants: ev.max_participants ? ev.max_participants.toString() : '',
          min_team_size: ev.min_team_size ? ev.min_team_size.toString() : '1',
          max_team_size: ev.max_team_size ? ev.max_team_size.toString() : '1',
          registration_mode: ev.registration_mode || (ev.max_team_size > 1 ? 'team' : 'individual'),
          registration_start_date: ev.registration_start_date ? ev.registration_start_date.slice(0, 16) : '',
          registration_deadline: ev.registration_deadline ? ev.registration_deadline.slice(0, 16) : '',
          status: ev.status || 'Draft',
          poster_url: ev.poster_url || '',
          form_schema: ev.form_schema || []
        });
      } catch (err) {
        console.error(err);
        alert('Failed to load event data');
      }
    };
    fetchEvent();
  }, [id]);

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
      setFormData(prev => ({ ...prev, poster_url: res.data.url }));
    } catch (err: any) {
      alert('Failed to upload poster: ' + (err.response?.data?.detail || err.message));
    } finally {
      setIsUploadingPoster(false);
      if (posterFileInputRef.current) posterFileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsGenerating(true);
    const token = localStorage.getItem('token');
    const data = new FormData();
    data.append('file', file);

    try {
      const res = await axios.post('/api/ai/generate-description', data, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      setFormData(prev => ({ ...prev, description: res.data.description }));
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to generate description from file.');
    } finally {
      setIsGenerating(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executeSave = async (payload: any, notifyAttendees: boolean, customNote?: string) => {
    const token = localStorage.getItem('token');
    await axios.put(`/api/events/${id}`, payload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (notifyAttendees) {
      await axios.post(`/api/events/${id}/notify-change`, {
        custom_note: customNote || undefined
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    }

    navigate('/dashboard/events');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = {
        ...formData,
        start_time: formData.start_time ? new Date(formData.start_time).toISOString() : null,
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : null,
        poster_url: formData.poster_url || null,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        min_team_size: parseInt(formData.min_team_size),
        max_team_size: parseInt(formData.max_team_size),
        registration_start_date: formData.registration_start_date ? new Date(formData.registration_start_date).toISOString() : null,
        registration_deadline: formData.registration_deadline ? new Date(formData.registration_deadline).toISOString() : null
      };

      // Check if venue or schedule changed
      const detectRes = await axios.post(`/api/events/${id}/detect-changes`, {
        venue: formData.venue || null,
        start_time: payload.start_time,
        end_time: payload.end_time
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (detectRes.data.has_changes && detectRes.data.eligible_attendees_count > 0) {
        setChangeModal({
          show: true,
          summary: detectRes.data.summary,
          affectedCount: detectRes.data.eligible_attendees_count,
          customNote: '',
          pendingPayload: payload
        });
        return;
      }

      await executeSave(payload, false);
    } catch (err: any) {
      console.error(err);
      alert('Failed to update event: ' + (err.response?.data?.detail || err.message));
    }
  };

  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b border-gray-100 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Edit Event</h2>
          <p className="text-xs text-gray-500">Update event details, form fields, and venue information</p>
        </div>
        <button
          type="button"
          onClick={() => setIsShareModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-bold shadow-xs transition"
          title="Share Registration Form"
        >
          <Share2 className="w-4 h-4 text-indigo-600" />
          Share Form
        </button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Event Title</label>
          <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-sm font-medium text-gray-700">Description</label>
            <div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf,.txt,.md,.png,.jpg,.jpeg" className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isGenerating} className="inline-flex items-center px-3 py-1 border border-indigo-200 text-sm font-medium rounded-md text-[var(--color-primary-hover)] bg-purple-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50">
                {isGenerating ? <span className="animate-pulse">Generating...</span> : <><Sparkles className="w-4 h-4 mr-2" /> AI Generate from File / Poster</>}
              </button>
            </div>
          </div>
          <textarea rows={8} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm font-mono text-sm" placeholder="Markdown supported..." />
        </div>

        {/* EVENT POSTER MANAGEMENT */}
        <div className="bg-gray-50 border border-gray-200 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                <span>🎨 Event Poster</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">Universal Studio</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Manage this event's poster or open Poster Studio to customize text, branding, and borders.</p>
            </div>
            {formData.poster_url && (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                <span>✓ Active Poster</span>
              </span>
            )}
          </div>

          <input 
            type="file" 
            ref={posterFileInputRef} 
            onChange={handlePosterUpload} 
            accept="image/png,image/jpeg,image/webp" 
            className="hidden" 
          />

          {isUploadingPoster && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <span className="text-xs font-bold text-gray-700 animate-pulse">Uploading new poster image...</span>
            </div>
          )}

          {formData.poster_url ? (
            <div className="flex items-center gap-4 bg-white p-3.5 rounded-xl border border-gray-200">
              <div className="w-20 h-28 shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 shadow-xs">
                <img src={formData.poster_url} alt="Event Poster" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-1.5 flex-1">
                <p className="text-xs font-bold text-gray-900">Current Event Poster</p>
                <p className="text-[11px] text-gray-500 truncate max-w-xs">{formData.poster_url}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => navigate(`/dashboard/events/${id}/poster`)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
                  >
                    ✏️ Edit in Poster Studio
                  </button>
                  <button 
                    type="button" 
                    onClick={() => posterFileInputRef.current?.click()}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    🔄 Replace Poster
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      if (confirm('Remove poster from this event?')) {
                        setFormData(prev => ({ ...prev, poster_url: '' }));
                      }
                    }}
                    className="bg-red-50 hover:bg-red-100 text-red-600 font-bold px-3 py-1.5 rounded-lg text-xs transition"
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border border-dashed border-gray-300 rounded-xl gap-3">
              <span className="text-xs text-gray-500">No poster currently set for this event.</span>
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  onClick={() => navigate(`/dashboard/events/${id}/poster`)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
                >
                  ✨ Design in Poster Studio
                </button>
                <button 
                  type="button" 
                  onClick={() => posterFileInputRef.current?.click()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs"
                >
                  📤 Upload Poster File
                </button>
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
            <label className="block text-sm font-medium text-gray-700">Event Start Date & Time</label>
            <input type="datetime-local" value={formData.start_time} onChange={e => setFormData({...formData, start_time: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Event End Date & Time</label>
            <input type="datetime-local" value={formData.end_time} onChange={e => setFormData({...formData, end_time: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm" />
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

      {/* SCHEDULE / VENUE CHANGE NOTIFICATION CONFIRMATION MODAL */}
      {changeModal.show && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Schedule or Venue Change Detected</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Notify confirmed attendees about these updates?
                </p>
              </div>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 text-xs space-y-2">
              <div className="font-bold text-amber-900">Detected Modifications:</div>
              <p className="text-amber-800 font-semibold">{changeModal.summary}</p>
              <div className="pt-1 text-[11px] text-amber-700">
                Eligible registered attendees: <strong>{changeModal.affectedCount}</strong>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Optional Note for Attendees
              </label>
              <input
                type="text"
                value={changeModal.customNote}
                onChange={e => setChangeModal({ ...changeModal, customNote: e.target.value })}
                placeholder="e.g. Please enter via Gate 3; parking is available in Lot B"
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setChangeModal({ ...changeModal, show: false })}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => executeSave(changeModal.pendingPayload, false)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
              >
                Save Without Notifying
              </button>
              <button
                type="button"
                onClick={() => executeSave(changeModal.pendingPayload, true, changeModal.customNote)}
                className="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs"
              >
                Save & Notify Attendees
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Registration Form Modal */}
      <ShareRegistrationModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        event={{
          id: id || '',
          title: formData.title,
          category: formData.category,
          venue: formData.venue,
          status: formData.status
        }}
      />
    </div>
  );
}
