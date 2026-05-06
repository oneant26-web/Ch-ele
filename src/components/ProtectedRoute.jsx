import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Spinner from './Spinner';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  const allowed = !roles || roles.includes(user.role) || (user.position === '행정팀' && roles.includes('admin'));
  if (!allowed) return <Navigate to="/login" replace />;
  return children;
}
