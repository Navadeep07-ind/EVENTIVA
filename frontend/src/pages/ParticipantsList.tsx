import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Search, 
  Filter, 
  QrCode, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  AlertTriangle, 
  Copy, 
  Check, 
  Eye, 
  RefreshCw, 
  FileSpreadsheet, 
  ArrowLeft,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ShieldAlert,
  Users,
  ChevronDown,
  ChevronUp,
  Crown,
  Bell,
  Share2
} from 'lucide-react';
import NotificationsHub from './NotificationsHub';
import ShareRegistrationModal from '../components/ShareRegistrationModal';

interface Participant {
  id: number;
  event_id: number;
  full_name: string;
  email: string;
  college?: string;
  custom_answers?: Record<string, any>;
  status: string;
  ticket_code?: string;
  ticket_url?: string;
  checked_in: boolean;
  checked_in_at?: string;
  team_id?: number;
  team_name?: string;
  is_team_leader?: boolean;
  created_at: string;
}

interface TeamItem {
  id: number;
  team_name: string;
  event_id: number;
  invite_code: string;
  status: string;
  leader_name?: string;
  leader_email?: string;
  leader_college?: string;
  current_member_count: number;
  min_team_size: number;
  max_team_size: number;
  is_complete: boolean;
  members: Participant[];
  created_at: string;
}

interface Stats {
  total: number;
  checked_in: number;
  pending: number;
  approved: number;
  cancelled: number;
  rejected: number;
}

export default function ParticipantsList() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<any>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [activeHubTab, setActiveHubTab] = useState<'attendees' | 'teams' | 'notifications'>('attendees');
  const [expandedTeamId, setExpandedTeamId] = useState<number | null>(null);
  const [teamSearchQuery, setTeamSearchQuery] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [checkInFilter, setCheckInFilter] = useState('ALL'); // ALL, CHECKED_IN, PENDING
  const [sortBy, setSortBy] = useState<'created_at' | 'name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Selected participant for custom answers modal
  const [viewingAnswers, setViewingAnswers] = useState<Participant | null>(null);

  // Status Change Confirmation Dialog
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    participant: Participant;
    newStatus: string;
  } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Quick Inline Check-in Loading
  const [checkingInId, setCheckingInId] = useState<number | null>(null);

  // QR Scanner Modal State
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerResult, setScannerResult] = useState<{
    type: 'success' | 'already' | 'error';
    message: string;
    attendeeName?: string;
    ticketCode?: string;
    checkedInAt?: string;
  } | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Exporting state
  const [exporting, setExporting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const loadData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [evtRes, partsRes, statsRes, teamsRes] = await Promise.all([
        axios.get(`/api/events/${id}`, authHeaders),
        axios.get(`/api/events/${id}/registrations`, authHeaders),
        axios.get(`/api/events/${id}/registrations/stats`, authHeaders).catch(() => ({ data: null })),
        axios.get(`/api/events/${id}/teams`, authHeaders).catch(() => ({ data: [] }))
      ]);

      setEvent(evtRes.data);
      setParticipants(partsRes.data);
      setTeams(teamsRes.data || []);
      if (statsRes.data) {
        setStats(statsRes.data);
      } else {
        // Compute client side fallback
        const total = partsRes.data.length;
        const checked = partsRes.data.filter((p: Participant) => p.checked_in).length;
        setStats({
          total,
          checked_in: checked,
          pending: total - checked,
          approved: partsRes.data.filter((p: Participant) => ['registered', 'approved'].includes(p.status.toLowerCase())).length,
          cancelled: partsRes.data.filter((p: Participant) => p.status.toLowerCase() === 'cancelled').length,
          rejected: partsRes.data.filter((p: Participant) => p.status.toLowerCase() === 'rejected').length
        });
      }
    } catch (err: any) {
      console.error('Failed to load participants:', err);
      setError(err.response?.data?.detail || 'Failed to load attendees. Please ensure you are authorized.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // Clean up scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(console.error);
      }
    };
  }, []);

  // Filtered & Sorted participants
  const filteredParticipants = useMemo(() => {
    return participants.filter(p => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = p.full_name?.toLowerCase().includes(q);
        const emailMatch = p.email?.toLowerCase().includes(q);
        const codeMatch = p.ticket_code?.toLowerCase().includes(q);
        const collegeMatch = p.college?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !codeMatch && !collegeMatch) return false;
      }

      // Status filter
      if (statusFilter !== 'ALL') {
        if (p.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }

      // Check-in filter
      if (checkInFilter === 'CHECKED_IN' && !p.checked_in) return false;
      if (checkInFilter === 'PENDING' && p.checked_in) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.full_name.toLowerCase();
        const nameB = b.full_name.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      }
    });
  }, [participants, searchQuery, statusFilter, checkInFilter, sortBy, sortOrder]);

  // Paginated records
  const totalPages = Math.ceil(filteredParticipants.length / pageSize) || 1;
  const paginatedParticipants = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredParticipants.slice(start, start + pageSize);
  }, [filteredParticipants, currentPage, pageSize]);

  const filteredTeams = useMemo(() => {
    return teams.filter(t => {
      if (!teamSearchQuery.trim()) return true;
      const q = teamSearchQuery.toLowerCase();
      return (
        t.team_name.toLowerCase().includes(q) ||
        (t.leader_name && t.leader_name.toLowerCase().includes(q)) ||
        (t.leader_email && t.leader_email.toLowerCase().includes(q)) ||
        t.invite_code.toLowerCase().includes(q)
      );
    });
  }, [teams, teamSearchQuery]);

  // Quick single check-in toggle
  const handleQuickCheckIn = async (participant: Participant) => {
    if (!participant.ticket_code) return;
    setCheckingInId(participant.id);
    try {
      const res = await axios.post(`/api/events/${id}/check-in`, {
        ticket_code: participant.ticket_code
      }, authHeaders);

      if (res.data.status === 'success' || res.data.status === 'already_checked_in') {
        setParticipants(prev => prev.map(p => {
          if (p.id === participant.id) {
            return {
              ...p,
              checked_in: true,
              checked_in_at: res.data.checked_in_at || new Date().toISOString()
            };
          }
          return p;
        }));
        if (stats) {
          setStats({
            ...stats,
            checked_in: stats.checked_in + (participant.checked_in ? 0 : 1),
            pending: Math.max(0, stats.pending - (participant.checked_in ? 0 : 1))
          });
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Check-in failed');
    } finally {
      setCheckingInId(null);
    }
  };

  // Status update execution
  const executeStatusChange = async () => {
    if (!pendingStatusChange) return;
    const { participant, newStatus } = pendingStatusChange;
    setUpdatingStatus(true);
    try {
      const res = await axios.put(
        `/api/events/${id}/registrations/${participant.id}`,
        { status: newStatus },
        authHeaders
      );

      setParticipants(prev => prev.map(p => (p.id === participant.id ? res.data : p)));
      setPendingStatusChange(null);
      // Reload stats
      loadData(true);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update registration status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Export Excel (.xlsx) from backend
  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const res = await axios.get(`/api/events/${id}/registrations/export`, {
        ...authHeaders,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const cleanTitle = (event?.title || 'event').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 30);
      link.setAttribute('download', `${cleanTitle}_participants.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Export failed:', err);
      alert('Failed to export Excel file. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Start QR Camera Scanner
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setScannerResult(null);
      await new Promise(r => setTimeout(r, 150)); // Allow DOM node to mount

      const html5QrCode = new Html5Qrcode("qr-scanner-mount");
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        async (decodedText) => {
          // Pause camera while processing
          if (html5QrCode.isScanning) {
            await html5QrCode.pause();
          }
          await processCheckInCode(decodedText);
        },
        () => {
          // Frame scan error (ignore normal no-code frames)
        }
      );
    } catch (err) {
      console.error('Camera start error:', err);
      setCameraActive(false);
      setScannerResult({
        type: 'error',
        message: 'Camera permission denied or camera not available. Use manual code entry below.'
      });
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
      } catch (err) {
        console.error('Error stopping camera:', err);
      }
    }
    setCameraActive(false);
  };

  const openScanner = () => {
    setScannerOpen(true);
    setScannerResult(null);
    setManualCode('');
    startCamera();
  };

  const closeScanner = async () => {
    await stopCamera();
    setScannerOpen(false);
    setScannerResult(null);
  };

  // Process ticket code scan or manual entry
  const processCheckInCode = async (rawInput: string) => {
    setScannerLoading(true);
    try {
      const match = rawInput.match(/EVT-[A-Za-z0-9]+/i);
      const code = match ? match[0].toUpperCase() : rawInput.trim().toUpperCase();

      const res = await axios.post(`/api/events/${id}/check-in`, {
        ticket_code: code
      }, authHeaders);

      const data = res.data;
      if (data.status === 'already_checked_in') {
        setScannerResult({
          type: 'already',
          message: data.message || 'Attendee was already admitted.',
          attendeeName: data.attendee_name,
          ticketCode: data.ticket_code,
          checkedInAt: data.checked_in_at
        });
      } else {
        setScannerResult({
          type: 'success',
          message: data.message || 'Admission Confirmed!',
          attendeeName: data.attendee_name,
          ticketCode: data.ticket_code,
          checkedInAt: data.checked_in_at
        });

        // Update list
        setParticipants(prev => prev.map(p => {
          if (p.ticket_code === data.ticket_code) {
            return { ...p, checked_in: true, checked_in_at: data.checked_in_at };
          }
          return p;
        }));

        if (stats) {
          setStats({
            ...stats,
            checked_in: stats.checked_in + 1,
            pending: Math.max(0, stats.pending - 1)
          });
        }
      }
    } catch (err: any) {
      setScannerResult({
        type: 'error',
        message: err.response?.data?.detail || 'Invalid ticket code or check-in failed.'
      });
    } finally {
      setScannerLoading(false);
    }
  };

  const resumeScan = async () => {
    setScannerResult(null);
    if (html5QrCodeRef.current) {
      try {
        html5QrCodeRef.current.resume();
      } catch (err) {
        console.error(err);
        startCamera();
      }
    } else {
      startCamera();
    }
  };

  const copyTicketCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-gray-500">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="font-medium text-sm">Loading Attendee Operations Hub...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link 
              to="/dashboard/events" 
              className="text-xs font-medium text-gray-500 hover:text-indigo-600 inline-flex items-center gap-1 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to My Events
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Attendee Operations Hub
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {event?.title} • Live check-in scanner, admissions workflow, and roster export.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to={`/dashboard/events/${id}/live`}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-xs transition"
            title="Open Live Event Control Center"
          >
            <span>⚡</span>
            <span>Live Hub</span>
          </Link>

          <button
            onClick={() => setIsShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs sm:text-sm font-semibold shadow-xs transition"
            title="Share Registration Form"
          >
            <Share2 className="w-4 h-4 text-indigo-600" />
            Share Form
          </button>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs sm:text-sm font-medium shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            Refresh
          </button>

          <button
            onClick={openScanner}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-medium shadow-sm transition shadow-indigo-600/20"
          >
            <QrCode className="w-4 h-4" />
            Scan QR Pass
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting || participants.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-medium shadow-sm transition shadow-emerald-600/20 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {exporting ? 'Generating Excel...' : 'Export Excel (.xlsx)'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hub Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveHubTab('attendees')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeHubTab === 'attendees'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-4 h-4" />
          All Attendees ({participants.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveHubTab('teams')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeHubTab === 'teams'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Crown className="w-4 h-4 text-amber-500" />
          Teams Overview ({teams.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveHubTab('notifications')}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition flex items-center gap-2 ${
            activeHubTab === 'notifications'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Bell className="w-4 h-4 text-indigo-600" />
          Broadcasts & Reminders
        </button>
      </div>

      {activeHubTab === 'attendees' && (
        <>
          {/* Metric Cards Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Total Registered</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900">{stats?.total ?? participants.length}</div>
          <div className="text-xs text-gray-400 mt-1">
            Capacity: {event?.max_participants ? `${event.max_participants} max` : 'Unlimited'}
          </div>
        </div>

        <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
          <div className="flex items-center justify-between text-emerald-800 text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Admitted (Checked In)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-700">{stats?.checked_in ?? 0}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium">
            {stats && stats.total > 0 ? `${Math.round((stats.checked_in / stats.total) * 100)}% attendance rate` : '0% checked in'}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Pending Check-In</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900">{stats?.pending ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">Awaiting gate arrival</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
            <span>Cancelled / Revoked</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-3xl font-extrabold text-gray-900">
            {(stats?.cancelled ?? 0) + (stats?.rejected ?? 0)}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {stats?.cancelled ?? 0} Cancelled • {stats?.rejected ?? 0} Rejected
          </div>
        </div>
      </div>

      {/* Filter, Search & Sort Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, email, college, or ticket code..."
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </div>
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 border border-gray-300 bg-white rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Registered">Registered</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>

            <select
              value={checkInFilter}
              onChange={e => {
                setCheckInFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="py-1.5 px-3 border border-gray-300 bg-white rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Admission States</option>
              <option value="CHECKED_IN">Checked In</option>
              <option value="PENDING">Pending Check-in</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={e => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb as any);
                setSortOrder(so as any);
              }}
              className="py-1.5 px-3 border border-gray-300 bg-white rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="created_at-desc">Registered (Newest First)</option>
              <option value="created_at-asc">Registered (Oldest First)</option>
              <option value="name-asc">Name (A to Z)</option>
              <option value="name-desc">Name (Z to A)</option>
            </select>
          </div>
        </div>

        {/* Filter stats pill */}
        <div className="flex items-center justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
          <span>
            Showing <strong className="text-gray-900">{filteredParticipants.length}</strong> of {participants.length} attendees
            {searchQuery && ` matching "${searchQuery}"`}
          </span>
          {(searchQuery || statusFilter !== 'ALL' || checkInFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
                setCheckInFilter('ALL');
                setCurrentPage(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Attendee Data Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 text-xs font-semibold uppercase tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-3.5">Attendee</th>
                <th scope="col" className="px-5 py-3.5">Contact Details</th>
                <th scope="col" className="px-5 py-3.5">Ticket Code</th>
                <th scope="col" className="px-5 py-3.5">Registration Status</th>
                <th scope="col" className="px-5 py-3.5">Check-In Status</th>
                <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {paginatedParticipants.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="font-medium text-sm text-gray-700">No attendees match your query.</p>
                    <p className="text-xs text-gray-400 mt-1">Try clearing filters or search terms.</p>
                  </td>
                </tr>
              ) : (
                paginatedParticipants.map(p => {
                  const isCancelled = ['cancelled', 'rejected'].includes(p.status.toLowerCase());
                  const formattedRegDate = new Date(p.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition">
                      {/* Attendee Name & College */}
                      <td className="px-5 py-4">
                        <div className="font-bold text-gray-900">{p.full_name}</div>
                        <div className="text-xs text-gray-500">{p.college || 'General Registration'}</div>
                        {p.team_name && (
                          <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {p.is_team_leader ? '👑 Leader: ' : '👥 Team: '}{p.team_name}
                          </div>
                        )}
                        <div className="text-[11px] text-gray-400 mt-0.5">Registered: {formattedRegDate}</div>
                      </td>

                      {/* Contact Details (Email + Phone) */}
                      <td className="px-5 py-4">
                        <div className="text-xs font-medium text-gray-800">{p.email}</div>
                        {p.custom_answers && (p.custom_answers.phone || p.custom_answers.phone_number || p.custom_answers.contact) && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {p.custom_answers.phone || p.custom_answers.phone_number || p.custom_answers.contact}
                          </div>
                        )}
                      </td>

                      {/* Ticket Code */}
                      <td className="px-5 py-4 font-mono">
                        {p.ticket_code ? (
                          <div className="inline-flex items-center gap-1.5">
                            <Link 
                              to={`/tickets/${p.ticket_code}`} 
                              target="_blank"
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                              title="Open public pass"
                            >
                              {p.ticket_code}
                              <ExternalLink className="w-3 h-3 opacity-60" />
                            </Link>
                            <button
                              onClick={() => copyTicketCode(p.ticket_code!)}
                              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
                              title="Copy ticket code"
                            >
                              {copiedCode === p.ticket_code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>

                      {/* Registration Status Dropdown / Badge */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={p.status}
                            onChange={(e) => {
                              const newStatus = e.target.value;
                              if (['Cancelled', 'Rejected'].includes(newStatus)) {
                                setPendingStatusChange({ participant: p, newStatus });
                              } else {
                                // Execute directly
                                setPendingStatusChange({ participant: p, newStatus });
                                executeStatusChange();
                              }
                            }}
                            className={`text-xs font-bold rounded-lg py-1 px-2.5 border focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                              p.status.toLowerCase() === 'approved' || p.status.toLowerCase() === 'registered'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.status.toLowerCase() === 'cancelled'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-red-50 text-red-700 border-red-200'
                            }`}
                          >
                            <option value="Registered">Registered</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </td>

                      {/* Check-In Status & Timestamp */}
                      <td className="px-5 py-4">
                        {p.checked_in ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" /> Admitted
                            </span>
                            {p.checked_in_at && (
                              <div className="text-[11px] text-gray-400 mt-0.5">
                                {new Date(p.checked_in_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-gray-400">Pending</span>
                            {!isCancelled && p.ticket_code && (
                              <button
                                onClick={() => handleQuickCheckIn(p)}
                                disabled={checkingInId === p.id}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition disabled:opacity-50"
                              >
                                {checkingInId === p.id ? 'Checking In...' : 'Check In'}
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Custom Answers Modal Action */}
                      <td className="px-5 py-4 text-right">
                        {p.custom_answers && Object.keys(p.custom_answers).length > 0 ? (
                          <button
                            onClick={() => setViewingAnswers(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Answers ({Object.keys(p.custom_answers).length})
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-gray-200 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Page <strong className="text-gray-900">{currentPage}</strong> of <strong>{totalPages}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* TEAMS OVERVIEW VIEW */}
      {activeHubTab === 'teams' && (
        <div className="space-y-6">
          {/* Teams Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
                <span>Total Teams</span>
                <Users className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">{teams.length}</div>
              <div className="text-xs text-gray-400 mt-1">Configured for {event?.title}</div>
            </div>

            <div className="bg-white border border-emerald-200/80 rounded-2xl p-5 shadow-sm bg-gradient-to-br from-white to-emerald-50/30">
              <div className="flex items-center justify-between text-emerald-800 text-xs uppercase tracking-wider font-semibold mb-2">
                <span>Full Teams</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-3xl font-extrabold text-emerald-700">
                {teams.filter(t => t.is_complete).length}
              </div>
              <div className="text-xs text-emerald-600 mt-1 font-medium">Max capacity reached</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
                <span>Active / Recruiting</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">
                {teams.filter(t => !t.is_complete).length}
              </div>
              <div className="text-xs text-gray-400 mt-1">Has open member spots</div>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between text-gray-500 text-xs uppercase tracking-wider font-semibold mb-2">
                <span>Total Team Members</span>
                <Crown className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-3xl font-extrabold text-gray-900">
                {teams.reduce((acc, t) => acc + (t.current_member_count || 0), 0)}
              </div>
              <div className="text-xs text-gray-400 mt-1">Across all registered teams</div>
            </div>
          </div>

          {/* Teams Search Bar */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={teamSearchQuery}
                onChange={e => setTeamSearchQuery(e.target.value)}
                placeholder="Search teams by team name, leader name, email, or invite code..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {teamSearchQuery && (
                <button
                  onClick={() => setTeamSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Teams List */}
          <div className="space-y-4">
            {filteredTeams.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h4 className="text-base font-bold text-gray-900 mb-1">No Teams Found</h4>
                <p className="text-xs text-gray-500">
                  {teamSearchQuery ? 'No teams match your search term.' : 'No teams have registered for this event yet.'}
                </p>
              </div>
            ) : (
              filteredTeams.map(t => {
                const isExpanded = expandedTeamId === t.id;
                const pct = Math.min(100, Math.round((t.current_member_count / (t.max_team_size || 1)) * 100));

                return (
                  <div key={t.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-black text-gray-900">{t.team_name}</h3>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            t.is_complete ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {t.is_complete ? 'Roster Full' : 'Recruiting'}
                          </span>
                        </div>

                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>
                            Leader: <strong className="text-gray-800">{t.leader_name || 'N/A'}</strong> ({t.leader_email || 'No email'})
                          </span>
                          {t.leader_college && (
                            <span>• {t.leader_college}</span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Progress Bar & Counter */}
                        <div className="w-36">
                          <div className="flex justify-between text-[11px] font-semibold text-gray-500 mb-1">
                            <span>{t.current_member_count} of {t.max_team_size}</span>
                            <span>{pct}%</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${t.is_complete ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Invite Code Pill with Copy */}
                        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
                          <span className="font-mono text-xs font-bold text-gray-800">{t.invite_code}</span>
                          <button
                            type="button"
                            onClick={() => copyTicketCode(t.invite_code)}
                            className="text-gray-400 hover:text-gray-600 ml-1"
                            title="Copy Code"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Toggle Roster Button */}
                        <button
                          type="button"
                          onClick={() => setExpandedTeamId(isExpanded ? null : t.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition"
                        >
                          {isExpanded ? (
                            <>Hide Members <ChevronUp className="w-3.5 h-3.5" /></>
                          ) : (
                            <>View Members ({t.members?.length || t.current_member_count}) <ChevronDown className="w-3.5 h-3.5" /></>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* EXPANDED MEMBER ROSTER */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-slate-50/60 p-4 sm:p-5">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
                            <thead className="text-gray-500 uppercase tracking-wider font-bold">
                              <tr>
                                <th scope="col" className="px-3 py-2">Role</th>
                                <th scope="col" className="px-3 py-2">Member</th>
                                <th scope="col" className="px-3 py-2">Email</th>
                                <th scope="col" className="px-3 py-2">Ticket Code</th>
                                <th scope="col" className="px-3 py-2">Check-in Status</th>
                                <th scope="col" className="px-3 py-2 text-right">Gate Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {t.members?.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50">
                                  <td className="px-3 py-2.5">
                                    {m.is_team_leader ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-amber-100 text-amber-800">
                                        <Crown className="w-3 h-3 text-amber-600" /> Leader
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">
                                        Member
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 font-bold text-gray-900">
                                    {m.full_name}
                                    {m.college && <div className="text-[11px] text-gray-400 font-normal">{m.college}</div>}
                                  </td>
                                  <td className="px-3 py-2.5 text-gray-600">{m.email}</td>
                                  <td className="px-3 py-2.5 font-mono text-indigo-600 font-bold">
                                    {m.ticket_code ? (
                                      <Link to={`/tickets/${m.ticket_code}`} target="_blank" className="hover:underline flex items-center gap-1">
                                        {m.ticket_code}
                                        <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                      </Link>
                                    ) : '—'}
                                  </td>
                                  <td className="px-3 py-2.5">
                                    {m.checked_in ? (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                        <CheckCircle2 className="w-3 h-3" /> Checked In
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600">
                                        <Clock className="w-3 h-3" /> Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-right">
                                    {!m.checked_in && m.ticket_code && (
                                      <button
                                        type="button"
                                        disabled={checkingInId === m.id}
                                        onClick={() => handleQuickCheckIn(m)}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition disabled:opacity-50"
                                      >
                                        {checkingInId === m.id ? 'Checking...' : 'Admit Attendee'}
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {activeHubTab === 'notifications' && (
        <NotificationsHub eventIdProp={id} />
      )}

      {/* QR CAMERA SCANNER MODAL */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-base">Gate Check-In Scanner</h3>
                {cameraActive && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              <button 
                onClick={closeScanner}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Camera Viewport or Verification Result */}
            <div className="p-5">
              {scannerResult ? (
                <div className={`p-6 rounded-2xl text-center border ${
                  scannerResult.type === 'success' 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                    : scannerResult.type === 'already'
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 border">
                    {scannerResult.type === 'success' ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    ) : scannerResult.type === 'already' ? (
                      <AlertTriangle className="w-8 h-8 text-amber-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-rose-400" />
                    )}
                  </div>

                  <h4 className="text-xl font-bold mb-1">
                    {scannerResult.type === 'success' ? 'Admission Confirmed!' : scannerResult.type === 'already' ? 'Already Admitted' : 'Admission Denied'}
                  </h4>

                  <p className="text-xs text-slate-300 mb-4">{scannerResult.message}</p>

                  {scannerResult.attendeeName && (
                    <div className="bg-slate-950/60 p-3 rounded-xl text-left border border-slate-800 mb-4">
                      <div className="text-[11px] text-slate-400 uppercase font-semibold">Attendee</div>
                      <div className="text-sm font-bold text-white">{scannerResult.attendeeName}</div>
                      <div className="text-xs font-mono text-indigo-400 mt-0.5">{scannerResult.ticketCode}</div>
                    </div>
                  )}

                  <button
                    onClick={resumeScan}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs sm:text-sm transition"
                  >
                    Scan Next Ticket
                  </button>
                </div>
              ) : (
                <div>
                  <div 
                    id="qr-scanner-mount" 
                    className="rounded-2xl overflow-hidden bg-black border border-slate-800 aspect-square flex items-center justify-center text-slate-500 text-xs"
                  />
                  <p className="text-xs text-slate-400 text-center mt-3">
                    Point camera at attendee's digital ticket or printed pass QR code.
                  </p>
                </div>
              )}

              {/* Manual Entry Fallback */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Manual Code Entry Fallback
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value.toUpperCase())}
                    placeholder="e.g. EVT-F01F7DC8"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={() => {
                      if (manualCode.trim()) processCheckInCode(manualCode);
                    }}
                    disabled={scannerLoading || !manualCode.trim()}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-xs font-medium rounded-xl transition"
                  >
                    {scannerLoading ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATUS CHANGE CONFIRMATION MODAL */}
      {pendingStatusChange && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Confirm Status Change to {pendingStatusChange.newStatus}?
            </h3>
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              Changing <strong>{pendingStatusChange.participant.full_name}</strong>'s status to <strong>{pendingStatusChange.newStatus}</strong> will immediately revoke admission validity for ticket <strong>{pendingStatusChange.participant.ticket_code}</strong>.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setPendingStatusChange(null)}
                disabled={updatingStatus}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={executeStatusChange}
                disabled={updatingStatus}
                className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm"
              >
                {updatingStatus ? 'Updating...' : `Confirm ${pendingStatusChange.newStatus}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW CUSTOM ANSWERS MODAL */}
      {viewingAnswers && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{viewingAnswers.full_name}</h3>
                <p className="text-xs text-gray-500">{viewingAnswers.email} • {viewingAnswers.ticket_code}</p>
              </div>
              <button
                onClick={() => setViewingAnswers(null)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1">
              {viewingAnswers.custom_answers && Object.entries(viewingAnswers.custom_answers).map(([key, val]) => (
                <div key={key} className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm font-medium text-slate-900">
                    {Array.isArray(val) ? val.join(', ') : String(val)}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 pt-3 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setViewingAnswers(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Registration Form Modal */}
      <ShareRegistrationModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        event={event}
      />
    </div>
  );
}
