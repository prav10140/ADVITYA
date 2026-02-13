// src/components/PrivateRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { currentUser } = useAuth();

  // If no user is logged in, redirect them to the Login page
  if (!currentUser) {
    return <Navigate to="/" />;
  }

  // If user is logged in, show the protected page (Dashboard/Admin)
  return children;
}