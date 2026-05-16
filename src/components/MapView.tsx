import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { Deal } from "../types";
import { subscribeLocalDeals } from "../localDeals";
import { motion, AnimatePresence } from "motion/react";
import { Search, Filter, Navigation, MapPin, Clock } from "lucide-react";
import "leaflet/dist/leaflet.css";

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80";

const PLACE_LABELS = [
  { name: "Singapore", lat: 1.3521, lng: 103.8198 },
  { name: "NUS", lat: 1.2966, lng: 103.7764 },
  { name: "NTU", lat: 1.3483, lng: 103.6831 },
  { name: "SMU", lat: 1.2966, lng: 103.85 },
  { name: "Jurong Point", lat: 1.3397, lng: 103.7067 },
  { name: "Jurong East", lat: 1.3331, lng: 103.7423 },
  { name: "Orchard", lat: 1.3048, lng: 103.8318 },
  { name: "Bugis", lat: 1.3008, lng: 103.8559 },
  { name: "Tampines", lat: 1.3526, lng: 103.9448 },
  { name: "Bishan", lat: 1.3508, lng: 103.8485 },
  { name: "Clementi", lat: 1.3151, lng: 103.7652 },
  { name: "Chinatown", lat: 1.2839, lng: 103.8435 },
  { name: "Jewel Changi", lat: 1.3602, lng: 103.9898 },
  { name: "The Woodleigh Mall", lat: 1.3395, lng: 103.8715 },
  { name: "Maxwell Food Centre", lat: 1.2806, lng: 103.8448 },
  { name: "Lau Pa Sat", lat: 1.2807, lng: 103.8505 },
  { name: "Amoy Street", lat: 1.2807, lng: 103.8467 }
];

// Fix for default marker icons in Leaflet with React
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

function DealMarker({ deal, onClick }: { deal: Deal; onClick: () => void; key?: any }) {
  const label = deal.title.length > 26 ? `${deal.title.slice(0, 23)}...` : deal.title;
  const customIcon = L.divIcon({
    className: "custom-div-icon",
    html: `
      <div class="relative transform transition-transform cursor-pointer">
        <div class="bg-white text-gray-900 font-bold text-[10px] px-2 py-1 rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.18)] border border-primary/30 whitespace-nowrap max-w-[180px]">
          <span class="text-primary">$${deal.price.toFixed(2)}</span>
          <span class="mx-1 text-gray-300">|</span>
          <span>${label.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
        </div>
        <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45 border-r border-b border-primary/30"></div>
      </div>
    `,
    iconSize: [160, 26],
    iconAnchor: [20, 20],
  });

  return (
    <Marker
      position={[deal.location.lat, deal.location.lng]}
      icon={customIcon}
      eventHandlers={{
        click: onClick,
      }}
    />
  );
}

function LocationLabel({ place, onClick }: { place: { name: string; lat: number; lng: number }; onClick: () => void; key?: any }) {
  const icon = L.divIcon({
    className: "custom-location-label",
    html: `
      <div class="bg-secondary text-white font-black text-[10px] px-3 py-1 rounded-full shadow-lg border-2 border-white whitespace-nowrap">
        ${place.name.replace(/</g, "&lt;").replace(/>/g, "&gt;")}
      </div>
    `,
    iconSize: [120, 24],
    iconAnchor: [60, 12],
  });

  return <Marker position={[place.lat, place.lng]} icon={icon} eventHandlers={{ click: onClick }} />;
}

function SearchMapFocus({ places }: { places: Array<{ name: string; lat: number; lng: number }> }) {
  const map = useMap();

  useEffect(() => {
    if (places[0]) {
      map.flyTo([places[0].lat, places[0].lng], 14, { duration: 0.8 });
    }
  }, [map, places]);

  return null;
}

export default function MapView({ onViewDeal }: { onViewDeal?: (dealId: string) => void }) {
  const [remoteDeals, setRemoteDeals] = useState<Deal[]>([]);
  const [localDeals, setLocalDeals] = useState<Deal[]>([]);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "deals"), where("status", "==", "approved"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deal));
      setRemoteDeals(docs);
    }, (error) => {
      console.warn("Firestore map deals unavailable; using local deals.", error);
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
    return [...byId.values()];
  }, [remoteDeals, localDeals]);

  const filteredDeals = deals.filter(deal => {
    const matchesSearch = deal.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         deal.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         deal.location.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!activeFilter) return matchesSearch;

    if (activeFilter === "<$5") return matchesSearch && deal.price < 5;
    if (activeFilter === "$5-$10") return matchesSearch && deal.price >= 5 && deal.price <= 10;
    
    return matchesSearch && deal.category.toLowerCase().includes(activeFilter.toLowerCase());
  });

  const matchingPlaces = searchQuery.trim().length >= 2
    ? PLACE_LABELS.filter((place) => place.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : [];

  return (
    <div className="relative w-full h-[calc(100vh-64px)] md:h-screen z-0">
      {/* Search & Filters Overlay */}
      <div className="absolute top-4 left-0 w-full z-[1000] px-5 pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-full shadow-lg flex items-center px-4 py-2 mb-3 border border-gray-200 max-w-xl mx-auto">
          <Search className="w-5 h-5 text-gray-400 mr-2" />
          <input 
            className="bg-transparent border-none focus:ring-0 text-sm w-full outline-none placeholder-gray-400" 
            placeholder="Search for lobangs..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            onClick={() => setShowFilters((visible) => !visible)}
            className={`ml-2 p-1.5 rounded-full flex items-center justify-center ${showFilters ? "bg-primary text-white" : "bg-gray-100 text-gray-500"}`}
            aria-label="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        {showFilters && <div className="pointer-events-auto flex overflow-x-auto hide-scrollbar gap-2 max-w-xl mx-auto">
          <button 
            onClick={() => setActiveFilter(activeFilter === "Student" ? null : "Student")}
            className={`flex-shrink-0 flex items-center font-bold text-xs px-4 py-2 rounded-full border shadow-sm transition-all ${
              activeFilter === "Student" 
                ? 'bg-primary text-white border-primary' 
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
             Student
          </button>
          {["<$5", "$5-$10", "Hawker", "Cafe"].map(filter => (
            <button 
              key={filter} 
              onClick={() => setActiveFilter(activeFilter === filter ? null : filter)}
              className={`flex-shrink-0 flex items-center font-bold text-xs px-4 py-2 rounded-full border shadow-sm transition-all ${
                activeFilter === filter 
                  ? 'bg-primary text-white border-primary' 
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>}
      </div>

      <MapContainer
        center={[1.3521, 103.8198]}
        zoom={12}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <SearchMapFocus places={matchingPlaces} />
        
        {filteredDeals.map((deal) => (
          <DealMarker 
            key={deal.id} 
            deal={deal} 
            onClick={() => setSelectedDeal(deal)} 
          />
        ))}
        {matchingPlaces.map((place) => (
          <LocationLabel key={place.name} place={place} onClick={() => setSearchQuery(place.name)} />
        ))}
      </MapContainer>

      {/* Geolocate FAB */}
      <button className="absolute bottom-32 right-4 bg-white p-3 rounded-full shadow-lg border border-gray-200 z-[1000] text-gray-700 active:scale-95 transition-transform">
        <Navigation className="w-6 h-6 fill-gray-700" />
      </button>

      {/* Bottom Sheet Preview Card */}
      <AnimatePresence>
        {selectedDeal && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-24 left-0 right-0 z-[1000] px-5 pointer-events-none"
          >
            <div className="pointer-events-auto bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-row max-w-md mx-auto">
              <div className="w-1/3 bg-gray-100 relative h-32">
                <img
                  src={selectedDeal.imageUrl || FALLBACK_IMAGE}
                  onError={(event) => { event.currentTarget.src = FALLBACK_IMAGE; }}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                  Flash Deal
                </div>
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-sm text-on-surface leading-tight mb-1">{selectedDeal.title}</h3>
                  <p className="text-[10px] text-on-surface-variant flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> 120m away • {selectedDeal.location.name}
                  </p>
                </div>
                <div className="flex justify-between items-end">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-primary bg-orange-100 px-1.5 py-0.5 rounded w-max mb-1">{selectedDeal.category}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-black text-on-surface tracking-tight">${selectedDeal.price.toFixed(2)}</span>
                      {selectedDeal.originalPrice && (
                        <span className="text-[10px] text-gray-400 line-through">${selectedDeal.originalPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="text-[8px] font-bold text-red-600 flex items-center gap-0.5 mb-1">
                      <Clock className="w-2.5 h-2.5" /> 2h left
                    </span>
                    <button
                      onClick={() => onViewDeal?.(selectedDeal.importKey || selectedDeal.id)}
                      className="bg-primary text-white text-[10px] font-bold px-4 py-2 rounded-full shadow-md hover:bg-red-800 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDeal(null)}
                className="absolute top-2 right-2 p-1 bg-white/80 backdrop-blur-sm rounded-full"
              >
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
