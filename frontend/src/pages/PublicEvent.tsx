import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { PoweredByFooter } from '../components/Brand';
import ShareRegistrationModal, { copyToClipboard } from '../components/ShareRegistrationModal';
import { 
  MapPin, 
  Users, 
  CheckCircle, 
  Ticket, 
  Copy, 
  Check,
  ExternalLink, 
  Loader2, 
  ArrowRight,
  Share2,
  Sparkles,
  Link2
} from 'lucide-react';

export default function PublicEvent() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [customAnswers, setCustomAnswers] = useState<any>({});
  const [registered, setRegistered] = useState(false);
  const [ticketResult, setTicketResult] = useState<any>(null);
  const [createdTeamResult, setCreatedTeamResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [copiedFormLink, setCopiedFormLink] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [error, setError] = useState('');

  // Team Registration State
  const [teamModeTab, setTeamModeTab] = useState<'create' | 'join'>('create');
  const [teamName, setTeamName] = useState('');
  const [directInviteCode, setDirectInviteCode] = useState('');

  useEffect(() => {
    axios.get(`/api/events/${id}`)
      .then(res => setEvent(res.data))
      .catch(err => console.error(err));
  }, [id]);

  useEffect(() => {
    if (window.location.hash === '#register' && event) {
      setTimeout(() => {
        const el = document.getElementById('register');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 350);
    }
  }, [event]);

  const isTeamEvent = event && (event.registration_mode === 'team' || event.max_team_size > 1);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');

    try {
      let extractedName = '';
      let extractedEmail = '';
      let extractedCollege = '';

      for (const [key, val] of Object.entries(customAnswers)) {
        if (!val || typeof val !== 'string') continue;
        const lowerKey = key.toLowerCase();
        const lowerVal = (val as string).toLowerCase();
        
        if (!extractedName && (lowerKey.includes('name') || lowerKey.includes('full'))) {
          extractedName = val;
        } else if (!extractedEmail && (lowerKey.includes('email') || lowerVal.includes('@'))) {
          extractedEmail = val;
        } else if (!extractedCollege && (lowerKey.includes('college') || lowerKey.includes('institution') || lowerKey.includes('organization') || lowerKey.includes('university') || lowerKey.includes('school'))) {
          extractedCollege = val;
        }
      }

      const participantPayload = {
        full_name: extractedName || 'Participant',
        email: extractedEmail || 'participant@example.com',
        college: extractedCollege || '',
        custom_answers: customAnswers
      };

      if (isTeamEvent) {
        if (!teamName || !teamName.trim()) {
          setError('Please provide a Team Name to register as Team Leader.');
          setSubmitting(false);
          return;
        }

        const teamPayload = {
          team_name: teamName.trim(),
          leader: participantPayload
        };

        const res = await axios.post(`/api/events/${id}/teams`, teamPayload);
        setCreatedTeamResult(res.data.team);
        setTicketResult(res.data.registration);
        setRegistered(true);
      } else {
        const res = await axios.post(`/api/events/${id}/register`, participantPayload);
        setTicketResult(res.data);
        setRegistered(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed. Please check your inputs.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!event) return <div className="min-h-screen flex items-center justify-center">Loading event...</div>;
  if (event.status !== 'Published') return <div className="min-h-screen flex items-center justify-center">This event is not published yet.</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        
        {event.poster_url && (
          <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-8 border border-gray-100 flex justify-center p-4">
            <img src={event.poster_url} alt={`${event.title} Poster`} className="max-h-[700px] object-contain rounded-lg" />
          </div>
        )}

        <div className="bg-white shadow-sm rounded-xl overflow-hidden mb-8 border border-gray-100">
          <div className="p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">{event.title}</h1>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-bold transition shadow-xs flex-shrink-0"
              >
                <Share2 className="w-4 h-4 text-indigo-600" />
                Share Registration Form
              </button>
            </div>
            <div className="flex flex-wrap gap-4 items-center mb-6 text-sm text-gray-500">
              <span className="bg-purple-50 text-[var(--color-primary-hover)] px-3 py-1 rounded-full font-medium">{event.category || 'Event'}</span>
              <span className="flex items-center"><MapPin className="w-4 h-4 mr-1" /> {event.venue || 'TBA'}</span>
              <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> Team Size: {event.min_team_size === event.max_team_size ? (event.min_team_size > 1 ? `${event.min_team_size} members` : 'Individual') : `${event.min_team_size} - ${event.max_team_size} members`}</span>
              <span className="flex items-center"><Users className="w-4 h-4 mr-1" /> Max Capacity: {event.max_participants || 'Unlimited'}</span>
            </div>
            <div className="prose prose-indigo max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: event.description?.replace(/\n/g, '<br />') }} />
          </div>
        </div>

        {registered ? (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle className="w-8 h-8" />
            </div>
            
            {createdTeamResult ? (
              <>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 mb-2">Team Registered Successfully!</h3>
                <p className="text-emerald-800 text-sm sm:text-base mb-6 max-w-lg mx-auto">
                  Team <span className="font-bold text-emerald-950">"{createdTeamResult.team_name}"</span> has been created for <span className="font-semibold text-emerald-950">{event.title}</span>. You are the registered Team Leader!
                </p>

                {/* TEAM INVITE CARD */}
                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-6 max-w-lg mx-auto mb-6 shadow-md text-left">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                      <Share2 className="w-4 h-4 text-indigo-600" /> Share with Teammates
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                      Team Capacity: {createdTeamResult.max_team_size} members
                    </span>
                  </div>

                  <div className="mb-4">
                    <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Team Invitation Code</div>
                    <div className="flex items-center justify-between bg-indigo-50/60 p-3 rounded-xl border border-indigo-100 mt-1">
                      <span className="font-mono text-2xl font-black text-indigo-900 tracking-wider">
                        {createdTeamResult.invite_code}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdTeamResult.invite_code);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copiedInvite ? 'Copied Code!' : 'Copy Code'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const joinUrl = `${window.location.origin}/teams/join/${createdTeamResult.invite_code}`;
                        navigator.clipboard.writeText(joinUrl);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold text-xs transition border border-gray-200"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copied ? 'Copied Link!' : 'Copy Invite Link'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const joinUrl = `${window.location.origin}/teams/join/${createdTeamResult.invite_code}`;
                        const text = `Join my team "${createdTeamResult.team_name}" for ${event.title}! Register here: ${joinUrl}`;
                        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-xs"
                    >
                      <span>💬</span> Share via WhatsApp
                    </button>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex justify-end">
                    <Link
                      to={`/teams/hub/${createdTeamResult.invite_code}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      Open Team Management Hub <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* LEADER TICKET PASS */}
                {ticketResult?.ticket_code && (
                  <div className="bg-white border border-emerald-200/80 rounded-2xl p-6 max-w-lg mx-auto mb-6 shadow-md text-left">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Leader Admission Pass</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        Confirmed Leader
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Ticket Number</div>
                      <div className="font-mono text-2xl font-bold text-indigo-600 tracking-wider">
                        {ticketResult.ticket_code}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <a
                        href={`/tickets/${ticketResult.ticket_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm"
                      >
                        <Ticket className="w-4 h-4" />
                        Open My Ticket Pass
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </a>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 mb-2">Registration Confirmed!</h3>
                <p className="text-emerald-800 text-sm sm:text-base mb-6 max-w-lg mx-auto">
                  You are officially registered for <span className="font-semibold text-emerald-950">{event.title}</span>. Your unique Digital Ticket Pass has been generated.
                </p>

                {ticketResult?.ticket_code && (
                  <div className="bg-white border border-emerald-200/80 rounded-2xl p-6 max-w-md mx-auto mb-6 shadow-md text-left">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                      <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Official Pass</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                        Confirmed
                      </span>
                    </div>

                    <div className="mb-4">
                      <div className="text-xs text-gray-500 uppercase tracking-wider">Ticket Number</div>
                      <div className="font-mono text-2xl font-bold text-indigo-600 tracking-wider">
                        {ticketResult.ticket_code}
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mb-5">
                      Present this pass with its scannable QR code at the venue gate for admission.
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <a
                        href={`/tickets/${ticketResult.ticket_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm"
                      >
                        <Ticket className="w-4 h-4" />
                        Open Ticket Pass
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/tickets/${ticketResult.ticket_code}`;
                          navigator.clipboard.writeText(url);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium text-sm transition border border-gray-200"
                      >
                        <Copy className="w-4 h-4" />
                        {copied ? 'Copied!' : 'Copy Link'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <p className="text-xs text-emerald-700">
              A confirmation email has been scheduled to your address. You can also bookmark or take a screenshot of your pass.
            </p>

            {/* Post-Registration Share Invite */}
            <div className="mt-6 pt-5 border-t border-emerald-200/60 flex flex-col sm:flex-row items-center justify-center gap-3">
              <span className="text-xs font-semibold text-emerald-900">
                Want to invite friends or teammates?
              </span>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-300 shadow-xs transition"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                Share Registration Form
              </button>
            </div>
          </div>
        ) : (
          <div id="register" className="bg-white shadow-sm rounded-xl overflow-hidden border border-gray-100 p-8 scroll-mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {isTeamEvent ? 'Team Registration' : 'Register Now'}
              </h2>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition"
              >
                <Share2 className="w-3.5 h-3.5" />
                Share Form
              </button>
            </div>

            {/* Shareable Registration Link Banner */}
            <div className="mb-6 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-indigo-50/70 border border-indigo-100 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-lg bg-indigo-600 text-white flex-shrink-0 shadow-xs">
                  <Link2 className="w-4 h-4" />
                </span>
                <div className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                    Shareable Registration Link
                  </span>
                  <span className="block text-xs text-gray-600 font-mono truncate">
                    {`${window.location.origin}/events/${event.id}#register`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const url = `${window.location.origin}/events/${event.id}#register`;
                    const ok = await copyToClipboard(url);
                    if (ok) {
                      setCopiedFormLink(true);
                      setTimeout(() => setCopiedFormLink(false), 2000);
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-gray-50 text-gray-700 font-semibold text-xs border border-gray-200 transition shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  {copiedFormLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedFormLink ? 'Copied!' : 'Copy Link'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition shadow-xs flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Options
                </button>
              </div>
            </div>
            
            {(() => {
              const now = new Date();
              if (event.registration_start_date && new Date(event.registration_start_date) > now) {
                return <div className="text-orange-600 bg-orange-50 p-4 rounded-md">Registration has not started yet.</div>;
              }
              if (event.registration_deadline && new Date(event.registration_deadline) < now) {
                return <div className="text-red-600 bg-red-50 p-4 rounded-md">Registration is closed. The deadline has passed.</div>;
              }

              return (
                <div>
                  {isTeamEvent && (
                    <div className="mb-8">
                      <div className="flex border-b border-gray-200">
                        <button
                          type="button"
                          onClick={() => setTeamModeTab('create')}
                          className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                            teamModeTab === 'create'
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Sparkles className="w-4 h-4" />
                          Option 1: Create a New Team
                        </button>
                        <button
                          type="button"
                          onClick={() => setTeamModeTab('join')}
                          className={`py-3 px-5 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
                            teamModeTab === 'join'
                              ? 'border-indigo-600 text-indigo-600'
                              : 'border-transparent text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <Users className="w-4 h-4" />
                          Option 2: Join with Invitation Code
                        </button>
                      </div>

                      {teamModeTab === 'join' && (
                        <div className="mt-6 bg-indigo-50/60 p-6 rounded-2xl border border-indigo-100 text-left">
                          <h4 className="text-base font-bold text-gray-900 mb-1 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            Have a Team Invitation Code?
                          </h4>
                          <p className="text-xs text-gray-600 mb-4">
                            Enter the unique team code shared by your Team Leader to join their roster and claim your ticket.
                          </p>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <input
                              type="text"
                              value={directInviteCode}
                              onChange={e => setDirectInviteCode(e.target.value.toUpperCase())}
                              placeholder="e.g. TEAM-A1B2C3D4"
                              className="flex-1 font-mono uppercase font-bold text-gray-900 border border-indigo-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!directInviteCode.trim()) {
                                  alert('Please enter a team invitation code');
                                  return;
                                }
                                navigate(`/teams/join/${directInviteCode.trim().toUpperCase()}`);
                              }}
                              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-sm flex items-center justify-center gap-2"
                            >
                              Continue to Join Team <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {(!isTeamEvent || teamModeTab === 'create') && (
                    <form onSubmit={handleRegister} className="space-y-6">
                      {error && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-200">{error}</div>}

                      {isTeamEvent && (
                        <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 mb-6">
                          <label className="block text-sm font-bold text-gray-900 mb-1">
                            Team Name <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={teamName}
                            onChange={e => setTeamName(e.target.value)}
                            placeholder="e.g. CyberKnights, CodeBlaze, Falcon 9"
                            className="mt-1 block w-full border border-gray-300 rounded-lg shadow-xs py-2.5 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm bg-white"
                          />
                          <p className="text-xs text-gray-500 mt-1.5">
                            As team creator, you will be registered as the Team Leader. You will receive an invitation link to share with up to {event.max_team_size - 1} teammates.
                          </p>
                        </div>
                      )}

                      <div className="border-t border-gray-100 pt-4">
                        <h4 className="text-sm font-bold text-gray-800 mb-4">
                          {isTeamEvent ? 'Team Leader Registration Details' : 'Attendee Details'}
                        </h4>

                        {event.form_schema && event.form_schema.length > 0 ? (
                          <div className="space-y-6">
                            {event.form_schema.map((field: any) => (
                              <div key={field.id}>
                                <label className="block text-sm font-medium text-gray-700">
                                  {field.label} {field.required && '*'}
                                </label>
                                
                                {field.type === 'longtext' ? (
                                  <textarea
                                    required={field.required}
                                    rows={3}
                                    onChange={e => setCustomAnswers({...customAnswers, [field.id]: e.target.value})}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm"
                                  />
                                ) : field.type === 'dropdown' ? (
                                  <select
                                    required={field.required}
                                    onChange={e => setCustomAnswers({...customAnswers, [field.id]: e.target.value})}
                                    className="mt-1 block w-full border border-gray-300 bg-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm"
                                  >
                                    <option value="">Select an option</option>
                                    {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                                  </select>
                                ) : field.type === 'checkbox' ? (
                                  <div className="mt-2 space-y-2">
                                    {field.options?.map((opt: string) => (
                                      <div key={opt} className="flex items-center">
                                        <input
                                          type="checkbox"
                                          value={opt}
                                          onChange={(e) => {
                                            const current = customAnswers[field.id] || [];
                                            let next;
                                            if (e.target.checked) next = [...current, opt];
                                            else next = current.filter((i: string) => i !== opt);
                                            setCustomAnswers({...customAnswers, [field.id]: next});
                                          }}
                                          className="h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-gray-300 rounded"
                                        />
                                        <label className="ml-2 text-sm text-gray-700">{opt}</label>
                                      </div>
                                    ))}
                                  </div>
                                ) : field.type === 'radio' ? (
                                  <div className="mt-2 space-y-2">
                                    {field.options?.map((opt: string) => (
                                      <div key={opt} className="flex items-center">
                                        <input
                                          type="radio"
                                          name={field.id}
                                          value={opt}
                                          required={field.required}
                                          onChange={e => setCustomAnswers({...customAnswers, [field.id]: e.target.value})}
                                          className="h-4 w-4 text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-gray-300"
                                        />
                                        <label className="ml-2 text-sm text-gray-700">{opt}</label>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <input
                                    type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                                    required={field.required}
                                    onChange={e => setCustomAnswers({...customAnswers, [field.id]: e.target.value})}
                                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)] sm:text-sm"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm italic">No registration fields configured.</p>
                        )}
                      </div>

                      <button 
                        type="submit" 
                        disabled={submitting}
                        className="w-full flex items-center justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] mt-8 disabled:opacity-60 disabled:cursor-not-allowed transition"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            {isTeamEvent ? 'Creating Team & Issuing Pass...' : 'Processing Registration...'}
                          </>
                        ) : (
                          isTeamEvent ? 'Create Team & Generate Pass →' : 'Complete Registration'
                        )}
                      </button>
                    </form>
                  )}
                </div>
              );
            })()}
          </div>
        )}
        <PoweredByFooter />
      </div>

      <ShareRegistrationModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        event={event}
      />
    </div>
  );
}
