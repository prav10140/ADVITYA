// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Home from "./pages/Home";       
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ManagerPanel from "./pages/ManagerPanel"; // Ensure you have this file from previous steps
import AdminPanel from "./pages/AdminPanel";     // Ensure you have this file from previous steps

// 1. Protected Route
const ProtectedRoute = ({ children, requiredRole }) => {
  const { currentUser, userRole, loading } = useAuth();

  if (loading) return <div style={{background:'#000', height:'100vh'}}></div>;

  if (!currentUser) return <Navigate to="/login" replace />;
  
  if (requiredRole && userRole !== requiredRole && userRole !== 'admin') {
    return <div style={{color:'red', background:'#000', height:'100vh', padding:'20px'}}>ACCESS DENIED.</div>;
  }

  return children;
};

// 2. Public Route (Redirects to Dashboard if logged in)
const PublicRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) return null;

  if (currentUser) return <Navigate to="/dashboard" replace />;

  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicRoute><Home /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          
          <Route path="/manager" element={<ProtectedRoute requiredRole="manager"><ManagerPanel /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminPanel /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}