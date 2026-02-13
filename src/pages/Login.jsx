// src/pages/Login.jsx
import { useState } from "react";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { auth, db } from "../firebase"; 
import { doc, setDoc, getDoc } from "firebase/firestore"; // Added getDoc
import { useNavigate } from "react-router-dom";
import "./Login.css"; 

export default function Login() {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Handle Google Login
  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true); // Show loading state
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // CRITICAL FIX: Check if user exists in DB. If not, create them.
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: user.email,
          role: "participant",
          tokens: 100, // Give free tokens on first Google login
          activeGame: null,
          lockedCategory: null,
          createdAt: new Date(),
        });
      }

      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle Email/Password
  const handleAuth = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up Logic
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create User Doc manually
        await setDoc(doc(db, "users", user.uid), {
            email: user.email,
            role: "participant",
            tokens: 100, // Initial Tokens
            activeGame: null,
            lockedCategory: null,
            createdAt: new Date(),
        });

      } else {
        // Login Logic
        await signInWithEmailAndPassword(auth, email, password);
      }
      navigate("/dashboard");
    } catch (err) {
      if(err.code === 'auth/invalid-credential') setError("Invalid credentials.");
      else if(err.code === 'auth/email-already-in-use') setError("Email already registered.");
      else if(err.code === 'auth/weak-password') setError("Password too weak (min 6 chars).");
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card glass-panel"> {/* Added glass-panel class if you used my index.css */}
        <h1 className="title-main">ADVITYA</h1>
        <h2 className="title-sub">{isSignUp ? "CITIZEN REGISTRATION" : "IDENTITY VERIFICATION"}</h2>

        {/* Toggle Switch */}
        <div className="auth-toggle">
            <button 
                className={!isSignUp ? "active" : ""} 
                onClick={() => setIsSignUp(false)}>LOGIN</button>
            <button 
                className={isSignUp ? "active" : ""} 
                onClick={() => setIsSignUp(true)}>SIGN UP</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={handleAuth} className="auth-form">
            <div className="input-group">
                <input 
                    type="email" 
                    required 
                    placeholder="EMAIL ID"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
            </div>

            <div className="input-group" style={{marginTop:'15px'}}>
                <input 
                    type="password" 
                    required 
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>

            <button type="submit" className="btn-enter" disabled={loading}>
                {loading ? "PROCESSING..." : (isSignUp ? "REGISTER VISA" : "ACCESS SYSTEM")}
            </button>
        </form>

        <div className="divider">OR</div>

        <button onClick={handleGoogleLogin} className="btn-google">
           <span className="google-icon">G</span> CONTINUE WITH GOOGLE
        </button>

      </div>
    </div>
  );
}