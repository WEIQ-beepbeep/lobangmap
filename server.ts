import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3002;

// Initialize Gemini
const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY,
});

app.use(express.json());

const TELEGRAM_CHANNELS = (process.env.TELEGRAM_CHANNELS || "goodlobang,SGstudentpromos")
  .split(",")
  .map((channel) => channel.trim().replace(/^@/, ""))
  .filter(Boolean);

const WEB_DEAL_SOURCES = [
  "https://www.misslobang.com/article/best-fnb-brand-promos-singapore-2026",
  "https://www.eatwhatsia.com/deals",
  "https://singaporepromo.com/8-food-deals-in-february-2026-10-large-pizzas-50-off-alaskan-crab-and-more/"
];

const STUDENT_FOOD_DEALS = [
  {
    title: "The Tree Cafe: $2 off all mains",
    description: "Present a student, NSF, or senior card to get $2 off mains including rice bowls, pasta, burgers, baked items, and all-day breakfast.",
    price: 0,
    category: "Student",
    terms: "Available all day except on the eve of public holidays and on public holidays. Valid student card, 11B, or senior card required.",
    location: { name: "The Tree Cafe", lat: 1.3521, lng: 103.8198, address: "Singapore" },
    imageUrl: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80",
    sourceName: "DiveDeals",
    sourceUrl: "https://divedeals.sg/deals/food/The-Tree-Cafe-2-off-all-mains-1774580020_TheTreeCafe"
  },
  {
    title: "SHIFU CAFE: up to 20% student discount",
    description: "Kaplan students enjoy up to 20% discount at SHIFU CAFE.",
    price: 0,
    category: "Student",
    terms: "Present Kaplan student card at the stall counter. Valid only at SHIFU CAFE, 231 Bras Basah Complex.",
    location: { name: "Bras Basah Complex", lat: 1.2968, lng: 103.8535, address: "231 Bras Basah Complex" },
    imageUrl: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80",
    sourceName: "Kaplan Student Deals",
    sourceUrl: "https://www.kaplan.com.sg/student-engagement-student-deals"
  },
  {
    title: "llaollao: student deal with free toppings",
    description: "Enjoy additional free toppings with every two small tubs purchased.",
    price: 0,
    category: "Student",
    terms: "Student pass required. Mon-Fri, 2pm-4pm. Valid at City Square Mall and Century Square.",
    location: { name: "City Square Mall", lat: 1.3114, lng: 103.8566, address: "180 Kitchener Road" },
    imageUrl: "https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=800&q=80",
    sourceName: "HungryCat",
    sourceUrl: "https://hungrycat.sg/promotions/llaollao-llaollao-student-deal"
  },
  {
    title: "Chen's Mapo Tofu: $8.90 student meal",
    description: "Flash your student card to enjoy signature mains from $8.90, with optional set top-up.",
    price: 8.9,
    category: "Student",
    terms: "Dine-in only on weekdays, excluding public holidays. Valid at NEX and The Star Vista before 5pm.",
    location: { name: "The Star Vista", lat: 1.3068, lng: 103.7884, address: "1 Vista Exchange Green" },
    imageUrl: "https://images.unsplash.com/photo-1512003867696-6d5ce6835040?auto=format&fit=crop&w=800&q=80",
    sourceName: "HungryCat",
    sourceUrl: "https://hungrycat.sg/promotions/chen%27s-mapo-tofu-dollar8.90-student-meal"
  },
  {
    title: "Dunkin' Donuts: 10% off for students",
    description: "Student Deals Campaign at Hillion Mall outlet.",
    price: 0,
    category: "Student",
    terms: "Valid 1 Apr 2025 to 31 Mar 2026 on weekdays, excluding public holidays. Student identification required. Limited to one redemption.",
    location: { name: "Hillion Mall", lat: 1.3786, lng: 103.7631, address: "17 Petir Road" },
    imageUrl: "https://images.unsplash.com/photo-1551024601-bec78aea704b?auto=format&fit=crop&w=800&q=80",
    sourceName: "Hillion Mall",
    sourceUrl: "https://www.hillionmall.com.sg/promotions/dunkin-donuts-deals-for-students-1/"
  },
  {
    title: "Rocky Master: student cafe deals",
    description: "Rocky Master lists student deals for cafe drinks and meals across Singapore outlets.",
    price: 0,
    category: "Student",
    terms: "Check the linked promotion page for current outlet availability, redemption windows, and student verification.",
    location: { name: "Singapore", lat: 1.3521, lng: 103.8198, address: "All Rocky Master outlets" },
    imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=800&q=80",
    sourceName: "Rocky Master",
    sourceUrl: "https://www.rockymaster.com.sg/promotions"
  },
  {
    title: "Clayful Cafe: student offers",
    description: "Clayful Cafe student discount program via Initia SG student offers.",
    price: 0,
    category: "Student",
    terms: "Student verification required. Ongoing until further notice; Clayful Cafe may modify or terminate the program.",
    location: { name: "Singapore", lat: 1.3521, lng: 103.8198, address: "Singapore" },
    imageUrl: "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=800&q=80",
    sourceName: "Initia SG",
    sourceUrl: "https://initia.sg/pages/student-offers"
  },
  {
    title: "Luckin Coffee NP: 1-for-1 drinks",
    description: "Luckin Coffee opening promotion at Ngee Ann Polytechnic with 1-for-1 drinks.",
    price: 0,
    category: "Student",
    terms: "Promotion ran 6-23 Apr 2026 at Block 1, Ngee Ann Polytechnic. Check source for current validity before redeeming.",
    location: { name: "Ngee Ann Polytechnic", lat: 1.3333, lng: 103.7741, address: "535 Clementi Road" },
    imageUrl: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=800&q=80",
    sourceName: "All Singapore Deals",
    sourceUrl: "https://www.allsingaporedeals.com/2026/04/luckin-coffee-opens-ngee-ann.html"
  },
  {
    title: "BG Monsters Cafe: student package",
    description: "BG Monsters Cafe student package for students with valid passes.",
    price: 0,
    category: "Student",
    terms: "Valid student passes required. Benefits may not be used with other promos or vouchers.",
    location: { name: "BG Monsters Cafe", lat: 1.3521, lng: 103.8198, address: "Singapore" },
    imageUrl: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=800&q=80",
    sourceName: "BG Monsters Cafe",
    sourceUrl: "https://bgmonsters.com.sg/promos/"
  }
];

function decodeHtmlEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function stripHtml(html: string) {
  return decodeHtmlEntities(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function estimatePrice(text: string) {
  const match = text.match(/(?:S\$|\$)\s?(\d+(?:\.\d{1,2})?)/i);
  return match ? Number(match[1]) : 0;
}

function inferCategory(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("student")) return "Student";
  if (lower.includes("coffee") || lower.includes("cafe") || lower.includes("latte")) return "Cafe";
  if (lower.includes("hawker") || lower.includes("rice") || lower.includes("noodle")) return "Hawker";
  if (lower.includes("bubble tea") || lower.includes("boba") || lower.includes("drink")) return "Drinks";
  return "General";
}

function isFoodLobang(text: string) {
  return /(food|meal|drink|coffee|tea|pizza|burger|chicken|rice|noodle|sushi|matcha|taco|buffet|steak|kfc|starbucks|wingstop|astons|umisushi|boba|cafe|restaurant|dining|hawker|breakfast|lunch|dinner|dessert|bread|bagel)/i.test(text);
}

function estimateLocation(text: string) {
  const knownPlaces = [
    { name: "NUS", lat: 1.2966, lng: 103.7764 },
    { name: "NTU", lat: 1.3483, lng: 103.6831 },
    { name: "SMU", lat: 1.2966, lng: 103.8500 },
    { name: "Clementi", lat: 1.3151, lng: 103.7652 },
    { name: "Bishan", lat: 1.3508, lng: 103.8485 },
    { name: "Tampines", lat: 1.3526, lng: 103.9448 },
    { name: "Jurong", lat: 1.3331, lng: 103.7423 },
    { name: "Orchard", lat: 1.3048, lng: 103.8318 },
    { name: "Bugis", lat: 1.3008, lng: 103.8559 },
    { name: "Chinatown", lat: 1.2839, lng: 103.8435 }
  ];
  return knownPlaces.find((item) => text.toLowerCase().includes(item.name.toLowerCase()))
    || { name: "Singapore", lat: 1.3521, lng: 103.8198 };
}

function buildTerms(text: string) {
  const terms = [
    text.match(/T&Cs? apply\.?/i)?.[0],
    text.match(/Now\s*(?:-|till|until)\s*[^.]+/i)?.[0],
    text.match(/Valid\s*(?:till|until|from)\s*[^.]+/i)?.[0],
    text.match(/Selected outlets?[^.]*\.?/i)?.[0],
    text.match(/while stocks last/i)?.[0]
  ].filter(Boolean);

  return terms.length > 0
    ? terms.join(" ")
    : "Check the original source for final terms, participating outlets, redemption limits, and expiry.";
}

async function scrapeTelegramChannel(channel: string) {
  const response = await fetch(`https://t.me/s/${channel}`);
  if (!response.ok) throw new Error(`Telegram returned ${response.status} for ${channel}`);

  const html = await response.text();
  const imageUrls = [...html.matchAll(/background-image:url\('([^']+)'\)/g)]
    .map((match) => match[1].replace(/^\/\//, "https://"))
    .filter((url) => !url.includes("/img/emoji/"));
  const postUrls = [...html.matchAll(/data-post="([^"]+)"/g)]
    .map((match) => `https://t.me/${match[1]}`);
  const messageBlocks = [...html.matchAll(/<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)]
    .map((match, index) => ({
      text: stripHtml(match[1]),
      imageUrl: imageUrls[index] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      sourceUrl: postUrls[index] || `https://t.me/s/${channel}`
    }))
    .filter((message) => message.text.length > 20 && isFoodLobang(message.text))
    .slice(-6);

  if (messageBlocks.length === 0) {
    throw new Error(`No public message preview found for ${channel}`);
  }

  return messageBlocks.map((message, index) => {
    const text = message.text;
    const location = estimateLocation(text);
    return {
      title: text.split(/[.!?\n]/)[0].slice(0, 90) || `Telegram lobang from ${channel}`,
      description: text.slice(0, 500),
      price: estimatePrice(text),
      category: inferCategory(text),
      terms: buildTerms(text),
      location: {
        ...location,
        address: location.name
      },
      score: 0,
      voters: [],
      imageUrl: message.imageUrl,
      sourceName: channel,
      sourceType: "telegram",
      sourceUrl: message.sourceUrl,
      importKey: `${channel}-${index}-${text.slice(0, 24)}`
    };
  });
}

async function scrapeWebDealSource(sourceUrl: string) {
  const response = await fetch(sourceUrl);
  if (!response.ok) throw new Error(`Web source returned ${response.status} for ${sourceUrl}`);

  const html = await response.text();
  const pageTitle = stripHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || new URL(sourceUrl).hostname);
  const imageUrls = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
    .map((match) => new URL(match[1], sourceUrl).toString())
    .filter((url) => !url.includes("logo") && !url.includes("icon"))
    .slice(0, 20);
  const sourceHost = new URL(sourceUrl).hostname.replace(/[^a-z0-9]/gi, "-");
  const headings = [...html.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi)]
    .map((match) => stripHtml(match[1]))
    .filter((text) => text.length >= 12 && text.length <= 140)
    .filter((text) => /(deal|promo|off|free|1-for-1|discount|\$|food|burger|pizza|coffee|meal|buffet|student)/i.test(text))
    .filter(isFoodLobang)
    .slice(0, 10);

  return headings.map((title, index) => {
    const location = estimateLocation(title);
    return {
      id: `web-${sourceHost}-${index}`,
      title: title.slice(0, 90),
      description: `${title}. Sourced from ${pageTitle}.`,
      price: estimatePrice(title),
      category: inferCategory(title),
      terms: "Check the linked website for full terms, participating outlets, date validity, and redemption limits.",
      location: {
        ...location,
        address: location.name
      },
      score: 0,
      voters: [],
      imageUrl: imageUrls[index] || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80",
      sourceName: pageTitle,
      sourceType: "web",
      sourceUrl,
      importKey: `web-${sourceUrl}-${index}-${title.slice(0, 24)}`
    };
  });
}

// API: Sync Lobangs
app.post("/api/sync", async (req, res) => {
  try {
    console.log("Starting LobangMap sync...");
    const scrapedResults = await Promise.allSettled(TELEGRAM_CHANNELS.map(scrapeTelegramChannel));
    const webResults = await Promise.allSettled(WEB_DEAL_SOURCES.map(scrapeWebDealSource));
    const telegramDeals = scrapedResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const webDeals = webResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const channelErrors = scrapedResults.flatMap((result, index) => (
      result.status === "rejected" ? [`${TELEGRAM_CHANNELS[index]}: ${result.reason?.message || result.reason}`] : []
    )).concat(webResults.flatMap((result, index) => (
      result.status === "rejected" ? [`${WEB_DEAL_SOURCES[index]}: ${result.reason?.message || result.reason}`] : []
    )));

    const studentDeals = STUDENT_FOOD_DEALS.map((deal, index) => ({
      ...deal,
      id: `student-source-${index}`,
      score: 25 - index,
      voters: [],
      sourceType: "web",
      importKey: `student-source-${index}-${deal.title}`
    }));
    const allDeals = [...studentDeals, ...telegramDeals, ...webDeals];

    if (allDeals.length > 0) {
      return res.json({ status: "ok", deals: allDeals.slice(0, 30), channelErrors });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(502).json({
        error: "No Telegram deals could be scraped, and GEMINI_API_KEY is not set for fallback.",
        channelErrors
      });
    }
    
    // Fallback: use Gemini when public Telegram pages are unreachable.
    const result = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Search for the latest and trending food deals (lobangs) in Singapore from sources like GoodLobang, Student Deals, and Hawker Go Where. Return a list of 5 deals with details: title, description, price, originalPrice (if available), category (Student, Hawker, Cafe, Buffet), location name, expected coordinates (lat/lng) in Singapore, image description, and source URL.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              price: { type: Type.NUMBER },
              originalPrice: { type: Type.NUMBER },
              category: { type: Type.STRING },
              locationName: { type: Type.STRING },
              lat: { type: Type.NUMBER },
              lng: { type: Type.NUMBER },
              imageDesc: { type: Type.STRING },
              sourceUrl: { type: Type.STRING },
              expiryDate: { type: Type.STRING }
            },
            required: ["title", "price", "locationName", "lat", "lng", "category"]
          }
        }
      }
    });

    const deals = JSON.parse(result.text);

    // Filter or adjust for the client
    const clientDeals = deals.map((deal: any) => ({
      ...deal,
      location: {
        lat: deal.lat,
        lng: deal.lng,
        name: deal.locationName,
        address: deal.locationName
      },
      score: Math.floor(Math.random() * 50) + 50,
      voters: [],
      imageUrl: `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80`,
      sourceName: "Gemini Search",
      sourceType: "telegram"
    }));

    res.json({ status: "ok", deals: clientDeals });
  } catch (error: any) {
    console.error("Sync error:", error);
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ 
        error: "Quota reached. The Gemini API is currently busy or out of credits for Search. Please try again in 1 minute." 
      });
    }
    res.status(500).json({ error: "Failed to sync lobangs" });
  }
});

app.get("/api/bootstrap", async (req, res) => {
  try {
    const bootstrapDeals = [
      {
        title: "$4.50 Jumbo Chicken Cutlet Rice",
        description: "Massive crispy chicken cutlet with fragrant rice at Clementi. Student deal available!",
        price: 4.50,
        originalPrice: 6.80,
        category: "Student",
        location: { lat: 1.3150, lng: 103.7640, name: "Clementi Mall Food Court", address: "Clementi Mall" },
        score: 98,
        voters: [],
        imageUrl: "https://images.unsplash.com/photo-1562607311-283125dfa14d?auto=format&fit=crop&w=800&q=80",
        status: "approved",
        sourceType: "seed"
      },
      {
        title: "1-for-1 Milk Tea @ Koi The",
        description: "Limited time 1-for-1 offer on all medium sized milk teas.",
        price: 4.50,
        originalPrice: 9.00,
        category: "Drinks",
        location: { lat: 1.3500, lng: 103.8500, name: "Bishan Junction 8", address: "Bishan J8" },
        score: 95,
        voters: [],
        imageUrl: "https://images.unsplash.com/photo-1534422298391-e4f8c170db0a?auto=format&fit=crop&w=800&q=80",
        status: "approved",
        sourceType: "seed"
      },
      {
        title: "$2.50 Chicken Rice @ Maxwell",
        description: "Classic authentic Hainanese chicken rice at unbeatable price.",
        price: 2.50,
        originalPrice: 4.00,
        category: "Hawker",
        location: { lat: 1.2806, lng: 103.8448, name: "Maxwell Food Centre", address: "Maxwell Rd" },
        score: 92,
        voters: [],
        imageUrl: "https://images.unsplash.com/photo-1598514983318-2f64f8f4796c?auto=format&fit=crop&w=800&q=80",
        status: "approved",
        sourceType: "seed"
      }
    ];

    res.json({ deals: bootstrapDeals });
  } catch (error) {
    console.error("Bootstrap error:", error);
    res.status(500).json({ error: "Bootstrap failed" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
