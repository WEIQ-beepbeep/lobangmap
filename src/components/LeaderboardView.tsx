import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Deal } from "../types";
import { subscribeLocalDeals } from "../localDeals";
import { motion } from "motion/react";
import { Flame, Star, Users, History, MapPin } from "lucide-react";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

export default function LeaderboardView() {
  const [remoteDeals, setRemoteDeals] = useState<Deal[]>([]);
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);
  const [activeTab, setActiveTab] = useState("Today");

  useEffect(() => {
    const q = query(collection(db, "deals"), where("status", "==", "approved"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
      setRemoteDeals(docs);
    }, (error) => {
      console.warn("Firestore leaderboard unavailable; using local deals.", error);
      setRemoteDeals([]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => subscribeLocalDeals(setLocalDeals), []);

  const deals = useMemo(() => {
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const byId = new Map<string, Deal>();

    for (const deal of [...remoteDeals, ...localDeals]) {
      if ((deal.status || "approved") === "approved") {
        byId.set(deal.importKey || deal.id, deal);
      }
    }

    return [...byId.values()]
      .filter((deal) => {
        const createdAt = deal.createdAt?.toMillis?.() || now;
        if (activeTab === "Today") return createdAt >= startOfToday.getTime();
        if (activeTab === "This Week") return createdAt >= weekAgo;
        return true;
      })
      .sort((a, b) => (b.score - a.score) || ((b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)))
      .slice(0, 20);
  }, [activeTab, localDeals, remoteDeals]);

  const locationRows = useMemo(() => {
    const grouped = new Map<string, { count: number; score: number }>();
    for (const deal of deals) {
      const location = deal.location.name || "Singapore";
      const current = grouped.get(location) || { count: 0, score: 0 };
      grouped.set(location, { count: current.count + 1, score: current.score + deal.score });
    }
    return [...grouped.entries()]
      .map(([location, stats]) => ({ location, ...stats }))
      .sort((a, b) => b.count - a.count || b.score - a.score);
  }, [deals]);

  const top1 = deals[0];
  const others = deals.slice(1);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto px-5 pb-24 pt-4">
      {/* Header & Tabs */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface">Trending Ranking</h2>
          <p className="text-sm text-on-surface-variant mt-1">Discover the most popular deals ranked by the community.</p>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
          {["Today", "This Week", "All Time", "By Location"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap shadow-sm transition-all ${activeTab === tab ? 'bg-primary text-white' : 'bg-surface-container-high text-on-surface-variant'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </section>

      {/* Ranking List */}
      {activeTab === "By Location" ? (
        <div className="grid grid-cols-1 gap-3">
          {locationRows.map((row, index) => (
            <div key={row.location} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
              <div className="w-10 text-center text-xl font-black text-primary">#{index + 1}</div>
              <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-extrabold text-on-surface">{row.location}</h3>
                <p className="text-xs text-on-surface-variant">{row.count} lobangs • {row.score} community points</p>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="flex flex-col gap-4">
        {/* Rank 1: Feature Bento Card */}
        {top1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative w-full rounded-3xl overflow-hidden bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)] flex flex-col group active:scale-[0.99] transition-all duration-200 cursor-pointer border border-gray-50"
          >
            <div className="h-52 w-full relative">
              <img src={top1.imageUrl || FALLBACK_IMAGE} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} alt={top1.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute top-4 left-4 bg-primary text-white w-14 h-14 flex items-center justify-center rounded-2xl shadow-xl z-10 border-2 border-white rotate-[-4deg]">
                <span className="text-3xl font-black">1</span>
              </div>
              <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                <Flame className="w-4 h-4 text-primary fill-primary" />
                <span className="text-xs font-black text-on-surface">{top1.score} <span className="font-medium text-[10px] opacity-60 uppercase">pts</span></span>
              </div>
              <div className="absolute bottom-4 left-4 right-4">
                <h3 className="font-extrabold text-2xl text-white line-clamp-2 drop-shadow-md">{top1.title}</h3>
              </div>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-on-surface">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-bold">4.9</span>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant border-l border-gray-100 pl-4">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-bold">2.4k views</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-primary">${top1.price.toFixed(2)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Subsequent Ranks */}
        <div className="grid grid-cols-1 gap-3">
          {others.map((deal, index) => (
            <motion.div
              key={deal.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center p-3 bg-white rounded-2xl shadow-[0_4px_12px_rgb(0,0,0,0.03)] border border-gray-100 active:bg-gray-50 transition-all duration-150 cursor-pointer group"
            >
              <div className="w-12 flex-shrink-0 flex justify-center">
                <span className="text-2xl font-black text-gray-300 group-hover:text-primary transition-colors">#{index + 2}</span>
              </div>
              <img src={deal.imageUrl || FALLBACK_IMAGE} onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }} alt={deal.title} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-gray-50 shadow-sm border border-gray-50" />
              <div className="flex flex-col flex-grow pl-4 justify-between h-20 py-1">
                <div className="flex justify-between items-start gap-2">
                  <h4 className="text-sm font-extrabold text-on-surface line-clamp-2 leading-tight group-hover:text-primary transition-colors">{deal.title}</h4>
                  <span className="text-sm font-black text-on-surface">${deal.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-primary bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                    <Flame className="w-3.5 h-3.5 fill-primary" />
                    <span className="text-[10px] font-black">{deal.score}</span>
                  </div>
                  <div className="flex items-center gap-1 text-on-surface-variant">
                    <History className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">Updated just now</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>}
    </div>
  );
}
