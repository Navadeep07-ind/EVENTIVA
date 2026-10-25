import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import PublicEvent from './pages/PublicEvent';
import TicketPass from './pages/TicketPass';
import JoinTeam from './pages/JoinTeam';
import TeamHub from './pages/TeamHub';
import Unsubscribe from './pages/Unsubscribe';
import ParticipantLiveDashboard from './pages/ParticipantLiveDashboard';
import DirectTaskSubmission from './pages/DirectTaskSubmission';

function GeneratorRedirect() {
  const location = useLocation();
  return <Navigate to={`/dashboard/poster-generator${location.search}`} replace />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard/*" element={<Dashboard />} />
        <Route path="/events/:id" element={<PublicEvent />} />
        <Route path="/events/:id/live" element={<ParticipantLiveDashboard />} />
        <Route path="/events/:id/portal" element={<ParticipantLiveDashboard />} />
        <Route path="/events/:eventId/tasks/:taskId/submit" element={<DirectTaskSubmission />} />
        <Route path="/events/:eventId/tasks/:taskId" element={<DirectTaskSubmission />} />
        <Route path="/tickets/:ticketCode" element={<TicketPass />} />
        <Route path="/teams/join/:inviteCode" element={<JoinTeam />} />
        <Route path="/teams/join" element={<JoinTeam />} />
        <Route path="/teams/hub/:inviteCode" element={<TeamHub />} />
        <Route path="/teams/:teamId" element={<TeamHub />} />
        <Route path="/notifications/unsubscribe/:token" element={<Unsubscribe />} />
        <Route path="/generator" element={<GeneratorRedirect />} />
        <Route path="/generator/:id" element={<GeneratorRedirect />} />
        <Route path="/poster-generator" element={<GeneratorRedirect />} />
      </Routes>
    </Router>
  );
}

export default App;
