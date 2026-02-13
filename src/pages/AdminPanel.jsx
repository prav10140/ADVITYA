// src/pages/AdminPanel.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
// 1. IMPORT arrayUnion
import { collection, onSnapshot, doc, updateDoc, increment, getDoc, arrayUnion } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./AdminPanel.css";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  // --- SECURITY CHECK (Allow Admins OR Managers) ---
  useEffect(() => {
    const checkAdmin = async () => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        // Check for BOTH roles
        const role = userDoc.data()?.role;
        if (role !== "admin" && role !== "manager") {
          alert("ACCESS DENIED: CLEARANCE LEVEL TOO LOW.");
          navigate("/dashboard");
        }
      }
    };
    checkAdmin();
  }, [currentUser, navigate]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  // --- ACTIONS ---

  const manualAdjust = async (userId, amount) => {
    const reason = prompt("Reason? (Log only)");
    if(reason === null) return;
    await updateDoc(doc(db, "users", userId), { tokens: increment(amount) });
  };

  const resetLocks = async (userId) => {
    if(!window.confirm("RESET USER?")) return;
    await updateDoc(doc(db, "users", userId), { lockedCategory: null, activeGame: null, unlockedSameCategory: false });
  };

  // --- NEW FUNCTION: MARK GAME AS COMPLETE ---
  const markComplete = async (user) => {
    if (!user.activeGame) return;
    if (!window.confirm(`Confirm completion for ${user.displayName}?`)) return;

    await updateDoc(doc(db, "users", user.id), {
        activeGame: null,
        // Add to history (Fixes Leaderboard)
        completedGames: arrayUnion(user.activeGame.gameId)
        // No tokens added (per your request)
    });
  };

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div>
            <h1 className="admin-title">MANAGER CONTROL</h1>
            <div style={{color:'#666'}}>AUTHORIZED PERSONNEL ONLY</div>
        </div>
        <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
            <button onClick={() => navigate('/dashboard')} className="btn-back">EXIT TO DASHBOARD</button>
        </div>
      </header>
      
      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th>CITIZEN</th>
              <th>ROLE</th>
              <th>VISA</th>
              <th>ACTIVE MISSION</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td>
                  <div style={{fontWeight:'bold', color:'#fff'}}>{u.displayName || "Unknown"}</div>
                  <div style={{fontSize:'0.8rem', color:'#555'}}>{u.email}</div>
                </td>
                <td>
                  <span className={`badge ${u.role === 'admin' ? 'badge-admin' : u.role === 'manager' ? 'badge-manager' : 'badge-user'}`}>
                    {u.role}
                  </span>
                </td>
                <td style={{color: '#ffd700'}}>{u.tokens}</td>
                <td>
                  {u.activeGame ? (
                    <div style={{color:'#00ff41', fontWeight:'bold'}}>
                      {u.activeGame.gameId}
                    </div>
                  ) : (
                    <span style={{color:'#555'}}>--</span>
                  )}
                </td>
                <td style={{display:'flex', gap:'5px'}}>
                  
                  {/* SHOW COMPLETE BUTTON ONLY IF PLAYING */}
                  {u.activeGame && (
                      <button 
                        onClick={() => markComplete(u)} 
                        style={{background:'#00ff41', color:'#000', border:'none', padding:'5px 10px', cursor:'pointer', fontWeight:'bold'}}
                      >
                        ✔ COMPLETE
                      </button>
                  )}

                  <button onClick={() => manualAdjust(u.id, 50)} className="action-btn btn-plus">+50</button>
                  <button onClick={() => manualAdjust(u.id, -50)} className="action-btn btn-minus">-50</button>
                  <button onClick={() => resetLocks(u.id)} className="action-btn btn-reset">RESET</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}