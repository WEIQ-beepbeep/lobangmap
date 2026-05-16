import { Map, Zap, PlusCircle, Trophy } from "lucide-react";
import { motion } from "motion/react";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: 'map', label: 'Map', icon: Map },
    { id: 'feed', label: 'Feed', icon: Zap },
    { id: 'leaderboard', label: 'Ranking', icon: Trophy },
    { id: 'contribute', label: 'Contribute', icon: PlusCircle },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 bg-white border-t border-gray-100 pb-safe md:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.05)]">
      <div className="flex justify-around items-center px-6 py-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative flex flex-col items-center justify-center min-w-[64px]"
            >
              <div className="relative">
                {isActive && (
                  <motion.div
                    layoutId="activePill"
                    className="absolute -inset-x-4 -inset-y-1 bg-primary-container rounded-full z-0"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className={`w-6 h-6 relative z-10 transition-colors duration-200 ${isActive ? 'text-on-primary-container stroke-[2.5]' : 'text-on-surface-variant'}`} />
              </div>
              <span className={`text-[10px] mt-1 font-bold tracking-tight relative z-10 transition-colors duration-200 ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
