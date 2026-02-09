import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";

// !! IMPORTANT: 'export default' is required here !!
export default function Leaderboard({ limit: limitCount = 10 }) {
  const [leaders, setLeaders] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "users"),
      orderBy("tokens", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setLeaders(data);
    });

    return unsubscribe;
  }, [limitCount]);

  return (
    <div className="w-full bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-2xl">
      <table className="w-full text-left border-collapse">
        <thead className="bg-black/50 text-gray-500 text-[10px] uppercase tracking-wider">
          <tr>
            <th className="p-4 font-normal">#</th>
            <th className="p-4 font-normal">Player</th>
            <th className="p-4 font-normal text-right">Tokens</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {leaders.map((player, index) => (
            <tr key={player.id} className="hover:bg-white/5 transition-colors">
              <td className="p-4 text-gray-500 font-mono">
                {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`}
              </td>
              <td className="p-4">
                <span className="text-white font-bold tracking-wide">
                  {player.displayName || "Unknown Player"}
                </span>
                {player.role === 'admin' && (
                  <span className="ml-2 px-1.5 py-0.5 rounded bg-red-900/50 text-red-400 text-[10px] border border-red-800">
                    ADM
                  </span>
                )}
              </td>
              <td className="p-4 text-right">
                <span className="text-yellow-500 font-mono font-bold drop-shadow-sm">
                  {player.tokens}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}