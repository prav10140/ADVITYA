import { useState } from "react";
import { functions } from "../firebase";
import { httpsCallable } from "firebase/functions";

export default function ManagerPanel() {
  const [playerEmail, setPlayerEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // In production, this ID should come from the Manager's user profile
  const MANAGER_GAME_ID = "HEART_3"; 

  const submitGameResult = async (result) => {
    if(!playerEmail) return;
    setLoading(true);
    setMessage(null);

    const submitResultFn = httpsCallable(functions, "submitGameResult");
    
    try {
      const resp = await submitResultFn({
        playerEmail,
        result, 
        gameId: MANAGER_GAME_ID
      });
      setMessage({ type: "success", text: "RESULT CONFIRMED" });
      setPlayerEmail(""); 
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 font-mono flex flex-col">
      <header className="mb-8 border-b border-gray-700 pb-4">
        <h2 className="text-xs text-gray-400 uppercase tracking-widest">Authorized Personnel Only</h2>
        <h1 className="text-2xl font-bold text-yellow-500 mt-1">GAME MANAGER: {MANAGER_GAME_ID}</h1>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full flex flex-col justify-center">
        
        {/* Input Section */}
        <div className="mb-8">
          <label className="block text-sm text-gray-400 mb-2">SCAN PLAYER EMAIL / ID</label>
          <input
            type="text"
            value={playerEmail}
            onChange={(e) => setPlayerEmail(e.target.value)}
            className="w-full bg-black border-2 border-gray-700 p-4 rounded-lg text-white text-lg focus:border-yellow-500 focus:outline-none transition-colors"
            placeholder="player@example.com"
          />
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => submitGameResult("WIN")}
            disabled={loading}
            className="col-span-1 bg-green-600 hover:bg-green-500 py-6 rounded-lg font-bold text-xl shadow-[0_0_15px_rgba(22,163,74,0.4)] disabled:opacity-50"
          >
            WIN
          </button>
          
          <button
            onClick={() => submitGameResult("LOSE")}
            disabled={loading}
            className="col-span-1 bg-red-600 hover:bg-red-500 py-6 rounded-lg font-bold text-xl shadow-[0_0_15px_rgba(220,38,38,0.4)] disabled:opacity-50"
          >
            LOSE
          </button>

          <button
            onClick={() => submitGameResult("VIOLATION")}
            disabled={loading}
            className="col-span-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 py-3 rounded-lg text-sm text-red-400 tracking-wider disabled:opacity-50"
          >
            REPORT RULE VIOLATION
          </button>
        </div>

        {/* Feedback Messages */}
        {loading && <div className="text-center text-yellow-500 animate-pulse">TRANSMITTING DATA...</div>}
        
        {message && (
          <div className={`p-4 rounded text-center font-bold border ${message.type === 'error' ? 'bg-red-950 text-red-400 border-red-800' : 'bg-green-950 text-green-400 border-green-800'}`}>
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}