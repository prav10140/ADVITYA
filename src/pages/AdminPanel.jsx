import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";

export default function AdminPanel() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const manualAdjust = async (userId, amount) => {
    // Ideally use a modal, but prompt is fine for admin internal tools
    const reason = prompt("Reason for adjustment?");
    if(!reason) return;
    
    await updateDoc(doc(db, "users", userId), {
      tokens: increment(amount),
    });
  };

  const resetLocks = async (userId) => {
    if(!window.confirm("RESET LOCKS? This will allow player to roll freely.")) return;
    await updateDoc(doc(db, "users", userId), {
      lockedCategory: null,
      activeGame: null
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 font-mono">
      <header className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4">
        <h1 className="text-2xl font-bold text-red-500 tracking-widest">MASTER CONTROL</h1>
        <div className="text-sm text-gray-400">Total Players: {users.length}</div>
      </header>
      
      <div className="overflow-x-auto rounded-lg border border-gray-700 shadow-2xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-black text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Role</th>
              <th className="p-4">Tokens</th>
              <th className="p-4">Status</th>
              <th className="p-4">Overrides</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 bg-gray-800">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-700 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-white">{u.displayName || "No Name"}</div>
                  <div className="text-xs text-gray-500">{u.email}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs uppercase ${u.role === 'admin' ? 'bg-red-900 text-red-200' : u.role === 'manager' ? 'bg-yellow-900 text-yellow-200' : 'bg-blue-900 text-blue-200'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="p-4 font-mono text-yellow-400 text-lg">{u.tokens}</td>
                <td className="p-4">
                  {u.activeGame ? (
                    <span className="text-green-400 font-bold animate-pulse">
                      Playing {u.activeGame.category}-{u.activeGame.level}
                    </span>
                  ) : (
                    <span className="text-gray-500">Idle</span>
                  )}
                  <div className="text-xs text-gray-400 mt-1">Lock: {u.lockedCategory || 'None'}</div>
                </td>
                <td className="p-4 flex gap-2">
                  <button onClick={() => manualAdjust(u.id, 50)} className="bg-green-700 hover:bg-green-600 text-white px-3 py-1 rounded text-xs font-bold">+50</button>
                  <button onClick={() => manualAdjust(u.id, -50)} className="bg-red-700 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-bold">-50</button>
                  <button onClick={() => resetLocks(u.id)} className="bg-blue-700 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold">UNLOCK</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}