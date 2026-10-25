import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { PoweredByFooter } from '../components/Brand';
import { 
  Users, 
  MapPin, 
  CheckCircle, 
  AlertTriangle, 
  Ticket, 
  ExternalLink, 
  Copy, 
  ArrowRight, 
  Loader2,
  Search
} from 'lucide-react';

export default function JoinTeam() {
  const { inviteCode: paramCode } = useParams<{ inviteCode?: string }>();
  const navigate = useNavigate();

  const [inputCode, setInputCode] = useState(paramCode || '');
  const [teamInfo, setTeamInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customAnswers, setCustomAnswers] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const [joinResult, setJoinResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const fetchTeamDetails = async (codeToFetch: string) => {
    if (!codeToFetch || !codeToFetch.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const cleanCode = codeToFetch.trim().toUpperCase();
      const res = await axios.get(`/api/teams/invite/${cleanCode}`);
      setTeamInfo(res.data);
    } catch (err: any) {
      console.error('Failed to load team invite:', err);
      setTeamInfo(null);
      setError(err.response?.data?.detail || 'Invalid or expired invitation code. Please verify with your Team Leader.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (paramCode) {
      setInputCode(paramCode);
      fetchTeamDetails(paramCode);
    }
  }, [paramCode]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    navigate(`/teams/join/${inputCode.trim().toUpperCase()}`);
    fetchTeamDetails(inputCode.trim());
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !teamInfo) return;
    setSubmitting(true);
    setError(null);

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

      const payload = {
        full_name: extractedName || 'Teammate',
        email: extractedEmail || 'member@example.com',
        college: extractedCollege || '',
        custom_answers: customAnswers
      };

      const res = await axios.post(`/api/teams/invite/${teamInfo.invite_code}/join`, payload);
      setJoinResult(res.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to join team. Please ensure you are not already registered.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">

        {/* HEADER / ENTER CODE IF NOT PROVIDED */}
        {!paramCode && !teamInfo && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 mb-8">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
              <Users className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Join an Event Team</h1>
            <p className="text-sm text-gray-600 mb-6">
              Enter the unique team invitation code provided by your Team Leader to join their roster.
            </p>

            <form onSubmit={handleManualSearch} className="flex gap-2">
              <input
                type="text"
                required
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                placeholder="e.g. TEAM-B4F29A10"
                className="flex-1 font-mono uppercase font-bold text-gray-900 border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Lookup Team
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {/* LOADING STATE */}
        {loading && (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-gray-100">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-600 font-medium">Verifying invitation code & loading team...</p>
          </div>
        )}

        {/* SUCCESS CONFIRMATION SCREEN */}
        {joinResult && (
          <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-8 text-center shadow-lg">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-200">
              <CheckCircle className="w-8 h-8" />
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-emerald-950 mb-2">Welcome to the Team!</h2>
            <p className="text-emerald-800 text-sm sm:text-base mb-6 max-w-lg mx-auto">
              You have successfully joined <span className="font-bold text-emerald-950">"{joinResult.team_name}"</span> for <span className="font-semibold text-emerald-950">{teamInfo?.event_title}</span>!
            </p>

            {/* MEMBER PASS CARD */}
            {joinResult.ticket_code && (
              <div className="bg-white border border-emerald-200/80 rounded-2xl p-6 max-w-md mx-auto mb-6 shadow-md text-left">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Digital Admission Pass</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                    Team Member Pass
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider">Ticket Number</div>
                  <div className="font-mono text-2xl font-bold text-indigo-600 tracking-wider">
                    {joinResult.ticket_code}
                  </div>
                </div>

                <div className="text-xs text-gray-500 mb-5">
                  Your individual digital ticket pass has been generated. Present this QR code at the venue gate for admission.
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <a
                    href={`/tickets/${joinResult.ticket_code}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm"
                  >
                    <Ticket className="w-4 h-4" />
                    Open My Ticket Pass
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      const url = `${window.location.origin}/tickets/${joinResult.ticket_code}`;
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

            <div className="flex justify-center gap-3">
              <Link
                to={`/teams/hub/${joinResult.invite_code}`}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
              >
                <Users className="w-4 h-4" /> View Team Hub & Roster <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* TEAM INFO & REGISTRATION FORM */}
        {!joinResult && teamInfo && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* EVENT / TEAM BANNER */}
            <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 text-white p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  {teamInfo.category || 'Event Team'}
                </span>
                <span className="bg-indigo-500/40 text-indigo-100 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  Team Code: {teamInfo.invite_code}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black mb-1">{teamInfo.team_name}</h1>
              <p className="text-indigo-200 text-sm mb-4">
                Invited by Team Leader <span className="text-white font-bold">{teamInfo.leader_name}</span> for <span className="text-white font-semibold">{teamInfo.event_title}</span>
              </p>

              <div className="flex flex-wrap gap-4 text-xs text-indigo-100 pt-2 border-t border-white/10">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {teamInfo.venue || 'TBA'}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {teamInfo.current_member_count} of {teamInfo.max_team_size} Spots Filled
                </span>
              </div>
            </div>

            {/* CAPACITY / STATUS CALLOUT */}
            <div className="p-6 sm:p-8">
              {teamInfo.is_full ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center mb-6">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-amber-950 mb-1">Team Capacity Reached</h3>
                  <p className="text-xs text-amber-800 max-w-md mx-auto mb-4">
                    This team has already filled all {teamInfo.max_team_size} member spots. No further teammates can join this team.
                  </p>
                  <div className="flex justify-center gap-3">
                    <Link
                      to={`/teams/hub/${teamInfo.invite_code}`}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition"
                    >
                      View Team Roster
                    </Link>
                    <Link
                      to={`/events/${teamInfo.event_id}`}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
                    >
                      Browse Other Teams / Event Page
                    </Link>
                  </div>
                </div>
              ) : !teamInfo.can_join ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center mb-6">
                  <h3 className="text-sm font-bold text-red-900 mb-1">Registration Unavailable</h3>
                  <p className="text-xs text-red-700">
                    Registration for this team or event is currently closed or the deadline has expired.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl mb-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-xs font-bold text-emerald-900">
                        {teamInfo.spots_remaining} {teamInfo.spots_remaining === 1 ? 'spot' : 'spots'} remaining in this team
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">
                      Capacity: {teamInfo.min_team_size} - {teamInfo.max_team_size} members
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-gray-900 mb-2">Enter Your Teammate Details</h3>
                  <p className="text-xs text-gray-500 mb-6">
                    Please provide your information as required by the event organizers. You will instantly receive your individual digital ticket pass.
                  </p>

                  <form onSubmit={handleJoin} className="space-y-6">
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-medium">
                        {error}
                      </div>
                    )}

                    {teamInfo.form_schema && teamInfo.form_schema.length > 0 ? (
                      <div className="space-y-5">
                        {teamInfo.form_schema.map((field: any) => (
                          <div key={field.id}>
                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                              {field.label} {field.required && <span className="text-red-500">*</span>}
                            </label>

                            {field.type === 'longtext' ? (
                              <textarea
                                required={field.required}
                                rows={3}
                                onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                                className="block w-full border border-gray-300 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                              />
                            ) : field.type === 'dropdown' ? (
                              <select
                                required={field.required}
                                onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                                className="block w-full border border-gray-300 bg-white rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                              >
                                <option value="">Select an option</option>
                                {field.options?.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                              </select>
                            ) : field.type === 'checkbox' ? (
                              <div className="mt-2 space-y-1.5">
                                {field.options?.map((opt: string) => (
                                  <label key={opt} className="flex items-center text-xs text-gray-700">
                                    <input
                                      type="checkbox"
                                      value={opt}
                                      onChange={(e) => {
                                        const cur = customAnswers[field.id] || [];
                                        const next = e.target.checked ? [...cur, opt] : cur.filter((i: string) => i !== opt);
                                        setCustomAnswers({ ...customAnswers, [field.id]: next });
                                      }}
                                      className="h-4 w-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                    />
                                    <span className="ml-2">{opt}</span>
                                  </label>
                                ))}
                              </div>
                            ) : (
                              <input
                                type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'email' ? 'email' : 'text'}
                                required={field.required}
                                onChange={e => setCustomAnswers({ ...customAnswers, [field.id]: e.target.value })}
                                className="block w-full border border-gray-300 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Full Name *</label>
                          <input
                            type="text"
                            required
                            onChange={e => setCustomAnswers({ ...customAnswers, name: e.target.value })}
                            className="block w-full border border-gray-300 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Email Address *</label>
                          <input
                            type="email"
                            required
                            onChange={e => setCustomAnswers({ ...customAnswers, email: e.target.value })}
                            className="block w-full border border-gray-300 rounded-xl py-2 px-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full flex items-center justify-center py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition shadow-sm disabled:opacity-60"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Confirming Membership & Issuing Pass...
                        </>
                      ) : (
                        `Join "${teamInfo.team_name}" & Get Pass →`
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        <PoweredByFooter />
      </div>
    </div>
  );
}
