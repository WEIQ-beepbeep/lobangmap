import { useState, useEffect } from "react";
import BottomNav from "./components/BottomNav";
import MapView from "./components/MapView";
import FeedView from "./components/FeedView";
import LeaderboardView from "./components/LeaderboardView";
import ContributeView from "./components/ContributeView";
import { motion, AnimatePresence } from "motion/react";
import { Zap } from "lucide-react";
import { auth } from "./firebase";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User as FirebaseUser, signInAnonymously } from "firebase/auth";

export default function App() {
  const [activeTab, setActiveTab] = useState("map");
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [previewUser, setPreviewUser] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const login = async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.warn("Google login failed, trying anonymous sign-in.", error);
      try {
        await signInAnonymously(auth);
      } catch (anonymousError) {
        console.warn("Anonymous login failed.", anonymousError);
        setPreviewUser(true);
        setAuthError("Firebase login is blocked by project settings, so you are signed in for this local preview.");
      }
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "map": return <MapView onViewDeal={(dealId) => { setSelectedDealId(dealId); setActiveTab("feed"); }} />;
      case "feed": return <FeedView selectedDealId={selectedDealId} onSelectedDealHandled={() => setSelectedDealId(null)} />;
      case "leaderboard": return <LeaderboardView />;
      case "contribute": return <ContributeView />;
      default: return <MapView />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Top Bar - Minimal Header */}
      {activeTab !== 'map' && (
        <header className="fixed top-0 left-0 w-full z-40 bg-white/70 backdrop-blur-xl border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
               <Zap className="w-4 h-4 text-white fill-white" />
             </div>
             <h1 className="text-xl font-extrabold text-on-surface tracking-tighter">LobangMap</h1>
          </div>
          <div className="flex items-center gap-3">
            {(user || previewUser) && (
              <div className="flex items-center gap-2 pr-1">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border-2 border-white shadow-sm" />
                ) : (
                  <div className="w-8 h-8 rounded-full border-2 border-white shadow-sm bg-primary text-white flex items-center justify-center text-xs font-black">L</div>
                )}
              </div>
            )}
          </div>
        </header>
      )}
      {authError && activeTab !== "map" && (
        <div className="fixed top-16 left-0 right-0 z-50 px-5">
          <div className="max-w-3xl mx-auto bg-amber-50 text-amber-900 border border-amber-200 rounded-xl px-4 py-3 text-xs font-bold shadow-sm">
            {authError}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`${activeTab !== 'map' ? 'pt-16' : ''} min-h-screen`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
