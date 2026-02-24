// src/pages/SuperAdmin.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./AdminPanel.css"; 

// MUST HAVE 'export default function SuperAdmin'
export default function SuperAdmin() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const userList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setUsers(userList);
    });
    return () => unsub();
  }, []);

  const approveManager = async (userId) => {
    if(!window.confirm("Approve this user as a Manager?")) return;
    try {
      await updateDoc(doc(db, "users", userId), { role: "manager" });
    } catch (err) { alert(err.message); }
  };

  const revokeManager = async (userId) => {
    if(!window.confirm("Revoke Manager access? They will become a regular participant.")) return;
    try {
      await updateDoc(doc(db, "users", userId), { role: "participant" });
    } catch (err) { alert(err.message); }
  };

  const pendingManagers = users.filter(u => u.role === "pending_manager");
  const activeManagers = users.filter(u => u.role === "manager");

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1 style={{color: '#ffd700'}}>SUPER ADMIN: STAFF CLEARANCE</h1>
        <button onClick={() => navigate('/dashboard')} className="back-btn">RETURN TO DASHBOARD</button>
      </header>

      <div className="admin-content">
        <h2 style={{color: '#ff0055', borderBottom: '1px solid #ff0055', paddingBottom: '10px'}}>PENDING VERIFICATION</h2>
        {pendingManagers.length === 0 ? <p style={{color: '#888'}}>No pending manager applications.</p> : (
            <table className="admin-table" style={{marginBottom: '40px'}}>
            <thead>
                <tr>
                <th>EMAIL / ID</th>
                <th>STATUS</th>
                <th>ACTION</th>
                </tr>
            </thead>
            <tbody>
                {pendingManagers.map(user => (
                <tr key={user.id} style={{background: 'rgba(255,0,85,0.1)'}}>
                    <td className="id-col">{user.email}</td>
                    <td className="status-col" style={{color: '#ff0055'}}>AWAITING APPROVAL</td>
                    <td className="actions-col">
                        <button className="btn-verify" onClick={() => approveManager(user.id)}>✅ APPROVE</button>
                        <button className="btn-cancel" onClick={() => revokeManager(user.id)} style={{marginLeft: '10px'}}>❌ REJECT</button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        )}

        <h2 style={{color: '#00ff41', borderBottom: '1px solid #00ff41', paddingBottom: '10px'}}>ACTIVE MANAGERS</h2>
        {activeManagers.length === 0 ? <p style={{color: '#888'}}>No active managers.</p> : (
            <table className="admin-table">
            <thead>
                <tr>
                <th>EMAIL / ID</th>
                <th>STATUS</th>
                <th>ACTION</th>
                </tr>
            </thead>
            <tbody>
                {activeManagers.map(user => (
                <tr key={user.id}>
                    <td className="id-col">{user.email}</td>
                    <td className="status-col" style={{color: '#00ff41'}}>VERIFIED MANAGER</td>
                    <td className="actions-col">
                        <button className="btn-cancel" onClick={() => revokeManager(user.id)}>🛑 REVOKE ACCESS</button>
                    </td>
                </tr>
                ))}
            </tbody>
            </table>
        )}
      </div>
    </div>
  );
}