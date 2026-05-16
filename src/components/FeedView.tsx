import { useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { collection, onSnapshot, query, addDoc, Timestamp, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Deal } from "../types";
import { saveLocalDeals, subscribeLocalDeals } from "../localDeals";
import { motion } from "motion/react";
import { MapPin, TrendingUp, Zap, Clock, Filter, Sparkles, Database, X, ExternalLink, ReceiptText } from "lucide-react";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

function ensureImage(event: SyntheticEvent<HTMLImageElement>) {
  if (event.currentTarget.src !== FALLBACK_IMAGE) {
    event.currentTarget.src = FALLBACK_IMAGE;
  }
}

export default function FeedView({ selectedDealId, onSelectedDealHandled }: { selectedDealId?: string | null; onSelectedDealHandled?: () => void }) {
  const [remoteDeals, setRemoteDeals] = useState<Deal[]>([]);
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [activeTag, setActiveTag] = useState("All Deals");
  const [showFilters, setShowFilters] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

  useEffect(() => {
    const q = query(collection(db, "deals"), where("status", "==", "approved"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Deal))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setRemoteDeals(docs);
    }, (error) => {
      console.warn("Firestore feed deals unavailable; using local deals.", error);
      setRemoteDeals([]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => subscribeLocalDeals(setLocalDeals), []);

  const deals = useMemo(() => {
    const byId = new Map<string, Deal>();
    for (const deal of [...remoteDeals, ...localDeals]) {
      if ((deal.status || "approved") === "approved") {
        byId.set(deal.importKey || deal.id, deal);
      }
    }
    return [...byId.values()].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  }, [remoteDeals, localDeals]);

  const handleBootstrap = async () => {
    setIsBootstrapping(true);
    try {
      const res = await fetch("/api/bootstrap");
      const data = await res.json();
      
      if (data.deals) {
        const localSeeds: Deal[] = [];
        for (const deal of data.deals) {
          const newDeal = {
            ...deal,
            id: `seed-${crypto.randomUUID()}`,
            createdAt: Timestamp.now(),
            createdBy: auth.currentUser?.uid || "local-preview",
            status: "approved",
            sourceType: "seed"
          } as Deal;
          localSeeds.push(newDeal);
          if (auth.currentUser) {
            await addDoc(collection(db, "deals"), newDeal);
          }
        }
        saveLocalDeals(localSeeds);
      }
    } catch (e: any) {
      console.error(e);
      alert("Failed to load sample deals.");
    } finally {
      setIsBootstrapping(false);
    }
  };

  const filteredDeals = deals.filter(deal => {
    if (activeTag === "All Deals") return true;
    if (activeTag === "Trending") return deal.score >= 90;
    if (activeTag === "Student") return deal.category.toLowerCase().includes("student");
    if (activeTag === "Hawker") return deal.category.toLowerCase().includes("hawker");
    if (activeTag === "Cafe") return deal.category.toLowerCase().includes("cafe");
    return true;
  });

  const featured = filteredDeals[0];
  const others = filteredDeals.slice(1);

  useEffect(() => {
    if (!selectedDealId || deals.length === 0) return;
    const deal = deals.find((item) => item.id === selectedDealId || item.importKey === selectedDealId);
    if (deal) {
      setSelectedDeal(deal);
      onSelectedDealHandled?.();
    }
  }, [deals, onSelectedDealHandled, selectedDealId]);

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto px-5 pb-24 pt-4">
      <section className="flex flex-col gap-4">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-extrabold text-on-surface">Fresh Lobangs</h2>
            <p className="text-sm text-on-surface-variant mt-1">Latest deals added by the community.</p>
          </div>
          <button
            onClick={() => setShowFilters((visible) => !visible)}
            className={`p-2 rounded-full ${showFilters ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant"}`}
            aria-label="Toggle filters"
          >
            <Filter className="w-5 h-5" />
          </button>
        </div>
        {showFilters && <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
          {["All Deals", "Trending", "Student", "Hawker", "Cafe"].map((tag) => (
            <button 
              key={tag} 
              onClick={() => setActiveTag(tag)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-bold transition-all ${
                activeTag === tag 
                  ? 'bg-primary text-white shadow-md' 
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredDeals.map((deal, index) => (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => setSelectedDeal(deal)}
            className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-3 group cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="relative aspect-[16/10] rounded-xl overflow-hidden">
              <img src={deal.imageUrl || FALLBACK_IMAGE} onError={ensureImage} alt="" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-[10px] font-bold text-on-surface shadow-sm">
                {deal.category}
              </div>
              {index === 0 && (
                <div className="absolute top-2 left-2 bg-primary text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-sm">
                  Featured
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <h4 className="font-extrabold text-sm text-on-surface line-clamp-2 flex-1 leading-tight">{deal.title}</h4>
                <span className="font-extrabold text-primary ml-2">${deal.price.toFixed(2)}</span>
              </div>
              <p className="text-xs text-on-surface-variant line-clamp-2">{deal.description}</p>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-[10px] font-bold text-on-surface-variant">
                  <MapPin className="w-3 h-3" /> {deal.location.name}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-primary ml-auto">
                   <TrendingUp className="w-3 h-3" /> {deal.score}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredDeals.length === 0 && (
        <div className="flex flex-col items-center justify-center p-10 text-center bg-white rounded-3xl border border-gray-100 shadow-sm mt-4">
          <Zap className="w-12 h-12 mb-4 text-gray-300" />
          <p className="text-on-surface font-bold text-lg">No lobangs yet!</p>
          <p className="text-on-surface-variant text-sm mt-1 mb-6">Warming up the lobangs...</p>
          <button 
            onClick={handleBootstrap}
            disabled={isBootstrapping}
            className="bg-primary text-white font-bold py-3 px-6 rounded-full shadow-md active:scale-95 transition-transform flex items-center gap-2"
          >
             <Database className="w-4 h-4" />
             {isBootstrapping ? "Loading Sample Deals..." : "Load Sample Deals"}
          </button>
        </div>
      )}

      {selectedDeal && (
        <div className="fixed inset-0 z-[1200] bg-black/40 backdrop-blur-sm px-5 py-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white max-w-2xl mx-auto rounded-2xl overflow-hidden shadow-2xl border border-gray-100"
          >
            <div className="relative aspect-video bg-gray-100">
              <img src={selectedDeal.imageUrl || FALLBACK_IMAGE} onError={ensureImage} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => setSelectedDeal(null)}
                className="absolute top-4 right-4 bg-white/90 backdrop-blur p-2 rounded-full shadow-sm"
                aria-label="Close deal details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="inline-flex text-[10px] font-black text-primary bg-orange-50 border border-orange-100 px-2 py-1 rounded-full mb-2">{selectedDeal.category}</span>
                  <h2 className="text-2xl font-extrabold text-on-surface leading-tight">{selectedDeal.title}</h2>
                  <p className="text-xs font-bold text-on-surface-variant flex items-center gap-1 mt-2">
                    <MapPin className="w-3.5 h-3.5" /> {selectedDeal.location.name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] uppercase font-black text-on-surface-variant">Price</p>
                  <p className="text-3xl font-black text-primary">${selectedDeal.price.toFixed(2)}</p>
                  {selectedDeal.originalPrice && <p className="text-xs text-gray-400 line-through">${selectedDeal.originalPrice.toFixed(2)}</p>}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-extrabold text-on-surface mb-2">Details</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{selectedDeal.description}</p>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <h3 className="text-sm font-extrabold text-on-surface mb-2 flex items-center gap-2">
                  <ReceiptText className="w-4 h-4 text-primary" /> Terms and conditions
                </h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {selectedDeal.terms || "Check the linked source for the final terms, participating outlets, redemption caps, and expiry details before heading down."}
                </p>
              </div>

              {selectedDeal.sourceUrl && (
                <a
                  href={selectedDeal.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-primary text-white font-bold rounded-full py-3 px-5 text-center flex items-center justify-center gap-2"
                >
                  View original post <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
