import { Timestamp } from "firebase/firestore";

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category: string;
  tags?: string[];
  terms?: string;
  location: {
    lat: number;
    lng: number;
    address: string;
    name: string;
  };
  score: number;
  voters: string[];
  createdAt: Timestamp;
  status?: "pending" | "approved" | "rejected";
  expiresAt?: Timestamp;
  sourceUrl?: string;
  sourceName?: string;
  sourceType?: "community" | "telegram" | "web" | "seed";
  importKey?: string;
  createdBy: string;
  reviewedAt?: Timestamp;
  reviewedBy?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  reputation: number;
  contributions: number;
}
