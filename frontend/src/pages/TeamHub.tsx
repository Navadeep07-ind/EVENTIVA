import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { PoweredByFooter } from '../components/Brand';
import { 
  Users, 
  Crown, 
  Share2, 
  Copy, 
  Check, 
  CheckCircle2, 
  Clock, 
  ArrowLeft,
  Loader2,
  AlertTriangle
} from 'lucide-react';

interface TeamMember {
  id: number;
  full_name: string;
  college?: string;
  status: string;
  checked_in: boolean;
  is_team_leader: boolean;
  created_at: string;
}

interface TeamData {
  id: number;
  team_name: string;
  event_id: number;
  event_title: string;
  category?: string;
  venue?: string;
  start_time?: string;
  end_time?: string;
  poster_url?: string;
  leader_name: string;
  invite_code: string;
  status: string;
  min_team_size: number;
  max_team_size: number;
  current_member_count: number;
  spots_remaining: number;
  is_full: boolean;
  members: TeamMember[];
  created_at: string;
}

export default function TeamHub() {
  const { inviteCode, teamId } = useParams<{ inviteCode?: string; teamId?: string }>();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    const fetchTeam = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = inviteCode 
          ? `/api/teams/hub/${inviteCode.trim()}` 
          : `/api/teams/${teamId}`;
        const res = await axios.get(url);
        setTeam(res.data);
      } catch (err: any) {
        console.error('Failed to load team hub:', err);
        setError(err.response?.data?.detail || 'Team not found or link has expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [inviteCode, teamId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Loading Team Hub...</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Team Not Found</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'Could not locate team details.'}</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const joinUrl = `${window.location.origin}/teams/join/${team.invite_code}`;
  const whatsappShareText = `Join our team "${team.team_name}" for ${team.event_title}! Use this link to register: ${joinUrl}`;

  const completionPct = Math.min(100, Math.round((team.current_member_count / team.max_team_size) * 100));

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* TOP BAR / BACK LINK */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to={`/events/${team.event_id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-indigo-600 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Event Page
            </Link>
            <Link
              to={`/events/${team.event_id}/live`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
            >
              <span>⚡</span>
              <span>Live Portal</span>
            </Link>
          </div>

          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
            team.is_full 
              ? 'bg-emerald-100 text-emerald-800' 
              : 'bg-indigo-100 text-indigo-800'
          }`}>
            <span className={`w-2 h-2 rounded-full ${team.is_full ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'}`}></span>
            {team.is_full ? 'Roster Complete' : `${team.spots_remaining} Spots Open`}
          </span>
        </div>

        {/* HERO / TEAM HEADER CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 text-white p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-300">
                  {team.category || 'Event Team'}
                </span>
                <h1 className="text-3xl sm:text-4xl font-black mt-1 tracking-tight">{team.team_name}</h1>
              </div>

              <div className="bg-white/10 backdrop-blur-xs px-4 py-2.5 rounded-xl border border-white/20 text-right">
                <div className="text-[11px] uppercase tracking-wider text-indigo-200">Team Size</div>
                <div className="text-2xl font-black text-white">
                  {team.current_member_count} <span className="text-sm font-semibold text-indigo-200">/ {team.max_team_size}</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-indigo-100 mb-6">
              Participating in <span className="font-bold text-white">{team.event_title}</span> • Led by <span className="font-bold text-white">{team.leader_name}</span>
            </p>

            {/* PROGRESS BAR */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-indigo-200">
                <span>Roster Capacity Progress</span>
                <span>{completionPct}% Complete</span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${
                    team.is_full ? 'bg-emerald-400' : 'bg-indigo-300'
                  }`}
                  style={{ width: `${completionPct}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* SHARE / INVITATION CODE STRIP */}
          <div className="p-6 sm:p-8 bg-indigo-50/40 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Share2 className="w-4 h-4 text-indigo-600" /> Team Invitation Passcode
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Share this code or direct link with teammates to allow them to join your roster.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="bg-white px-3.5 py-1.5 rounded-xl border border-indigo-200 font-mono text-base font-black text-indigo-900 tracking-wider">
                  {team.invite_code}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(team.invite_code);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Copied!' : 'Copy Code'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="px-3 py-2 bg-white hover:bg-gray-50 text-gray-800 text-xs font-bold rounded-xl transition border border-gray-200 shadow-2xs flex items-center gap-1"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedLink ? 'Copied Link!' : 'Copy Link'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappShareText)}`, '_blank');
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1"
                >
                  <span>💬</span> WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TEAM ROSTER */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" /> Official Team Roster
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                All registered team members confirmed for this event.
              </p>
            </div>

            <span className="text-xs font-bold text-gray-500">
              {team.members.length} / {team.max_team_size} Registered
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            {team.members.map((member) => (
              <div key={member.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    member.is_team_leader 
                      ? 'bg-amber-100 text-amber-800 border border-amber-300' 
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {member.is_team_leader ? '👑' : member.full_name.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">{member.full_name}</span>
                      {member.is_team_leader && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900">
                          <Crown className="w-3 h-3 text-amber-600" /> Leader
                        </span>
                      )}
                    </div>
                    {member.college && (
                      <div className="text-xs text-gray-500">{member.college}</div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {member.checked_in ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Checked In
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                      <Clock className="w-3.5 h-3.5 text-gray-500" /> Admission Pending
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* EMPTY ROSTER SLOTS */}
            {Array.from({ length: Math.max(0, team.max_team_size - team.members.length) }).map((_, idx) => (
              <div key={`empty-${idx}`} className="py-4 flex items-center justify-between border-dashed border-gray-200">
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-xs font-bold">
                    +{idx + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-400">Open Teammate Slot</div>
                    <div className="text-xs text-gray-400">Invite a peer using your team code</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(joinUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
                >
                  + Invite Teammate
                </button>
              </div>
            ))}
          </div>
        </div>

        <PoweredByFooter />
      </div>
    </div>
  );
}
