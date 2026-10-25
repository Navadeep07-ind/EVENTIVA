import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Send, 
  Bell, 
  Clock, 
  RotateCw, 
  Users, 
  Mail, 
  ArrowLeft, 
  Loader2, 
  Eye, 
  Check, 
  X
} from 'lucide-react';
import { PoweredByFooter } from '../components/Brand';
import { toLocalDatetimeInputValue } from '../utils/dateUtils';

interface CampaignDelivery {
  id: number;
  recipient_email: string;
  recipient_name: string;
  status: string; // queued, sent, failed, skipped_unsubscribed
  error_message?: string;
  attempt_count: number;
  last_attempt_at?: string;
  created_at: string;
}

interface Campaign {
  id: number;
  event_id: number;
  campaign_type: string;
  title: string;
  message: string;
  target_audience: string;
  priority: string;
  status: string; // Pending, Sending, Completed, Partial, Failed
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at?: string;
}

interface TeamOption {
  id: number;
  team_name: string;
  current_member_count: number;
}

interface ParticipantOption {
  id: number;
  full_name: string;
  email: string;
  status: string;
}

interface ReminderConfig {
  id?: number;
  reminder_type: string;
  scheduled_time: string;
  custom_message?: string;
  is_enabled: boolean;
  is_sent?: boolean;
  sent_at?: string;
}

export default function NotificationsHub({ eventIdProp }: { eventIdProp?: string }) {
  const { id: paramId } = useParams<{ id: string }>();
  const eventId = eventIdProp || paramId;

  const [event, setEvent] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [reminders, setReminders] = useState<ReminderConfig[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Active view section
  const [activeSection, setActiveSection] = useState<'broadcast' | 'history' | 'reminders'>('broadcast');

  // Broadcast composer state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [targetAudience, setTargetAudience] = useState<'all' | 'teams' | 'participants'>('all');
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<number[]>([]);
  const [participantSearch, setParticipantSearch] = useState('');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Detailed campaign inspection modal
  const [inspectCampaign, setInspectCampaign] = useState<Campaign | null>(null);
  const [inspectDeliveries, setInspectDeliveries] = useState<CampaignDelivery[]>([]);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  // Reminders state
  const [remind24h, setRemind24h] = useState(true);
  const [remind1h, setRemind1h] = useState(true);
  const [remindCustom, setRemindCustom] = useState(false);
  const [customTime, setCustomTime] = useState('');
  const [reminderCustomNote, setReminderCustomNote] = useState('');
  const [reminderSuccessMsg, setReminderSuccessMsg] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  // Load event, teams, participants, campaigns, reminders
  const loadData = async () => {
    if (!eventId) return;
    try {
      const authHeader = { headers: { Authorization: `Bearer ${token}` } };
      
      const [evtRes, campRes, remRes, partRes, teamRes] = await Promise.all([
        axios.get(`/api/events/${eventId}`),
        axios.get(`/api/events/${eventId}/notifications`, authHeader),
        axios.get(`/api/events/${eventId}/reminders`, authHeader),
        axios.get(`/api/events/${eventId}/registrations`, authHeader),
        axios.get(`/api/events/${eventId}/teams`, authHeader).catch(() => ({ data: [] }))
      ]);

      setEvent(evtRes.data);
      setCampaigns(campRes.data);
      setReminders(remRes.data);

      const eligibleParts = (partRes.data || []).filter((p: any) => 
        !['Cancelled', 'Rejected'].includes(p.status)
      );
      setParticipants(eligibleParts);
      setTeams(teamRes.data || []);

      // Initialize reminder checkboxes based on returned configs
      if (remRes.data && remRes.data.length > 0) {
        const has24 = remRes.data.find((r: any) => r.reminder_type === '24h_before');
        const has1 = remRes.data.find((r: any) => r.reminder_type === '1h_before');
        const hasCust = remRes.data.find((r: any) => r.reminder_type === 'custom');
        setRemind24h(has24 ? has24.is_enabled : false);
        setRemind1h(has1 ? has1.is_enabled : false);
        if (hasCust) {
          setRemindCustom(hasCust.is_enabled);
          setCustomTime(hasCust.scheduled_time ? toLocalDatetimeInputValue(hasCust.scheduled_time) : '');
          setReminderCustomNote(hasCust.custom_message || '');
        }
      }
    } catch (err: any) {
      console.error('Failed to load notifications hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  // Recipient count calculation
  const calculateRecipientCount = () => {
    if (targetAudience === 'all') {
      return participants.length;
    }
    if (targetAudience === 'teams') {
      const selectedTeams = teams.filter(t => selectedTeamIds.includes(t.id));
      return selectedTeams.reduce((acc, t) => acc + (t.current_member_count || 0), 0);
    }
    if (targetAudience === 'participants') {
      return selectedParticipantIds.length;
    }
    return 0;
  };

  // Broadcast submit handler
  const handleBroadcastSubmit = async () => {
    setShowConfirmModal(false);
    setSubmitting(true);
    try {
      const target_ids = targetAudience === 'teams' ? selectedTeamIds : targetAudience === 'participants' ? selectedParticipantIds : undefined;
      const payload = {
        title: title.trim(),
        message: message.trim(),
        priority,
        target_audience: targetAudience,
        target_ids
      };

      await axios.post(`/api/events/${eventId}/notifications/broadcast`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      // Reset form
      setTitle('');
      setMessage('');
      setPriority('normal');
      setSelectedTeamIds([]);
      setSelectedParticipantIds([]);
      setActiveSection('history');
      await loadData();
    } catch (err: any) {
      alert('Broadcast dispatch failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Inspect campaign detail modal
  const openInspectModal = async (campaign: Campaign) => {
    setInspectCampaign(campaign);
    setLoadingDeliveries(true);
    try {
      const res = await axios.get(`/api/events/${eventId}/notifications/${campaign.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInspectDeliveries(res.data.deliveries || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingDeliveries(false);
    }
  };

  // Retry failed deliveries
  const handleRetryCampaign = async (campaignId: number) => {
    setRetryingId(campaignId);
    try {
      await axios.post(`/api/events/${eventId}/notifications/${campaignId}/retry`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      await loadData();
      if (inspectCampaign && inspectCampaign.id === campaignId) {
        await openInspectModal(inspectCampaign);
      }
    } catch (err: any) {
      alert('Retry attempt failed: ' + (err.response?.data?.detail || err.message));
    } finally {
      setRetryingId(null);
    }
  };

  // Save Reminders schedule
  const handleSaveReminders = async () => {
    if (!event) return;
    setSavingReminders(true);
    setReminderSuccessMsg(null);
    try {
      const configs: any[] = [];
      const startTime = event.start_time ? new Date(event.start_time) : null;

      if (remind24h) {
        const time24 = startTime 
          ? new Date(startTime.getTime() - 24 * 60 * 60 * 1000).toISOString()
          : new Date().toISOString();
        configs.push({
          reminder_type: '24h_before',
          scheduled_time: time24,
          is_enabled: true
        });
      }

      if (remind1h) {
        const time1 = startTime 
          ? new Date(startTime.getTime() - 1 * 60 * 60 * 1000).toISOString()
          : new Date().toISOString();
        configs.push({
          reminder_type: '1h_before',
          scheduled_time: time1,
          is_enabled: true
        });
      }

      if (remindCustom && customTime) {
        configs.push({
          reminder_type: 'custom',
          scheduled_time: new Date(customTime).toISOString(),
          custom_message: reminderCustomNote.trim() || undefined,
          is_enabled: true
        });
      }

      await axios.put(`/api/events/${eventId}/reminders`, { reminders: configs }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setReminderSuccessMsg('Automated reminder schedule saved successfully!');
      setTimeout(() => setReminderSuccessMsg(null), 3500);
      await loadData();
    } catch (err: any) {
      alert('Failed to save reminders: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSavingReminders(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center p-8 bg-white rounded-2xl border border-gray-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-600">Loading Notifications Hub...</p>
        </div>
      </div>
    );
  }

  const recipientCount = calculateRecipientCount();

  return (
    <div className="space-y-6">

      {/* TOP BAR / BACK LINK IF STANDALONE */}
      {!eventIdProp && (
        <div className="flex items-center justify-between">
          <Link
            to={`/dashboard/events/${eventId}/participants`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-indigo-600 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Attendee Operations Hub
          </Link>

          <span className="text-xs font-semibold text-gray-500">
            Event: <strong className="text-gray-900">{event?.title}</strong>
          </span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-2xl p-6 sm:p-8 text-white shadow-sm border border-indigo-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 mb-2">
              <Bell className="w-3.5 h-3.5" /> Communications & Broadcasts
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Notification Engine</h1>
            <p className="text-sm text-indigo-200 mt-1 max-w-xl">
              Broadcast announcements, manage automated 24h & 1h event reminders, and inspect delivery telemetry with duplicate prevention.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-xs p-1.5 rounded-xl border border-white/20 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveSection('broadcast')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                activeSection === 'broadcast'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Compose Broadcast
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('reminders')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                activeSection === 'reminders'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              Automated Reminders ({reminders.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('history')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition ${
                activeSection === 'history'
                  ? 'bg-white text-indigo-900 shadow-xs'
                  : 'text-white hover:bg-white/10'
              }`}
            >
              History ({campaigns.length})
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: COMPOSE BROADCAST */}
      {activeSection === 'broadcast' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Mail className="w-5 h-5 text-indigo-600" /> Compose Event Announcement
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Send an email broadcast to your registered attendees or specific teams with branded styling and clear calls-to-action.
            </p>
          </div>

          <div className="space-y-5">
            {/* AUDIENCE SELECTOR */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Target Audience
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetAudience('all')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    targetAudience === 'all'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-gray-900">All Registered Attendees</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{participants.length} eligible participants</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAudience('teams')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    targetAudience === 'teams'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Users className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-gray-900">Selected Teams</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{teams.length} teams available</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetAudience('participants')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-3 ${
                    targetAudience === 'participants'
                      ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-500'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <Mail className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-gray-900">Specific Attendees</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">Select specific people</div>
                  </div>
                </button>
              </div>
            </div>

            {/* TEAM PICKER IF TARGET === TEAMS */}
            {targetAudience === 'teams' && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Select Teams to Message:</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTeamIds.length === teams.length) {
                        setSelectedTeamIds([]);
                      } else {
                        setSelectedTeamIds(teams.map(t => t.id));
                      }
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    {selectedTeamIds.length === teams.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                {teams.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No teams registered yet for this event.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {teams.map(team => (
                      <label key={team.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 text-xs font-medium cursor-pointer hover:bg-indigo-50/30">
                        <input
                          type="checkbox"
                          checked={selectedTeamIds.includes(team.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedTeamIds(prev => [...prev, team.id]);
                            } else {
                              setSelectedTeamIds(prev => prev.filter(id => id !== team.id));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate flex-1 font-bold text-gray-800">{team.team_name}</span>
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">
                          {team.current_member_count}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* PARTICIPANT PICKER IF TARGET === PARTICIPANTS */}
            {targetAudience === 'participants' && (
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={participantSearch}
                    onChange={e => setParticipantSearch(e.target.value)}
                    placeholder="Search attendee by name or email..."
                    className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedParticipantIds.length === participants.length) {
                        setSelectedParticipantIds([]);
                      } else {
                        setSelectedParticipantIds(participants.map(p => p.id));
                      }
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 shrink-0"
                  >
                    {selectedParticipantIds.length === participants.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {participants
                    .filter(p => 
                      p.full_name.toLowerCase().includes(participantSearch.toLowerCase()) || 
                      p.email.toLowerCase().includes(participantSearch.toLowerCase())
                    )
                    .map(part => (
                      <label key={part.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-gray-200 text-xs cursor-pointer hover:bg-indigo-50/30">
                        <input
                          type="checkbox"
                          checked={selectedParticipantIds.includes(part.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedParticipantIds(prev => [...prev, part.id]);
                            } else {
                              setSelectedParticipantIds(prev => prev.filter(id => id !== part.id));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <div className="truncate flex-1">
                          <span className="font-bold text-gray-800 block truncate">{part.full_name}</span>
                          <span className="text-[11px] text-gray-500 block truncate">{part.email}</span>
                        </div>
                      </label>
                    ))}
                </div>
              </div>
            )}

            {/* PRIORITY SELECTOR */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Priority Banner
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'normal', label: 'Standard Update', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                  { id: 'important', label: 'Important Notice', color: 'bg-amber-50 text-amber-800 border-amber-200' },
                  { id: 'urgent', label: 'Urgent Alert', color: 'bg-red-50 text-red-800 border-red-200' }
                ].map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(p.id as any)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition ${
                      priority === p.id 
                        ? `${p.color} ring-2 ring-indigo-500 shadow-2xs` 
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SUBJECT / TITLE */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Announcement Subject <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Schedule Update, Presentation Order, or Venue Check-in Details"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* MESSAGE BODY */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                Announcement Body <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={6}
                required
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your message here. Line breaks are preserved. The email will automatically format with EVENTIVA branding, event information, and contact details."
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {/* RECIPIENT COUNT & DISPATCH ACTION BAR */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Estimated Recipients:</span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                  recipientCount > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-800'
                }`}>
                  {recipientCount} Attendees
                </span>
                {targetAudience === 'teams' && (
                  <span className="text-[11px] text-gray-500">({selectedTeamIds.length} teams selected)</span>
                )}
              </div>

              <button
                type="button"
                disabled={submitting || recipientCount === 0 || !title.trim() || !message.trim()}
                onClick={() => setShowConfirmModal(true)}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition shadow-xs"
              >
                <Send className="w-4 h-4" /> Send Announcement Broadcast
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: AUTOMATED REMINDERS */}
      {activeSection === 'reminders' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
          <div className="border-b border-gray-100 pb-4">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Automated Event Reminders
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure automated reminder triggers. Reminders will only be sent to eligible registered participants (excluding cancelled/rejected registrations).
            </p>
          </div>

          {reminderSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600" /> {reminderSuccessMsg}
            </div>
          )}

          <div className="space-y-4">
            {/* 24H BEFORE */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition">
              <input
                type="checkbox"
                id="remind24h"
                checked={remind24h}
                onChange={e => setRemind24h(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <label htmlFor="remind24h" className="text-sm font-bold text-gray-900 cursor-pointer">
                  24 Hours Before Event Start
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Sends an automated email reminder 1 day prior to help attendees plan travel and review their digital QR ticket pass.
                </p>
                {event?.start_time && (
                  <span className="text-[11px] text-indigo-600 font-semibold mt-1 inline-block">
                    Event Start: {new Date(event.start_time).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* 1H BEFORE */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition">
              <input
                type="checkbox"
                id="remind1h"
                checked={remind1h}
                onChange={e => setRemind1h(e.target.checked)}
                className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <div className="flex-1">
                <label htmlFor="remind1h" className="text-sm font-bold text-gray-900 cursor-pointer">
                  1 Hour Before Event Start
                </label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Last-minute gate reminder prompting participants to have their QR code ready on their phone screen.
                </p>
              </div>
            </div>

            {/* CUSTOM TIME REMINDER */}
            <div className="p-4 rounded-xl border border-gray-200 hover:border-indigo-200 transition space-y-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="remindCustom"
                  checked={remindCustom}
                  onChange={e => setRemindCustom(e.target.checked)}
                  className="mt-1 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <label htmlFor="remindCustom" className="text-sm font-bold text-gray-900 cursor-pointer">
                    Custom Reminder Schedule
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Specify an exact date, time, and custom note for a dedicated reminder.
                  </p>
                </div>
              </div>

              {remindCustom && (
                <div className="pl-7 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Reminder Scheduled Time
                    </label>
                    <input
                      type="datetime-local"
                      value={customTime}
                      onChange={e => setCustomTime(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Custom Reminder Note (Optional)
                    </label>
                    <input
                      type="text"
                      value={reminderCustomNote}
                      onChange={e => setReminderCustomNote(e.target.value)}
                      placeholder="e.g. Bring your laptop and student ID card"
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ACTION BUTTON */}
            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={savingReminders}
                onClick={handleSaveReminders}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {savingReminders ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                {savingReminders ? 'Saving...' : 'Save Reminder Schedule'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await axios.post(`/api/events/${eventId}/reminders/trigger-check`, {}, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    alert(`Checked due reminders. Processed: ${res.data.processed_campaigns.length} reminders.`);
                    await loadData();
                  } catch (err: any) {
                    alert('Error checking reminders: ' + (err.response?.data?.detail || err.message));
                  }
                }}
                className="text-xs font-bold text-gray-600 hover:text-indigo-600 flex items-center gap-1"
              >
                <RotateCw className="w-3.5 h-3.5" /> Check & Process Due Reminders Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NOTIFICATION HISTORY */}
      {activeSection === 'history' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" /> Broadcast & Delivery History
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Audit every announcement, reminder, and schedule change campaign with real-time delivery telemetry.
              </p>
            </div>

            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition"
            >
              <RotateCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {campaigns.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Mail className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-gray-700">No campaigns sent yet.</p>
              <p className="text-xs text-gray-400 mt-0.5">Compose your first announcement above to notify attendees.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {campaigns.map(camp => {
                const completionPct = camp.total_recipients > 0 ? Math.round((camp.sent_count / camp.total_recipients) * 100) : 100;
                return (
                  <div key={camp.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          camp.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : camp.status === 'Partial'
                            ? 'bg-amber-100 text-amber-800'
                            : camp.status === 'Failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {camp.status}
                        </span>

                        <span className="text-xs font-bold text-gray-500 capitalize">
                          {camp.campaign_type.replace('_', ' ')}
                        </span>

                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-400">
                          {new Date(camp.created_at).toLocaleString()}
                        </span>
                      </div>

                      <h3 className="text-base font-black text-gray-900 leading-tight">{camp.title}</h3>
                      <p className="text-xs text-gray-500 line-clamp-1 max-w-xl">{camp.message}</p>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-black text-gray-900">
                          {camp.sent_count} / {camp.total_recipients} Sent
                        </div>
                        <div className="w-24 bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              camp.failed_count > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openInspectModal(camp)}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-lg border border-gray-200 transition flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-gray-500" /> Details
                        </button>

                        {camp.failed_count > 0 && (
                          <button
                            type="button"
                            disabled={retryingId === camp.id}
                            onClick={() => handleRetryCampaign(camp.id)}
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-lg border border-amber-200 transition flex items-center gap-1 disabled:opacity-50"
                          >
                            <RotateCw className={`w-3.5 h-3.5 ${retryingId === camp.id ? 'animate-spin' : ''}`} /> Retry Failed
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Confirm Broadcast Dispatch</h3>
                <p className="text-xs text-gray-500">Please review before sending to attendees</p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Recipients:</span>
                <span className="font-bold text-gray-900">{recipientCount} Attendees</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Priority:</span>
                <span className="font-bold text-gray-900 capitalize">{priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Subject:</span>
                <span className="font-bold text-gray-900 truncate max-w-[200px]">{title}</span>
              </div>
            </div>

            <p className="text-xs text-gray-600">
              This message will be dispatched in the background to all confirmed registered participants. Unsubscribed participants will be safely skipped.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBroadcastSubmit}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition shadow-xs"
              >
                Yes, Dispatch Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INSPECT CAMPAIGN MODAL */}
      {inspectCampaign && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-xl border border-gray-100 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full">
                  Telemetry & Audit
                </span>
                <h3 className="text-xl font-black text-gray-900 mt-1">{inspectCampaign.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Dispatched: {new Date(inspectCampaign.created_at).toLocaleString()}</p>
              </div>

              <button
                type="button"
                onClick={() => setInspectCampaign(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl text-xs text-gray-800 whitespace-pre-wrap font-sans border border-gray-200">
              {inspectCampaign.message}
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Per-Recipient Delivery Status ({inspectDeliveries.length})
                </h4>

                {inspectCampaign.failed_count > 0 && (
                  <button
                    type="button"
                    disabled={retryingId === inspectCampaign.id}
                    onClick={() => handleRetryCampaign(inspectCampaign.id)}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1"
                  >
                    <RotateCw className="w-3.5 h-3.5" /> Retry Failed Recipients
                  </button>
                )}
              </div>

              {loadingDeliveries ? (
                <div className="text-center py-6 text-gray-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                  <p className="text-xs">Loading delivery logs...</p>
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl overflow-hidden divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {inspectDeliveries.map(d => (
                    <div key={d.id} className="p-3 flex items-center justify-between text-xs hover:bg-gray-50/70">
                      <div>
                        <div className="font-bold text-gray-900">{d.recipient_name}</div>
                        <div className="text-[11px] text-gray-500">{d.recipient_email}</div>
                        {d.error_message && (
                          <div className="text-[10px] text-red-600 mt-0.5 font-medium">{d.error_message}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.status === 'sent'
                            ? 'bg-emerald-100 text-emerald-800'
                            : d.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : d.status === 'skipped_unsubscribed'
                            ? 'bg-gray-100 text-gray-700'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}>
                          {d.status === 'skipped_unsubscribed' ? 'Opted Out' : d.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setInspectCampaign(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {!eventIdProp && <PoweredByFooter />}
    </div>
  );
}
