import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ProjectsPage } from '@/pages/projects';
import { ProjectDetailPage } from '@/pages/projects/detail';
import { FlowEditorPage } from '@/pages/projects/flow-editor';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/auth/login';
import { RegisterPage } from '@/pages/auth/register';
import { SettingsPage } from '@/pages/settings';
import { AdminLayout } from '@/components/layout/admin-layout';
import { upsertPendingMemberInvitation } from '@/utils/member-invitations';
import { toast } from 'sonner';

function InvitationCapture() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('invite_token') || params.get('invitation_token') || params.get('token');
    const projectIdFromQuery = params.get('project_id') || params.get('pid');
    const projectIdFromPath = location.pathname.match(/^\/projects\/(\d+)/)?.[1];
    const projectId = Number(projectIdFromQuery || projectIdFromPath || 0);

    if (!token || !Number.isInteger(projectId) || projectId <= 0) return;

    const result = upsertPendingMemberInvitation(projectId, token);
    if (result.added) {
      toast.success('Invitation added to your pending list');
    }

    params.delete('invite_token');
    params.delete('invitation_token');
    params.delete('token');
    params.delete('project_id');
    params.delete('pid');
    const nextSearch = params.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}

function App() {
  return (
    <>
      <InvitationCapture />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/projects" element={<AdminLayout><ProjectsPage /></AdminLayout>} />
        <Route path="/projects/:id" element={<AdminLayout><ProjectDetailPage /></AdminLayout>} />
        <Route path="/projects/:id/api-specs/:sid" element={<AdminLayout><ProjectDetailPage /></AdminLayout>} />
        <Route path="/projects/:id/flows/:fid" element={<AdminLayout><FlowEditorPage /></AdminLayout>} />
        <Route path="/settings" element={<AdminLayout><SettingsPage /></AdminLayout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
