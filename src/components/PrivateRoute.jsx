// src/components/PrivateRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { currentUser } = useAuth();

  // CHANGE: Redirect to /login instead of /
  if (!currentUser) {
    return <Navigate to="/login" />;
  }

  return children;
}
