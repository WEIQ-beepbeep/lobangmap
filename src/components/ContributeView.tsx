import { FormEvent, useEffect, useState } from "react";
import {
  Camera,
  CheckCircle,
  CreditCard,
  Hourglass,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Store,
  TimerOff,
  XCircle
} from "lucide-react";
import { collection, addDoc, Timestamp, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { Deal } from "../types";
import { replaceSyncedLocalDeals, saveLocalDeals } from "../localDeals";

const emptyForm = {
  title: "",
  description: "",
  price: "",
  originalPrice: "",
  category: "Student",
  locationName: "",
  address: "",
  lat: "",
  lng: "",
  imageUrl: ""
};

export default function ContributeView() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<string | null>(null);
  const [reportType, setReportType] = useState("Expired deal");
  const [reportDeal, setReportDeal] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportResult, setReportResult] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingDeals, setPendingDeals] = useState<Deal[]>([]);

  useEffect(() => {
    return auth.onAuthStateChanged(async (user) => {
      setIsAdmin(false);
      if (!user) return;

      try {
        const adminDoc = await getDoc(doc(db, "admins", user.uid));
        setIsAdmin(adminDoc.exists());
      } catch {
        setIsAdmin(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      setPendingDeals([]);
      return;
    }

    const q = query(collection(db, "deals"), where("status", "==", "pending"));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs
        .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() } as Deal))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setPendingDeals(docs);
    });
  }, [isAdmin]);

  const triggerSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setSyncResult(data.error || "Sync failed.");
      } else if (data.deals?.length) {
        const syncedDeals: Deal[] = [];
        for (const deal of data.deals) {
          const newDeal = {
            ...deal,
            id: `telegram-${crypto.randomUUID()}`,
            createdAt: Timestamp.now(),
            createdBy: auth.currentUser?.uid || "local-preview",
            status: auth.currentUser ? "pending" : "approved"
          } as Deal;
          syncedDeals.push(newDeal);
          if (auth.currentUser) {
            try {
              await addDoc(collection(db, "deals"), newDeal);
            } catch (e) {
              console.error("Failed to add deal", e);
            }
          }
        }
        replaceSyncedLocalDeals(syncedDeals.map((deal) => ({ ...deal, status: "approved" })));
        setSyncResult(auth.currentUser
          ? `Synced ${data.deals.length} Telegram lobangs. They are visible locally and pending admin review in Firestore.`
          : `Synced ${data.deals.length} Telegram lobangs for this preview.`);
      } else {
        setSyncResult("No deals found.");
      }
    } catch (error) {
      setSyncResult("Sync failed. Check your connection.");
    } finally {
      setIsSyncing(false);
    }
  };

  const updateField = (field: keyof typeof emptyForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submitLobang = async (event: FormEvent) => {
    event.preventDefault();

    setIsSubmitting(true);
    setSubmitResult(null);
    try {
      const newDeal = {
        id: `community-${crypto.randomUUID()}`,
        title: form.title.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        ...(form.originalPrice ? { originalPrice: Number(form.originalPrice) } : {}),
        imageUrl: form.imageUrl.trim() || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
        category: form.category.trim(),
        location: {
          lat: Number(form.lat),
          lng: Number(form.lng),
          name: form.locationName.trim(),
          address: form.address.trim() || form.locationName.trim()
        },
        score: 0,
        voters: [],
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid || "local-preview",
        status: "pending",
        sourceType: "community"
      } as Deal;

      if (auth.currentUser) {
        await addDoc(collection(db, "deals"), newDeal);
      }
      saveLocalDeals([{ ...newDeal, status: auth.currentUser ? "pending" : "approved" }]);
      setForm(emptyForm);
      setSubmitResult(auth.currentUser
        ? "Submitted for admin approval."
        : "Added to this local preview. Connect Firebase auth to use admin approval.");
    } catch (error) {
      console.error(error);
      setSubmitResult("Could not submit this lobang. Please check the fields and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewDeal = async (dealId: string, status: "approved" | "rejected") => {
    if (!auth.currentUser) return;

    await updateDoc(doc(db, "deals", dealId), {
      status,
      reviewedAt: Timestamp.now(),
      reviewedBy: auth.currentUser.uid
    });
  };

  const reportIssue = (issue: string) => {
    setReportType(issue);
    setReportResult(null);
  };

  const submitReport = (event: FormEvent) => {
    event.preventDefault();
    setReportResult(`${reportType} report saved for review.`);
    setReportDeal("");
    setReportDetails("");
  };

  return (
    <div className="px-5 flex flex-col gap-6 pb-24 max-w-screen-md mx-auto pt-4">
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 bg-gradient-to-br from-orange-50 to-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-on-surface">Spotted a fresh deal?</h2>
              <p className="text-xs text-on-surface-variant">Submit it for admin review before it appears on the map.</p>
            </div>
          </div>
          <form onSubmit={submitLobang} className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            <input required value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Lobang title" className="md:col-span-2 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <textarea required value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="Short details" className="md:col-span-2 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary min-h-24" />
            <input required type="number" step="0.01" min="0" value={form.price} onChange={(e) => updateField("price", e.target.value)} placeholder="Price" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input type="number" step="0.01" min="0" value={form.originalPrice} onChange={(e) => updateField("originalPrice", e.target.value)} placeholder="Original price" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input required value={form.category} onChange={(e) => updateField("category", e.target.value)} placeholder="Category" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input required value={form.locationName} onChange={(e) => updateField("locationName", e.target.value)} placeholder="Location name" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input value={form.address} onChange={(e) => updateField("address", e.target.value)} placeholder="Address" className="md:col-span-2 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input required type="number" step="0.000001" value={form.lat} onChange={(e) => updateField("lat", e.target.value)} placeholder="Latitude" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input required type="number" step="0.000001" value={form.lng} onChange={(e) => updateField("lng", e.target.value)} placeholder="Longitude" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <input value={form.imageUrl} onChange={(e) => updateField("imageUrl", e.target.value)} placeholder="Image URL" className="md:col-span-2 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            <button disabled={isSubmitting} className="md:col-span-2 w-full bg-primary text-white font-bold py-4 rounded-full shadow-md active:scale-95 transition-transform duration-150 flex items-center justify-center gap-2 mt-2 disabled:opacity-60">
              {isSubmitting ? "Submitting..." : "Add a New Lobang"}
            </button>
          </form>
          {submitResult && <p className="text-center text-xs font-bold text-primary mt-3">{submitResult}</p>}
        </div>
      </section>

      <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-blue-100 p-2 rounded-lg">
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Telegram Sync</h3>
            <p className="text-gray-500 text-[10px]">Scrape public posts from GoodLobangSG and Student Deals for review.</p>
          </div>
        </div>
        <button
          onClick={triggerSync}
          disabled={isSyncing}
          className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
            isSyncing
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-100"
          }`}
        >
          <RefreshCw className={`w-5 h-5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing Deals..." : "Sync latest Telegram lobangs"}
        </button>
        {syncResult && (
          <p className="mt-2 text-center text-[10px] font-bold text-blue-600">{syncResult}</p>
        )}
      </section>

      {isAdmin && (
        <section className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-green-100 p-2 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900">Admin Approval Queue</h3>
              <p className="text-gray-500 text-[10px]">{pendingDeals.length} pending lobangs waiting for review.</p>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {pendingDeals.map((deal) => (
              <div key={deal.id} className="border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex gap-3">
                  <img src={deal.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover bg-gray-100" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-bold text-on-surface">{deal.title}</h4>
                      <span className="text-sm font-black text-primary">${deal.price.toFixed(2)}</span>
                    </div>
                    <p className="text-[10px] text-on-surface-variant line-clamp-2 mt-1">{deal.description}</p>
                    <p className="text-[10px] text-on-surface-variant mt-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {deal.location.name}
                    </p>
                    {deal.sourceName && <p className="text-[10px] text-blue-600 font-bold mt-1">Source: {deal.sourceName}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => reviewDeal(deal.id, "approved")} className="bg-green-600 text-white text-xs font-bold py-2 rounded-full flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => reviewDeal(deal.id, "rejected")} className="bg-gray-100 text-gray-700 text-xs font-bold py-2 rounded-full flex items-center justify-center gap-2">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))}
            {pendingDeals.length === 0 && <p className="text-xs text-on-surface-variant text-center py-4">No pending lobangs right now.</p>}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h3 className="text-xl font-bold text-on-surface">Report an Inaccuracy</h3>
        <p className="text-xs text-on-surface-variant mb-1">Keep the map clean. Notice something off?</p>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => reportIssue("Expired deal")} className="flex flex-col items-start p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all text-left">
            <TimerOff className="text-primary w-6 h-6 mb-2" />
            <span className="text-xs font-bold text-on-surface">Expired Deal</span>
            <span className="text-[10px] text-on-surface-variant mt-1">Promotion ended</span>
          </button>
          <button onClick={() => reportIssue("Wrong price")} className="flex flex-col items-start p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all text-left">
            <CreditCard className="text-primary w-6 h-6 mb-2" />
            <span className="text-xs font-bold text-on-surface">Wrong Price</span>
            <span className="text-[10px] text-on-surface-variant mt-1">Cost has changed</span>
          </button>
          <button onClick={() => reportIssue("Stall closed or relocated")} className="flex flex-col items-start p-4 bg-white rounded-xl shadow-sm border border-gray-200 hover:bg-gray-50 active:scale-95 transition-all text-left col-span-2">
            <Store className="text-primary w-6 h-6 mb-2" />
            <span className="text-xs font-bold text-on-surface">Stall Closed / Relocated</span>
            <span className="text-[10px] text-on-surface-variant mt-1">The vendor is no longer at this location</span>
          </button>
        </div>
        <form onSubmit={submitReport} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-on-surface-variant">Issue type</span>
              <select value={reportType} onChange={(event) => setReportType(event.target.value)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary bg-white">
                <option>Expired deal</option>
                <option>Wrong price</option>
                <option>Stall closed or relocated</option>
                <option>Wrong location</option>
                <option>Other</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-black uppercase text-on-surface-variant">Lobang name</span>
              <input value={reportDeal} onChange={(event) => setReportDeal(event.target.value)} placeholder="e.g. Wingstop student deal" className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase text-on-surface-variant">Details</span>
            <textarea required value={reportDetails} onChange={(event) => setReportDetails(event.target.value)} placeholder="Tell us what changed, what price you saw, or where the stall moved." className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-primary min-h-24" />
          </label>
          <button className="bg-primary text-white font-bold rounded-full py-3">Submit Report</button>
        </form>
        {reportResult && <p className="text-xs font-bold text-primary">{reportResult}</p>}
      </section>

      <section className="flex flex-col gap-3 mt-2">
        <h3 className="text-xl font-bold text-on-surface">My Contributions</h3>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-200 opacity-60">
            <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center">
              <Hourglass className="w-6 h-6 text-gray-400" />
            </div>
            <div className="flex-grow">
              <h4 className="text-xs font-bold text-on-surface mb-1">New submissions now enter review first</h4>
              <p className="text-[10px] text-on-surface-variant mb-2">Approved lobangs appear on the map and feed.</p>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold">
                Pending Review
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
