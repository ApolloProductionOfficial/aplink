import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

// This page redirects to appropriate dashboard based on auth status
const MeetingHistory = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    
    if (!user) {
      // Not logged in - redirect to auth
      navigate('/auth');
    } else if (isAdmin) {
      // Admin - redirect to admin panel
      navigate('/admin');
    } else {
      // Regular user - redirect to dashboard
      navigate('/dashboard');
    }
  }, [user, isAdmin, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-12 h-12 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
};

export default MeetingHistory;
