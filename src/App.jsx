import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Attendance from './pages/Attendance';
import Login from './pages/Login';
import Teacher from './pages/Teacher';
import Admin from './pages/Admin';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/attendance" replace />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/login" element={<Login />} />
            <Route
              path="/teacher"
              element={
                <ProtectedRoute roles={['teacher', 'admin']}>
                  <Teacher />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={['admin']}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/attendance" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
