// ═══════════════════════════════════════════════════════
// DISC GOLF COMPANION — COMPLETE SINGLE-FILE APP
// Part 1: Imports, Constants, Helpers, Core Components,
//         Forms, Trophy System
// Part 2: Bags, Dashboard, Detail, Cards, Main App
// ═══════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback, useRef, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { emailToUserId, syncToFirestore, loadFromFirestore, deleteUserDataFromFirestore, normalizeSkillLevel, normalizeThrowStyle } from './firestoreSync.js';
import { getAuth, signOut as firebaseSignOut, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from './firebase.js';
import FlightChart from './components/FlightChart.jsx';
import { hasValidFlightNumbersForChart, parseFlightNum } from './flightChartMath.js';
import { track } from './utils/analytics.js';
import ReactGA from 'react-ga4';
import {
  Trophy, Plus, Search, X, ChevronDown, Check, Minus, Target,
  ExternalLink, ChevronRight, Trash2, Package, Edit3, Calendar, Backpack,
  MapPin, Hash, ShoppingCart, Loader, LayoutGrid, List, Upload,
  Camera, Filter, Ruler, Library, Info,
  AlertTriangle, BarChart3, Crosshair, DollarSign,
  Zap, Shield, Users, Sparkles, Star, Download, Settings, LogOut, User, Mail, Lock, Award,
  Sun, Moon, Monitor, CheckSquare, Square,
} from 'lucide-react';

// ── Constants ────────────────────────────────────────
const MFRS = ['Axiom','Clash','DGA','Discraft','Dynamic Discs','Gateway','Innova','Kastaplast','Latitude 64','Lone Star','Mint','MVP','Prodigy','RPM','Streamline','TSA','Westside'];
const DT = {
  putter:          { label:'Putter',   bg:'bg-secondary/15',     text:'text-secondary',     border:'border-secondary/30',   color:'#6B8F71' },
  midrange:        { label:'Midrange', bg:'bg-primary/15', text:'text-primary', border:'border-primary/30',color:'#1F3D2B' },
  fairway_driver:  { label:'Fairway',  bg:'bg-gap-medium/15',   text:'text-gap-medium',   border:'border-gap-medium/30', color:'#C08A2E' },
  distance_driver: { label:'Distance', bg:'bg-gap-low/15',    text:'text-gap-low',    border:'border-gap-low/30',  color:'#4C7A67' },
};

/** Default flight numbers when disc type is chosen (add/edit form). */
const DISC_TYPE_FLIGHT_PRESETS = {
  distance_driver: { speed: 12, glide: 5, turn: -1, fade: 3 },
  fairway_driver: { speed: 7, glide: 5, turn: -1, fade: 2 },
  midrange: { speed: 5, glide: 4, turn: -1, fade: 1 },
  putter: { speed: 3, glide: 3, turn: 0, fade: 1 },
};

/** Map mold speed to disc_type for auto-fill from MOLD_LOOKUP. */
function inferDiscTypeFromSpeed(speed) {
  const s = typeof speed === 'number' && Number.isFinite(speed) ? speed : parseFlightNum(speed);
  if (!Number.isFinite(s) || s < 1) return 'putter';
  if (s <= 3) return 'putter';
  if (s <= 6) return 'midrange';
  if (s <= 11) return 'fairway_driver';
  return 'distance_driver';
}
const SM = {
  in_bag: { label: 'In Bag', dot: 'bg-primary' },
  backup: { label: 'Backup', dot: 'bg-secondary' },
  wall_hanger: { label: 'Wall', dot: 'bg-gap-medium' },
  lost: { label: 'Lost', dot: 'bg-orange-500' },
  gave_away_sold: { label: 'Gave Away / Sold', dot: 'bg-text-muted' },
};

/** @param {{ bagIds?: string[]; bagId?: string | null } | null | undefined} d */
function getDiscBagIds(d) {
  if (!d) return [];
  if (Array.isArray(d.bagIds) && d.bagIds.length) {
    return [...new Set(d.bagIds.filter((id) => typeof id === 'string' && id))];
  }
  if (typeof d.bagId === 'string' && d.bagId) return [d.bagId];
  return [];
}

/** When disc only had legacy bag membership via disc_ids, infer bagIds for the form. */
function inferBagIdsFromMembership(editDisc, bags) {
  const ids = getDiscBagIds(editDisc);
  if (ids.length) return ids;
  if (!editDisc?.id || !bags?.length) return [];
  return bags.filter((b) => b.disc_ids.includes(editDisc.id)).map((b) => b.id);
}

/** Discs shown in a bag detail view: in_bag + bag id in disc.bagIds (or legacy bagId / disc_ids). */
function discBelongsToBagView(d, bag) {
  if (!bag || !d || d.status !== 'in_bag') return false;
  const ids = getDiscBagIds(d);
  if (ids.length) return ids.includes(bag.id);
  return bag.disc_ids.includes(d.id);
}
const FN_META = [
  { key:'speed',label:'SPD',bg:'bg-secondary/10',text:'text-secondary' },
  { key:'glide',label:'GLD',bg:'bg-primary/10',text:'text-primary' },
  { key:'turn', label:'TRN',bg:'bg-gap-medium/10',text:'text-gap-medium' },
  { key:'fade', label:'FAD',bg:'bg-gap-low/10',text:'text-gap-low' },
];
const SPEED_RANGES = [
  { value:'All', label:'All Speeds', min:0, max:99 },
  { value:'1-3', label:'1–3 (Putters)', min:1, max:3.9 },
  { value:'4-5', label:'4–5 (Mids)', min:4, max:5.9 },
  { value:'6-8', label:'6–8 (Fairway)', min:6, max:8.9 },
  { value:'9+',  label:'9+ (Distance)', min:9, max:99 },
];
const SORT_OPTIONS = [
  { value:'Recent', label:'Recent' },{ value:'Name', label:'Name A–Z' },
  { value:'Speed', label:'Speed ↓' },{ value:'Wear', label:'Worst Condition' },
];
const DISC_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#ffffff','#1e1e1e','#6b7280','#14b8a6'];
const BAG_COLORS = ['#1e3a5f','#dc2626','#ea580c','#ca8a04','#16a34a','#0891b2','#7c3aed','#db2777','#475569','#f59e0b','#0ea5e9','#84cc16'];
const PB_CATEGORIES = ['Lowest Round','Most Birdies','Longest Putt','Best Score','First Under Par','Other'];

// Mold flight number lookup: { manufacturer, mold, speed, glide, turn, fade } — used for auto-fill in add/edit disc form
const MOLD_LOOKUP = [
  // Innova (57)
  { manufacturer:'Innova', mold:'Ape', speed:13, glide:5, turn:0, fade:4 }, { manufacturer:'Innova', mold:'Aviar', speed:2, glide:3, turn:0, fade:1 }, { manufacturer:'Innova', mold:'Aviar3', speed:2, glide:3, turn:0, fade:2 },
  { manufacturer:'Innova', mold:'AviarX3', speed:2, glide:2, turn:0, fade:3 }, { manufacturer:'Innova', mold:'Beast', speed:10, glide:5, turn:-2, fade:2 }, { manufacturer:'Innova', mold:'Birdie', speed:1, glide:2, turn:0, fade:0 },
  { manufacturer:'Innova', mold:'Boss', speed:13, glide:5, turn:-1, fade:3 }, { manufacturer:'Innova', mold:'Caiman', speed:5, glide:2, turn:0, fade:4 }, { manufacturer:'Innova', mold:'Colt', speed:3, glide:4, turn:-1, fade:1 },
  { manufacturer:'Innova', mold:'Colossus', speed:14, glide:5, turn:-2, fade:3 }, { manufacturer:'Innova', mold:'Corvette', speed:14, glide:6, turn:-2, fade:2 }, { manufacturer:'Innova', mold:'Dart', speed:3, glide:4, turn:0, fade:0 },
  { manufacturer:'Innova', mold:'Destroyer', speed:12, glide:5, turn:-1, fade:3 }, { manufacturer:'Innova', mold:'Dragon', speed:8, glide:5, turn:-2, fade:2 }, { manufacturer:'Innova', mold:'Eagle', speed:7, glide:4, turn:-1, fade:3 },
  { manufacturer:'Innova', mold:'Firebird', speed:9, glide:3, turn:0, fade:4 }, { manufacturer:'Innova', mold:'Foxbat', speed:5, glide:6, turn:-1, fade:0 }, { manufacturer:'Innova', mold:'Gator', speed:5, glide:2, turn:0, fade:3 },
  { manufacturer:'Innova', mold:'Gator3', speed:5, glide:2, turn:0, fade:3 }, { manufacturer:'Innova', mold:'Hawkeye', speed:8, glide:5, turn:-1, fade:2 }, { manufacturer:'Innova', mold:'Invader', speed:2, glide:3, turn:0, fade:1 },
  { manufacturer:'Innova', mold:'Katana', speed:13, glide:5, turn:-3, fade:3 }, { manufacturer:'Innova', mold:'Leopard', speed:6, glide:5, turn:-2, fade:1 }, { manufacturer:'Innova', mold:'Leopard3', speed:7, glide:5, turn:-2, fade:1 },
  { manufacturer:'Innova', mold:'Lion', speed:5, glide:4, turn:0, fade:2 }, { manufacturer:'Innova', mold:'Mako3', speed:5, glide:5, turn:0, fade:0 }, { manufacturer:'Innova', mold:'Mamba', speed:11, glide:6, turn:-5, fade:1 },
  { manufacturer:'Innova', mold:'Mirage', speed:5, glide:5, turn:-3, fade:0 }, { manufacturer:'Innova', mold:'Monster', speed:10, glide:3, turn:0, fade:5 }, { manufacturer:'Innova', mold:'Mystere', speed:11, glide:6, turn:-2, fade:2 },
  { manufacturer:'Innova', mold:'Nova', speed:2, glide:3, turn:0, fade:0 }, { manufacturer:'Innova', mold:'Orc', speed:10, glide:4, turn:-1, fade:3 }, { manufacturer:'Innova', mold:'Panther', speed:5, glide:4, turn:-2, fade:1 },
  { manufacturer:'Innova', mold:'Pig', speed:3, glide:1, turn:0, fade:3 }, { manufacturer:'Innova', mold:'Polecat', speed:1, glide:3, turn:0, fade:0 }, { manufacturer:'Innova', mold:'Rat', speed:4, glide:2, turn:0, fade:3 },
  { manufacturer:'Innova', mold:'Rhyno', speed:2, glide:1, turn:0, fade:3 }, { manufacturer:'Innova', mold:'Roadrunner', speed:9, glide:5, turn:-4, fade:1 }, { manufacturer:'Innova', mold:'Roc', speed:4, glide:3, turn:0, fade:3 },
  { manufacturer:'Innova', mold:'Roc3', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Innova', mold:'RocX3', speed:5, glide:3, turn:0, fade:4 }, { manufacturer:'Innova', mold:'Savant', speed:10, glide:5, turn:-1, fade:2 },
  { manufacturer:'Innova', mold:'Shark', speed:4, glide:4, turn:0, fade:2 }, { manufacturer:'Innova', mold:'Shryke', speed:13, glide:6, turn:-2, fade:2 }, { manufacturer:'Innova', mold:'Sidewinder', speed:9, glide:5, turn:-3, fade:1 },
  { manufacturer:'Innova', mold:'Stud', speed:3, glide:3, turn:0, fade:2 }, { manufacturer:'Innova', mold:'TL', speed:7, glide:5, turn:0, fade:1 }, { manufacturer:'Innova', mold:'TL3', speed:8, glide:4, turn:0, fade:1 },
  { manufacturer:'Innova', mold:'Teebird', speed:7, glide:5, turn:0, fade:2 }, { manufacturer:'Innova', mold:'Teebird3', speed:8, glide:4, turn:0, fade:2 }, { manufacturer:'Innova', mold:'Tern', speed:11, glide:5, turn:-2, fade:2 },
  { manufacturer:'Innova', mold:'Thunderbird', speed:9, glide:5, turn:0, fade:2 }, { manufacturer:'Innova', mold:'Valkyrie', speed:9, glide:4, turn:-2, fade:2 }, { manufacturer:'Innova', mold:'VRoc', speed:4, glide:4, turn:0, fade:1 },
  { manufacturer:'Innova', mold:'Wombat3', speed:5, glide:6, turn:-1, fade:0 }, { manufacturer:'Innova', mold:'Wraith', speed:11, glide:5, turn:-1, fade:3 }, { manufacturer:'Innova', mold:'XCaliber', speed:12, glide:4, turn:0, fade:4 },
  // Discmania (17)
  { manufacturer:'Discmania', mold:'CD2', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'Discmania', mold:'DD3', speed:12, glide:5, turn:-1, fade:3 }, { manufacturer:'Discmania', mold:'Enigma', speed:12, glide:6, turn:-1, fade:2 },
  { manufacturer:'Discmania', mold:'Essence', speed:8, glide:6, turn:-2, fade:1 }, { manufacturer:'Discmania', mold:'FD', speed:7, glide:6, turn:-1, fade:1 }, { manufacturer:'Discmania', mold:'Instinct', speed:7, glide:5, turn:-1, fade:2 },
  { manufacturer:'Discmania', mold:'Link', speed:2, glide:4, turn:0, fade:1 }, { manufacturer:'Discmania', mold:'Logic', speed:3, glide:3, turn:0, fade:1 }, { manufacturer:'Discmania', mold:'MD3', speed:5, glide:5, turn:0, fade:2 },
  { manufacturer:'Discmania', mold:'Method', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Discmania', mold:'Mutant', speed:5, glide:2, turn:0, fade:4 }, { manufacturer:'Discmania', mold:'Origin', speed:5, glide:5, turn:-1, fade:0 },
  { manufacturer:'Discmania', mold:'P2', speed:2, glide:3, turn:0, fade:1 }, { manufacturer:'Discmania', mold:'PD', speed:10, glide:4, turn:0, fade:3 }, { manufacturer:'Discmania', mold:'Rainmaker', speed:2, glide:3, turn:0, fade:2 },
  { manufacturer:'Discmania', mold:'Sensei', speed:3, glide:3, turn:0, fade:1 }, { manufacturer:'Discmania', mold:'Tactic', speed:4, glide:2, turn:0, fade:3 },
  // Discraft (42)
  { manufacturer:'Discraft', mold:'Anax', speed:10, glide:6, turn:-1, fade:3 }, { manufacturer:'Discraft', mold:'Archer', speed:5, glide:4, turn:-4, fade:1 }, { manufacturer:'Discraft', mold:'Ares', speed:12, glide:6, turn:-1, fade:2 },
  { manufacturer:'Discraft', mold:'Athena', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'Discraft', mold:'Avenger SS', speed:10, glide:5, turn:-3, fade:1 }, { manufacturer:'Discraft', mold:'Banger GT', speed:2, glide:3, turn:0, fade:1 },
  { manufacturer:'Discraft', mold:'Buzzz', speed:5, glide:4, turn:-1, fade:1 }, { manufacturer:'Discraft', mold:'Buzzz OS', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Discraft', mold:'Buzzz SS', speed:5, glide:4, turn:-2, fade:1 },
  { manufacturer:'Discraft', mold:'Challenger', speed:2, glide:3, turn:0, fade:2 }, { manufacturer:'Discraft', mold:'Cicada', speed:8, glide:6, turn:-2, fade:1 }, { manufacturer:'Discraft', mold:'Cigarra', speed:7, glide:6, turn:-1, fade:2 },
  { manufacturer:'Discraft', mold:'Comet', speed:5, glide:5, turn:-2, fade:1 }, { manufacturer:'Discraft', mold:'Crank', speed:12, glide:5, turn:-2, fade:2 }, { manufacturer:'Discraft', mold:'Crank SS', speed:13, glide:5, turn:-3, fade:3 },
  { manufacturer:'Discraft', mold:'Fierce', speed:3, glide:4, turn:-1, fade:0 }, { manufacturer:'Discraft', mold:'Force', speed:12, glide:5, turn:0, fade:3 }, { manufacturer:'Discraft', mold:'Hades', speed:12, glide:6, turn:-3, fade:2 },
  { manufacturer:'Discraft', mold:'Hallux', speed:10, glide:5, turn:0, fade:3 }, { manufacturer:'Discraft', mold:'Heat', speed:9, glide:6, turn:-3, fade:1 }, { manufacturer:'Discraft', mold:'Kratos', speed:3, glide:3, turn:0, fade:3 },
  { manufacturer:'Discraft', mold:'Luna', speed:3, glide:3, turn:0, fade:3 }, { manufacturer:'Discraft', mold:'Machete', speed:11, glide:4, turn:0, fade:4 }, { manufacturer:'Discraft', mold:'Maltese', speed:5, glide:4, turn:0, fade:3 },
  { manufacturer:'Discraft', mold:'Mantis', speed:8, glide:5, turn:-2, fade:1 }, { manufacturer:'Discraft', mold:'Meteor', speed:5, glide:5, turn:-3, fade:1 }, { manufacturer:'Discraft', mold:'Nuke', speed:13, glide:5, turn:-1, fade:3 },
  { manufacturer:'Discraft', mold:'Nuke SS', speed:13, glide:5, turn:-3, fade:3 }, { manufacturer:'Discraft', mold:'Passion', speed:8, glide:5, turn:-1, fade:2 }, { manufacturer:'Discraft', mold:'Punisher', speed:12, glide:5, turn:0, fade:3 },
  { manufacturer:'Discraft', mold:'Raptor', speed:9, glide:4, turn:0, fade:3 }, { manufacturer:'Discraft', mold:'Roach', speed:2, glide:4, turn:0, fade:1 }, { manufacturer:'Discraft', mold:'Scorch', speed:11, glide:6, turn:-2, fade:2 },
  { manufacturer:'Discraft', mold:'Stalker', speed:7, glide:5, turn:-1, fade:2 }, { manufacturer:'Discraft', mold:'Surge', speed:13, glide:5, turn:-1, fade:3 }, { manufacturer:'Discraft', mold:'Surge SS', speed:13, glide:5, turn:-2, fade:3 },
  { manufacturer:'Discraft', mold:'Thrasher', speed:12, glide:5, turn:-2, fade:2 }, { manufacturer:'Discraft', mold:'Undertaker', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'Discraft', mold:'Vulture', speed:10, glide:5, turn:-1, fade:2 },
  { manufacturer:'Discraft', mold:'Wasp', speed:5, glide:3, turn:0, fade:2 }, { manufacturer:'Discraft', mold:'Zeus', speed:12, glide:5, turn:-1, fade:3 }, { manufacturer:'Discraft', mold:'Zone', speed:4, glide:3, turn:0, fade:3 },
  // Dynamic Discs (32)
  { manufacturer:'Dynamic Discs', mold:'Bounty', speed:4, glide:5, turn:-1.5, fade:0.5 }, { manufacturer:'Dynamic Discs', mold:'Breakout', speed:8, glide:5, turn:-1, fade:1 }, { manufacturer:'Dynamic Discs', mold:'Captain', speed:13, glide:5, turn:-2, fade:2 },
  { manufacturer:'Dynamic Discs', mold:'Contender', speed:9, glide:6, turn:-1, fade:1 }, { manufacturer:'Dynamic Discs', mold:'Convict', speed:9, glide:4, turn:-0.5, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Criminal', speed:10, glide:3, turn:0.5, fade:4 },
  { manufacturer:'Dynamic Discs', mold:'Deputy', speed:3, glide:4, turn:-1, fade:0 }, { manufacturer:'Dynamic Discs', mold:'Emac Truth', speed:5, glide:5, turn:0, fade:2 }, { manufacturer:'Dynamic Discs', mold:'Enforcer', speed:12, glide:5, turn:0, fade:4 },
  { manufacturer:'Dynamic Discs', mold:'Escape', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'Dynamic Discs', mold:'Evader', speed:8, glide:5, turn:0, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Evidence', speed:5, glide:5, turn:-1, fade:0 },
  { manufacturer:'Dynamic Discs', mold:'Felon', speed:9, glide:4, turn:0, fade:4 }, { manufacturer:'Dynamic Discs', mold:'Freedom', speed:14, glide:5, turn:-3, fade:2 }, { manufacturer:'Dynamic Discs', mold:'Fugitive', speed:5, glide:5, turn:-0.5, fade:1.7 },
  { manufacturer:'Dynamic Discs', mold:'Getaway', speed:9, glide:5, turn:0, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Guard', speed:2, glide:3, turn:0, fade:1.5 }, { manufacturer:'Dynamic Discs', mold:'Harp', speed:4, glide:3, turn:0, fade:3 },
  { manufacturer:'Dynamic Discs', mold:'Judge', speed:2, glide:4, turn:0, fade:1 }, { manufacturer:'Dynamic Discs', mold:'Justice', speed:5, glide:2, turn:0.5, fade:4 }, { manufacturer:'Dynamic Discs', mold:'Lucid-X Felon', speed:9, glide:4, turn:0, fade:4 },
  { manufacturer:'Dynamic Discs', mold:'Maverick', speed:7, glide:5, turn:-1, fade:2 }, { manufacturer:'Dynamic Discs', mold:'Raider', speed:12, glide:5, turn:-1, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Sergeant', speed:11, glide:5, turn:-1, fade:2 },
  { manufacturer:'Dynamic Discs', mold:'Sheriff', speed:12, glide:6, turn:-1, fade:2 }, { manufacturer:'Dynamic Discs', mold:'Slammer', speed:3, glide:2, turn:0, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Suspect', speed:4, glide:3, turn:0, fade:2 },
  { manufacturer:'Dynamic Discs', mold:'Trespass', speed:12, glide:5, turn:-0.5, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Truth', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'Dynamic Discs', mold:'Vandal', speed:9, glide:5, turn:-1.5, fade:2 },
  { manufacturer:'Dynamic Discs', mold:'Verdict', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Dynamic Discs', mold:'Warden', speed:2, glide:4, turn:0, fade:1 },
  // MVP (22)
  { manufacturer:'MVP', mold:'Anode', speed:2, glide:4, turn:0, fade:0 }, { manufacturer:'MVP', mold:'Atom', speed:3, glide:3, turn:-0.5, fade:1 }, { manufacturer:'MVP', mold:'Catalyst', speed:12, glide:6, turn:-2, fade:2 },
  { manufacturer:'MVP', mold:'Crave', speed:6, glide:5, turn:-1, fade:1 }, { manufacturer:'MVP', mold:'Deflector', speed:5, glide:3, turn:0, fade:4 }, { manufacturer:'MVP', mold:'Defy', speed:11, glide:5, turn:0, fade:3 },
  { manufacturer:'MVP', mold:'Entropy', speed:4, glide:2, turn:0, fade:3 }, { manufacturer:'MVP', mold:'Hex', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'MVP', mold:'Insanity', speed:9, glide:5, turn:-2, fade:1.5 },
  { manufacturer:'MVP', mold:'Ion', speed:2, glide:4, turn:0, fade:1 }, { manufacturer:'MVP', mold:'Matrix', speed:5, glide:4, turn:0, fade:2 }, { manufacturer:'MVP', mold:'Motion', speed:9, glide:4, turn:0, fade:3 },
  { manufacturer:'MVP', mold:'Octane', speed:10, glide:5, turn:-1, fade:2 }, { manufacturer:'MVP', mold:'Ohm', speed:2, glide:5, turn:0, fade:0 }, { manufacturer:'MVP', mold:'Photon', speed:11, glide:5, turn:-1, fade:2 },
  { manufacturer:'MVP', mold:'Reactor', speed:5, glide:5, turn:-0.5, fade:1.5 }, { manufacturer:'MVP', mold:'Relay', speed:6, glide:5, turn:-2, fade:1 }, { manufacturer:'MVP', mold:'Resistor', speed:6, glide:4, turn:0, fade:3 },
  { manufacturer:'MVP', mold:'Servo', speed:6, glide:5, turn:-1, fade:2 }, { manufacturer:'MVP', mold:'Tesla', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'MVP', mold:'Volt', speed:8, glide:5, turn:-0.5, fade:2 },
  { manufacturer:'MVP', mold:'Wave', speed:11, glide:5, turn:-2, fade:2 },
  // Latitude 64 (20)
  { manufacturer:'Latitude 64', mold:'Anchor', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Latitude 64', mold:'Ballista', speed:14, glide:5, turn:-1, fade:3 }, { manufacturer:'Latitude 64', mold:'Ballista Pro', speed:14, glide:4, turn:0, fade:3 },
  { manufacturer:'Latitude 64', mold:'Compass', speed:5, glide:5, turn:0, fade:1 }, { manufacturer:'Latitude 64', mold:'Diamond', speed:8, glide:6, turn:-3, fade:1 }, { manufacturer:'Latitude 64', mold:'Explorer', speed:7, glide:5, turn:0, fade:2 },
  { manufacturer:'Latitude 64', mold:'Fuse', speed:5, glide:5, turn:-1, fade:0 }, { manufacturer:'Latitude 64', mold:'Grace', speed:11, glide:6, turn:-1, fade:2 }, { manufacturer:'Latitude 64', mold:'Harp', speed:4, glide:3, turn:0, fade:3 },
  { manufacturer:'Latitude 64', mold:'Keystone', speed:3, glide:5, turn:-1, fade:0 }, { manufacturer:'Latitude 64', mold:'Mercy', speed:2, glide:4, turn:0, fade:1 }, { manufacturer:'Latitude 64', mold:'Pioneer', speed:9, glide:4, turn:0, fade:4 },
  { manufacturer:'Latitude 64', mold:'Pure', speed:3, glide:3, turn:0, fade:0 }, { manufacturer:'Latitude 64', mold:'Recoil', speed:9, glide:5, turn:0, fade:3 }, { manufacturer:'Latitude 64', mold:'River', speed:7, glide:7, turn:-1, fade:1 },
  { manufacturer:'Latitude 64', mold:'Rive', speed:12, glide:6, turn:0, fade:3 }, { manufacturer:'Latitude 64', mold:'Saint', speed:9, glide:7, turn:-1, fade:2 }, { manufacturer:'Latitude 64', mold:'Saint Pro', speed:9, glide:6, turn:0, fade:3 },
  { manufacturer:'Latitude 64', mold:'Sapphire', speed:10, glide:6, turn:-1, fade:2 }, { manufacturer:'Latitude 64', mold:'Trust', speed:9, glide:5, turn:0, fade:2 },
  // Kastaplast (20)
  { manufacturer:'Kastaplast', mold:'Berg', speed:1, glide:1, turn:0, fade:2 }, { manufacturer:'Kastaplast', mold:'Falk', speed:9, glide:6, turn:-2, fade:1 }, { manufacturer:'Kastaplast', mold:'Falk', speed:9, glide:6, turn:-2, fade:1 },
  { manufacturer:'Kastaplast', mold:'Göte', speed:5, glide:5, turn:-1, fade:0 }, { manufacturer:'Kastaplast', mold:'Grym', speed:11, glide:6, turn:-2, fade:2 }, { manufacturer:'Kastaplast', mold:'Grym X', speed:11, glide:5, turn:0, fade:3 },
  { manufacturer:'Kastaplast', mold:'Guld', speed:12, glide:6, turn:-1, fade:2 }, { manufacturer:'Kastaplast', mold:'Impa', speed:11, glide:6, turn:-4, fade:1 }, { manufacturer:'Kastaplast', mold:'Järn', speed:4, glide:2, turn:0, fade:3 },
  { manufacturer:'Kastaplast', mold:'Kaxe', speed:6, glide:4, turn:0, fade:3 }, { manufacturer:'Kastaplast', mold:'Kaxe Z', speed:6, glide:5, turn:-1, fade:2 }, { manufacturer:'Kastaplast', mold:'Lots', speed:9, glide:5, turn:-1, fade:2 },
  { manufacturer:'Kastaplast', mold:'Rask', speed:12, glide:4, turn:0, fade:4 }, { manufacturer:'Kastaplast', mold:'Rask', speed:12, glide:4, turn:0, fade:4 }, { manufacturer:'Kastaplast', mold:'Reko', speed:3, glide:3, turn:0, fade:1 },
  { manufacturer:'Kastaplast', mold:'Reko X', speed:3, glide:3, turn:0, fade:2 }, { manufacturer:'Kastaplast', mold:'Stig', speed:8, glide:6, turn:-2, fade:1 }, { manufacturer:'Kastaplast', mold:'Stål', speed:9, glide:4, turn:0, fade:3 },
  { manufacturer:'Kastaplast', mold:'Svea', speed:5, glide:6, turn:-1, fade:0 }, { manufacturer:'Kastaplast', mold:'Vass', speed:13, glide:5, turn:-1, fade:3 },
  // Westside (22)
  { manufacturer:'Westside', mold:'Adder', speed:13, glide:5, turn:-2, fade:2 }, { manufacturer:'Westside', mold:'Ahti', speed:9, glide:3, turn:0, fade:4 }, { manufacturer:'Westside', mold:'Bear', speed:8, glide:6, turn:-2, fade:1 },
  { manufacturer:'Westside', mold:'Boatman', speed:11, glide:5, turn:0, fade:2 }, { manufacturer:'Westside', mold:'Destiny', speed:14, glide:6, turn:-2, fade:2 }, { manufacturer:'Westside', mold:'Fortress', speed:9, glide:4, turn:0, fade:3 },
  { manufacturer:'Westside', mold:'Gatekeeper', speed:5, glide:4, turn:0, fade:2 }, { manufacturer:'Westside', mold:'Giant', speed:12, glide:5, turn:-1, fade:3 }, { manufacturer:'Westside', mold:'Harp', speed:4, glide:3, turn:0, fade:3 },
  { manufacturer:'Westside', mold:'Hatchet', speed:9, glide:6, turn:-2, fade:1 }, { manufacturer:'Westside', mold:'King', speed:14, glide:5, turn:-1.5, fade:2 }, { manufacturer:'Westside', mold:'Maiden', speed:3, glide:4, turn:0, fade:0 },
  { manufacturer:'Westside', mold:'Northman', speed:10, glide:5, turn:-1, fade:2 }, { manufacturer:'Westside', mold:'Seer', speed:7, glide:6, turn:-2, fade:1 }, { manufacturer:'Westside', mold:'Shield', speed:3, glide:3, turn:0, fade:1 },
  { manufacturer:'Westside', mold:'Sling', speed:5, glide:5, turn:-2, fade:0 }, { manufacturer:'Westside', mold:'Stag', speed:8, glide:6, turn:-1, fade:2 }, { manufacturer:'Westside', mold:'Sword', speed:12, glide:5, turn:-1, fade:2 },
  { manufacturer:'Westside', mold:'Tursas', speed:5, glide:5, turn:-2, fade:1 }, { manufacturer:'Westside', mold:'Underworld', speed:7, glide:6, turn:-3, fade:1 }, { manufacturer:'Westside', mold:'Warship', speed:5, glide:6, turn:0, fade:0 },
  { manufacturer:'Westside', mold:'World', speed:14, glide:4, turn:1, fade:4 },
  // Prodigy (34)
  { manufacturer:'Prodigy', mold:'A1', speed:4, glide:3, turn:0, fade:4 }, { manufacturer:'Prodigy', mold:'A2', speed:4, glide:2, turn:0, fade:3 }, { manufacturer:'Prodigy', mold:'A3', speed:4, glide:4, turn:0, fade:3 },
  { manufacturer:'Prodigy', mold:'A5', speed:4, glide:3, turn:0, fade:2 }, { manufacturer:'Prodigy', mold:'D1', speed:12, glide:5, turn:0, fade:3 }, { manufacturer:'Prodigy', mold:'D2', speed:12, glide:6, turn:-1, fade:2 },
  { manufacturer:'Prodigy', mold:'D2 Pro', speed:12, glide:5, turn:-1, fade:3 }, { manufacturer:'Prodigy', mold:'D3', speed:12, glide:6, turn:-2, fade:2 }, { manufacturer:'Prodigy', mold:'D4', speed:13, glide:6, turn:-3, fade:2 },
  { manufacturer:'Prodigy', mold:'F1', speed:7, glide:4, turn:0, fade:3 }, { manufacturer:'Prodigy', mold:'F2', speed:7, glide:5, turn:0, fade:2 }, { manufacturer:'Prodigy', mold:'F3', speed:7, glide:5, turn:0, fade:2 },
  { manufacturer:'Prodigy', mold:'F5', speed:7, glide:5, turn:-2, fade:1 }, { manufacturer:'Prodigy', mold:'F7', speed:7, glide:6, turn:-3, fade:1 }, { manufacturer:'Prodigy', mold:'Feedback', speed:9, glide:5, turn:-1, fade:3 },
  { manufacturer:'Prodigy', mold:'FX-2', speed:9, glide:4, turn:0, fade:3 }, { manufacturer:'Prodigy', mold:'FX-3', speed:9, glide:5, turn:-0.5, fade:2 }, { manufacturer:'Prodigy', mold:'FX-4', speed:9, glide:5, turn:-2, fade:1 },
  { manufacturer:'Prodigy', mold:'Good Boy', speed:3, glide:5, turn:0, fade:2 }, { manufacturer:'Prodigy', mold:'H1 V2', speed:10, glide:4, turn:0, fade:4 }, { manufacturer:'Prodigy', mold:'H2 V2', speed:10, glide:5, turn:-1, fade:2 },
  { manufacturer:'Prodigy', mold:'H3 V2', speed:10, glide:5, turn:-1, fade:2 }, { manufacturer:'Prodigy', mold:'M1', speed:5, glide:3, turn:0, fade:3 }, { manufacturer:'Prodigy', mold:'M2', speed:5, glide:4, turn:0, fade:2 },
  { manufacturer:'Prodigy', mold:'M3', speed:5, glide:4, turn:0, fade:2 }, { manufacturer:'Prodigy', mold:'M4', speed:5, glide:5, turn:-2, fade:0 }, { manufacturer:'Prodigy', mold:'MX-3', speed:5, glide:5, turn:-1, fade:1 },
  { manufacturer:'Prodigy', mold:'PA-1', speed:2, glide:3, turn:0, fade:3 }, { manufacturer:'Prodigy', mold:'PA-2', speed:3, glide:3, turn:0, fade:2 }, { manufacturer:'Prodigy', mold:'PA-3', speed:3, glide:3, turn:0, fade:1 },
  { manufacturer:'Prodigy', mold:'PA-5', speed:3, glide:4, turn:-2, fade:0 }, { manufacturer:'Prodigy', mold:'X1', speed:12, glide:3, turn:0, fade:5 }, { manufacturer:'Prodigy', mold:'X3', speed:11, glide:5, turn:-1, fade:2 },
  { manufacturer:'Prodigy', mold:'X5', speed:13, glide:5, turn:-4, fade:1 },
  // Axiom (14)
  { manufacturer:'Axiom', mold:'Crave', speed:6, glide:5, turn:-1, fade:1 }, { manufacturer:'Axiom', mold:'Defy', speed:11, glide:5, turn:0, fade:3 }, { manufacturer:'Axiom', mold:'Envy', speed:3, glide:3, turn:0, fade:2 },
  { manufacturer:'Axiom', mold:'Fireball', speed:9, glide:3, turn:0, fade:4 }, { manufacturer:'Axiom', mold:'Hex', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'Axiom', mold:'Insanity', speed:9, glide:5, turn:-2, fade:1.5 },
  { manufacturer:'Axiom', mold:'Mayhem', speed:13, glide:5, turn:-1.5, fade:2 }, { manufacturer:'Axiom', mold:'Paradox', speed:5, glide:4, turn:-4, fade:0 }, { manufacturer:'Axiom', mold:'Proxy', speed:3, glide:3, turn:-1, fade:0 },
  { manufacturer:'Axiom', mold:'Pyro', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Axiom', mold:'Tenacity', speed:13, glide:5, turn:-2, fade:2 }, { manufacturer:'Axiom', mold:'Vanish', speed:11, glide:5, turn:-2, fade:1.5 },
  { manufacturer:'Axiom', mold:'Virus', speed:9, glide:5, turn:-3.5, fade:1 }, { manufacturer:'Axiom', mold:'Wrath', speed:9, glide:4, turn:0, fade:3 },
  // Streamline (7)
  { manufacturer:'Streamline', mold:'Drift', speed:7, glide:5, turn:-2, fade:1 }, { manufacturer:'Streamline', mold:'Flare', speed:9, glide:3, turn:0, fade:4 }, { manufacturer:'Streamline', mold:'Lift', speed:9, glide:5, turn:-1, fade:2 },
  { manufacturer:'Streamline', mold:'Pilot', speed:2, glide:5, turn:0, fade:0 }, { manufacturer:'Streamline', mold:'Runway', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'Streamline', mold:'Stabilizer', speed:3, glide:3, turn:0, fade:3 },
  { manufacturer:'Streamline', mold:'Trace', speed:11, glide:5, turn:-1, fade:2 },
  // Lone Star (10), Mint (7), RPM (6), TSA (8), DGA (9), Gateway (8), Clash (9), Infinite Discs (13), Millennium (7), Flight Lab Discs (4)
  { manufacturer:'Lone Star', mold:'Armadillo', speed:2, glide:3, turn:0, fade:2 }, { manufacturer:'Lone Star', mold:'Benny', speed:2, glide:3, turn:0, fade:1 }, { manufacturer:'Lone Star', mold:'Copperhead', speed:9, glide:4, turn:0, fade:3 },
  { manufacturer:'Lone Star', mold:'Curve', speed:12, glide:6, turn:-2, fade:2 }, { manufacturer:'Lone Star', mold:'Frio', speed:7, glide:5, turn:-1, fade:1 }, { manufacturer:'Lone Star', mold:'Lone Wolf', speed:5, glide:5, turn:-3, fade:1 },
  { manufacturer:'Lone Star', mold:'Mad Cat', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'Lone Star', mold:'Middy', speed:5, glide:5, turn:0, fade:1 }, { manufacturer:'Lone Star', mold:'Mongoose', speed:9, glide:5, turn:-2, fade:2 },
  { manufacturer:'Lone Star', mold:'Walker', speed:5, glide:5, turn:0, fade:1 },
  { manufacturer:'Mint', mold:'Alpha', speed:10, glide:5, turn:0, fade:3 }, { manufacturer:'Mint', mold:'Bullet', speed:2.5, glide:3.5, turn:-0.5, fade:1 }, { manufacturer:'Mint', mold:'Freetail', speed:9, glide:5, turn:-2, fade:2 },
  { manufacturer:'Mint', mold:'Goat', speed:13, glide:5, turn:0, fade:3 }, { manufacturer:'Mint', mold:'Lobster', speed:5, glide:5, turn:-3, fade:0 }, { manufacturer:'Mint', mold:'Longhorn', speed:12, glide:5, turn:-1, fade:2 },
  { manufacturer:'Mint', mold:'Mustang', speed:5, glide:5, turn:0, fade:2 },
  { manufacturer:'RPM', mold:'Tui', speed:3, glide:4, turn:-1, fade:0 }, { manufacturer:'RPM', mold:'Ruru', speed:3, glide:3, turn:0, fade:1 }, { manufacturer:'RPM', mold:'Piwakawaka', speed:7, glide:6, turn:-3, fade:0 },
  { manufacturer:'RPM', mold:'Kotuku', speed:5, glide:5, turn:0, fade:2 }, { manufacturer:'RPM', mold:'Pekapeka', speed:9, glide:5, turn:-2, fade:2 }, { manufacturer:'RPM', mold:'Cosmic', speed:13, glide:5, turn:-1, fade:3 },
  { manufacturer:'TSA', mold:'Animus', speed:11, glide:5, turn:-1, fade:2 }, { manufacturer:'TSA', mold:'Construct', speed:5, glide:4, turn:0, fade:3 }, { manufacturer:'TSA', mold:'Mantra', speed:9, glide:6, turn:-2, fade:1 },
  { manufacturer:'TSA', mold:'Omen', speed:4, glide:3, turn:0, fade:3 }, { manufacturer:'TSA', mold:'Pathfinder', speed:5, glide:5, turn:0, fade:1 }, { manufacturer:'TSA', mold:'Praxis', speed:2, glide:4, turn:0, fade:0 },
  { manufacturer:'TSA', mold:'Synapse', speed:13, glide:5, turn:-1, fade:3 }, { manufacturer:'TSA', mold:'Votum', speed:9, glide:5, turn:0, fade:3 },
  { manufacturer:'DGA', mold:'Banzai', speed:9, glide:5, turn:-2, fade:2 }, { manufacturer:'DGA', mold:'Breaker', speed:4, glide:3, turn:0, fade:3 }, { manufacturer:'DGA', mold:'Hurricane', speed:12, glide:5, turn:-1, fade:2 },
  { manufacturer:'DGA', mold:'Pipeline', speed:8, glide:5, turn:-1, fade:2 }, { manufacturer:'DGA', mold:'Proline Squall', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'DGA', mold:'Rogue', speed:13, glide:5, turn:-1, fade:3 },
  { manufacturer:'DGA', mold:'Squall', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'DGA', mold:'Steady BL', speed:2, glide:3, turn:0, fade:2 }, { manufacturer:'DGA', mold:'Tremor', speed:8, glide:5, turn:-3, fade:1 },
  { manufacturer:'Gateway', mold:'Assassin', speed:10, glide:5, turn:-2, fade:2 }, { manufacturer:'Gateway', mold:'Devil Hawk', speed:4, glide:2, turn:0, fade:3 }, { manufacturer:'Gateway', mold:'Diamond', speed:5, glide:5, turn:-2, fade:0 },
  { manufacturer:'Gateway', mold:'Magic', speed:2, glide:3, turn:-1, fade:0 }, { manufacturer:'Gateway', mold:'Shaman', speed:2, glide:4, turn:-1, fade:0 }, { manufacturer:'Gateway', mold:'Voodoo', speed:2, glide:3, turn:0, fade:1 },
  { manufacturer:'Gateway', mold:'War Spear', speed:9, glide:5, turn:0, fade:3 }, { manufacturer:'Gateway', mold:'Wizard', speed:2, glide:3, turn:0, fade:2 },
  { manufacturer:'Clash', mold:'Berry', speed:2, glide:4, turn:0, fade:0 }, { manufacturer:'Clash', mold:'Cookie', speed:4, glide:3, turn:0, fade:3 }, { manufacturer:'Clash', mold:'Disc', speed:9, glide:5, turn:-1, fade:2 },
  { manufacturer:'Clash', mold:'Mango', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'Clash', mold:'Mint', speed:5, glide:5, turn:-1, fade:1 }, { manufacturer:'Clash', mold:'Peach', speed:3, glide:3, turn:0, fade:2 },
  { manufacturer:'Clash', mold:'Pepper', speed:4, glide:3, turn:0, fade:2 }, { manufacturer:'Clash', mold:'Salt', speed:2, glide:3, turn:0, fade:1 }, { manufacturer:'Clash', mold:'Soda', speed:7, glide:5, turn:-2, fade:1 },
  // Infinite Discs (13)
  { manufacturer:'Infinite Discs', mold:'Alpaca', speed:3, glide:3, turn:0, fade:1 }, { manufacturer:'Infinite Discs', mold:'Aztec', speed:10, glide:5, turn:-1, fade:2 }, { manufacturer:'Infinite Discs', mold:'Chariot', speed:5, glide:5, turn:0, fade:1 },
  { manufacturer:'Infinite Discs', mold:'Dynasty', speed:9, glide:5, turn:-1, fade:2 }, { manufacturer:'Infinite Discs', mold:'Emperor', speed:12, glide:5, turn:-1, fade:2.5 }, { manufacturer:'Infinite Discs', mold:'Exodus', speed:7, glide:5, turn:-0.5, fade:2 },
  { manufacturer:'Infinite Discs', mold:'Maya', speed:11, glide:5, turn:-3, fade:1 }, { manufacturer:'Infinite Discs', mold:'Pharaoh', speed:13, glide:6, turn:-1, fade:2 }, { manufacturer:'Infinite Discs', mold:'Ra', speed:5, glide:4, turn:0, fade:2.5 },
  { manufacturer:'Infinite Discs', mold:'Roman', speed:10, glide:4, turn:0, fade:3 }, { manufacturer:'Infinite Discs', mold:'Scepter', speed:9, glide:4, turn:0, fade:4 }, { manufacturer:'Infinite Discs', mold:'Sphinx', speed:9, glide:6, turn:-3, fade:1 },
  { manufacturer:'Infinite Discs', mold:'Tomb', speed:3, glide:4, turn:0, fade:1 },
  // Millennium (7)
  { manufacturer:'Millennium', mold:'Astra', speed:11, glide:5, turn:-2, fade:2 }, { manufacturer:'Millennium', mold:'Aurora MS', speed:5, glide:5, turn:-2, fade:1 }, { manufacturer:'Millennium', mold:'Draco', speed:12, glide:5, turn:-1, fade:3 },
  { manufacturer:'Millennium', mold:'JLS', speed:7, glide:5, turn:-1, fade:1 }, { manufacturer:'Millennium', mold:'Omega', speed:2, glide:3, turn:-1, fade:1 }, { manufacturer:'Millennium', mold:'Orion LF', speed:9, glide:5, turn:0, fade:3 },
  { manufacturer:'Millennium', mold:'Scorpius', speed:13, glide:5, turn:-1, fade:3 },
  // Flight Lab Discs (4)
  { manufacturer:'Flight Lab Discs', mold:'Dot', speed:3, glide:4, turn:0, fade:0 }, { manufacturer:'Flight Lab Discs', mold:'Knockout', speed:9, glide:3, turn:0, fade:3 }, { manufacturer:'Flight Lab Discs', mold:'Vapor', speed:11, glide:5, turn:-1, fade:2 },
  { manufacturer:'Flight Lab Discs', mold:'Wayfinder', speed:5, glide:5, turn:0, fade:2 },
];

const STAB_META = {
  understable:{label:'Understable',color:'#6B8F71',bg:'bg-secondary/15',text:'text-secondary',border:'border-secondary/30',icon:'↗'},
  stable:{label:'Stable',color:'#1F3D2B',bg:'bg-primary/15',text:'text-primary',border:'border-primary/30',icon:'↑'},
  overstable:{label:'Overstable',color:'#C08A2E',bg:'bg-gap-medium/15',text:'text-gap-medium',border:'border-gap-medium/30',icon:'↙'},
};

const SPEED_TIERS = [
  { id: 'putters', label: 'Putters', min: 1, max: 3 },
  { id: 'mids', label: 'Mids', min: 4, max: 5 },
  { id: 'fairways', label: 'Fairways', min: 6, max: 8 },
  { id: 'drivers', label: 'Drivers', min: 9, max: 15 },
];

const BUY_SUGGESTIONS = {
  putter: [
    { mold:'Luna', manufacturer:'Discraft', plastic:'Z Line', speed:3, glide:3, turn:0, fade:3, price:'$14–18', color:'#6B8F71', desc:'Tour-favorite putter with reliable fade' },
    { mold:'Aviar', manufacturer:'Innova', plastic:'Star', speed:2, glide:3, turn:0, fade:1, price:'$12–16', color:'#ef4444', desc:'The original do-everything putter' },
  ],
  midrange: [
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#4C7A67', desc:'The gold standard of midranges' },
    { mold:'Hex', manufacturer:'MVP', plastic:'Neutron', speed:5, glide:5, turn:-1, fade:1, price:'$15–19', color:'#8b5cf6', desc:'Glidey straight-to-understable mid' },
  ],
  fairway_driver: [
    { mold:'Teebird', manufacturer:'Innova', plastic:'Star', speed:7, glide:5, turn:0, fade:2, price:'$15–19', color:'#eab308', desc:'Accurate fairway with dependable fade' },
    { mold:'Stalker', manufacturer:'Discraft', plastic:'Z', speed:7, glide:5, turn:-1, fade:2, price:'$14–18', color:'#14b8a6', desc:'Versatile straight-stable fairway' },
  ],
  distance_driver: [
    { mold:'Wraith', manufacturer:'Innova', plastic:'Star', speed:11, glide:5, turn:-1, fade:3, price:'$16–20', color:'#7c3aed', desc:'Versatile distance driver for all arms' },
    { mold:'Zeus', manufacturer:'Discraft', plastic:'ESP', speed:12, glide:5, turn:-1, fade:3, price:'$16–20', color:'#ef4444', desc:'Max distance with reliable fade' },
  ],
  understable: [
    { mold:'Roadrunner', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:-4, fade:1, price:'$15–19', color:'#f97316', desc:'Extreme turnover and roller disc' },
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Perfect beginner fairway' },
  ],
  stable: [
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#6B8F71', desc:'Dead straight, the most popular mid' },
    { mold:'Reactor', manufacturer:'MVP', plastic:'Neutron', speed:5, glide:5, turn:-0.5, fade:1.5, price:'$15–19', color:'#14b8a6', desc:'Straight flying complement to the Hex' },
  ],
  overstable: [
    { mold:'Firebird', manufacturer:'Innova', plastic:'Champion', speed:9, glide:3, turn:0, fade:4, price:'$14–18', color:'#ef4444', desc:'The ultimate utility disc' },
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Overstable approach that always fades' },
  ],
  // Speed gap fillers (by range)
  speed_4_5: [
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#4C7A67', desc:'Fills the midrange slot' },
    { mold:'Roc3', manufacturer:'Innova', plastic:'Champion', speed:5, glide:4, turn:0, fade:3, price:'$14–18', color:'#6b7280', desc:'Stable mid for the 4–5 range' },
  ],
  speed_6_8: [
    { mold:'Teebird', manufacturer:'Innova', plastic:'Star', speed:7, glide:5, turn:0, fade:2, price:'$15–19', color:'#eab308', desc:'Classic fairway for 6–8 gap' },
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Understable fairway option' },
  ],
  speed_9_11: [
    { mold:'Thunderbird', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:0, fade:2, price:'$15–19', color:'#f97316', desc:'Bridges fairway and distance' },
    { mold:'Wraith', manufacturer:'Innova', plastic:'Star', speed:11, glide:5, turn:-1, fade:3, price:'$16–20', color:'#7c3aed', desc:'Distance driver for 9–11 range' },
  ],
  // Stability slot per tier
  stability_putters_understable: [
    { mold:'Fierce', manufacturer:'Discraft', plastic:'ESP', speed:3, glide:4, turn:-1, fade:0, price:'$14–18', color:'#ec4899', desc:'Understable putter for turnover putts' },
    { mold:'Deputy', manufacturer:'Dynamic Discs', plastic:'Lucid', speed:3, glide:4, turn:-1, fade:0, price:'$12–16', color:'#6B8F71', desc:'Understable approach putter' },
  ],
  stability_putters_overstable: [
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Overstable approach and putter' },
    { mold:'Harp', manufacturer:'Westside', plastic:'VIP', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#8b5cf6', desc:'Overstable putter slot' },
  ],
  stability_mids_understable: [
    { mold:'Comet', manufacturer:'Discraft', plastic:'Z', speed:5, glide:5, turn:-2, fade:1, price:'$14–18', color:'#22c55e', desc:'Understable mid' },
    { mold:'Mako3', manufacturer:'Innova', plastic:'Star', speed:5, glide:5, turn:0, fade:0, price:'$14–18', color:'#4C7A67', desc:'Neutral to understable mid' },
  ],
  stability_mids_overstable: [
    { mold:'Roc3', manufacturer:'Innova', plastic:'Champion', speed:5, glide:4, turn:0, fade:3, price:'$14–18', color:'#6b7280', desc:'Overstable mid' },
    { mold:'Verdict', manufacturer:'Dynamic Discs', plastic:'Lucid', speed:5, glide:4, turn:0, fade:3, price:'$14–18', color:'#ef4444', desc:'Overstable midrange' },
  ],
  stability_fairways_understable: [
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Understable fairway' },
    { mold:'River', manufacturer:'Latitude 64', plastic:'Gold', speed:7, glide:7, turn:-1, fade:1, price:'$15–19', color:'#4C7A67', desc:'Glidey understable fairway' },
  ],
  stability_fairways_overstable: [
    { mold:'Firebird', manufacturer:'Innova', plastic:'Champion', speed:9, glide:3, turn:0, fade:4, price:'$14–18', color:'#ef4444', desc:'Overstable fairway utility' },
    { mold:'Teebird', manufacturer:'Innova', plastic:'Star', speed:7, glide:5, turn:0, fade:2, price:'$15–19', color:'#eab308', desc:'Stable to overstable fairway' },
  ],
  stability_drivers_understable: [
    { mold:'Roadrunner', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:-4, fade:1, price:'$15–19', color:'#f97316', desc:'Understable distance' },
    { mold:'Tern', manufacturer:'Innova', plastic:'Star', speed:11, glide:5, turn:-2, fade:2, price:'$16–20', color:'#14b8a6', desc:'Understable driver' },
  ],
  stability_drivers_overstable: [
    { mold:'Firebird', manufacturer:'Innova', plastic:'Champion', speed:9, glide:3, turn:0, fade:4, price:'$14–18', color:'#ef4444', desc:'Overstable utility driver' },
    { mold:'Destroyer', manufacturer:'Innova', plastic:'Star', speed:12, glide:5, turn:-1, fade:3, price:'$16–20', color:'#7c3aed', desc:'Overstable distance' },
  ],
  // Utility shots
  utility_overstable_approach: [
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Overstable approach (speed 2–4, fade 3+)' },
    { mold:'Harp', manufacturer:'Westside', plastic:'VIP', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#8b5cf6', desc:'Meat hook approach disc' },
    { mold:'A2', manufacturer:'Prodigy', plastic:'400', speed:4, glide:2, turn:0, fade:3, price:'$14–18', color:'#6b7280', desc:'Overstable approach' },
  ],
  utility_turnover: [
    { mold:'Roadrunner', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:-4, fade:1, price:'$15–19', color:'#f97316', desc:'Understable turnover (speed 6–9)' },
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Turnover fairway' },
    { mold:'Sidewinder', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:-3, fade:1, price:'$15–19', color:'#ec4899', desc:'Understable driver' },
  ],
  utility_neutral_mid: [
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#4C7A67', desc:'Straight flying neutral mid' },
    { mold:'Hex', manufacturer:'MVP', plastic:'Neutron', speed:5, glide:5, turn:-1, fade:1, price:'$15–19', color:'#8b5cf6', desc:'Dead straight mid' },
    { mold:'Mako3', manufacturer:'Innova', plastic:'Star', speed:5, glide:5, turn:0, fade:0, price:'$14–18', color:'#14b8a6', desc:'Neutral mid' },
  ],
  redundancy: [
    { mold:'Roadrunner', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:-4, fade:1, price:'$15–19', color:'#f97316', desc:'Add variety — understable option' },
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Add variety — overstable approach' },
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Consider swapping one for different shot shape' },
  ],
};

// ── Disc golf glossary (tooltips) ─────────────────────────────────
const GLOSSARY_DIR_NOTE = ' (Directions based on RHBH — reversed for RHFH.)';

const DISC_GLOSSARY = {
  understable: {
    title: 'Understable',
    body: `A disc that curves to the right during flight (for RHBH throws). Understable discs are great for beginners and useful for turnover shots.${GLOSSARY_DIR_NOTE}`,
  },
  overstable: {
    title: 'Overstable',
    body: `A disc that curves hard to the left at the end of flight (for RHBH throws). Overstable discs fight wind and finish with a reliable fade.${GLOSSARY_DIR_NOTE}`,
  },
  stable: {
    title: 'Stable',
    body: 'A disc that flies relatively straight with a predictable gentle fade at the end.',
  },
  anhyzer: {
    title: 'Anhyzer',
    body: `A throw angle where the disc is tilted away from your body. This encourages the disc to curve right (for RHBH) for sweeping turnover lines.${GLOSSARY_DIR_NOTE}`,
  },
  hyzer: {
    title: 'Hyzer',
    body: `A throw angle where the disc is tilted toward your body. This encourages the disc to curve left (for RHBH) and is the most natural release angle.${GLOSSARY_DIR_NOTE}`,
  },
  tailwind: {
    title: 'Tailwind',
    body: "Wind blowing in the same direction you're throwing. Tailwinds make discs act more understable (turn more).",
  },
  headwind: {
    title: 'Headwind',
    body: "Wind blowing toward you as you throw. Headwinds make discs act more overstable (fade harder and resist turning).",
  },
  fade: {
    title: 'Fade',
    body: `The natural end-of-flight hook to the left (for RHBH). A disc's fade number indicates how hard it hooks at the end. Higher fade = more hook.${GLOSSARY_DIR_NOTE}`,
  },
  turn: {
    title: 'Turn',
    body: `The tendency of a disc to curve right during the high-speed part of flight (for RHBH). Negative turn numbers mean more rightward movement.${GLOSSARY_DIR_NOTE}`,
  },
  glide: {
    title: 'Glide',
    body: 'How well a disc stays in the air. Higher glide means more distance and float.',
  },
  speed: {
    title: 'Speed',
    body: "How fast a disc needs to be thrown to achieve its intended flight. Higher speed discs require more arm speed but can go farther.",
  },
  turnover_shot: {
    title: 'Turnover shot',
    body: `A shot where the disc curves opposite to its natural fade — turning right for RHBH throwers. Used for shaping lines around obstacles.${GLOSSARY_DIR_NOTE}`,
  },
  hard_finishing_line: {
    title: 'Hard-finishing line',
    body: 'A shot that hooks hard at the end of its flight, usually using an overstable disc. Useful for dogleg holes and getting around corners.',
  },
  skip_shot: {
    title: 'Skip shot',
    body: 'A shot where the disc intentionally hits the ground at an angle and skips forward or sideways. Overstable discs on hyzer are best for skips.',
  },
  roller: {
    title: 'Roller',
    body: 'A throw where the disc is released nearly vertical so it lands on its edge and rolls along the ground. Used for extra distance or getting under low ceilings.',
  },
  s_curve: {
    title: 'S-curve',
    body: `A flight path where the disc first turns right then fades back left (for RHBH), making an S-shape. Common with slightly understable discs thrown with good speed.${GLOSSARY_DIR_NOTE}`,
  },
  flippy: {
    title: 'Flippy',
    body: 'Slang for very understable. A flippy disc turns over easily and is great for beginners or turnover shots.',
  },
  beef_beefy: {
    title: 'Beef / Beefy',
    body: `Slang for very overstable. A beefy disc resists turn and has a hard fade. Good for windy conditions and reliable left finishes.${GLOSSARY_DIR_NOTE}`,
  },
  parking: {
    title: 'Parking',
    body: 'Landing your disc right next to the basket — a great approach shot.',
  },
  gap: {
    title: 'Gap',
    body: 'In bag building, a gap is a missing flight shape or disc category in your bag that limits the shots you can throw on the course.',
  },
};

const GLOSSARY_MATCHERS_ORDERED = [
  { id: 'turnover_shot', re: /^turnover\s+shot\b/i },
  { id: 'turnover_shot', re: /^turnover\b/i },
  { id: 'hard_finishing_line', re: /^hard[- ]finishing\s+line\b/i },
  { id: 'skip_shot', re: /^skip\s+shot\b/i },
  { id: 'understable', re: /^understable\b/i },
  { id: 'overstable', re: /^overstable\b/i },
  { id: 'turnover', re: /^turnover\b/i },
  { id: 'anhyzer', re: /^anhyzer\b/i },
  { id: 'hyzer', re: /^hyzer\b/i },
  { id: 'tailwind', re: /^tailwind\b/i },
  { id: 'headwind', re: /^headwind\b/i },
  { id: 's_curve', re: /^s[- ]?curve\b/i },
  { id: 'flippy', re: /^flippy\b/i },
  { id: 'beefy', re: /^beefy\b/i },
  { id: 'roller', re: /^roller\b/i },
  { id: 'parking', re: /^parking\b/i },
  { id: 'stable', re: /^stable\b/i },
  { id: 'glide', re: /^glide\b/i },
  { id: 'speed', re: /^speed\b/i },
  { id: 'fade', re: /^fade\b/i },
  { id: 'turn', re: /^turn\b/i },
  { id: 'beef_beefy', re: /^beef\b/i },
  { id: 'gap', re: /^gap\b/i },
];

function parseGlossaryTextToNodes(text, openTerm) {
  const parts = [];
  let i = 0;
  let k = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    let matched = null;
    for (const m of GLOSSARY_MATCHERS_ORDERED) {
      const hit = rest.match(m.re);
      if (hit && hit.index === 0) {
        matched = { id: m.id, len: hit[0].length };
        break;
      }
    }
    if (matched) {
      const display = text.slice(i, i + matched.len);
      parts.push(
        <button
          key={`g-${k++}`}
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openTerm(matched.id);
          }}
          className="text-primary underline decoration-dotted decoration-primary underline-offset-[3px] cursor-pointer bg-transparent p-0 border-0 font-inherit text-left inline align-baseline"
          aria-label={`Glossary: ${DISC_GLOSSARY[matched.id]?.title || display}`}
        >
          {display}
        </button>
      );
      i += matched.len;
    } else {
      let j = i;
      while (j < text.length) {
        const sub = text.slice(j);
        let hit = false;
        for (const m of GLOSSARY_MATCHERS_ORDERED) {
          const h = sub.match(m.re);
          if (h && h.index === 0) {
            hit = true;
            break;
          }
        }
        if (hit) break;
        j += 1;
      }
      if (j > i) {
        parts.push(text.slice(i, j));
      }
      i = j;
    }
  }
  return parts;
}

const GlossaryContext = React.createContext(null);

function GlossaryProvider({ children }) {
  const [activeId, setActiveId] = useState(null);
  const openTerm = useCallback((id) => {
    if (DISC_GLOSSARY[id]) setActiveId(id);
  }, []);
  const closeTerm = useCallback(() => setActiveId(null), []);
  const value = useMemo(() => ({ openTerm, closeTerm, activeId }), [activeId, openTerm, closeTerm]);
  return (
    <GlossaryContext.Provider value={value}>
      {children}
      <GlossaryTermBottomSheet activeId={activeId} onClose={closeTerm} />
    </GlossaryContext.Provider>
  );
}

function GlossaryBody({ children, className = '', as: Comp = 'span' }) {
  const ctx = useContext(GlossaryContext);
  const text = typeof children === 'string' ? children : '';
  const nodes = useMemo(() => {
    if (!ctx?.openTerm || !text) return null;
    return parseGlossaryTextToNodes(text, ctx.openTerm);
  }, [text, ctx]);
  if (!ctx || nodes == null) return <Comp className={className}>{children}</Comp>;
  return <Comp className={className}>{nodes}</Comp>;
}

function GlossaryTermBottomSheet({ activeId, onClose }) {
  useEffect(() => {
    if (!activeId) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeId, onClose]);
  const entry = activeId ? DISC_GLOSSARY[activeId] : null;
  return (
    <AnimatePresence>
      {activeId && entry ? (
        <motion.button
          key="glossary-backdrop"
          type="button"
          aria-label="Close glossary"
          className="fixed inset-0 z-[200] border-0 p-0 cursor-default bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          onClick={onClose}
        />
      ) : null}
      {activeId && entry ? (
        <motion.div
          key="glossary-sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="glossary-term-title"
          className="fixed left-0 right-0 bottom-0 z-[201] flex justify-center pointer-events-none"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        >
          <motion.div
            className="pointer-events-auto w-full max-w-lg mx-auto bg-card border border-border rounded-t-2xl shadow-card-lg flex flex-col max-h-[40vh] overflow-hidden"
            drag="y"
            dragConstraints={{ top: 0, bottom: 320 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            dragMomentum={false}
            onDragEnd={(_, info) => {
              if (info.offset.y > 72 || info.velocity.y > 500) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-3 shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-10 h-1 rounded-full bg-black/15 dark:bg-white/20" aria-hidden />
            </div>
            <div className="px-5 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] flex flex-col gap-3 min-h-0">
              <h2 id="glossary-term-title" className="text-[18px] font-bold text-text leading-tight shrink-0">
                {entry.title}
              </h2>
              <p className="text-[15px] font-normal text-text-muted leading-relaxed overflow-y-auto overscroll-contain touch-pan-y max-h-[calc(40vh-7rem)]">
                {entry.body}
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

// ── Helpers (function declarations so they are hoisted and safe with minification) ───
function wc(l) { return l>=8?'bg-gap-low':l>=6?'bg-primary':l>=4?'bg-gap-medium':l>=2?'bg-gap-medium':'bg-gap-high'; }
function ww(l) { return l>=9?'Mint':l>=7?'Good':l>=5?'Used':l>=3?'Fair':'Poor'; }
function td() { return new Date().toISOString().split('T')[0]; }
function fmtD(d) {
  if (!d) return '—';
  try {
    const s = String(d).trim();
    const parsed = s.includes('T') ? new Date(s) : new Date(s + 'T00:00:00');
    if (isNaN(parsed.getTime())) return s || '—';
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '—';
  }
}
function luma(hex) { const c=(hex||'#888').replace('#',''); return (parseInt(c.substr(0,2),16)*299+parseInt(c.substr(2,2),16)*587+parseInt(c.substr(4,2),16)*114)/1000; }
function classifyStability(d) {
  const t = parseFlightNum(d.turn);
  const f = parseFlightNum(d.fade);
  const net = t + f;
  if (t <= -2 || net <= 0) return 'understable';
  if (f >= 3 || net >= 3) return 'overstable';
  return 'stable';
}

function getSkillSpeedRange(skillLevelRaw) {
  const s = normalizeSkillLevel(skillLevelRaw) ?? 'intermediate';
  if (s === 'beginner') return { min: 1, max: 9 };
  if (s === 'advanced') return { min: 1, max: 14 };
  return { min: 1, max: 10 };
}
function isDiscInSkillRange(d, range) {
  const sp = Number(d.speed);
  if (!Number.isFinite(sp)) return false;
  return sp >= range.min && sp <= range.max;
}
function discTypeFromSpeed(speed) {
  const s = Number(speed);
  if (s <= 3) return 'putter';
  if (s <= 5) return 'midrange';
  if (s <= 8) return 'fairway_driver';
  return 'distance_driver';
}
function skillLevelDisplayLabel(sl) {
  const s = normalizeSkillLevel(sl) ?? 'intermediate';
  if (s === 'beginner') return 'Beginner';
  if (s === 'advanced') return 'Advanced';
  return 'Intermediate';
}
function findLibraryReplacementsForFlag(flagDisc, allDiscs, bagDiscIds, range) {
  const stab = classifyStability(flagDisc);
  const wantType = flagDisc.disc_type;
  const targetSpeed = Math.min(Number(flagDisc.speed) || 0, range.max);
  const pool = allDiscs.filter((d) => {
    if (!d || bagDiscIds.includes(d.id) || d.id === flagDisc.id) return false;
    if (!isDiscInSkillRange(d, range)) return false;
    if (classifyStability(d) !== stab) return false;
    return true;
  });
  const exact = pool.filter((d) => d.disc_type === wantType);
  const list = exact.length ? exact : pool;
  return [...list].sort((a, b) => Math.abs((Number(a.speed) || 0) - targetSpeed) - Math.abs((Number(b.speed) || 0) - targetSpeed)).slice(0, 4);
}
function findMoldReplacementSuggestions(flagDisc, range) {
  const stab = classifyStability(flagDisc);
  const wantType = flagDisc.disc_type;
  const targetSpeed = Math.min(Number(flagDisc.speed) || 0, range.max);
  let rows = MOLD_LOOKUP.filter((m) => {
    if (!isDiscInSkillRange(m, range)) return false;
    if (classifyStability(m) !== stab) return false;
    return discTypeFromSpeed(m.speed) === wantType;
  });
  if (rows.length === 0) {
    rows = MOLD_LOOKUP.filter((m) => isDiscInSkillRange(m, range) && classifyStability(m) === stab);
  }
  return [...rows]
    .sort((a, b) => Math.abs((Number(a.speed) || 0) - targetSpeed) - Math.abs((Number(b.speed) || 0) - targetSpeed))
    .slice(0, 4)
    .map((m) => ({
      manufacturer: m.manufacturer,
      mold: m.mold,
      plastic: 'Premium',
      plastic_type: '',
      color: '#6b7280',
      speed: m.speed,
      glide: m.glide,
      turn: m.turn,
      fade: m.fade,
      price: '—',
    }));
}
function explainDiscOutsideSkillRange(d, range, sl) {
  const sp = Number(d.speed);
  const label = skillLevelDisplayLabel(sl);
  if (sp > range.max) return `Speed ${sp} — recommended max for ${label}s is ${range.max}.`;
  if (sp < range.min) return `Speed ${sp} — recommended min for ${label}s is ${range.min}.`;
  return 'Outside the recommended speed range for your skill level.';
}

function fmtSuggestionFlightNumSegment(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  const x = Number(n);
  return Number.isInteger(x) ? String(x) : String(x);
}
function fmtSuggestionFlightLine(s) {
  if (!s) return '—';
  return [s.speed, s.glide, s.turn, s.fade].map(fmtSuggestionFlightNumSegment).join('/');
}
/** Full flight numbers for any disc-like object (gap finder, library rows). */
function fmtDiscFlightLine(d) {
  if (!d) return '—';
  return [d.speed, d.glide, d.turn, d.fade].map(fmtSuggestionFlightNumSegment).join('/');
}
function getAceRarity(distance) {
  if(distance>=350) return { label:'LEGENDARY', badge:'ACE', border:'linear-gradient(135deg,#1F3D2B,#6B8F71,#C08A2E,#1F3D2B)', glow:'rgba(31,61,43,0.3)', text:'text-primary', bg:'bg-primary/10' };
  if(distance>=300) return { label:'EPIC', badge:'ACE', border:'linear-gradient(135deg,#C08A2E,#e8c97a,#C08A2E,#C08A2E)', glow:'rgba(192,138,46,0.3)', text:'text-gap-medium', bg:'bg-gap-medium/10' };
  if(distance>=200) return { label:'RARE', badge:'ACE', border:'linear-gradient(135deg,#6B8F71,#9ab59e,#6B8F71,#6B8F71)', glow:'rgba(107,143,113,0.25)', text:'text-secondary', bg:'bg-secondary/10' };
  return { label:'ACE', badge:'ACE', border:'linear-gradient(135deg,#C08A2E,#e8c97a,#E6E7E3,#C08A2E)', glow:'rgba(192,138,46,0.2)', text:'text-gap-medium', bg:'bg-gap-medium/10' };
}
// Theme borders for achievement cards (primary/silver, fiery, emerald)
const THEME_TOURNAMENT = { border:'linear-gradient(135deg,#1F3D2B,#C0C0C0,#6B8F71,#1F3D2B)', primary:'#1F3D2B', silver:'#C0C0C0', dark:'#1F3D2B' };
const THEME_LONGEST = { border:'linear-gradient(135deg,#FF4500,#FF6347,#DC143C,#FF4500)', primary:'#FF4500', mid:'#FF6347', dark:'#DC143C' };
const THEME_PB = { border:'linear-gradient(135deg,#50C878,#2E8B57,#00FF7F,#50C878)', primary:'#50C878', mid:'#2E8B57', light:'#00FF7F' };

function getTournamentRarity(placement) {
  const p = typeof placement === 'number' ? placement : parseInt(String(placement), 10);
  if (p === 1) {
    return {
      label:'1ST PLACE',
      border: THEME_TOURNAMENT.border,
      text:'text-text',
      bg:'bg-secondary/20',
      medalColor:'#FFD700',
      medalEmoji:'🥇',
    };
  }
  if (p === 2) {
    return {
      label:'2ND PLACE',
      border: THEME_TOURNAMENT.border,
      text:'text-text',
      bg:'bg-secondary/20',
      medalColor:'#C0C0C0',
      medalEmoji:'🥈',
    };
  }
  if (p === 3) {
    return {
      label:'3RD PLACE',
      border: THEME_TOURNAMENT.border,
      text:'text-text',
      bg:'bg-secondary/20',
      medalColor:'#CD7F32',
      medalEmoji:'🥉',
    };
  }
  return {
    label:'TOURNAMENT',
    border: THEME_TOURNAMENT.border,
    text:'text-text-muted',
    bg:'bg-secondary/15',
    medalColor: THEME_TOURNAMENT.silver,
    medalEmoji:'🎗️',
  };
}
function getLongestThrowRarity(distanceFeet) {
  if ((distanceFeet || 0) >= 400) return { label:'CANNON', border: THEME_LONGEST.border, text:'text-gap-medium', bg:'bg-gap-medium/10' };
  if ((distanceFeet || 0) >= 300) return { label:'BOMBER', border: THEME_LONGEST.border, text:'text-gap-high', bg:'bg-gap-high/10' };
  return { label:'LONG', border: THEME_LONGEST.border, text:'text-gap-low', bg:'bg-gap-low/20' };
}
function getPBRarity() {
  return { label:'PB', border: THEME_PB.border, text:'text-primary', bg:'bg-primary/10' };
}

const APP_URL = 'Disc Golf Companion';
const GUEST_MODE_KEY = 'discgolf_guest_mode';
const AUTH_KEY = 'discgolf_auth';
const EMAIL_ACCOUNTS_KEY = 'discgolf_email_accounts';
const USER_PROFILE_PIC_KEY = 'discgolf_user_profile_pic';
const PROFILE_PIC_MAX_SIZE = 200;
const LS_KEY = 'discgolf_app_v2';
const MIN_PASSWORD_LENGTH = 6;

const SKILL_LEVEL_OPTIONS = [
  { value: 'beginner', label: 'Beginner', description: 'New to disc golf or still learning form. Typical arm speed under 45 mph.' },
  { value: 'intermediate', label: 'Intermediate', description: 'Comfortable with the game and developing consistency. Typical arm speed 45-60 mph.' },
  { value: 'advanced', label: 'Advanced', description: 'Experienced player with strong arm speed and shot shaping. Typical arm speed 60+ mph.' },
];

function SkillLevelPicker({ value, onChange }) {
  return (
    <div className="space-y-2" role="radiogroup" aria-label="Skill level">
      {SKILL_LEVEL_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${
              selected ? 'border-primary bg-primary/10 ring-1 ring-primary/25' : 'border-border bg-card hover:border-border hover:bg-surface/80'
            }`}
          >
            <div className={`text-sm font-semibold ${selected ? 'text-primary' : 'text-text'}`}>{opt.label}</div>
            <p className="text-[11px] text-text-muted mt-0.5 leading-snug">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}

const THROW_STYLE_OPTIONS = [
  { value: 'rhbh', label: 'Right Hand Backhand (RHBH)', description: 'Most common — backhand with your right hand.', suggested: true },
  { value: 'rhfh', label: 'Right Hand Forehand (RHFH)', description: 'Forehand (sidearm) with your right hand.', suggested: false },
  { value: 'lhbh', label: 'Left Hand Backhand (LHBH)', description: 'Backhand with your left hand.', suggested: false },
  { value: 'lhfh', label: 'Left Hand Forehand (LHFH)', description: 'Forehand (sidearm) with your left hand.', suggested: false },
];

function ThrowStylePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="Primary throwing style">
      {THROW_STYLE_OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(opt.value)}
            className={`text-left rounded-xl border px-3 py-3 transition-all min-h-[4.5rem] flex flex-col justify-center ${
              selected ? 'border-primary bg-primary/10 ring-1 ring-primary/25 shadow-sm' : 'border-border bg-card hover:border-primary/30 hover:bg-surface/80'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <span className={`text-sm font-semibold leading-tight ${selected ? 'text-primary' : 'text-text'}`}>{opt.label}</span>
              {opt.suggested && (
                <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${selected ? 'bg-primary/20 text-primary' : 'bg-surface text-text-muted'}`}>Suggested</span>
              )}
            </div>
            <p className="text-[10px] text-text-muted mt-1.5 leading-snug">{opt.description}</p>
          </button>
        );
      })}
    </div>
  );
}

function SkillLevelRequiredModal({ open, onComplete }) {
  const [value, setValue] = useState(null);
  useEffect(() => { if (open) setValue(null); }, [open]);
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg/95 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-card-lg p-5"
      >
        <h2 className="text-base font-bold text-text mb-1">What&apos;s your skill level?</h2>
        <p className="text-xs text-text-muted mb-4">Choose one so we can tailor your experience.</p>
        <SkillLevelPicker value={value} onChange={setValue} />
        <button
          type="button"
          disabled={!value}
          onClick={() => value && onComplete(value)}
          className="mt-4 w-full py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm disabled:opacity-45 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </motion.div>
    </motion.div>
  );
}
const EMPTY_DISC = {manufacturer:'',mold:'',plastic_type:'',custom_name:'',speed:7,glide:5,turn:-1,fade:1,weight_grams:175,disc_type:'midrange',wear_level:10,status:'backup',flight_preference:'both',color:'#22c55e',photo:null,date_acquired:'',story:'',estimated_value:18,hasAce:false,aceDate:'',aceLocation:'',aceHole:'',lostNote:'',gaveAwayNote:'',bagIds:[],bagId:null};
const PWA_INSTALL_DISMISSED_KEY = 'discgolf-pwa-install-dismissed';
const VIEW_MODE_KEY = 'discgolf_view_mode';
const THEME_KEY = 'discgolf_theme';
const PWA_DISMISS_DAYS = 7;
const PWA_SHOW_DELAY_MS = 30_000;

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.discs) {
        console.log('[loadState] loaded discs from localStorage:', parsed.discs.length, 'example disc:', parsed.discs[0], 'hasPhoto:', !!parsed.discs[0]?.photo);
      }
      return parsed;
    }
  } catch(e) { console.warn('Failed to load state', e); }
  return null;
}
function saveState(data) {
  try {
    console.log('[saveState] saving discs to localStorage...', {
      count: data?.discs?.length ?? 0,
      example: data?.discs?.[0],
      hasPhoto: !!data?.discs?.[0]?.photo,
      photoBytes: typeof data?.discs?.[0]?.photo === 'string' ? data.discs[0].photo.length : 0,
    });
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    console.log('[saveState] localStorage save SUCCESS');
  } catch(e) { console.warn('Failed to save', e); }
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch(_) {}
  return null;
}

function saveAuth(auth) {
  try {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
    else localStorage.removeItem(AUTH_KEY);
  } catch(_) {}
}

function loadEmailAccounts() {
  try {
    const raw = localStorage.getItem(EMAIL_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch(_) {}
  return {};
}

function saveEmailAccounts(accounts) {
  try { localStorage.setItem(EMAIL_ACCOUNTS_KEY, JSON.stringify(accounts)); } catch(_) {}
}

function loadProfilePic() {
  try { return localStorage.getItem(USER_PROFILE_PIC_KEY); } catch(_) { return null; }
}
function saveProfilePic(dataUrl) {
  try { if (dataUrl) localStorage.setItem(USER_PROFILE_PIC_KEY, dataUrl); else localStorage.removeItem(USER_PROFILE_PIC_KEY); } catch(_) {}
}

function resizeImageToDataUrl(file, maxSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      let tw = w, th = h;
      if (w > maxSize || h > maxSize) {
        if (w >= h) { tw = maxSize; th = Math.round((h * maxSize) / w); }
        else { th = maxSize; tw = Math.round((w * maxSize) / h); }
      }
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0, tw, th);
      try { resolve(canvas.toDataURL('image/jpeg', 0.85)); } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

const MAX_UPLOAD_WIDTH = 400;
const UPLOAD_JPEG_QUALITY = 0.3;
const UPLOAD_TARGET_MAX_BYTES = 200 * 1024;

function compressImageFileToBlob(file, maxWidth = MAX_UPLOAD_WIDTH, quality = UPLOAD_JPEG_QUALITY) {
  return new Promise((resolve, reject) => {
    console.log('[ImageCompress] Photo selected', { name: file.name, size: file.size, type: file.type });
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) { reject(new Error('Invalid image dimensions')); return; }
      const scale = w > maxWidth ? maxWidth / w : 1;
      const tw = Math.round(w * scale);
      const th = Math.round(h * scale);
      console.log('[ImageCompress] Compressing photo...', { originalWidth: w, originalHeight: h, targetWidth: tw, targetHeight: th });
      const canvas = document.createElement('canvas');
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('No canvas context')); return; }
      ctx.drawImage(img, 0, 0, tw, th);
      const tryEncode = (q, allowSecondPass) => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Image encode failed')); return; }
          console.log('[ImageCompress] Compression attempt done', { quality: q, size: blob.size });
          if (blob.size > UPLOAD_TARGET_MAX_BYTES && allowSecondPass) {
            // One extra pass at a lower quality if still too large
            tryEncode(Math.max(0.35, q - 0.15), false);
          } else {
            resolve(blob);
          }
        }, 'image/jpeg', q);
      };
      tryEncode(quality, true);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressImageFileToDataUrl(file, maxWidth = MAX_UPLOAD_WIDTH, quality = UPLOAD_JPEG_QUALITY) {
  const blob = await compressImageFileToBlob(file, maxWidth, quality);
  if (!blob) throw new Error('Failed to compress image');
  return blobToDataUrl(blob);
}

function getInitials(displayName) {
  if (!displayName || typeof displayName !== 'string') return '?';
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2);
  return (parts[0] || '?').slice(0, 2).toUpperCase();
}

function getInitialsColor(displayName) {
  let h = 0;
  const s = displayName || '';
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue}, 45%, 35%)`;
}

function decodeGoogleJwt(credential) {
  try {
    const payload = credential.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return {
      email: decoded.email || '',
      displayName: decoded.name || decoded.email || 'Google User',
      picture: decoded.picture || decoded.photoURL || null,
    };
  } catch (_) { return null; }
}

// ═══════════════════════════════════════════════════════
// SMALL REUSABLE COMPONENTS
// ═══════════════════════════════════════════════════════

function Confetti() {
  const p = useMemo(() => Array.from({length:45},(_,i) => ({
    i, x:(Math.random()-.5)*500, y:Math.random()*-550-50,
    r:Math.random()*700-350,
    c:['#f59e0b','#ef4444','#10b981','#3b82f6','#8b5cf6','#ec4899','#fbbf24','#34d399'][i%8],
    w:Math.random()*10+4, h:Math.random()*6+3, d:Math.random()*0.3
  })), []);
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {p.map(v => (
        <motion.div key={v.i} className="absolute left-1/2 top-1/3"
          initial={{x:0,y:0,opacity:1,scale:0,rotate:0}}
          animate={{x:v.x,y:v.y+500,opacity:[1,1,0],rotate:v.r,scale:[0,1.2,0.7]}}
          transition={{duration:2.2,delay:v.d,ease:[.25,.46,.45,.94]}}
          style={{width:v.w,height:v.h,backgroundColor:v.c,borderRadius:2}}
        />
      ))}
    </div>
  );
}

function Toast({message,onDone}) {
  useEffect(() => { const t = setTimeout(onDone,3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border px-5 py-3 rounded-xl shadow-card-lg max-w-sm text-center" style={{zIndex:60}}>
      <span className="text-sm text-text">{message}</span>
    </motion.div>
  );
}

function Stepper({value,onChange,min,max,step=1,label}) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const hasValue = typeof value === 'number' && Number.isFinite(value);
  const safeVal = hasValue ? value : null;
  useEffect(() => {
    setInputVal(hasValue ? String(value) : '');
  }, [value, hasValue]);
  const clamp = (v) => Math.max(min, Math.min(max, +(Number(v).toFixed(1))));
  const inc = () => {
    setEditing(false);
    const base = safeVal !== null ? safeVal : min;
    onChange(clamp(+(base + step).toFixed(1)));
  };
  const dec = () => {
    setEditing(false);
    const base = safeVal !== null ? safeVal : min;
    onChange(clamp(+(base - step).toFixed(1)));
  };
  const commit = (v) => {
    setEditing(false);
    const raw = String(v).trim();
    if (raw === '' || raw === '-' || raw === '.') {
      onChange(null);
      return;
    }
    const n = parseFloat(raw);
    if (!isNaN(n)) onChange(clamp(n));
  };
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); inc(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); dec(); }
    else if (e.key === 'Enter') { e.preventDefault(); commit(e.target.value); }
  };
  const handleChange = (e) => {
    const v = e.target.value;
    setInputVal(v);
    if (v !== '' && v !== '-' && v !== '.') {
      const n = parseFloat(v);
      if (!isNaN(n)) onChange(clamp(n));
    }
  };
  const handleFocus = () => { setEditing(true); setInputVal(hasValue ? String(value) : ''); };
  const handleBlur = () => commit(inputVal);
  const displayVal = editing ? inputVal : (hasValue ? value : '');
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1 font-medium">{label}</label>
      <div className="flex items-center bg-surface rounded-lg border border-border hover:border-border active:border-primary/50 transition-colors">
        <button type="button" onClick={dec} className="px-2 py-2.5 sm:px-2 sm:py-2 text-text-muted hover:text-text active:text-primary transition rounded-l-lg touch-manipulation min-h-[44px] flex items-center justify-center shrink-0" aria-label={`Decrease ${label}`}><Minus size={14} /></button>
        <input
          type="text"
          inputMode="decimal"
          value={displayVal}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="—"
          title="Tap to type or use +/−"
          className="flex-1 min-w-[2.5rem] bg-surface/40 text-center text-text font-semibold text-base sm:text-sm py-2.5 sm:py-2 cursor-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-surface/60 rounded min-h-[44px] touch-manipulation tabular-nums"
        />
        <button type="button" onClick={inc} className="px-2 py-2.5 sm:px-2 sm:py-2 text-text-muted hover:text-text active:text-primary transition rounded-r-lg touch-manipulation min-h-[44px] flex items-center justify-center shrink-0" aria-label={`Increase ${label}`}><Plus size={14} /></button>
      </div>
    </div>
  );
}

function FilterDropdown({value,options,onChange,label}) {
  const [open,setOpen] = useState(false);
  const selected = options.find(o => o.value===value) || options[0];
  const isActive = value!=='All' && value!=='Recent';
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(p=>!p)}
        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive?'bg-accent text-primary border-primary/20':'bg-card text-text-muted border-border hover:border-border'}`}>
        {label&&<span className="text-text-muted mr-0.5">{label}:</span>}{selected.label}
        <ChevronDown size={12} className={`transition-transform duration-200 ${open?'rotate-180':''}`}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{zIndex:45}} onClick={() => setOpen(false)}/>
          <div className="absolute top-full left-0 mt-1.5 bg-card border border-border rounded-xl overflow-hidden shadow-card" style={{zIndex:46,minWidth:'12rem',maxHeight:'16rem',overflowY:'auto'}}>
            {options.map(o => (
              <button key={o.value} onClick={() => {onChange(o.value);setOpen(false);}}
                className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 ${o.value===value?'bg-accent text-primary':'text-text-muted hover:bg-surface/60'}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${o.value===value?'bg-primary border-primary':'border-border'}`}>
                  {o.value===value && <Check size={10} className="text-text"/>}
                </span>
                <span className="flex-1">{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC VISUAL (defined before ConfirmDialog which uses it)
// ═══════════════════════════════════════════════════════

/** Fits disc name on one line (no wrap, no ellipsis): shrinks font from maxPx until it fits, down to hardMinPx. */
function FittedDiscText({ text, maxPx, hardMinPx = 6, className = '', style }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;
    const apply = () => {
      const cw = wrap.clientWidth;
      if (cw <= 0) return;
      const str = text != null ? String(text) : '';
      el.style.whiteSpace = 'nowrap';
      el.style.wordBreak = 'normal';
      el.style.overflow = 'visible';
      el.style.textOverflow = 'clip';
      if (!str) return;
      let chosen = hardMinPx;
      for (let fs = maxPx; fs >= hardMinPx; fs -= 0.5) {
        el.style.fontSize = `${fs}px`;
        if (el.scrollWidth <= cw) {
          chosen = fs;
          break;
        }
      }
      el.style.fontSize = `${chosen}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, maxPx, hardMinPx]);
  return (
    <div ref={wrapRef} className="w-full min-w-0 overflow-visible">
      <span ref={textRef} className={`block whitespace-nowrap ${className}`} style={{ ...style, fontSize: maxPx }}>{text}</span>
    </div>
  );
}

/** One line inside the disc circle (manufacturer or mold): shrink to fit, no wrap, no ellipsis. */
function FittedCircleLine({ text, maxPx, hardMinPx = 4, className = '', style }) {
  const wrapRef = useRef(null);
  const textRef = useRef(null);
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const el = textRef.current;
    if (!wrap || !el) return;
    const apply = () => {
      const cw = wrap.clientWidth;
      if (cw <= 0) return;
      const str = text != null ? String(text) : '';
      el.style.whiteSpace = 'nowrap';
      el.style.wordBreak = 'normal';
      el.style.overflow = 'visible';
      el.style.textOverflow = 'clip';
      if (!str) return;
      let chosen = hardMinPx;
      for (let fs = maxPx; fs >= hardMinPx; fs -= 0.5) {
        el.style.fontSize = `${fs}px`;
        if (el.scrollWidth <= cw) {
          chosen = fs;
          break;
        }
      }
      el.style.fontSize = `${chosen}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [text, maxPx, hardMinPx]);
  return (
    <div ref={wrapRef} className="w-full min-w-0 px-0.5 flex justify-center overflow-visible">
      <span ref={textRef} className={`text-center leading-tight block whitespace-nowrap ${className}`} style={{ ...style, fontSize: maxPx }}>{text}</span>
    </div>
  );
}

function DiscVisual({disc,size='md'}) {
  const sz = {sm:'w-14 h-14',md:'w-20 h-20',lg:'w-28 h-28',xl:'w-36 h-36'}[size]||'w-20 h-20';
  const dark = luma(disc.color||'#888')>160;
  const tc = dark?'rgba(0,0,0,0.8)':'rgba(255,255,255,0.9)';
  const sc2 = dark?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.55)';
  const mfs = {sm:8,md:9,lg:10,xl:11}[size]||9;
  const dfs = {sm:11,md:14,lg:17,xl:22}[size]||14;
  const mfsMin = {sm:5,md:5,lg:6,xl:6}[size]||5;
  const dfsMin = {sm:5,md:6,lg:7,xl:8}[size]||6;
  return (
  <div className={`relative rounded-full overflow-hidden ${sz} shrink-0 shadow-lg`}
      style={disc.wear_level<=4?{filter:`saturate(${0.55+disc.wear_level*0.1})`}:undefined}>
      {disc.photo ? (
        <img src={disc.photo} className="w-full h-full object-cover" alt={disc.mold}/>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1 min-h-0 gap-px"
          style={{backgroundColor:disc.color||'#6b7280',boxShadow:'inset 0 2px 8px rgba(255,255,255,0.15), inset 0 -2px 8px rgba(0,0,0,0.2)'}}>
          <FittedCircleLine text={disc.manufacturer} maxPx={mfs} hardMinPx={mfsMin} className="font-semibold" style={{ color: sc2 }} />
          <FittedCircleLine text={disc.mold} maxPx={dfs} hardMinPx={dfsMin} className="font-extrabold" style={{ color: tc }} />
        </div>
      )}
    </div>
  );
}

function LostDiscDialog({ onRemoveFromBags, onKeepInBags, onDismiss }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 80 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onDismiss} role="presentation"/>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden shadow-card-lg">
        <div className="p-6">
          <h3 className="text-base font-bold text-text">Disc Lost</h3>
          <p className="text-sm text-text-muted mt-1.5 leading-relaxed">Would you like to remove this disc from your existing bags?</p>
        </div>
        <div className="px-6 pb-6 flex flex-col gap-2">
          <button type="button" onClick={onRemoveFromBags} className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold text-sm hover:opacity-95 transition-opacity">Yes, remove from bags</button>
          <button type="button" onClick={onKeepInBags} className="w-full py-3 rounded-xl bg-surface text-text font-semibold text-sm border border-border hover:bg-surface/80 transition-colors">No, keep in bags</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function GaveAwayNoteModal({ open, draft, onDraft, onCancel, onSave }) {
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 85 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} role="presentation" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden shadow-card-lg p-6"
      >
        <h3 className="text-base font-bold text-text">Gave Away / Sold</h3>
        <p className="text-xs text-text-muted mt-1 mb-3">Details (optional)</p>
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          rows={4}
          placeholder="Who did you give it to or sell it to? When? How much?"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary resize-y min-h-[5rem]"
        />
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold border border-border">
            Cancel
          </button>
          <button type="button" onClick={onSave} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold">
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LostNoteQuickModal({ open, draft, onDraft, onCancel, onSave }) {
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 85 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} role="presentation" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden shadow-card-lg p-6"
      >
        <h3 className="text-base font-bold text-text">Lost disc note</h3>
        <p className="text-xs text-text-muted mt-1 mb-3">Add details now or edit the disc later.</p>
        <textarea
          value={draft}
          onChange={(e) => onDraft(e.target.value)}
          rows={4}
          placeholder="Where and when did you lose it?"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary resize-y min-h-[5rem]"
        />
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onCancel} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold border border-border">
            Skip
          </button>
          <button type="button" onClick={onSave} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold">
            Save
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConfirmDialog({open,title,message,onConfirm,onCancel,danger,confirmLabel,discInfo}) {
  if (!open) return null;
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 flex items-center justify-center p-4" style={{zIndex:70}}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden shadow-card-lg">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${danger?'bg-gap-high/15':'bg-gap-medium/15'}`}>
              {danger ? <Trash2 size={22} className="text-gap-high"/> : <AlertTriangle size={22} className="text-gap-medium"/>}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-text">{title}</h3>
              <p className="text-sm text-text-muted mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>
          {discInfo && (
            <div className="mt-4 flex items-center gap-3 bg-surface/80 border border-border/50 rounded-xl px-4 py-3">
              <DiscVisual disc={discInfo} size="sm"/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-text truncate">{discInfo.custom_name||discInfo.mold}</div>
                <div className="text-xs text-text-muted">{discInfo.manufacturer} · {discInfo.plastic_type}</div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-surface text-text-muted font-semibold text-sm hover:bg-surface transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${danger?'bg-gap-high hover:bg-gap-high text-on-primary':'bg-gap-medium hover:bg-gap-medium text-on-primary'}`}>
            {danger&&<Trash2 size={14}/>}{confirmLabel||(danger?'Delete':'Confirm')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PrivacyPolicyModal({open,onClose}) {
  if (!open) return null;
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 flex items-center justify-center p-4" style={{zIndex:75}}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={{scale:0.95,opacity:0,y:10}}
        animate={{scale:1,opacity:1,y:0}}
        exit={{scale:0.97,opacity:0,y:10}}
        className="relative w-full max-w-lg bg-card rounded-2xl border border-border shadow-card-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 mb-4">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-primary"/>
            <h2 className="text-sm font-semibold text-text">Privacy Policy</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-surface text-text-muted">
            <X size={16}/>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 text-xs text-text-muted max-h-[60vh] overflow-y-auto">
          <p className="text-text-muted text-xs">
            Last updated: March 2026. This policy explains how Disc Golf Companion collects, uses, and protects your data.
          </p>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Account &amp; Authentication</h3>
            <p className="leading-relaxed text-text-muted">
              When you create an account we collect your email address and an encrypted password (or OAuth token if you sign in with Google/Apple). This is used solely for authentication and account recovery. We do not sell or share your email with marketers.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Data We Store</h3>
            <p className="leading-relaxed text-text-muted">
              Your disc collection, bags, bag assignments, profile information (display name, avatar), and app preferences are stored in a cloud database powered by Firebase/Firestore (hosted by Google Cloud). This allows your data to sync across devices and persist if you clear your browser. Your data is protected by Firebase security rules so only you can access it.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Payments</h3>
            <p className="leading-relaxed text-text-muted">
              No payment or subscription system is currently in use. If we add one later, we will update this policy.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Cookies &amp; Analytics</h3>
            <p className="leading-relaxed text-text-muted">
              We use cookies for authentication sessions and basic site analytics to understand how the app is used. We do not run targeted advertising.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Third Parties</h3>
            <p className="leading-relaxed text-text-muted">
              When you click a &quot;Buy&quot; or &quot;Shop&quot; link, you are redirected to third-party retailers (e.g. Amazon, Infinite Discs) which have their own privacy policies. We may earn a small commission from these links at no extra cost to you.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Data Security</h3>
            <p className="leading-relaxed text-text-muted">
              All data is transmitted over HTTPS (TLS encryption). Passwords are hashed and never stored in plain text. Database access is restricted by Firebase security rules.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Your Rights</h3>
            <p className="leading-relaxed text-text-muted">
              You can view, edit, or delete your disc and bag data at any time within the app. To delete your account and all associated data, go to your profile settings and select &quot;Delete Account,&quot; or contact us at discgolfcompanionsupport@gmail.com. Under GDPR and CCPA, you have the right to request a copy of your data or ask us to erase it.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-text mb-1">Contact</h3>
            <p className="leading-relaxed text-text-muted">
              Questions about this policy? Reach us at discgolfcompanionsupport@gmail.com.
            </p>
          </div>
        </div>
        <div className="px-5 py-3 mt-4 pt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface text-text-muted hover:bg-surface"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ProfileAvatar({ src, displayName, size = 'md', onUpload, className = '' }) {
  const sizeCls = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-16 h-16' : 'w-10 h-10';
  const iconSize = size === 'sm' ? 12 : size === 'lg' ? 20 : 14;
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const handleClick = () => {
    if (!onUpload) return;
    fileRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/') || !onUpload) return;
    e.target.value = '';
    setUploading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file, PROFILE_PIC_MAX_SIZE);
      onUpload(dataUrl);
    } catch (_) {}
    setUploading(false);
  };

  const initials = getInitials(displayName);
  const bgColor = getInitialsColor(displayName);

  return (
    <div className={`relative shrink-0 ${className}`}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <div
        onClick={onUpload ? handleClick : undefined}
        className={`${sizeCls} rounded-full overflow-hidden border-2 border-border flex items-center justify-center text-text font-bold text-sm select-none transition-all ${onUpload ? 'cursor-pointer hover:border-primary/50 hover:ring-2 hover:ring-primary/20' : 'cursor-default'}`}
        style={!src ? { backgroundColor: bgColor } : undefined}
        aria-label={onUpload ? 'Change profile picture' : 'Profile picture'}
        role={onUpload ? 'button' : undefined}
      >
        {uploading ? (
          <Loader size={iconSize} className="animate-spin text-text/90" />
        ) : src ? (
          <img src={src} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="leading-none">{initials}</span>
        )}
      </div>
      {onUpload && !uploading && (
        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-surface border-2 border-border flex items-center justify-center" aria-hidden="true">
          <Camera size={iconSize - 4} className="text-primary" />
        </span>
      )}
    </div>
  );
}

function ProfileModal({ open, onClose, userAuth, profilePic, onProfilePicUpload, onSave, setToast, onDeleteAccount }) {
  const [displayName, setDisplayName] = useState(userAuth?.displayName ?? '');
  const [skillLevel, setSkillLevel] = useState(() => normalizeSkillLevel(userAuth?.skillLevel) ?? 'intermediate');
  const [throwStyle, setThrowStyle] = useState(() => normalizeThrowStyle(userAuth?.throwStyle) ?? 'rhbh');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const isEmail = userAuth?.type === 'email';

  useEffect(() => {
    if (open && userAuth) {
      setDisplayName(userAuth.displayName ?? '');
      setSkillLevel(normalizeSkillLevel(userAuth.skillLevel) ?? 'intermediate');
      setThrowStyle(normalizeThrowStyle(userAuth.throwStyle) ?? 'rhbh');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [open, userAuth]);

  if (!open || !userAuth) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const name = displayName.trim();
    if (!name) { setError('Display name cannot be empty.'); return; }
    if (isEmail && (newPassword || confirmPassword || currentPassword)) {
      if (!currentPassword) { setError('Enter your current password to change it.'); return; }
      if (newPassword.length < MIN_PASSWORD_LENGTH) { setError(`New password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
      if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    }
    const sk = normalizeSkillLevel(skillLevel);
    if (!sk) { setError('Please select a skill level.'); return; }
    const ts = normalizeThrowStyle(throwStyle) ?? 'rhbh';
    const err = onSave({
      displayName: name,
      skillLevel: sk,
      throwStyle: ts,
      ...(isEmail && { currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
    });
    if (err) { setError(err); return; }
    setToast?.('Profile updated!');
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 min-h-0" style={{ zIndex: 75 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm max-h-[min(92dvh,calc(100dvh-1.5rem))] sm:max-h-[min(92dvh,calc(100dvh-2rem))] bg-card rounded-2xl border border-border shadow-card-lg overflow-hidden flex flex-col min-h-0"
      >
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="text-base font-bold text-text flex items-center gap-2">
            <User size={18} className="text-primary"/> Edit Profile
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-text-muted"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pt-4 pb-10 space-y-4">
            <div className="flex flex-col items-center gap-3 pb-2">
              <ProfileAvatar src={profilePic} displayName={userAuth.displayName} size="lg" onUpload={onProfilePicUpload} />
              <p className="text-xs text-text-muted">Click the avatar to change your photo</p>
            </div>
            <div>
              <label className="block text-xs text-text-muted font-medium mb-1">Display name</label>
              <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary" placeholder="Your name" />
            </div>
            <div>
              <label className="block text-xs text-text-muted font-medium mb-2">Skill level</label>
              <SkillLevelPicker value={skillLevel} onChange={setSkillLevel} />
            </div>
            <div>
              <label className="block text-xs text-text-muted font-medium mb-2">Throwing style</label>
              <p className="text-[10px] text-text-muted mb-2 leading-snug">Used for flight charts. You can change this anytime.</p>
              <ThrowStylePicker value={throwStyle} onChange={setThrowStyle} />
            </div>
            {userAuth.email && (
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Email</label>
                <input type="email" value={userAuth.email} readOnly className="w-full bg-surface/80 border border-border rounded-xl px-3 py-2.5 text-sm text-text-muted cursor-not-allowed" />
              </div>
            )}
            {isEmail && (
              <>
                <div className="pt-3 mt-3">
                  <p className="text-xs text-text-muted font-medium mb-2">Change password (optional)</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Current password</label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary" placeholder="Current password" autoComplete="current-password" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">New password</label>
                      <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary" placeholder="At least 6 characters" autoComplete="new-password" />
                    </div>
                    <div>
                      <label className="block text-xs text-text-muted mb-1">Confirm new password</label>
                      <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary" placeholder="Repeat new password" autoComplete="new-password" />
                    </div>
                  </div>
                </div>
              </>
            )}
            <div className="pt-3 mt-3">
              <button
                type="button"
                onClick={onDeleteAccount}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-gap-high hover:bg-gap-high/10 border border-gap-high/40 transition-colors"
              >
                Delete Account
              </button>
              <p className="text-xs text-text-muted mt-1.5 text-center">Permanently delete your account and all data</p>
            </div>
          </div>
          <div className="shrink-0 border-t border-border/60 bg-card px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
            {error && <p className="text-sm text-gap-high">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-surface text-text-muted font-semibold text-sm hover:bg-surface">Cancel</button>
              <button type="submit" className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm">Save</button>
            </div>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

function DeleteAccountModal({ open, onClose, onConfirm }) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) { setConfirmText(''); setDeleting(false); }
  }, [open]);

  if (!open) return null;

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm();
    } catch (e) {
      setDeleting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 80 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm bg-card rounded-2xl border border-gap-high/50 shadow-card-lg overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 mb-4">
          <h2 className="text-base font-bold text-gap-high flex items-center gap-2">
            <Trash2 size={18} className="text-gap-high" /> Delete Account
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface text-text-muted"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-text-muted">
            This will <span className="text-gap-high font-semibold">permanently delete</span> your account and all your data, including your disc collection, bags, and ace history. This action cannot be undone.
          </p>
          <div>
            <label className="block text-xs text-text-muted font-medium mb-1">
              Type <span className="text-gap-high font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text focus:outline-none focus:border-gap-high"
              placeholder="DELETE"
              disabled={deleting}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={deleting} className="flex-1 py-3 rounded-xl bg-surface text-text-muted font-semibold text-sm hover:bg-surface">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="flex-1 py-3 rounded-xl bg-gap-high hover:bg-gap-high text-on-primary font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {deleting ? 'Deleting…' : 'Delete Forever'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// PWA INSTALL PROMPT BANNER
// ═══════════════════════════════════════════════════════
function isPwaStandalone() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || document.referrer.includes('android-app://');
}

function isIosNotStandalone() {
  if (typeof window === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const notStandalone = !window.navigator.standalone;
  return ios && notStandalone;
}

function isDismissedWithinCooldown() {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISSED_KEY);
    if (!raw) return false;
    const ts = parseInt(raw, 10);
    if (Number.isNaN(ts)) return false;
    return (Date.now() - ts) < PWA_DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch { return false; }
}

function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [bannerType, setBannerType] = useState(null); // 'android' | 'ios'
  const [pastDelay, setPastDelay] = useState(false);
  const dismissedCooldown = useRef(isDismissedWithinCooldown());

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (dismissedCooldown.current || isPwaStandalone()) return;
    const t = setTimeout(() => setPastDelay(true), PWA_SHOW_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!pastDelay || dismissedCooldown.current) {
      setShowBanner(false);
      setBannerType(null);
      return;
    }
    if (isPwaStandalone()) {
      setShowBanner(false);
      setBannerType(null);
      return;
    }
    if (deferredPrompt) {
      setBannerType('android');
      setShowBanner(true);
    } else if (isIosNotStandalone()) {
      setBannerType('ios');
      setShowBanner(true);
    } else {
      setShowBanner(false);
      setBannerType(null);
    }
  }, [pastDelay, deferredPrompt]);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowBanner(false);
    setBannerType(null);
    try { localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, String(Date.now())); } catch (_) {}
    dismissedCooldown.current = true;
  }, []);

  if (!showBanner || !bannerType) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-3 safe-area-pb"
      >
        <div className="max-w-lg mx-auto rounded-xl border border-border bg-card backdrop-blur-md shadow-card-lg overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 text-xl">
              {bannerType === 'android' ? (
                <Download size={20} className="text-primary" />
              ) : (
                <span aria-hidden="true">⬆️</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {bannerType === 'android' ? (
                <>
                  <p className="text-sm font-semibold text-text">Install Disc Golf Companion for the best experience!</p>
                  <p className="text-xs text-text-muted mt-0.5">Add to home screen for quick access and offline use.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-text">Install this app: tap the Share button then &quot;Add to Home Screen&quot;</p>
                  <p className="text-xs text-text-muted mt-1">Tap <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-surface text-base">⬆️</span> then &quot;Add to Home Screen&quot;</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {bannerType === 'android' && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary hover:bg-primary text-on-primary shadow-lg shadow-primary/20 transition-colors"
                >
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors"
                aria-label="Dismiss"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════
// FLIGHT PATH (pair mode: RHBH/LHFH vs RHFH/LHBH vs both)
// ═══════════════════════════════════════════════════════
function defaultPairModeFromThrowStyle(ts) {
  const t = normalizeThrowStyle(ts) ?? 'rhbh';
  if (t === 'rhfh' || t === 'lhbh') return 'mirrored';
  return 'standard';
}

function FlightPath({ turn, fade, id, large, hideToggle = false, defaultThrowStyle }) {
  const [pairMode, setPairMode] = useState(() => defaultPairModeFromThrowStyle(defaultThrowStyle));
  useEffect(() => {
    setPairMode(defaultPairModeFromThrowStyle(defaultThrowStyle));
  }, [defaultThrowStyle]);
  const sc = large?1.55:1;
  const w = Math.round(82*sc), h = Math.round(96*sc), cx = w/2;
  const tNum = parseFlightNum(turn);
  const fNum = parseFlightNum(fade);
  /** Neutral flight (0/0): vertical path has zero-width bbox; objectBoundingBox gradients don't paint — use solid strokes below. */
  const straight = Math.abs(tNum) < 1e-9 && Math.abs(fNum) < 1e-9;

  const makePath = (mirror) => {
    const m = mirror ? -1 : 1;
    const tp = tNum * -5.5 * m * sc, fp = fNum * -5 * m * sc;
    const cl = (v,mn,mx) => Math.max(mn,Math.min(mx,v));
    const sy = h-Math.round(10*sc), ty = h*0.38, ey = Math.round(10*sc);
    const tx = cl(cx+tp,8,w-8), ex = cl(cx+tp*0.5+fp,8,w-8);
    // Turn 0 + fade 0 → straight vertical; degenerate cubics + gradient-on-zero-width stroke both fail to paint.
    if (straight) {
      return { d: `M ${cx} ${sy} L ${cx} ${ey}`, ex, ey, sx: cx, sy };
    }
    return {
      d:`M ${cx} ${sy} C ${cx} ${(sy+ty)/2}, ${tx} ${ty+15*sc}, ${tx} ${ty} C ${tx} ${ty-12*sc}, ${ex} ${ey+15*sc}, ${ex} ${ey}`,
      ex, ey, sx:cx, sy
    };
  };

  /** Standard (RHBH/LHFH) vs mirrored (RHFH/LHBH) geometry; "both" overlays the two shapes. */
  const std = makePath(false);
  const mir = makePath(true);
  const showStandard = pairMode === 'standard' || pairMode === 'both';
  const showMirrored = pairMode === 'mirrored' || pairMode === 'both';
  const fs = large?9:7;
  /** In "Both", use flat colors + dashed mirrored path so the two flights read clearly (gradients hide dashes). */
  const bothMode = pairMode === 'both';
  const stdStroke = bothMode || straight ? '#10b981' : `url(#bh_${id})`;
  const mirStroke = bothMode || straight ? '#a78bfa' : `url(#fh_${id})`;
  const labelFs = large ? 7 : 6;

  return (
    <div className="flex flex-col items-center w-full max-w-full">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
        <line x1={cx} y1={6} x2={cx} y2={h-6} stroke="white" strokeOpacity={0.06} strokeDasharray="2,4"/>
        <text x={cx} y={h-1} textAnchor="middle" fill="white" fillOpacity={0.1} fontSize={fs} fontWeight="bold">TEE</text>
        {showStandard && (
          <motion.path
            key={`std-${pairMode}`}
            d={std.d}
            fill="none"
            stroke={stdStroke}
            strokeWidth={bothMode ? 2.75 : 2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}
        {showMirrored && (
          <motion.path
            key={`mir-${pairMode}`}
            d={mir.d}
            fill="none"
            stroke={mirStroke}
            strokeWidth={bothMode ? 2.5 : 2}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={bothMode ? '6 4' : undefined}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          />
        )}
        {showStandard && <circle cx={std.sx} cy={std.sy} r={2.5} fill="#10b981"/>}
        {showStandard && (
          <motion.g initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7}}>
            <circle cx={std.ex} cy={std.ey} r={2} fill="#10b981"/>
            {bothMode && (
              <text
                x={std.ex}
                y={std.ey - 5}
                textAnchor="middle"
                fill="#10b981"
                stroke="rgba(0,0,0,0.35)"
                strokeWidth={0.35}
                paintOrder="stroke fill"
                fontSize={labelFs}
                fontWeight="800"
              >
                1
              </text>
            )}
          </motion.g>
        )}
        {showMirrored && (
          <motion.g initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7}}>
            <circle cx={mir.ex} cy={mir.ey} r={2} fill="#a78bfa"/>
            {bothMode && (
              <text
                x={mir.ex}
                y={mir.ey - 5}
                textAnchor="middle"
                fill="#c4b5fd"
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={0.35}
                paintOrder="stroke fill"
                fontSize={labelFs}
                fontWeight="800"
              >
                2
              </text>
            )}
          </motion.g>
        )}
        <defs>
          <linearGradient id={`bh_${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#f87171"/></linearGradient>
          <linearGradient id={`fh_${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient>
        </defs>
      </svg>
      {pairMode === 'both' && !hideToggle && (
        <div
          className={`flex flex-wrap justify-center gap-x-3 gap-y-1 mt-1 px-0.5 max-w-full ${!large ? 'gap-x-4' : ''}`}
          aria-label="Line key: 1 RHBH/LHFH, 2 RHFH/LHBH"
          onClick={(e) => e.stopPropagation()}
        >
          {!large ? (
            <>
              <span className="inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-text-muted leading-tight">
                <span className="font-extrabold tabular-nums text-emerald-500 shrink-0">1</span>
                <span className="font-semibold text-text-muted">RHBH / LHFH</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-text-muted leading-tight">
                <span className="font-extrabold tabular-nums text-violet-400 shrink-0">2</span>
                <span className="font-semibold text-text-muted">RHFH / LHBH</span>
              </span>
            </>
          ) : (
            <>
              <span className="inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-text-muted leading-tight">
                <span className="font-extrabold tabular-nums text-emerald-500 shrink-0" aria-hidden>
                  1
                </span>
                <svg width={18} height={8} viewBox="0 0 18 8" className="shrink-0" aria-hidden>
                  <line x1={0} y1={4} x2={18} y2={4} stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" />
                </svg>
                <span className="font-semibold text-text-muted">RHBH / LHFH</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[7px] sm:text-[8px] text-text-muted leading-tight">
                <span className="font-extrabold tabular-nums text-violet-400 shrink-0" aria-hidden>
                  2
                </span>
                <svg width={18} height={8} viewBox="0 0 18 8" className="shrink-0" aria-hidden>
                  <line x1={0} y1={4} x2={18} y2={4} stroke="#a78bfa" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
                </svg>
                <span className="font-semibold text-text-muted">RHFH / LHBH</span>
              </span>
            </>
          )}
        </div>
      )}
      {!hideToggle && (
        <div
          className="flex gap-0.5 mt-0.5 w-full max-w-full justify-center flex-wrap"
          role="radiogroup"
          aria-label="Flight path view"
          onClick={(e) => e.stopPropagation()}
        >
          {[
            ['standard', 'RHBH / LHFH'],
            ['both', 'Both'],
            ['mirrored', 'RHFH / LHBH'],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={pairMode === k}
              onClick={(e) => { e.stopPropagation(); setPairMode(k); }}
              className={`px-1.5 py-0.5 rounded transition-all font-bold ${pairMode === k ? 'bg-surface text-text' : 'text-text-muted hover:text-text-muted'}`}
              style={{ fontSize: large ? 11 : 8 }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC FORM MODAL (Add / Edit)
// ═══════════════════════════════════════════════════════
function DiscFormModal({ open, onClose, onSave, editDisc, uploadImage, defaultDiscType, defaultBagId, bags, onRemoveDiscFromAllBags, onCreateBag, defaultThrowStyle }) {
  const [f, setF] = useState({ ...EMPTY_DISC });
  const fileRef = useRef(null);
  const moldDropdownRef = useRef(null);
  const userTouchedFlightRef = useRef(false);
  const lastMoldAutoKeyRef = useRef('');
  const [moldDropdownOpen, setMoldDropdownOpen] = useState(false);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [newBagOpen, setNewBagOpen] = useState(false);
  const [newBagName, setNewBagName] = useState('');
  const isEdit = !!editDisc;

  useEffect(() => {
    if (open) {
      lastMoldAutoKeyRef.current = '';
      setLostDialogOpen(false);
      setNewBagOpen(false);
      setNewBagName('');
      if (editDisc) {
        userTouchedFlightRef.current = true;
        const bagIds = inferBagIdsFromMembership(editDisc, bags);
        setF({
          ...editDisc,
          story: editDisc.story || '',
          estimated_value: editDisc.estimated_value || 18,
          lostNote: editDisc.lostNote ?? '',
          gaveAwayNote: editDisc.gaveAwayNote ?? '',
          bagIds,
          bagId: null,
        });
      } else {
        userTouchedFlightRef.current = false;
        const initial = { ...EMPTY_DISC, date_acquired: td(), speed: null, glide: null, turn: null, fade: null };
        if (defaultDiscType && DISC_TYPE_FLIGHT_PRESETS[defaultDiscType]) {
          initial.disc_type = defaultDiscType;
          Object.assign(initial, DISC_TYPE_FLIGHT_PRESETS[defaultDiscType]);
        }
        if (defaultBagId && bags?.some((b) => b.id === defaultBagId)) {
          initial.status = 'in_bag';
          initial.bagIds = [defaultBagId];
        }
        setF(initial);
      }
    }
  }, [open, editDisc, defaultDiscType, defaultBagId, bags]);

  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const setFlightNum = (k, v) => {
    userTouchedFlightRef.current = true;
    setF((p) => ({ ...p, [k]: v }));
  };

  const moldSuggestions = useMemo(() => {
    if (!f.manufacturer) return [];
    const q = (f.mold || '').trim().toLowerCase();
    return MOLD_LOOKUP.filter(row => row.manufacturer === f.manufacturer && (!q || row.mold.toLowerCase().includes(q))).slice(0, 20);
  }, [f.manufacturer, f.mold]);

  const applyMoldLookup = useCallback((manufacturer, mold) => {
    const match = MOLD_LOOKUP.find(row => row.manufacturer === manufacturer && row.mold.toLowerCase() === (mold || '').trim().toLowerCase());
    if (!match) return null;
    return {
      speed: match.speed,
      glide: match.glide,
      turn: match.turn,
      fade: match.fade,
      disc_type: inferDiscTypeFromSpeed(match.speed),
    };
  }, []);

  useEffect(() => {
    if (!open || !f.manufacturer || !String(f.mold || '').trim() || userTouchedFlightRef.current) return;
    const key = `${f.manufacturer}|${(f.mold || '').trim().toLowerCase()}`;
    const match = MOLD_LOOKUP.find(
      (row) => row.manufacturer === f.manufacturer && row.mold.toLowerCase() === (f.mold || '').trim().toLowerCase()
    );
    if (!match) {
      lastMoldAutoKeyRef.current = '';
      return;
    }
    if (lastMoldAutoKeyRef.current === key) return;
    lastMoldAutoKeyRef.current = key;
    setF((p) => ({
      ...p,
      speed: match.speed,
      glide: match.glide,
      turn: match.turn,
      fade: match.fade,
      disc_type: inferDiscTypeFromSpeed(match.speed),
    }));
  }, [open, f.manufacturer, f.mold]);

  const handleDiscTypeChange = (discTypeKey) => {
    const preset = DISC_TYPE_FLIGHT_PRESETS[discTypeKey];
    userTouchedFlightRef.current = false;
    setF((p) => ({ ...p, disc_type: discTypeKey, ...(preset || {}) }));
  };

  useEffect(() => {
    const handleClickOutside = (e) => { if (moldDropdownRef.current && !moldDropdownRef.current.contains(e.target)) setMoldDropdownOpen(false); };
    if (moldDropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [moldDropdownOpen]);
  const flightFormOk = hasValidFlightNumbersForChart(f);
  const ok = f.manufacturer && f.mold && f.plastic_type && flightFormOk;
  const handleStatusClick = (k) => {
    if (k === f.status) return;
    if (k === 'lost') {
      setLostDialogOpen(true);
      return;
    }
    if (k === 'in_bag') {
      setF((p) => ({ ...p, status: 'in_bag' }));
      return;
    }
    setF((p) => ({ ...p, status: k, bagIds: [], bagId: null }));
  };
  const toggleFormBagId = (bid) => {
    setF((p) => {
      const cur = Array.isArray(p.bagIds) ? [...p.bagIds] : [];
      const has = cur.includes(bid);
      const next = has ? cur.filter((id) => id !== bid) : [...cur, bid];
      return { ...p, bagIds: next };
    });
  };
  const createNewBagInline = () => {
    const name = newBagName.trim();
    if (!name || !onCreateBag) return;
    const id = onCreateBag(name);
    if (id) {
      setF((p) => ({
        ...p,
        status: 'in_bag',
        bagIds: [...new Set([...(Array.isArray(p.bagIds) ? p.bagIds : []), id])],
      }));
    }
    setNewBagName('');
    setNewBagOpen(false);
  };
  const save = () => {
    const discId = isEdit ? f.id : Date.now().toString();
    const bagIdsClean = f.status === 'in_bag' ? (Array.isArray(f.bagIds) ? f.bagIds.filter(Boolean) : []) : [];
    const discPayload = {
      ...f,
      ...(isEdit ? {} : { id: discId }),
      bagIds: bagIdsClean,
      bagId: null,
      lostNote: f.status === 'lost' ? (f.lostNote ?? '') : '',
      gaveAwayNote: f.status === 'gave_away_sold' ? (f.gaveAwayNote ?? '') : '',
      speed: parseFlightNum(f.speed),
      glide: parseFlightNum(f.glide),
      turn: parseFlightNum(f.turn),
      fade: parseFlightNum(f.fade),
    };
    onSave(discPayload);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    try {
      console.log('[DiscFormModal] Photo selected', { name: file.name, size: file.size, type: file.type });
      let photoValue = null;
      if (uploadImage) {
        photoValue = await uploadImage(file, 'discs');
      } else {
        photoValue = await compressImageFileToDataUrl(file);
      }
      if (photoValue) {
        console.log('[DiscFormModal] compressed disc photo, bytes:', typeof photoValue === 'string' ? photoValue.length : 0);
        s('photo', photoValue);
        console.log('[DiscFormModal] Photo saved to state');
      }
    } catch (err) {
      console.warn('[DiscFormModal] failed to process disc photo', err);
    }
  };

  return (
    <AnimatePresence>{open && (
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
        <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}} transition={{type:'spring',damping:28}} className="relative w-full max-w-lg bg-card rounded-t-3xl sm:rounded-2xl border border-border flex flex-col overflow-hidden shadow-card-lg" style={{maxHeight:'92vh'}}>
          <div className="flex items-center justify-between p-5 mb-4 shrink-0">
            <div><h2 className="text-lg font-bold text-text">{isEdit?'Edit Disc':'Add New Disc'}</h2><p className="text-xs text-text-muted mt-0.5">{isEdit?`Editing ${editDisc.mold}`:'Log a disc to your collection'}</p></div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-surface text-text-muted"><X size={20}/></button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* Photo */}
            <section>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Photo</h3>
              <div className="flex items-center gap-4">
                <DiscVisual disc={f} size="lg"/>
                <div className="flex-1 space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto}/>
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-text-muted hover:border-primary/50 hover:text-primary transition-all text-sm font-medium">
                    {f.photo?<><Camera size={14}/>Change</>:<><Upload size={14}/>Upload Photo</>}
                  </button>
                  {f.photo && <button type="button" onClick={() => s('photo',null)} className="w-full text-xs text-gap-high hover:text-red-300 py-1">Remove</button>}
                </div>
              </div>
            </section>
            {/* Identity */}
            <section>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Identity</h3>
              <div className="space-y-2">
                <select value={f.manufacturer} onChange={e=>{ lastMoldAutoKeyRef.current=''; s('manufacturer',e.target.value); setMoldDropdownOpen(false); }} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary">
                  <option value="">Select manufacturer…</option>{MFRS.map(m=><option key={m}>{m}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative" ref={moldDropdownRef}>
                    <input value={f.mold} onChange={e=>{ lastMoldAutoKeyRef.current=''; s('mold',e.target.value); setMoldDropdownOpen(true); }} onFocus={()=>setMoldDropdownOpen(true)} placeholder="Mold *" className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
                    {moldDropdownOpen && f.manufacturer && (
                      <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-card border border-border rounded-lg shadow-card py-1">
                        {moldSuggestions.length ? moldSuggestions.map(row => (
                          <li key={row.manufacturer+row.mold}>
                            <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-surface focus:bg-surface focus:outline-none" onClick={()=>{ const flight = applyMoldLookup(f.manufacturer, row.mold); userTouchedFlightRef.current = false; lastMoldAutoKeyRef.current = `${f.manufacturer}|${row.mold.trim().toLowerCase()}`; s('mold',row.mold); if (flight) setF(p=>({...p,mold:row.mold,...flight})); setMoldDropdownOpen(false); }}>
                              {row.mold} <span className="text-text-muted text-xs">({row.speed}/{row.glide}/{row.turn}/{row.fade})</span>
                            </button>
                          </li>
                        )) : <li className="px-3 py-2 text-xs text-text-muted">No molds found — type to search or enter custom</li>}
                      </ul>
                    )}
                  </div>
                  <input value={f.plastic_type} onChange={e=>s('plastic_type',e.target.value)} placeholder="Plastic *" className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
                </div>
                <input value={f.custom_name} onChange={e=>s('custom_name',e.target.value)} placeholder="Nickname (optional)" className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Disc Color</label>
                <div className="flex flex-wrap gap-2">
                  {DISC_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => s('color',c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${f.color===c?'border-white scale-110':'border-border'}`}
                      style={{backgroundColor:c}}/>
                  ))}
                </div>
              </div>
            </section>
            {/* Type & Status */}
            <section>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Type & Status</h3>
              <label className="block text-xs text-text-muted mb-1.5 font-medium">Disc type</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {[
                  ['distance_driver', 'Distance Driver'],
                  ['fairway_driver', 'Fairway Driver'],
                  ['midrange', 'Midrange'],
                  ['putter', 'Putter'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleDiscTypeChange(k)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 shrink-0 px-2 ${f.disc_type === k ? 'bg-surface text-text border-border' : 'bg-surface text-text-muted border-border'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5">
                {Object.entries(SM).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleStatusClick(k)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${f.status === k ? 'bg-surface text-text border-border' : 'bg-surface text-text-muted border-border'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.dot}`} />
                    <span className="text-center leading-tight">{v.label}</span>
                  </button>
                ))}
              </div>
              {f.status === 'in_bag' && (
                <div className="mt-2">
                  <label className="block text-xs text-text-muted mb-1.5 font-medium">Bags</label>
                  <div className="flex flex-col gap-1.5">
                    {(bags ?? []).map((b) => {
                      const checked = Array.isArray(f.bagIds) && f.bagIds.includes(b.id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => toggleFormBagId(b.id)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all flex items-center gap-2 w-full text-left ${checked ? 'bg-surface text-text border-border' : 'bg-surface text-text-muted border-border'}`}
                        >
                          {checked ? (
                            <CheckSquare size={16} className="shrink-0 text-primary" />
                          ) : (
                            <Square size={16} className="shrink-0 text-text-muted" />
                          )}
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: b.bagColor || '#6b7280' }} />
                          <span className="truncate">{b.name}</span>
                        </button>
                      );
                    })}
                    {onCreateBag && (
                      <>
                        {!newBagOpen ? (
                          <button
                            type="button"
                            onClick={() => setNewBagOpen(true)}
                            className="py-1.5 px-2 rounded-lg text-xs font-semibold border border-dashed border-border bg-surface text-text-muted hover:text-text hover:border-primary/40 flex items-center gap-1.5 w-full"
                          >
                            <Plus size={14} className="shrink-0" />
                            New Bag
                          </button>
                        ) : (
                          <div className="rounded-lg border border-border bg-surface p-2 space-y-2">
                            <input
                              value={newBagName}
                              onChange={(e) => setNewBagName(e.target.value)}
                              placeholder="New bag name…"
                              className="w-full bg-card border border-border rounded-lg px-2 py-1.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"
                              onKeyDown={(e) => e.key === 'Enter' && createNewBagInline()}
                            />
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setNewBagOpen(false);
                                  setNewBagName('');
                                }}
                                className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-card border border-border text-text-muted"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={createNewBagInline}
                                disabled={!newBagName.trim()}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold ${newBagName.trim() ? 'bg-primary text-on-primary' : 'bg-surface text-text-muted cursor-not-allowed'}`}
                              >
                                Create
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
              {f.status === 'lost' && (
                <div className="mt-3">
                  <label className="block text-xs text-text-muted mb-1.5 font-medium" htmlFor="disc-lost-note">
                    Lost Disc Note
                  </label>
                  <textarea
                    id="disc-lost-note"
                    value={f.lostNote ?? ''}
                    onChange={(e) => s('lostNote', e.target.value)}
                    rows={3}
                    placeholder="Where and when did you lose it? (e.g., Hole 7 water hazard, March 15)"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary resize-y min-h-[4.5rem]"
                  />
                </div>
              )}
              {f.status === 'gave_away_sold' && (
                <div className="mt-3">
                  <label className="block text-xs text-text-muted mb-1.5 font-medium" htmlFor="disc-gave-away-note">
                    Details
                  </label>
                  <textarea
                    id="disc-gave-away-note"
                    value={f.gaveAwayNote ?? ''}
                    onChange={(e) => s('gaveAwayNote', e.target.value)}
                    rows={3}
                    placeholder="Who did you give it to or sell it to? When? How much?"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary resize-y min-h-[4.5rem]"
                  />
                </div>
              )}
              <label className="flex items-center gap-2.5 mt-3 px-3 py-2.5 rounded-lg border border-border bg-surface cursor-pointer hover:border-primary/30 transition-colors">
                <input type="checkbox" checked={!!f.hasAce} onChange={e=>{ const checked=e.target.checked; s('hasAce',checked); if(checked) { s('aceDate',f.aceDate||td()); } else { s('aceDate',''); s('aceLocation',''); s('aceHole',''); } }} className="rounded border-border text-gap-medium focus:ring-gap-medium"/>
                <Trophy size={16} className="text-gap-medium shrink-0"/>
                <span className="text-sm font-medium text-text">Record Ace</span>
              </label>
              {f.hasAce && (
                <div className="mt-2 p-3 rounded-xl border border-gap-medium/30 bg-gap-medium/5 space-y-2">
                  <p className="text-xs font-semibold text-gap-medium uppercase tracking-wider">Ace details</p>
                  <input type="date" value={f.aceDate||''} onChange={e=>s('aceDate',e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" placeholder="Date"/>
                  <input value={f.aceLocation||''} onChange={e=>s('aceLocation',e.target.value)} placeholder="Location (e.g. course name)" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
                  <input type="number" min={1} max={36} value={f.aceHole ?? ''} onChange={e=>{ const v=e.target.value; s('aceHole',v===''?'':(parseInt(v,10)||'')); }} placeholder="Hole number" className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
                </div>
              )}
            </section>
            {/* Flight Numbers */}
            <section>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Flight Numbers</h3>
              <p className="text-xs text-text-muted mb-2 sm:text-[10px]">Tap to type or use +/− buttons</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stepper label="Speed" value={f.speed} onChange={(v)=>setFlightNum('speed',v)} min={1} max={15} step={0.5}/>
                <Stepper label="Glide" value={f.glide} onChange={(v)=>setFlightNum('glide',v)} min={0} max={7} step={0.5}/>
                <Stepper label="Turn" value={f.turn} onChange={(v)=>setFlightNum('turn',v)} min={-5} max={1} step={0.5}/>
                <Stepper label="Fade" value={f.fade} onChange={(v)=>setFlightNum('fade',v)} min={0} max={5} step={0.5}/>
              </div>
              {hasValidFlightNumbersForChart(f) && (
                <div className="mt-3 flex justify-center bg-surface/50 rounded-xl p-3">
                  <FlightPath turn={f.turn} fade={f.fade} id="preview" large hideToggle defaultThrowStyle={defaultThrowStyle}/>
                </div>
              )}
              {!hasValidFlightNumbersForChart(f) && (
                <GlossaryBody as="p" className="mt-3 text-center text-xs text-text-muted py-4 px-2 bg-surface/50 rounded-xl">Enter flight numbers to see the flight path</GlossaryBody>
              )}
              <div className="mt-3">
                <label className="block text-xs text-text-muted mb-1.5 font-medium">Default Flight View</label>
                <div className="flex gap-1.5">
                  {[['bh','Backhand Only','🫲'],['both','Both','↔️'],['fh','Forehand Only','🫱']].map(([k,l,icon]) => (
                    <button key={k} type="button" onClick={() => s('flight_preference',k)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        f.flight_preference===k 
                          ? 'bg-primary/20 text-primary border-primary/50' 
                          : 'bg-surface text-text-muted border-border hover:border-border'
                      }`}>{icon} {l}</button>
                  ))}
                </div>
              </div>
            </section>
            {/* Physical */}
            <section>
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Physical & Value</h3>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input type="number" value={f.weight_grams} onChange={e=>s('weight_grams',parseInt(e.target.value)||0)} placeholder="Weight (g)" className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"/>
                <input type="date" value={f.date_acquired} onChange={e=>s('date_acquired',e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"/>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span><input type="number" value={f.estimated_value} onChange={e=>s('estimated_value',parseFloat(e.target.value)||0)} className="w-full bg-surface border border-border rounded-lg pl-7 pr-3 py-2.5 text-sm text-text focus:outline-none focus:border-primary"/></div>
              </div>
              <label className="block text-xs text-text-muted mb-1">Condition: {f.wear_level}/10 · {ww(f.wear_level)}</label>
              <input type="range" min={1} max={10} value={f.wear_level} onChange={e=>s('wear_level',parseInt(e.target.value))} className="w-full accent-primary"/>
              <p className="text-xs text-text-muted mt-1">1 = Poor (heavily used) → 10 = Mint (brand new)</p>
            </section>
          </div>
          <div className="p-5 mt-4 pt-4 shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-surface text-text-muted font-semibold text-sm">Cancel</button>
            <button onClick={save} disabled={!ok} className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${ok?'bg-primary text-on-primary shadow-lg shadow-primary/25':'bg-surface text-text-muted cursor-not-allowed'}`}>
              {isEdit?<><Check size={16}/>Save Changes</>:<><Plus size={16}/>Add Disc</>}
            </button>
          </div>
        </motion.div>
        <AnimatePresence>
          {lostDialogOpen && (
            <LostDiscDialog
              onDismiss={() => setLostDialogOpen(false)}
              onRemoveFromBags={() => {
                const id = f.id || editDisc?.id;
                setF((p) => ({ ...p, status: 'lost', bagIds: [], bagId: null }));
                if (id) onRemoveDiscFromAllBags?.(id);
                queueMicrotask(() => setLostDialogOpen(false));
              }}
              onKeepInBags={() => {
                setF((p) => ({ ...p, status: 'lost' }));
                queueMicrotask(() => setLostDialogOpen(false));
              }}
            />
          )}
        </AnimatePresence>
      </motion.div>
    )}</AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════
// ACE FORM MODAL (Log / Edit Ace)
// ═══════════════════════════════════════════════════════
function AceFormModal({open,disc,existingAce,discs,onClose,onSave,uploadImage}) {
  const [date,setDate] = useState(td());
  const [course,setCourse] = useState('');
  const [hole,setHole] = useState('');
  const [distance,setDistance] = useState(250);
  const [selectedDiscId,setSelectedDiscId] = useState('');
  const [witnessed,setWitnessed] = useState(false);
  const [witnessNames,setWitnessNames] = useState('');
  const [notes,setNotes] = useState('');
  const [photo,setPhoto] = useState(null);
  const [discPickerOpen,setDiscPickerOpen] = useState(false);
  const isEdit = !!existingAce;

  useEffect(() => {
    if (open) {
      if (existingAce) {
        setDate(existingAce.date||td()); setCourse(existingAce.course||'');
        setHole(existingAce.hole?String(existingAce.hole):''); setDistance(existingAce.distance||250);
        setSelectedDiscId(existingAce.discId||''); setWitnessed(existingAce.witnessed||false);
        setWitnessNames(existingAce.witnessNames||''); setNotes(existingAce.notes||''); setPhoto(existingAce.photo||null);
      } else {
        setDate(td()); setCourse(''); setHole(''); setDistance(250);
        setSelectedDiscId(disc?.id||''); setWitnessed(false); setWitnessNames(''); setNotes(''); setPhoto(null);
      }
      setDiscPickerOpen(false);
    }
  }, [open, existingAce, disc]);

  if (!open) return null;
  const activeDisc = discs?.find(d=>d.id===selectedDiscId);
  const displayDisc = activeDisc || disc;
  const hasDiscSelected = !!(selectedDiscId || disc?.id);
  const noDiscsInCollection = !disc && (!discs || discs.length === 0);

  const submit = () => {
    onSave({
      id: existingAce?.id || `a${Date.now()}`,
      discId: selectedDiscId || disc?.id || '',
      date, course: course.trim()||'Unknown Course',
      hole: parseInt(hole)||0, distance: parseInt(distance)||0, witnessed,
      witnessNames: witnessed ? (witnessNames||'').trim() : '',
      notes: (notes||'').trim() || '',
      ...(photo != null ? { photo } : {}),
    }, isEdit);
    onClose();
  };
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.target.value = '';
    try {
      console.log('[AceFormModal] Photo selected', { name: file.name, size: file.size, type: file.type });
      let photoValue = null;
      if (uploadImage) {
        photoValue = await uploadImage(file, 'aces');
      } else {
        photoValue = await compressImageFileToDataUrl(file);
      }
      if (photoValue) {
        console.log('[AceFormModal] compressed ace photo, bytes:', typeof photoValue === 'string' ? photoValue.length : 0);
        setPhoto(photoValue);
        console.log('[AceFormModal] Photo saved to state');
      }
    } catch (err) {
      console.warn('[AceFormModal] failed to process ace photo', err);
    }
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} onClick={e=>e.stopPropagation()} className="relative w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden shadow-card-lg">
        <div className="p-5 mb-4 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEdit?'bg-secondary/15':'bg-gap-medium/15'}`}>
            {isEdit?<Edit3 size={20} className="text-secondary"/>:<Trophy size={20} className="text-gap-medium"/>}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-text">{isEdit?'Edit Ace':'Log an Ace!'}</h2>
            <p className="text-xs text-text-muted truncate">{displayDisc ? `${displayDisc.manufacturer || 'Unknown'} ${displayDisc.mold}` : 'Select a disc'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-surface text-text-muted"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
          {/* No discs message when opening without a disc and collection is empty */}
          {noDiscsInCollection && (
            <div className="rounded-xl bg-gap-medium/10 border border-gap-medium/20 px-4 py-3 text-sm text-gap-medium">
              Add a disc to your collection first, then log an ace for it.
            </div>
          )}
          {/* Disc picker: always show when logging an ace and user has discs (so they can select which disc) */}
          {discs?.length > 0 ? (
            <div className="relative">
              <label className="text-xs text-text-muted font-medium mb-1 block">Disc</label>
              <button onClick={() => setDiscPickerOpen(!discPickerOpen)} className="w-full flex items-center gap-2.5 bg-surface border border-border rounded-lg px-3 py-2.5 text-left hover:border-border">
                {activeDisc && <span className="w-5 h-5 rounded-full shrink-0 border border-border" style={{backgroundColor:activeDisc.color||'#6b7280'}}/>}
                <span className="text-sm text-text flex-1 truncate">
                  {activeDisc ? `${activeDisc.manufacturer || 'Unknown'} ${activeDisc.mold}${activeDisc.custom_name ? ` (${activeDisc.custom_name})` : ''}` : 'Select a disc…'}
                </span>
                <ChevronDown size={14} className={`text-text-muted transition-transform ${discPickerOpen?'rotate-180':''}`}/>
              </button>
              {discPickerOpen && (
                <>
                  <div className="fixed inset-0" style={{zIndex:9}} onClick={() => setDiscPickerOpen(false)}/>
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-card border border-border rounded-xl overflow-hidden shadow-card max-h-48 overflow-y-auto" style={{zIndex:10}}>
                    {discs.map(d => (
                      <button key={d.id} onClick={() => {setSelectedDiscId(d.id);setDiscPickerOpen(false);}}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-surface/60 ${d.id===selectedDiscId?'bg-primary/10 text-primary':'text-text-muted'}`}>
                        <span className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor:d.color||'#6b7280'}}/>
                        <span className="flex-1 truncate text-sm">{d.manufacturer || 'Unknown'} {d.mold}{d.custom_name ? ` (${d.custom_name})` : ''}</span>
                        {d.id===selectedDiscId && <Check size={12} className="text-primary shrink-0"/>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1 block">Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text focus:outline-none focus:border-gap-medium"/>
          </div>
          <div>
            <label className="text-xs text-text-muted font-medium mb-1 block">Course</label>
            <input value={course} onChange={e=>setCourse(e.target.value)} placeholder="e.g. Maple Hill" className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-gap-medium"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted font-medium mb-1 block">Hole #</label>
              <input type="number" value={hole} onChange={e=>setHole(e.target.value)} placeholder="7" min={1} max={36} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-gap-medium"/>
            </div>
            <div>
              <label className="text-xs text-text-muted font-medium mb-1 block">Distance (ft)</label>
              <input type="number" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="250" className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-gap-medium"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-text-muted font-medium mb-1.5 block">Quick pick</label>
            <div className="flex gap-1.5 flex-wrap">
              {[150,200,250,300,350,400].map(d => (
                <button key={d} type="button" onClick={() => setDistance(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${parseInt(distance)===d?'bg-gap-medium/20 text-gap-medium border-gap-medium/30':'bg-surface text-text-muted border-border'}`}>{d} ft</button>
              ))}
            </div>
          </div>
          {/* Witnesses toggle */}
          <button type="button" onClick={() => setWitnessed(!witnessed)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${witnessed?'bg-primary/10 border-primary/30':'bg-surface border-border hover:border-border'}`}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${witnessed?'bg-primary border-primary':'border-border'}`}>
              {witnessed && <Check size={14} className="text-text"/>}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Users size={13} className={witnessed?'text-primary':'text-text-muted'}/>
                <span className={`text-sm font-semibold ${witnessed?'text-primary':'text-text'}`}>Witnessed Ace</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">Was this ace witnessed by other players?</p>
            </div>
            {witnessed && <Shield size={16} className="text-primary shrink-0" fill="currentColor"/>}
          </button>
          {witnessed && (
            <div>
              <label className="text-xs text-text-muted font-medium mb-1 block">Witness names</label>
              <input value={witnessNames} onChange={e=>setWitnessNames(e.target.value)} placeholder="Who witnessed it? (e.g. John, Sarah)" className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
            </div>
          )}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1 block">Notes (optional)</label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note... (e.g. Wind was crazy, threw a perfect hyzer line)" rows={2} className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-gap-medium resize-none"/>
          </div>
          {/* Photo upload */}
          <div>
            <label className="text-xs text-text-muted font-medium mb-1.5 block">Photo</label>
            <label className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface hover:border-gap-medium/40 cursor-pointer">
              <Camera size={18} className="text-text-muted"/>
              <span className="text-sm text-text-muted">{photo ? 'Change photo' : 'Add Photo'}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoUpload}/>
            </label>
            {photo && (
              <div className="mt-2 flex items-center gap-2">
                <img src={photo} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border"/>
                <button type="button" onClick={()=>setPhoto(null)} className="text-xs text-gap-high hover:text-red-300 font-semibold">Remove photo</button>
              </div>
            )}
          </div>
        </div>
        <div className="p-5 mt-4 pt-4 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted font-semibold text-sm">Cancel</button>
          <button onClick={submit} disabled={!isEdit && !hasDiscSelected} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isEdit?'bg-secondary hover:bg-secondary text-on-primary':'bg-gap-medium hover:bg-gap-medium text-on-primary'}`}>
            {isEdit?<><Check size={14}/>Save</>:<><Trophy size={14}/>Log Ace!</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// TROPHY SYSTEM — Emblem, Trading Card, Share, Room
// ═══════════════════════════════════════════════════════
function AceEmblem({size=80}) {
  return (
    <div className="relative" style={{width:size,height:size}}>
      <motion.div className="absolute inset-0 rounded-full" style={{background:'radial-gradient(circle,rgba(251,191,36,0.25) 0%,transparent 70%)'}} animate={{scale:[1,1.2,1],opacity:[0.5,0.8,0.5]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}/>
      <svg viewBox="0 0 100 100" className="w-full h-full relative">
        <defs>
          <linearGradient id="aceGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#fbbf24"/><stop offset="50%" stopColor="#fef08a"/><stop offset="100%" stopColor="#d97706"/></linearGradient>
        </defs>
        <circle cx="50" cy="50" r="46" fill="none" stroke="url(#aceGold)" strokeWidth="2.5"/>
        <circle cx="50" cy="50" r="42" fill="rgba(251,191,36,0.06)" stroke="url(#aceGold)" strokeWidth="0.5" strokeOpacity="0.3"/>
        {[0,60,120,180,240,300].map(a => (<line key={a} x1="50" y1="6" x2="50" y2="11" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${a} 50 50)`} opacity="0.35"/>))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Trophy size={size*0.28} className="text-gap-medium" strokeWidth={2.5}/>
        <span className="text-gap-medium font-black tracking-widest" style={{fontSize:size*0.11,marginTop:size*0.02}}>ACE</span>
      </div>
    </div>
  );
}

const GOLD_ACE_BORDER = 'linear-gradient(135deg,#FFD700,#FFA500,#B8860B,#FFD700)';
function AceTradingCard({ace,disc,index,totalAces,onEdit,onDelete}) {
  const rarity = getAceRarity(ace.distance||0);
  const [hovered,setHovered] = useState(false);
  const hasPhoto = !!(ace.photo);
  return (
    <motion.div layout initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.5,delay:index*0.08,type:'spring',damping:25}}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="relative group h-full min-h-0 flex flex-col">
      <motion.div className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-lg" style={{background:GOLD_ACE_BORDER}}/>
      <div className="relative rounded-2xl overflow-hidden flex-1 min-h-0 flex flex-col" style={{padding:'1.5px',background:GOLD_ACE_BORDER}}>
        <div className="relative rounded-2xl overflow-hidden h-full min-h-0 flex flex-col bg-bg" style={{background:'linear-gradient(180deg,rgba(26,25,24,0.98),rgba(38,36,33,0.95))'}}>
          <motion.div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{zIndex:5,background:'linear-gradient(105deg,transparent 35%,rgba(255,215,0,0.06) 40%,rgba(255,255,255,0.08) 45%,rgba(255,215,0,0.06) 50%,transparent 55%)',backgroundSize:'250% 100%'}}
            animate={hovered?{backgroundPosition:['200% 0','-100% 0']}:{}} transition={{duration:1.5,repeat:Infinity,ease:'linear'}}/>
          {/* Photo hero or compact header — fixed height, shrink-0 */}
          {hasPhoto ? (
            <div className="relative w-full shrink-0 h-[180px]">
              <img src={ace.photo} alt="" className="w-full h-full object-cover rounded-t-2xl"/>
              <div className="absolute inset-0 rounded-t-2xl pointer-events-none" style={{background:'linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 50%)'}}/>
              <div className="absolute bottom-2 left-0 right-0 px-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-black tracking-widest uppercase text-gap-medium">
                  <Trophy size={14} className="text-gap-medium"/>
                  <span>Ace #{totalAces-index}</span>
                </span>
                <span className="ml-3 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-gap-medium/20 text-gap-medium border border-gap-medium/40">{rarity.label}</span>
              </div>
            </div>
          ) : (
            <div className="relative px-3 pt-3 pb-2.5 shrink-0 flex flex-col items-center text-center gap-1.5" style={{background:'linear-gradient(135deg,rgba(255,215,0,0.08),rgba(184,134,11,0.04))'}}>
              <div className="flex items-center justify-between w-full gap-3">
                <div className="inline-flex items-center gap-1.5">
                  <div className="w-8 h-8 rounded-full bg-gap-medium/15 border border-gap-medium/50 flex items-center justify-center">
                    <Trophy size={14} className="text-gap-medium"/>
                  </div>
                  <span className="text-[11px] font-black tracking-widest uppercase text-gap-medium">Ace #{totalAces-index}</span>
                </div>
                <span className="ml-auto text-[9px] font-black px-3 py-0.5 rounded-full bg-gap-medium/20 text-gap-medium border border-gap-medium/50 whitespace-nowrap">{rarity.label}</span>
              </div>
              <h3 className="text-[12px] font-black text-text leading-tight truncate w-full mt-0.5">
                {disc?.custom_name || disc?.mold || 'Unknown Disc'}
              </h3>
              <p className="text-[10px] text-text-muted font-medium truncate w-full">
                {disc?.manufacturer || ''}{disc?.plastic_type ? ` · ${disc.plastic_type}` : ''}
              </p>
              {ace.witnessed && (
                <motion.div initial={{scale:0}} animate={{scale:1}} className="flex items-center gap-1 bg-primary/20 border border-primary/30 rounded-full px-1.5 py-0.5 mt-1">
                  <Shield size={8} className="text-primary" fill="currentColor"/>
                  <span className="text-[9px] font-bold text-primary">VERIFIED</span>
                </motion.div>
              )}
            </div>
          )}
          {hasPhoto && (
            <div className="relative px-3 py-1 flex items-center justify-between shrink-0 border-b border-white/5">
              <span className="text-[10px] font-black text-gap-medium">{rarity.label}</span>
              {ace.witnessed && <span className="text-[9px] font-bold text-primary flex items-center gap-0.5"><Shield size={8} fill="currentColor"/>VERIFIED</span>}
            </div>
          )}
          {/* Stats — scrollable if needed, no flex-1 grow */}
          <div className="px-3 py-2 space-y-1 min-h-0 overflow-y-auto flex-1" style={{minHeight:0}}>
            {ace.distance>0 && (
              <div className="flex justify-center">
                <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-0.5" style={{background:'linear-gradient(135deg,rgba(255,215,0,0.12),rgba(184,134,11,0.06))',border:'1px solid rgba(255,215,0,0.25)'}}>
                  <Ruler size={11} className="text-gap-medium"/>
                  <span className="text-base font-black text-gap-medium">{ace.distance}</span>
                  <span className="text-[10px] text-gap-medium/80 font-bold uppercase">ft</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <MapPin size={10} className="text-gap-medium/70 shrink-0"/>
              <div className="flex-1 min-w-0"><span className="text-[10px] text-text-muted">Course</span><div className="text-xs text-text font-semibold truncate">{ace.course}</div></div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {ace.hole>0 && <div><span className="text-[10px] text-text-muted">Hole</span><div className="text-xs text-text font-bold">#{ace.hole}</div></div>}
              <div><span className="text-[10px] text-text-muted">Date</span><div className="text-xs text-text font-semibold">{fmtD(ace.date)}</div></div>
            </div>
            {ace.witnessNames && <p className="text-[10px] text-gap-medium/90 truncate" title={ace.witnessNames}>Witnessed by: {ace.witnessNames}</p>}
            {ace.notes && <p className="text-[10px] text-text-muted italic line-clamp-2" title={ace.notes}>"{ace.notes}"</p>}
          </div>
          {/* Actions — always visible at bottom */}
          <div className="px-2.5 py-2 flex items-center gap-1.5 shrink-0 border-t border-white/5">
            <button onClick={e=>{e.stopPropagation();onEdit(ace);}} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold bg-surface/80 text-text-muted hover:text-secondary border border-border/50"><Edit3 size={12}/>Edit</button>
            <button onClick={e=>{e.stopPropagation();onDelete(ace.id);}} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-gap-high border border-border/50"><Trash2 size={12}/></button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TrophyRoomModal({open,onClose,aces,discs,onEditAce,onDeleteAce,onLogAce}) {
  const [confirmDelete,setConfirmDelete] = useState(null);
  if (!open) return null;
  const sorted = [...aces].sort((a,b) => b.date.localeCompare(a.date));
  const dm = {}; discs.forEach(d => { dm[d.id] = d; });
  const acesWithDist = aces.filter(a => a.distance>0);
  const longestAce = acesWithDist.length>0 ? acesWithDist.reduce((mx,a)=>a.distance>mx.distance?a:mx, acesWithDist[0]) : null;
  const uniqueCourses = new Set(aces.map(a=>a.course)).size;
  const witnessedCount = aces.filter(a=>a.witnessed).length;

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}/>
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} className="relative w-full max-w-3xl bg-card rounded-t-3xl sm:rounded-2xl border border-border flex flex-col overflow-hidden shadow-card-lg" style={{maxHeight:'92vh'}}>
        {/* Gold bar */}
        <div className="h-1.5 shrink-0" style={{background:'linear-gradient(90deg,#d97706,#fbbf24,#fef08a,#fbbf24,#d97706)'}}/>
        {/* Header */}
        <div className="shrink-0 mb-4 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center relative" style={{background:'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(217,119,6,0.08))',border:'1px solid rgba(251,191,36,0.25)'}}>
                <motion.div animate={{rotate:[0,5,-5,0]}} transition={{duration:4,repeat:Infinity}}><Trophy size={28} className="text-gap-medium"/></motion.div>
                {aces.length>0 && <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-gap-medium text-on-primary text-xs font-black flex items-center justify-center shadow-lg">{aces.length}</span>}
              </div>
              <div>
                <h2 className="text-xl font-black bg-gradient-to-r from-gap-medium via-gap-medium/80 to-gap-medium bg-clip-text text-transparent">Trophy Case</h2>
                <p className="text-xs text-text-muted mt-0.5">{aces.length===0?'Start your legendary collection':'Your legendary ace collection'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aces.length>0 && (
                <button type="button" onClick={e => { e.stopPropagation(); onLogAce?.(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-gap-medium/20 text-gap-medium border border-gap-medium/30 hover:bg-gap-medium/30 transition-all">
                  <Trophy size={14}/>Add an Ace
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-full hover:bg-surface text-text-muted"><X size={20}/></button>
            </div>
          </div>
          {aces.length>0 && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="rounded-xl p-2.5 text-center" style={{background:'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(217,119,6,0.05))',border:'1px solid rgba(251,191,36,0.2)'}}><div className="text-xl font-black text-gap-medium">{aces.length}</div><div className="text-xs text-gap-medium/60 font-medium">Total</div></div>
              <div className="bg-card border border-border rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-text">{uniqueCourses}</div><div className="text-xs text-text-muted">Courses</div></div>
              <div className="bg-card border border-border rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-gap-medium">{longestAce?longestAce.distance+'ft':'—'}</div><div className="text-xs text-text-muted">Longest</div></div>
              <div className="bg-card border border-border rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-primary">{witnessedCount}</div><div className="text-xs text-text-muted">Verified</div></div>
            </div>
          )}
        </div>
        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {/* EMPTY STATE */}
          {sorted.length===0 && (
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} className="flex flex-col items-center justify-center py-16 text-center">
              <motion.div animate={{y:[0,-8,0]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}} className="relative mb-6">
                <AceEmblem size={120}/>
              </motion.div>
              <h3 className="text-xl font-black text-text mb-2">Your first Ace is waiting.</h3>
              <p className="text-sm text-text-muted max-w-xs leading-relaxed mb-6">Log your rounds to start your collection!</p>
              <div className="flex items-center gap-3 mb-6">
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{opacity:[0.2,0.6,0.2],scale:[0.8,1.1,0.8]}} transition={{duration:2,repeat:Infinity,delay:i*0.5}}>
                    <Sparkles size={16} className="text-gap-medium/40"/>
                  </motion.div>
                ))}
              </div>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={e => { e.stopPropagation(); onLogAce?.(); }}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg" style={{background:'linear-gradient(135deg,#d97706,#f59e0b)',color:'#1c1917'}}>
                <Trophy size={16}/>Log Your First Ace
              </motion.button>
            </motion.div>
          )}
          {/* TRADING CARD GRID */}
          {sorted.length>0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {sorted.map((a,i) => (
                <AceTradingCard key={a.id} ace={a} disc={dm[a.discId]} index={i} totalAces={sorted.length}
                  onEdit={onEditAce} onDelete={id=>setConfirmDelete(id)}/>
              ))}
            </div>
          )}
        </div>
        <AnimatePresence>
          {confirmDelete && (
            <ConfirmDialog open title="Delete this Ace?" message="This will permanently remove this ace record." danger confirmLabel="Delete Ace"
              onCancel={() => setConfirmDelete(null)} onConfirm={() => {onDeleteAce(confirmDelete);setConfirmDelete(null);}}/>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// GAP FINDER — reusable helpers for BagDashboard and AddToBagPicker
// ═══════════════════════════════════════════════════════
function computeBagGaps(bagDiscs) {
  const typeCounts = {};
  Object.keys(DT).forEach(t => { typeCounts[t] = bagDiscs.filter(d => d.disc_type === t).length; });
  const g = [];
  const seenKeys = new Set();
  const add = (entry) => {
    if (seenKeys.has(entry.key)) return;
    seenKeys.add(entry.key);
    g.push(entry);
  };
  const typeSuggestions = {
    putter: { suggest: 'Add a putter — essential for short approaches and finishing holes', reasonTag: 'Putter — essential for short approaches and finishing holes', shortSummary: "You're missing a putter" },
    midrange: { suggest: 'Add a midrange — reliable for accurate shots in the 150–300ft range', reasonTag: 'Midrange — reliable for accurate shots in the 150–300ft range', shortSummary: "You're missing a midrange" },
    fairway_driver: { suggest: 'Add a fairway driver — great for controlled distance off the tee', reasonTag: 'Fairway — great for controlled distance off the tee', shortSummary: "You're missing a fairway driver" },
    distance_driver: { suggest: 'Add a distance driver — maximize distance on open holes', reasonTag: 'Distance driver — maximize distance on open holes', shortSummary: "You're missing a distance driver" },
  };
  Object.entries(DT).forEach(([type, cfg]) => {
    if (typeCounts[type] === 0) {
      const ts = typeSuggestions[type] || { suggest: `Add a ${cfg.label.toLowerCase()}`, reasonTag: cfg.label, shortSummary: `You're missing a ${cfg.label.toLowerCase()}` };
      add({ key: `type_${type}`, sev: 'high', msg: `No ${cfg.label}s in this bag`, suggest: ts.suggest, reasonTag: ts.reasonTag, shortSummary: ts.shortSummary, chipLabel: `No ${cfg.label}s`, filterType: 'disc_type', filterValue: type, buySuggestionKey: type === 'fairway_driver' ? 'fairway_driver' : type === 'distance_driver' ? 'distance_driver' : type });
    }
  });
  const bySpeed = [...bagDiscs].sort((a, b) => a.speed - b.speed);
  for (let i = 0; i < bySpeed.length - 1; i++) {
    const low = bySpeed[i];
    const high = bySpeed[i + 1];
    const diff = high.speed - low.speed;
    if (diff >= 3) {
      const minS = low.speed + 1;
      const maxS = high.speed - 1;
      const sev = diff >= 4 ? 'high' : 'medium';
      const lowName = low.custom_name || low.mold;
      const highName = high.custom_name || high.mold;
      add({
        key: `speed_${low.id}_${high.id}`,
        sev,
        msg: `Speed gap between ${lowName} (speed ${low.speed}) and ${highName} (speed ${high.speed})`,
        suggest: `Add a disc in the speed ${minS}–${maxS} range — you're missing coverage between your mids and drivers, leaving a distance gap in your game`,
        reasonTag: `Speed ${minS}–${maxS} gap — bridge the distance between your mids and drivers`,
        shortSummary: `You're missing coverage in the speed ${minS}–${maxS} range`,
        chipLabel: `Speed ${minS}–${maxS} gap`,
        filterType: 'speed_gap',
        filterValue: { minSpeed: minS, maxSpeed: maxS },
        disc1Name: lowName,
        disc2Name: highName,
        buySuggestionKey: maxS <= 5 ? 'speed_4_5' : maxS <= 8 ? 'speed_6_8' : 'speed_9_11',
      });
    }
  }
  SPEED_TIERS.forEach(tier => {
    const inTier = bagDiscs.filter(d => d.speed >= tier.min && d.speed <= tier.max);
    if (inTier.length === 0) return;
    const hasUnder = inTier.some(d => classifyStability(d) === 'understable');
    const hasOver = inTier.some(d => classifyStability(d) === 'overstable');
    const slotName = tier.id === 'putters' ? 'putter' : tier.id === 'mids' ? 'mid' : tier.id === 'fairways' ? 'fairway' : 'driver';
    if (!hasUnder) add({
      key: `stab_${tier.id}_under`,
      sev: 'medium',
      msg: `${tier.label}: no understable option`,
      suggest: `No understable ${slotName} — you're missing a disc that turns right (RHBH) for anhyzer lines and tailwind shots in the speed ${tier.min}–${tier.max} range`,
      reasonTag: `No understable ${slotName} — turns right for anhyzer and tailwind shots`,
      shortSummary: `You're missing an understable ${slotName}`,
      chipLabel: `No understable ${slotName}`,
      filterType: 'stability_slot',
      filterValue: { tier: tier.id, stability: 'understable', minSpeed: tier.min, maxSpeed: tier.max },
      buySuggestionKey: `stability_${tier.id}_understable`,
    });
    if (!hasOver) add({
      key: `stab_${tier.id}_over`,
      sev: 'medium',
      msg: `${tier.label}: no overstable option`,
      suggest: `No overstable ${slotName} — you need a reliable fade disc for headwinds and hard-finishing lines in the speed ${tier.min}–${tier.max} range`,
      reasonTag: `No overstable ${slotName} — reliable fade for headwinds and hard finishes`,
      shortSummary: `You're missing an overstable ${slotName}`,
      chipLabel: `No overstable ${slotName}`,
      filterType: 'stability_slot',
      filterValue: { tier: tier.id, stability: 'overstable', minSpeed: tier.min, maxSpeed: tier.max },
      buySuggestionKey: `stability_${tier.id}_overstable`,
    });
  });
  const overstableApproach = bagDiscs.some(d => d.speed >= 2 && d.speed <= 4 && (d.fade ?? 0) >= 3);
  if (!overstableApproach) add({
    key: 'utility_overstable_approach',
    sev: 'medium',
    msg: 'No overstable approach disc (speed 2–4, fade ≥ 3)',
    suggest: 'Add a Zone, Harp, or similar — overstable approaches give you a reliable fade for upshots that need to sit down fast',
    reasonTag: 'Overstable approach — reliable fade for upshots that sit down',
    shortSummary: "You're missing an overstable approach disc",
    chipLabel: 'No overstable approach',
    filterType: 'utility',
    filterValue: 'overstable_approach',
    buySuggestionKey: 'utility_overstable_approach',
  });
  const turnover = bagDiscs.some(d => d.speed >= 6 && d.speed <= 9 && (d.turn ?? 0) <= -2);
  if (!turnover) add({
    key: 'utility_turnover',
    sev: 'medium',
    msg: 'No understable turnover disc (speed 6–9, turn ≤ -2)',
    suggest: 'Add a Leopard3, Roadrunner, or similar — turnover discs hold anhyzer lines and give you a right-finishing shot (RHBH) when you need it',
    reasonTag: 'Turnover disc — holds anhyzer and finishes right',
    shortSummary: "You're missing a turnover disc",
    chipLabel: 'No turnover disc',
    filterType: 'utility',
    filterValue: 'turnover',
    buySuggestionKey: 'utility_turnover',
  });
  const turn = d => d.turn ?? 0;
  const fade = d => d.fade ?? 0;
  const neutralMid = bagDiscs.some(d => d.speed >= 4 && d.speed <= 6 && turn(d) >= -1 && turn(d) <= 0 && fade(d) >= 0 && fade(d) <= 2);
  if (!neutralMid) add({
    key: 'utility_neutral_mid',
    sev: 'medium',
    msg: 'No straight flying neutral mid (speed 4–6, turn -1 to 0, fade 0–2)',
    suggest: 'Add a Buzzz, Hex, or Mako3 — dead-straight mids go where you aim with minimal fade or turn',
    reasonTag: 'Neutral mid — goes straight with minimal fade or turn',
    shortSummary: "You're missing a neutral mid",
    chipLabel: 'No neutral mid',
    filterType: 'utility',
    filterValue: 'neutral_mid',
    buySuggestionKey: 'utility_neutral_mid',
  });
  const near = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) <= 0.5;
  const sameFlight = (d1, d2) => near(d1.speed, d2.speed) && near(d1.glide, d2.glide) && near(d1.turn, d2.turn) && near(d1.fade, d2.fade);
  const flightStr = (d) => `${d.speed}/${d.glide ?? 0}/${d.turn ?? 0}/${d.fade ?? 0}`;
  const redundantGroups = [];
  const used = new Set();
  bagDiscs.forEach(seed => {
    if (used.has(seed.id)) return;
    const group = [seed];
    const queue = [seed];
    used.add(seed.id);
    while (queue.length) {
      const d2 = queue.shift();
      bagDiscs.forEach(other => {
        if (used.has(other.id) || other.id === d2.id) return;
        if (sameFlight(d2, other)) { group.push(other); used.add(other.id); queue.push(other); }
      });
    }
    if (group.length >= 2) redundantGroups.push(group);
  });
  redundantGroups.forEach((group, idx) => {
    const first = group[0];
    const sharedNumbers = `Speed ${first.speed} / Glide ${first.glide ?? 0} / Turn ${first.turn ?? 0} / Fade ${first.fade ?? 0}`;
    const discList = group.map(d => `${d.custom_name || d.mold} (${flightStr(d)})`).join(' and ');
    const suggest = `These discs have nearly identical flight numbers (${sharedNumbers}). ${discList} overlap — very similar speed, turn, and fade. Consider swapping one for a more understable or overstable option to cover more shot shapes.`;
    add({
      key: `redundancy_${idx}`,
      sev: 'low',
      msg: 'These discs overlap — very similar flight numbers',
      suggest,
      reasonTag: 'Overlap — very similar flight numbers; consider swapping one for versatility',
      chipLabel: 'Overlap',
      filterType: 'redundancy',
      filterValue: group.map(d => d.id),
      discs: group,
      isRedundancy: true,
      buySuggestionKey: 'redundancy',
    });
  });
  return g;
}

// Gap Finder UI: category and severity for grouping, sorting, and styling
const GAP_CATEGORIES = [
  { id: 'missing_types', label: 'Missing Types', severityOrder: 0 },
  { id: 'speed_gaps', label: 'Speed Gaps', severityOrder: 1 },
  { id: 'stability_gaps', label: 'Stability Gaps', severityOrder: 2 },
  { id: 'utility_gaps', label: 'Utility Gaps', severityOrder: 3 },
  { id: 'overlaps', label: 'Overlaps', severityOrder: 4 },
];
const SEVERITY_TIERS = {
  critical:    { order: 0, border: 'border-l-[#B23A3A]', icon: 'text-[#B23A3A]', chip: 'bg-[#B23A3A]/15 border-[#B23A3A]/40 text-[#B23A3A]' },
  recommended: { order: 1, border: 'border-l-[#C08A2E]', icon: 'text-[#C08A2E]', chip: 'bg-[#C08A2E]/15 border-[#C08A2E]/40 text-[#C08A2E]' },
  nice_to_have:{ order: 2, border: 'border-l-[#2563eb]', icon: 'text-[#2563eb]', chip: 'bg-[#2563eb]/15 border-[#2563eb]/40 text-[#2563eb]' },
  info:        { order: 3, border: 'border-l-[#6b7280]', icon: 'text-text-muted', chip: 'bg-surface border-border text-text-muted' },
};
function getGapCategoryAndSeverity(gap) {
  if (gap.filterType === 'disc_type') return { category: 'missing_types', categoryLabel: 'Missing Types', severity: 'critical' };
  if (gap.filterType === 'speed_gap') return { category: 'speed_gaps', categoryLabel: 'Speed Gaps', severity: 'recommended' };
  if (gap.filterType === 'stability_slot') return { category: 'stability_gaps', categoryLabel: 'Stability Gaps', severity: 'recommended' };
  if (gap.filterType === 'utility') {
    const v = gap.filterValue;
    if (v === 'overstable_approach') return { category: 'stability_gaps', categoryLabel: 'Stability Gaps', severity: 'recommended' };
    return { category: 'utility_gaps', categoryLabel: 'Utility Gaps', severity: 'nice_to_have' };
  }
  if (gap.filterType === 'redundancy' || gap.isRedundancy) return { category: 'overlaps', categoryLabel: 'Overlaps', severity: 'info' };
  return { category: 'utility_gaps', categoryLabel: 'Utility Gaps', severity: 'nice_to_have' };
}
function groupGapsByCategory(gaps) {
  const withMeta = gaps.map(g => ({ ...g, ...getGapCategoryAndSeverity(g) }));
  const groups = {};
  withMeta.forEach(g => {
    if (!groups[g.category]) groups[g.category] = { label: g.categoryLabel, gaps: [] };
    groups[g.category].gaps.push(g);
  });
  // Sort within each group by severity (critical → recommended → nice_to_have → info)
  Object.keys(groups).forEach(cat => {
    groups[cat].gaps.sort((a, b) => (SEVERITY_TIERS[a.severity]?.order ?? 4) - (SEVERITY_TIERS[b.severity]?.order ?? 4));
  });
  // Return groups in category order
  return GAP_CATEGORIES.filter(c => groups[c.id]).map(c => ({ id: c.id, label: c.label, gaps: groups[c.id].gaps }));
}

function getLibraryMatchesForGap(gap, allDiscs, bagDiscIds) {
  if (!allDiscs || !bagDiscIds) return [];
  return allDiscs.filter(d => {
    if (bagDiscIds.includes(d.id)) return false;
    if (gap.filterType === 'disc_type') return d.disc_type === gap.filterValue;
    if (gap.filterType === 'stability') return classifyStability(d) === gap.filterValue;
    if (gap.filterType === 'speed_gap') {
      const { minSpeed, maxSpeed } = gap.filterValue || {};
      return d.speed >= minSpeed && d.speed <= maxSpeed;
    }
    if (gap.filterType === 'stability_slot') {
      const { tier, minSpeed, maxSpeed, stability } = gap.filterValue || {};
      if (!tier || !stability) return false;
      const inRange = d.speed >= minSpeed && d.speed <= maxSpeed;
      return inRange && classifyStability(d) === stability;
    }
    if (gap.filterType === 'utility') {
      const v = gap.filterValue;
      if (v === 'overstable_approach') return d.speed >= 2 && d.speed <= 4 && (d.fade ?? 0) >= 3;
      if (v === 'turnover') return d.speed >= 6 && d.speed <= 9 && (d.turn ?? 0) <= -2;
      if (v === 'neutral_mid') return d.speed >= 4 && d.speed <= 6 && (d.turn ?? 0) >= -1 && (d.turn ?? 0) <= 0 && (d.fade ?? 0) >= 0 && (d.fade ?? 0) <= 2;
      return false;
    }
    if (gap.filterType === 'redundancy') return false;
    return false;
  });
}

// ═══════════════════════════════════════════════════════
// BAG DASHBOARD with GAP FINDER
// ═══════════════════════════════════════════════════════
function EditBagModal({ open, bag, onClose, onSave, onDelete }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(BAG_COLORS[0]);
  useEffect(() => { if (open && bag) { setName(bag.name); setColor(bag.bagColor || BAG_COLORS[0]); } }, [open, bag]);
  if (!open || !bag) return null;
  const save = () => { if (name.trim()) onSave(bag.id, { name: name.trim(), bagColor: color }); onClose(); };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="relative w-full max-w-sm bg-bg rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold text-text mb-4">Edit Bag</h2>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Bag name…" onKeyDown={e => e.key === 'Enter' && save()} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary mb-3"/>
        <div className="mb-4"><label className="block text-xs text-text-muted mb-2 font-medium">Color</label><div className="flex flex-wrap gap-2">{BAG_COLORS.map(c => (<button key={c} onClick={() => setColor(c)} className={`w-7 h-7 rounded-full border-2 ${color === c ? 'border-white scale-110' : 'border-border'}`} style={{ backgroundColor: c }}/>))}</div></div>
        <div className="flex gap-2">
          <button type="button" onClick={() => { onDelete(bag.id); onClose(); }} className="py-2.5 px-4 rounded-xl bg-gap-high/10 text-gap-high text-sm font-semibold border border-gap-high/20 hover:bg-gap-high/20">Delete</button>
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold">Cancel</button>
          <button onClick={save} disabled={!name.trim()} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${name.trim() ? 'bg-primary text-on-primary' : 'bg-surface text-text-muted cursor-not-allowed'}`}>Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function BagDashboard({ bagDiscs, bag, allDiscs, onAddToBag, onRemoveFromBag, onBuySearch, discListSlot, onEditBag, onRequestDeleteBag, userSkillLevel, defaultThrowStyle }) {
  const [expandedGap,setExpandedGap] = useState(null);
  const [expandedSkillDiscId, setExpandedSkillDiscId] = useState(null);
  const [skillOverBlockExpanded, setSkillOverBlockExpanded] = useState(false);
  const [gapFilter, setGapFilter] = useState(null);
  const [filterBySkillLevel, setFilterBySkillLevel] = useState(true);

  useEffect(() => {
    if (!skillOverBlockExpanded) setExpandedSkillDiscId(null);
  }, [skillOverBlockExpanded]);
  const totalValue = bagDiscs.reduce((s,d) => s+(d.estimated_value||0), 0);
  const weights = bagDiscs.filter(d=>d.weight_grams>0).map(d=>d.weight_grams);
  const avgWeight = weights.length>0 ? (weights.reduce((a,b)=>a+b,0)/weights.length) : 0;

  const typeCounts = useMemo(() => {
    const c = {}; Object.keys(DT).forEach(t => { c[t] = bagDiscs.filter(d=>d.disc_type===t).length; }); return c;
  }, [bagDiscs]);

  const stabCounts = useMemo(() => {
    const c = {understable:0,stable:0,overstable:0};
    bagDiscs.forEach(d => { c[classifyStability(d)]++; }); return c;
  }, [bagDiscs]);

  const bagDiscIds = useMemo(() => bagDiscs.map(d => d.id), [bagDiscs]);

  const gaps = useMemo(() => computeBagGaps(bagDiscs), [bagDiscs]);
  const groupedGaps = useMemo(() => groupGapsByCategory(gaps), [gaps]);
  const skillRange = useMemo(() => getSkillSpeedRange(userSkillLevel), [userSkillLevel]);
  const flaggedOverSkill = useMemo(() => {
    if (!filterBySkillLevel) return [];
    return bagDiscs.filter((d) => !isDiscInSkillRange(d, skillRange));
  }, [bagDiscs, filterBySkillLevel, skillRange]);
  const categoryCounts = useMemo(() => {
    const c = { all: gaps.length };
    groupedGaps.forEach(grp => { c[grp.id] = grp.gaps.length; });
    return c;
  }, [gaps.length, groupedGaps]);
  const filteredGroups = useMemo(() => {
    if (gapFilter === null) return [];
    if (gapFilter === 'all') return groupedGaps;
    return groupedGaps.filter(grp => grp.id === gapFilter);
  }, [groupedGaps, gapFilter]);

  const gapFinderTheme = useMemo(() => {
    if (gaps.length === 0) return { isRed: false, bg: 'transparent', border: 'transparent', accent: '#C08A2E', label: 'text-gap-medium' };
    const hasCritical = gaps.some(g => (getGapCategoryAndSeverity(g).severity === 'critical'));
    const useRed = hasCritical || gaps.length >= 5;
    if (useRed) {
      return {
        isRed: true,
        bg: 'rgba(178, 58, 58, 0.06)',
        border: 'rgba(178, 58, 58, 0.25)',
        accent: '#B23A3A',
        label: 'text-[#B23A3A]',
      };
    }
    return {
      isRed: false,
      bg: 'rgba(255, 160, 50, 0.05)',
      border: 'rgba(192, 138, 46, 0.3)',
      accent: '#C08A2E',
      label: 'text-gap-medium',
    };
  }, [gaps]);

  const hasSkillOverChip = filterBySkillLevel && flaggedOverSkill.length > 0;
  const gapFinderPanelOpen = gapFilter !== null && gaps.length > 0;
  useEffect(() => {
    if (gapFinderPanelOpen) {
      track.gapFinderOpened({
        gap_count: gaps.length,
        bag_id: bag?.id,
        bag_name: bag?.name,
      });
    }
  }, [gapFinderPanelOpen]);

  useEffect(() => {
    if (gaps.length > 0) {
      track.gapFinderCompleted({
        gap_count: gaps.length,
        bag_id: bag?.id,
        bag_name: bag?.name,
      });
    }
  }, [gaps.length]);
  const isRecAboveSkillSpeed = useCallback((d) => {
    const sp = Number(d?.speed);
    if (!Number.isFinite(sp)) return false;
    return sp > skillRange.max;
  }, [skillRange.max]);

  const getLibraryMatches = useCallback((gap) => getLibraryMatchesForGap(gap, allDiscs, bagDiscIds), [allDiscs, bagDiscIds]);

  const getBuySuggestions = useCallback((gap) => {
    const key = gap.buySuggestionKey ?? (gap.filterType === 'disc_type' || gap.filterType === 'stability' ? gap.filterValue : null);
    if (key && BUY_SUGGESTIONS[key]) return BUY_SUGGESTIONS[key];
    if (gap.filterType === 'speed_gap' && gap.filterValue) {
      const { minSpeed, maxSpeed } = gap.filterValue;
      const k = maxSpeed <= 5 ? 'speed_4_5' : maxSpeed <= 8 ? 'speed_6_8' : 'speed_9_11';
      return BUY_SUGGESTIONS[k] || [];
    }
    return [];
  }, []);

  if (bagDiscs.length===0) return null;
  const maxTC = Math.max(...Object.values(typeCounts),1);
  const maxSC = Math.max(...Object.values(stabCounts),1);
  const avgSpeed = bagDiscs.length ? (bagDiscs.reduce((s,d)=>s+d.speed,0)/bagDiscs.length).toFixed(1) : '—';
  const speedRange = bagDiscs.length ? `${Math.min(...bagDiscs.map(d=>d.speed))}–${Math.max(...bagDiscs.map(d=>d.speed))}` : '—';
  const bagColor = bag?.bagColor || '#6b7280';

  return (
    <>
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-4 mb-6">
      {/* Bag name + disc count + actions */}
      <div className="flex items-center gap-2.5">
        <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:bagColor}}/>
        <h2 className="text-lg font-bold text-text truncate">{bag?.name || 'My Bag'}</h2>
        <span className="text-sm font-semibold text-text-muted tabular-nums shrink-0">{bagDiscs.length} disc{bagDiscs.length !== 1 ? 's' : ''}</span>
        {onEditBag && (
          <button onClick={() => onEditBag(bag)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 shrink-0" aria-label="Edit bag"><Edit3 size={14}/></button>
        )}
        {onRequestDeleteBag && (
          <button onClick={() => onRequestDeleteBag(bag?.id)} className="p-1.5 rounded-lg text-text-muted hover:text-gap-high hover:bg-gap-high/10 shrink-0" aria-label="Delete bag"><Trash2 size={14}/></button>
        )}
      </div>

      {/* Summary stats — left: Gap Finder + gap details (unified when expanded); right: 2x2 stat cards */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:min-h-0">
        <div
          className={`min-w-0 sm:flex-[1.4] self-stretch flex flex-col ${gapFinderPanelOpen ? 'overflow-hidden shadow-card' : ''}`}
          style={gapFinderPanelOpen ? {
            backgroundColor: gapFinderTheme.bg === 'transparent' ? 'rgba(255, 160, 50, 0.05)' : gapFinderTheme.bg,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: gapFinderTheme.border === 'transparent' ? 'rgba(192, 138, 46, 0.25)' : gapFinderTheme.border,
            borderRadius: '0.75rem',
          } : undefined}
        >
          <div
            className={`p-4 flex flex-col min-w-0 min-h-0 ${gapFinderPanelOpen ? 'rounded-t-xl rounded-b-none border-0 flex-none' : 'rounded-xl shadow-card flex-1'}`}
            style={gapFilter === null || (gaps.length === 0 && !hasSkillOverChip) ? {
              backgroundColor: gapFinderTheme.bg === 'transparent' ? 'rgba(255, 160, 50, 0.05)' : gapFinderTheme.bg,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: gapFinderTheme.border === 'transparent' ? 'rgba(192, 138, 46, 0.25)' : gapFinderTheme.border,
            } : undefined}
          >
            <div className={`flex items-center gap-2 mb-1 ${gapFinderTheme.label}`}><AlertTriangle size={14} className="shrink-0"/><span className="text-xs font-bold uppercase tracking-wider opacity-90">Gap Finder</span></div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-[11px] text-text-muted">Filter by my skill level</span>
              <button
                type="button"
                role="switch"
                aria-checked={filterBySkillLevel}
                onClick={() => setFilterBySkillLevel((v) => !v)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${filterBySkillLevel ? 'bg-primary/90' : 'bg-border'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${filterBySkillLevel ? 'translate-x-4' : 'translate-x-0'}`}
                  aria-hidden
                />
              </button>
            </div>
            {hasSkillOverChip && (
              <div className="mt-2 mb-3 rounded-lg border border-primary/20 bg-primary/5 dark:bg-primary/10 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setSkillOverBlockExpanded((v) => !v)}
                  className="no-hover-scale w-full flex items-center gap-2 text-left py-1.5 min-h-[36px] cursor-pointer bg-transparent hover:bg-surface/60 transition-colors duration-150 rounded-md -mx-0.5 px-0.5"
                  aria-expanded={skillOverBlockExpanded}
                >
                  <span className="text-[12px] leading-none shrink-0" aria-hidden>⚠️</span>
                  <span className="text-[11px] font-bold text-text flex-1 min-w-0">Discs above your skill level ({flaggedOverSkill.length})</span>
                  <ChevronDown size={14} className={`shrink-0 text-text-muted transition-transform duration-200 ${skillOverBlockExpanded ? 'rotate-180' : ''}`} aria-hidden />
                </button>
                {skillOverBlockExpanded && (
                  <div className="mt-2 pt-2 border-t border-border/50 space-y-2.5">
                    <div className="rounded-xl border border-border bg-amber-50 dark:bg-amber-950/25 px-3 py-3 text-text shadow-sm">
                      <GlossaryBody as="p" className="text-xs leading-relaxed text-text">
                        {`These discs are outside the typical speed range for ${skillLevelDisplayLabel(userSkillLevel)} players. You can still throw them — many players bag one "challenge" disc — but slower discs in a similar role are often easier to control while you build form.`}
                      </GlossaryBody>
                    </div>
                    <div className="space-y-1.5">
                      {flaggedOverSkill.map((fd) => {
                        const isSkillExp = expandedSkillDiscId === fd.id;
                        const libRep = findLibraryReplacementsForFlag(fd, allDiscs, bagDiscIds, skillRange);
                        const moldRep = findMoldReplacementSuggestions(fd, skillRange);
                        return (
                          <div key={fd.id} className="rounded-lg border border-border bg-card border-l-4 border-l-[#C08A2E]/80">
                            <button
                              type="button"
                              onClick={() => setExpandedSkillDiscId(isSkillExp ? null : fd.id)}
                              className="no-hover-scale w-full flex items-center gap-2 text-left py-2 px-3 min-h-[40px] cursor-pointer bg-transparent hover:bg-surface/80 transition-colors duration-150 rounded-lg"
                            >
                              <span className="text-[13px] leading-none shrink-0" aria-hidden>⚠️</span>
                              <span className="text-xs font-bold text-text flex-1 min-w-0 truncate">
                                {fd.custom_name || fd.mold} · Speed {fd.speed}
                              </span>
                              <ChevronDown size={14} className={`shrink-0 text-text-muted transition-transform duration-200 ${isSkillExp ? 'rotate-180' : ''}`} aria-hidden />
                            </button>
                            <AnimatePresence>
                              {isSkillExp && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                  <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border/50 bg-surface/30" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center gap-2 bg-surface/60 rounded-lg px-2.5 py-2 border-2 border-red-500/50 dark:border-red-400/45 ring-1 ring-red-500/15 dark:ring-red-400/20">
                                      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center shadow-md border border-red-500/30" style={{ backgroundColor: fd.color || '#6b7280' }}>
                                        <span className="text-[10px] font-black" style={{ color: luma(fd.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{fd.speed}</span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <span className="text-xs font-bold text-text truncate block">{fd.custom_name || fd.mold}</span>
                                        <span className="text-[10px] text-text-muted">{[fd.manufacturer, fd.plastic_type || fd.plastic].filter(Boolean).join(' · ')}</span>
                                        <div className="text-[10px] font-semibold text-text tabular-nums tracking-tight mt-0.5">{fmtDiscFlightLine(fd)}</div>
                                        <GlossaryBody as="p" className="text-[11px] text-text mt-1 leading-snug">{explainDiscOutsideSkillRange(fd, skillRange, userSkillLevel)}</GlossaryBody>
                                      </div>
                                    </div>
                                    {libRep.length > 0 && (
                                      <div>
                                        <h5 className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5"><Library size={11}/>From your library</h5>
                                        <div className="space-y-1">
                                          {libRep.map((d) => (
                                            <div key={d.id} className="flex items-center gap-2 bg-surface/60 rounded-lg px-2.5 py-2">
                                              <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{ backgroundColor: d.color || '#6b7280' }}>
                                                <span className="text-[10px] font-black" style={{ color: luma(d.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{d.speed}</span>
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                <span className="text-xs font-bold text-text truncate block">{d.custom_name || d.mold}</span>
                                                <span className="text-[10px] text-text-muted">{[d.manufacturer, d.plastic_type || d.plastic].filter(Boolean).join(' · ')}</span>
                                                <div className="text-[10px] font-semibold text-text tabular-nums tracking-tight mt-0.5">{fmtDiscFlightLine(d)}</div>
                                              </div>
                                              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onAddToBag(bag.id, d.id)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold border border-primary/25"><Plus size={12}/>Add</motion.button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {moldRep.length > 0 && onBuySearch && (
                                      <div>
                                        <h5 className="flex items-center gap-1.5 text-[10px] font-bold text-gap-medium uppercase tracking-wider mb-1.5"><ShoppingCart size={11}/>Discs to consider buying</h5>
                                        <div className="space-y-1">
                                          {moldRep.map((s, si) => {
                                            const flightLine = fmtSuggestionFlightLine(s);
                                            return (
                                              <div key={`${s.mold}-${si}`} className="flex flex-wrap items-center gap-x-2 gap-y-1.5 bg-surface/40 rounded-lg px-2.5 py-2">
                                                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{ backgroundColor: s.color || '#6b7280' }}>
                                                  <span className="text-[10px] font-black" style={{ color: luma(s.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{s.speed}</span>
                                                </div>
                                                <div className="flex-1 min-w-0 basis-[min(100%,10rem)]">
                                                  <div className="text-xs font-bold text-text truncate">{s.mold}</div>
                                                  <div className="text-[10px] text-text-muted truncate">{s.manufacturer} · {s.plastic}</div>
                                                  <div className="text-[10px] font-semibold text-text tabular-nums tracking-tight mt-0.5">{flightLine}</div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0 ml-auto">
                                                  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onBuySearch(s)} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gap-medium/12 text-gap-medium text-xs font-semibold border border-gap-medium/20"><ShoppingCart size={10}/>Shop</motion.button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className={`text-2xl font-black ${gapFinderTheme.label}`}>{gaps.length}<span className="text-sm font-semibold opacity-80 ml-0.5">gaps</span></div>
            {gaps.length > 0 && (
              <div className="flex flex-nowrap gap-1.5 mt-3 pt-2 border-t border-border/40 overflow-x-auto pb-0.5 -mx-0.5 min-h-[32px] items-center">
                <button type="button" onClick={() => setGapFilter(prev => prev === 'all' ? null : 'all')} className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${gapFilter === 'all' ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-border text-text-muted hover:text-text'}`}>
                  All ({categoryCounts.all})
                </button>
                {groupedGaps.map(grp => (
                  <button key={grp.id} type="button" onClick={() => setGapFilter(prev => prev === grp.id ? null : grp.id)} className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors ${gapFilter === grp.id ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-border text-text-muted hover:text-text'}`}>
                    {grp.id === 'missing_types' ? 'Missing' : grp.id === 'overlaps' ? 'Overlap' : grp.label.replace(/\s+Gaps?$/, '')} ({grp.gaps.length})
                </button>
                ))}
              </div>
            )}
          </div>
          {gaps.length > 0 && (
            <AnimatePresence>
              {gapFinderPanelOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden rounded-b-xl flex-1 min-h-0" style={{ backgroundColor: gapFinderTheme.isRed ? 'rgba(178, 58, 58, 0.08)' : 'rgba(255, 160, 50, 0.07)' }}>
                  <div className="px-4 pb-4 pt-3 border-t border-gap-medium/30">
                    <div className="space-y-4">
                      {filteredGroups.map(grp => (
                        <div key={grp.id} className="space-y-1.5">
                          <h4 className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{grp.label} ({grp.gaps.length})</h4>
                          <div className="space-y-1.5">
                            {grp.gaps.map(g => {
                              const isExp = expandedGap === g.key;
                              const rawLib = getLibraryMatches(g);
                              const libraryMatches = rawLib;
                              const rawBuy = getBuySuggestions(g);
                              const buySuggestions = rawBuy;
                              const tier = SEVERITY_TIERS[g.severity] || SEVERITY_TIERS.info;
                              const IconComponent = g.isRedundancy ? Info : AlertTriangle;
                              return (
                                <div key={g.key} className={`rounded-lg border border-border bg-card border-l-4 ${tier.border}`} style={{ borderLeftWidth: 4 }}>
                                  <button type="button" onClick={() => setExpandedGap(isExp ? null : g.key)} className="no-hover-scale w-full flex items-center gap-2 text-left py-2 px-3 min-h-[40px] cursor-pointer bg-transparent hover:bg-surface/80 transition-colors duration-150 rounded-lg">
                                    <IconComponent size={14} className={`shrink-0 ${tier.icon}`} aria-hidden/>
                                    <span className="text-xs font-bold text-text flex-1 min-w-0 truncate">{g.msg}</span>
                                    <ChevronDown size={14} className={`shrink-0 text-text-muted transition-transform duration-200 ${isExp ? 'rotate-180' : ''}`} aria-hidden/>
                                  </button>
                                  <AnimatePresence>
                                    {isExp && (
                                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                                        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-border/50 bg-surface/30" onClick={e => e.stopPropagation()}>
                                          {g.isRedundancy && g.discs ? (
                                            <>
                                              <div className="flex gap-4 flex-wrap">
                                                {g.discs.map(d => (
                                                  <div key={d.id} className="flex items-center gap-2 min-w-0 flex-1 basis-0">
                                                    <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-md border-2 border-border" style={{ backgroundColor: d.color || '#6b7280' }}>
                                                      <span className="text-xs font-black" style={{ color: luma(d.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{d.speed}</span>
                                                    </div>
                                                    <div className="min-w-0">
                                                      <p className="text-sm font-bold text-text truncate">{d.custom_name || d.mold}</p>
                                                      <p className="text-[11px] text-text-muted truncate">{[d.manufacturer, d.plastic_type ?? d.plastic ?? ''].filter(Boolean).join(' · ')}</p>
                                                      <p className="text-xs font-semibold text-text tabular-nums tracking-tight mt-0.5">{fmtDiscFlightLine(d)}</p>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                              <GlossaryBody as="p" className="text-[11px] text-text-muted italic">Consider swapping one for a different stability to cover more shot shapes.</GlossaryBody>
                                            </>
                                          ) : (
                                            <>
                                              <GlossaryBody as="p" className="text-xs text-text-muted">{g.suggest}</GlossaryBody>
                                              {libraryMatches.length > 0 && (
                                                <div>
                                                  <h5 className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5"><Library size={11}/>From Your Collection ({libraryMatches.length})</h5>
                                                  <div className="space-y-1">
                                                    {libraryMatches.slice(0, 4).map(d => (
                                                      <div key={d.id} className="flex flex-col gap-2 bg-surface/60 rounded-lg px-2.5 py-2">
                                                        <div className="flex items-start gap-2">
                                                          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{ backgroundColor: d.color || '#6b7280' }}>
                                                            <span className="text-[10px] font-black" style={{ color: luma(d.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{d.speed}</span>
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <span className="text-xs font-bold text-text truncate block">{d.custom_name || d.mold}</span>
                                                            <span className="text-[10px] text-text-muted">{[d.manufacturer, d.plastic_type || d.plastic].filter(Boolean).join(' · ')}</span>
                                                            <div className="text-[10px] font-semibold text-text tabular-nums tracking-tight mt-0.5">{fmtDiscFlightLine(d)}</div>
                                                          </div>
                                                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onAddToBag(bag.id, d.id)} className="flex shrink-0 items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold border border-primary/25"><Plus size={12}/>Add</motion.button>
                                                        </div>
                                                        {filterBySkillLevel && isRecAboveSkillSpeed(d) && (
                                                          <div className="w-full min-w-0 rounded-md border border-amber-600/35 bg-amber-100 px-2.5 py-2 text-[10px] font-medium leading-snug text-neutral-900 shadow-sm dark:border-amber-500/50 dark:bg-amber-200/95 dark:text-neutral-950">
                                                            <span aria-hidden className="mr-1">⚠️</span>
                                                            <GlossaryBody>{explainDiscOutsideSkillRange(d, skillRange, userSkillLevel)}</GlossaryBody>
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                              {libraryMatches.length === 0 && (
                                                <div className="flex items-center gap-2 bg-surface/40 rounded-lg px-2.5 py-2">
                                                  <Library size={12} className="text-text-muted shrink-0"/><span className="text-[10px] text-text-muted">No matching discs in your collection</span>
                                                </div>
                                              )}
                                              {buySuggestions.length > 0 && (
                                                <div>
                                                  <h5 className="flex items-center gap-1.5 text-[10px] font-bold text-gap-medium uppercase tracking-wider mb-1.5"><ShoppingCart size={11}/>Popular Picks to Buy</h5>
                                                  <div className="space-y-1">
                                                    {buySuggestions.map((s, si) => (
                                                      <div key={si} className="flex flex-col gap-2 bg-surface/40 rounded-lg px-2.5 py-2">
                                                        <div className="flex items-start gap-2">
                                                          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{ backgroundColor: s.color || '#6b7280' }}>
                                                            <span className="text-[10px] font-black" style={{ color: luma(s.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{s.speed}</span>
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-text truncate">{s.mold}</div>
                                                            <div className="text-[10px] text-text-muted">{s.manufacturer} · {s.plastic}</div>
                                                            <div className="text-[10px] font-semibold text-text tabular-nums tracking-tight mt-0.5">{fmtSuggestionFlightLine(s)}</div>
                                                          </div>
                                                          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => onBuySearch(s)} className="flex shrink-0 items-center gap-1 px-2 py-1 rounded-lg bg-gap-medium/12 text-gap-medium text-xs font-semibold border border-gap-medium/20"><ShoppingCart size={10}/>Shop</motion.button>
                                                        </div>
                                                        {filterBySkillLevel && isRecAboveSkillSpeed(s) && (
                                                          <div className="w-full min-w-0 rounded-md border border-amber-600/35 bg-amber-100 px-2.5 py-2 text-[10px] font-medium leading-snug text-neutral-900 shadow-sm dark:border-amber-500/50 dark:bg-amber-200/95 dark:text-neutral-950">
                                                            <span aria-hidden className="mr-1">⚠️</span>
                                                            <GlossaryBody>{explainDiscOutsideSkillRange(s, skillRange, userSkillLevel)}</GlossaryBody>
                                                          </div>
                                                        )}
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
        <div className="flex flex-col min-w-0 sm:flex-1 h-full">
          <div className="grid grid-cols-2 grid-rows-[1fr_1fr] gap-2 flex-1 min-h-0">
          <div className="bg-card rounded-xl p-3 border border-border shadow-card min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5"><BarChart3 size={12} className="text-gap-medium shrink-0"/><span className="text-[10px] text-gap-medium/80 font-bold uppercase tracking-wider">Avg Speed</span></div>
            <div className="text-lg font-black text-gap-medium">{(bagDiscs.reduce((s,d)=>s+d.speed,0)/bagDiscs.length).toFixed(1)}</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border shadow-card min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5"><Zap size={12} className="text-secondary shrink-0"/><span className="text-[10px] text-secondary/80 font-bold uppercase tracking-wider">Avg Weight</span></div>
            <div className="text-lg font-black text-secondary">{avgWeight.toFixed(1)}<span className="text-xs text-text-muted">g</span></div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border shadow-card min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5"><Crosshair size={12} className="text-gap-low shrink-0"/><span className="text-[10px] text-gap-low/80 font-bold uppercase tracking-wider">Speed Range</span></div>
            <div className="text-lg font-black text-gap-low">{Math.min(...bagDiscs.map(d=>d.speed))}–{Math.max(...bagDiscs.map(d=>d.speed))}</div>
          </div>
          <div className="bg-card rounded-xl p-3 border border-border shadow-card min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-0.5"><DollarSign size={12} className="text-gap-medium shrink-0"/><span className="text-[10px] text-gap-medium/80 font-bold uppercase tracking-wider">Bag Value</span></div>
            <div className="text-lg font-black text-gap-medium tabular-nums">${Math.round(totalValue)}</div>
          </div>
          </div>
        </div>
      </div>
      {/* Type Breakdown | Stability Spectrum — side by side, stack on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-card rounded-xl p-4 border border-border shadow-card">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-3"><BarChart3 size={12}/>Type Breakdown</h3>
          <div className="space-y-2.5">
            {Object.entries(DT).map(([k,cfg]) => {
              const ct = typeCounts[k]; const pct = maxTC>0?(ct/maxTC)*100:0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor:cfg.color}}/><span className="text-xs text-text-muted font-medium">{cfg.label}s</span></div>
                    <span className={`text-sm font-black ${ct===0?'text-text-muted':cfg.text}`}>{ct}</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.6}} className="h-full rounded-full" style={{backgroundColor:cfg.color,opacity:ct===0?0.2:0.7}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-card rounded-xl p-4 border border-border shadow-card">
          <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-3"><Crosshair size={12}/>Stability Spectrum</h3>
          <div className="space-y-2.5">
            {Object.entries(STAB_META).map(([k,meta]) => {
              const ct = stabCounts[k]; const pct = maxSC>0?(ct/maxSC)*100:0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><span className="text-sm">{meta.icon}</span><span className="text-xs text-text-muted font-medium">{meta.label}</span></div>
                    <span className={`text-sm font-black ${ct===0?'text-text-muted':meta.text}`}>{ct}</span>
                  </div>
                  <div className="h-2 bg-surface rounded-full overflow-hidden">
                    <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.6}} className="h-full rounded-full" style={{backgroundColor:meta.color,opacity:ct===0?0.2:0.7}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Discs in the bag */}
      {discListSlot}
      {/* Flight Chart — mobile-first (see components/FlightChart.jsx) */}
      <div className="min-w-0 flex justify-center w-full px-2 sm:px-0">
        {bagDiscs.length > 0 && (
          <FlightChart bagDiscs={bagDiscs} defaultSkillLevel={normalizeSkillLevel(userSkillLevel) ?? 'intermediate'} defaultThrowStyle={normalizeThrowStyle(defaultThrowStyle) ?? 'rhbh'} />
        )}
      </div>
    </motion.div>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// CREATE BAG MODAL & MY BAGS GRID PAGE
// ═══════════════════════════════════════════════════════
function CreateBagModal({ open, onClose, onCreate }) {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(BAG_COLORS[0]);
  useEffect(() => { if (open) { setNewName(''); setNewColor(BAG_COLORS[0]); } }, [open]);
  const create = () => { if (!newName.trim()) return; onCreate({ name: newName.trim(), bagColor: newColor }); onClose(); };
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="relative w-full max-w-sm bg-bg rounded-2xl border border-border p-5">
        <h2 className="text-lg font-bold text-text mb-4">New Bag</h2>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Bag name…" onKeyDown={e => e.key === 'Enter' && create()} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary mb-3"/>
        <div className="mb-4"><label className="block text-xs text-text-muted mb-2 font-medium">Color</label><div className="flex flex-wrap gap-2">{BAG_COLORS.map(c => (<button key={c} onClick={() => setNewColor(c)} className={`w-7 h-7 rounded-full border-2 ${newColor === c ? 'border-white scale-110' : 'border-border'}`} style={{ backgroundColor: c }}/>))}</div></div>
        <div className="flex gap-2"><button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold">Cancel</button><button onClick={create} disabled={!newName.trim()} className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${newName.trim() ? 'bg-primary text-on-primary' : 'bg-surface text-text-muted cursor-not-allowed'}`}>Create</button></div>
      </motion.div>
    </motion.div>
  );
}

function MyBagsGridPage({ bags, discs, onSelectBag, onCreateBag }) {
  const [createOpen, setCreateOpen] = useState(false);
  const typeCountsForBag = (bag) => {
    const bd = discs.filter(d => discBelongsToBagView(d, bag));
    const c = {}; Object.keys(DT).forEach(t => { c[t] = bd.filter(d => d.disc_type === t).length; }); return c;
  };
  return (
    <div className="pb-24">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bags.map(bag => {
          const bd = discs.filter(d => discBelongsToBagView(d, bag));
          const tc = typeCountsForBag(bag);
          const bc = bag.bagColor || '#6b7280';
          const drivers = (tc.fairway_driver || 0) + (tc.distance_driver || 0);
          const mids = tc.midrange || 0;
          const putters = tc.putter || 0;
          return (
            <motion.button key={bag.id} type="button" onClick={() => onSelectBag(bag.id)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 transition-colors text-left shadow-card">
              <div className="h-2" style={{ backgroundColor: bc }}/>
              <div className="p-4 flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-surface/80" style={{ border: `2px solid ${bc}40` }}>
                  <Backpack size={24} className="text-text-muted" style={{ color: bc }}/>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-text truncate">{bag.name}</h3>
                  <p className="text-sm text-text-muted mt-0.5">{bd.length} disc{bd.length !== 1 ? 's' : ''}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2 text-xs">
                    {putters > 0 && <span className="px-2 py-0.5 rounded-full bg-secondary/15 text-secondary border border-secondary/30">{putters} putter{putters !== 1 ? 's' : ''}</span>}
                    {mids > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">{mids} mid{mids !== 1 ? 's' : ''}</span>}
                    {drivers > 0 && <span className="px-2 py-0.5 rounded-full bg-gap-medium/15 text-gap-medium border border-gap-medium/30">{drivers} driver{drivers !== 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>
            </motion.button>
          );
        })}
        <motion.button type="button" onClick={() => setCreateOpen(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="bg-card/60 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center min-h-[120px] text-text-muted hover:text-primary transition-colors">
          <Plus size={28} className="mb-2"/>
          <span className="text-sm font-semibold">Add New Bag</span>
        </motion.button>
      </div>
      <AnimatePresence>{createOpen && <CreateBagModal open onClose={() => setCreateOpen(false)} onCreate={onCreateBag}/>}</AnimatePresence>
    </div>
  );
}

function RoundsPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center mb-4"><Calendar size={36} className="text-text-muted"/></div>
      <h2 className="text-xl font-bold text-text mb-2">Rounds</h2>
      <p className="text-text-muted text-sm">Round tracking coming soon</p>
    </div>
  );
}

// ── HALL OF FAME: Achievement category cards + trading cards ──
const HOF_CATEGORIES = [
  { id: 'tournaments', label: 'Tournaments', icon: Award, count: (a,t,lt,pb) => t.length, accent: 'from-secondary/20 to-secondary/10 border-secondary/30' },
  { id: 'longest', label: 'Longest Throw', icon: Target, count: (a,t,lt,pb) => lt.length, accent: 'from-gap-high/20 to-gap-high/10 border-gap-high/30' },
  { id: 'pbs', label: 'Personal Bests', icon: Star, count: (a,t,lt,pb) => pb.length, accent: 'from-gap-low/20 to-gap-low/10 border-gap-low/30' },
];

function AchievementCardWrapper({ children, rarity, index, aspectRatio = 'aspect-[2.5/3.5]' }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: index * 0.04 }} className={`relative group h-full min-h-0 flex ${aspectRatio}`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <motion.div className="absolute -inset-0.5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-md" style={{ background: rarity.border }}/>
      <motion.div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden transition-shadow duration-300" style={{ padding: '1.5px', background: rarity.border }} whileHover={{ scale: 1.02, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)' }} whileTap={{ scale: 0.99 }}>
        <div className="h-full min-h-0 w-full rounded-xl bg-bg overflow-hidden relative flex flex-col">
          <motion.div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" style={{ zIndex: 2, background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,0.04) 50%,transparent 60%)', backgroundSize: '200% 100%' }} animate={hovered ? { backgroundPosition: ['100% 0', '-100% 0'] } : {}} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}/>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TournamentFormModal({ open, tournament, onClose, onSave, onDelete, uploadImage }) {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [course, setCourse] = useState('');
  const [division, setDivision] = useState('');
  const [placement, setPlacement] = useState('');
  const [numberOfPlayers, setNumberOfPlayers] = useState('');
  const [numberOfTeams, setNumberOfTeams] = useState('');
  const [tournamentType, setTournamentType] = useState('singles'); // 'singles' | 'doubles'
  const [partnerName, setPartnerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [rounds, setRounds] = useState('');
  const [withWho, setWithWho] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (open) {
      if (tournament) {
        setName(tournament.name || '');
        setDate(tournament.date || '');
        setCourse(tournament.course || '');
        setDivision(tournament.division || '');
        setPlacement(String(tournament.placement ?? ''));
        setNumberOfPlayers(String(tournament.numberOfPlayers ?? ''));
        setNumberOfTeams(String(tournament.numberOfTeams ?? ''));
        setTournamentType(tournament.type === 'doubles' ? 'doubles' : 'singles');
        setPartnerName(tournament.partnerName || '');
        setTeamName(tournament.teamName || '');
        setRounds(tournament.rounds != null ? String(tournament.rounds) : '');
        setWithWho(tournament.withWho || '');
        setNotes(tournament.notes || '');
        setPhoto(tournament.photo || null);
      } else {
        setName('');
        setDate(td());
        setCourse('');
        setDivision('');
        setPlacement('');
        setNumberOfPlayers('');
        setNumberOfTeams('');
        setTournamentType('singles');
        setPartnerName('');
        setTeamName('');
        setRounds('');
        setWithWho('');
        setNotes('');
        setPhoto(null);
      }
    }
  }, [open, tournament]);
  const save = () => {
    const p = parseInt(placement, 10);
    const placementValue = isNaN(p) ? (tournament?.placement ?? 1) : p;
    const players = parseInt(numberOfPlayers, 10);
    const teams = parseInt(numberOfTeams, 10);
    const roundsNum = parseInt(rounds, 10);

    const base = tournament ? { ...tournament } : { id: `t${Date.now()}` };
    const payload = {
      ...base,
      name,
      date,
      course,
      division,
      placement: placementValue,
      type: tournamentType,
      numberOfPlayers: tournamentType === 'singles' ? (isNaN(players) ? 0 : players) : (base.numberOfPlayers ?? 0),
      numberOfTeams: tournamentType === 'doubles' ? (isNaN(teams) ? 0 : teams) : (base.numberOfTeams ?? 0),
      partnerName: tournamentType === 'doubles' ? partnerName.trim() : '',
      teamName: tournamentType === 'doubles' ? teamName.trim() : '',
      rounds: isNaN(roundsNum) ? 0 : Math.max(0, roundsNum),
      withWho: withWho.trim(),
      notes,
    };
    if (photo != null) payload.photo = photo;
    onSave(payload);
    onClose();
  };
  const handlePhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    e.target.value = '';
    try {
      let photoValue = null;
      if (uploadImage) {
        photoValue = await uploadImage(f, 'tournaments');
      } else {
        photoValue = await compressImageFileToDataUrl(f);
      }
      if (photoValue) setPhoto(photoValue);
    } catch (err) {
      console.warn('[TournamentFormModal] failed to process photo', err);
    }
  };
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="relative w-full max-w-md bg-bg rounded-2xl border border-border p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-text mb-4">{tournament ? 'Edit Tournament' : 'Add Tournament'}</h2>
        <div className="mb-3">
          <label className="block text-xs text-text-muted font-medium mb-1.5">Photo</label>
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:border-secondary/40 cursor-pointer w-full">
            <Camera size={16} className="text-text-muted"/>
            <span className="text-sm text-text-muted">{photo ? 'Change photo' : 'Add Photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto}/>
          </label>
          {photo && (
            <div className="mt-2 flex items-center gap-2">
              <img src={photo} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border"/>
              <button type="button" onClick={()=>setPhoto(null)} className="text-xs text-gap-high hover:text-red-300 font-semibold">Remove photo</button>
            </div>
          )}
        </div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tournament name" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-3"/>
        <input value={date} onChange={e=>setDate(e.target.value)} type="date" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text mb-3"/>
        <input value={course} onChange={e=>setCourse(e.target.value)} placeholder="Course" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-3"/>
        <input value={division} onChange={e=>setDivision(e.target.value)} placeholder="Division" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-3"/>
        <div className="mb-3">
          <label className="block text-xs text-text-muted font-medium mb-1">Tournament type</label>
          <select
            value={tournamentType}
            onChange={e=>setTournamentType(e.target.value)}
            className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text"
          >
            <option value="singles">Singles</option>
            <option value="doubles">Doubles</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-text-muted font-medium mb-1">Placement</label>
            <input value={placement} onChange={e=>setPlacement(e.target.value)} type="number" min="1" placeholder="1" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"/>
          </div>
          <div>
            <label className="block text-xs text-text-muted font-medium mb-1">
              {tournamentType === 'doubles' ? '# Teams' : '# Players'}
            </label>
            {tournamentType === 'doubles' ? (
              <input
                value={numberOfTeams}
                onChange={e=>setNumberOfTeams(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"
              />
            ) : (
              <input
                value={numberOfPlayers}
                onChange={e=>setNumberOfPlayers(e.target.value)}
                type="number"
                min="0"
                placeholder="0"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"
              />
            )}
          </div>
        </div>
        {tournamentType === 'doubles' && (
          <>
            <div className="mb-3">
              <label className="block text-xs text-text-muted font-medium mb-1">Partner / Teammate</label>
              <input
                value={partnerName}
                onChange={e=>setPartnerName(e.target.value)}
                placeholder="Your teammate's name"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs text-text-muted font-medium mb-1">Team name</label>
              <input
                value={teamName}
                onChange={e=>setTeamName(e.target.value)}
                placeholder="e.g. Disc Dynasty"
                className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"
              />
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-text-muted font-medium mb-1">Number of rounds</label>
            <input
              value={rounds}
              onChange={e=>setRounds(e.target.value)}
              type="number"
              min="1"
              placeholder="1"
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted font-medium mb-1">Who were you with?</label>
            <input
              value={withWho}
              onChange={e=>setWithWho(e.target.value)}
              placeholder="Friends, card mates, etc."
              className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"
            />
          </div>
        </div>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note... (e.g. Wind was crazy, threw a perfect hyzer line)" rows={2} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-4 resize-none"/>
        <div className="flex gap-2">
          {tournament && <button type="button" onClick={() => { onDelete(tournament.id); onClose(); }} className="py-2.5 px-4 rounded-xl bg-gap-high/10 text-gap-high text-sm font-semibold border border-gap-high/20">Delete</button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold">Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LongestThrowFormModal({ open, throwRecord, discs, onClose, onSave, onDelete, uploadImage }) {
  const [distanceFeet, setDistanceFeet] = useState('');
  const [discId, setDiscId] = useState('');
  const [course, setCourse] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (open) {
      if (throwRecord) {
        setDistanceFeet(String(throwRecord.distanceFeet ?? '')); setDiscId(throwRecord.discId || ''); setCourse(throwRecord.course || ''); setDate(throwRecord.date || ''); setNotes(throwRecord.notes || ''); setPhoto(throwRecord.photo || null);
      } else {
        setDistanceFeet(''); setDiscId(discs[0]?.id || ''); setCourse(''); setDate(td()); setNotes(''); setPhoto(null);
      }
    }
  }, [open, throwRecord, discs]);
  const save = () => {
    const d = parseInt(distanceFeet, 10);
    const payload = throwRecord ? { ...throwRecord, distanceFeet: isNaN(d) ? 0 : d, discId, course, date, notes } : { id: `lt${Date.now()}`, distanceFeet: isNaN(d) ? 0 : d, discId, course, date, notes };
    if (photo != null) payload.photo = photo;
    onSave(payload);
    onClose();
  };
  const handlePhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    e.target.value = '';
    try {
      let photoValue = null;
      if (uploadImage) {
        photoValue = await uploadImage(f, 'longest');
      } else {
        photoValue = await compressImageFileToDataUrl(f);
      }
      if (photoValue) setPhoto(photoValue);
    } catch (err) {
      console.warn('[LongestThrowFormModal] failed to process photo', err);
    }
  };
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="relative w-full max-w-md bg-bg rounded-2xl border border-border p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-text mb-4">{throwRecord ? 'Edit Longest Throw' : 'Add Longest Throw'}</h2>
        <div className="mb-3">
          <label className="block text-xs text-text-muted font-medium mb-1.5">Photo</label>
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:border-gap-high/40 cursor-pointer w-full">
            <Camera size={16} className="text-text-muted"/>
            <span className="text-sm text-text-muted">{photo ? 'Change photo' : 'Add Photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto}/>
          </label>
          {photo && (
            <div className="mt-2 flex items-center gap-2">
              <img src={photo} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border"/>
              <button type="button" onClick={()=>setPhoto(null)} className="text-xs text-gap-high hover:text-red-300 font-semibold">Remove photo</button>
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="block text-xs text-text-muted mb-1">Distance (feet)</label>
          <input value={distanceFeet} onChange={e=>setDistanceFeet(e.target.value)} type="number" min="0" placeholder="e.g. 350" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted"/>
        </div>
        <div className="mb-3">
          <label className="block text-xs text-text-muted mb-1">Disc</label>
          <select value={discId} onChange={e=>setDiscId(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text">
            {discs.map(d => <option key={d.id} value={d.id}>{d.custom_name || d.mold} ({d.manufacturer})</option>)}
          </select>
        </div>
        <input value={course} onChange={e=>setCourse(e.target.value)} placeholder="Course / location" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-3"/>
        <input value={date} onChange={e=>setDate(e.target.value)} type="date" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text mb-3"/>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note... (e.g. Wind was crazy, threw a perfect hyzer line)" rows={2} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-4 resize-none"/>
        <div className="flex gap-2">
          {throwRecord && <button type="button" onClick={() => { onDelete(throwRecord.id); onClose(); }} className="py-2.5 px-4 rounded-xl bg-gap-high/10 text-gap-high text-sm font-semibold border border-gap-high/20">Delete</button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold">Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PersonalBestFormModal({ open, pb, onClose, onSave, onDelete, uploadImage }) {
  const [category, setCategory] = useState(PB_CATEGORIES[0]);
  const [value, setValue] = useState('');
  const [course, setCourse] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState(null);
  useEffect(() => {
    if (open) {
      if (pb) {
        setCategory(pb.category || PB_CATEGORIES[0]); setValue(pb.value || ''); setCourse(pb.course || ''); setDate(pb.date || ''); setNotes(pb.notes || ''); setPhoto(pb.photo || null);
      } else {
        setCategory(PB_CATEGORIES[0]); setValue(''); setCourse(''); setDate(td()); setNotes(''); setPhoto(null);
      }
    }
  }, [open, pb]);
  const save = () => {
    const payload = pb ? { ...pb, category, value, course, date, notes } : { id: `pb${Date.now()}`, category, value, course, date, notes };
    if (photo != null) payload.photo = photo;
    onSave(payload);
    onClose();
  };
  const handlePhoto = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    e.target.value = '';
    try {
      let photoValue = null;
      if (uploadImage) {
        photoValue = await uploadImage(f, 'personal-bests');
      } else {
        photoValue = await compressImageFileToDataUrl(f);
      }
      if (photoValue) setPhoto(photoValue);
    } catch (err) {
      console.warn('[PersonalBestFormModal] failed to process photo', err);
    }
  };
  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}/>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="relative w-full max-w-md bg-bg rounded-2xl border border-border p-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-text mb-4">{pb ? 'Edit Personal Best' : 'Add Personal Best'}</h2>
        <div className="mb-3">
          <label className="block text-xs text-text-muted font-medium mb-1.5">Photo</label>
          <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:border-gap-low/40 cursor-pointer w-full">
            <Camera size={16} className="text-text-muted"/>
            <span className="text-sm text-text-muted">{photo ? 'Change photo' : 'Add Photo'}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhoto}/>
          </label>
          {photo && (
            <div className="mt-2 flex items-center gap-2">
              <img src={photo} alt="Preview" className="w-16 h-16 rounded-lg object-cover border border-border"/>
              <button type="button" onClick={()=>setPhoto(null)} className="text-xs text-gap-high hover:text-red-300 font-semibold">Remove photo</button>
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className="block text-xs text-text-muted mb-1">Category</label>
          <select value={category} onChange={e=>setCategory(e.target.value)} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text">
            {PB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <input value={value} onChange={e=>setValue(e.target.value)} placeholder="Value / score" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-3"/>
        <input value={course} onChange={e=>setCourse(e.target.value)} placeholder="Course" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-3"/>
        <input value={date} onChange={e=>setDate(e.target.value)} type="date" className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text mb-3"/>
        <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Add a note... (e.g. Wind was crazy, threw a perfect hyzer line)" rows={2} className="w-full bg-surface border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted mb-4 resize-none"/>
        <div className="flex gap-2">
          {pb && <button type="button" onClick={() => { onDelete(pb.id); onClose(); }} className="py-2.5 px-4 rounded-xl bg-gap-high/10 text-gap-high text-sm font-semibold border border-gap-high/20">Delete</button>}
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-surface text-text-muted text-sm font-semibold">Cancel</button>
          <button onClick={save} className="flex-1 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold">Save</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function TrophyCasePage({
  aces, discs, tournaments, longestThrows, personalBests,
  onEditAce, onDeleteAce, onLogAce,
  addTournament, updateTournament, deleteTournament,
  addLongestThrow, updateLongestThrow, deleteLongestThrow,
  addPersonalBest, updatePersonalBest, deletePersonalBest,
  uploadImage,
}) {
  const [category, setCategory] = useState('tournaments');
  const [sortBy, setSortBy] = useState('newest');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [editingTournament, setEditingTournament] = useState(null);
  const [editingLongestThrow, setEditingLongestThrow] = useState(null);
  const [editingPersonalBest, setEditingPersonalBest] = useState(null);
  const [tournamentFormOpen, setTournamentFormOpen] = useState(false);
  const [longestThrowFormOpen, setLongestThrowFormOpen] = useState(false);
  const [pbFormOpen, setPbFormOpen] = useState(false);

  const dm = useMemo(() => { const m = {}; discs.forEach(d => { m[d.id] = d; }); return m; }, [discs]);
  const maxLongest = useMemo(() => longestThrows.length ? Math.max(...longestThrows.map(t => t.distanceFeet || 0)) : 0, [longestThrows]);

  const sortedAces = useMemo(() => {
    const s = [...aces].sort((a, b) => b.date.localeCompare(a.date));
    if (sortBy === 'oldest') return s.reverse();
    if (sortBy === 'rarity') return s.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    return s;
  }, [aces, sortBy]);

  const sortedTournaments = useMemo(() => {
    const s = [...tournaments].sort((a, b) => b.date.localeCompare(a.date));
    if (sortBy === 'oldest') return s.reverse();
    if (sortBy === 'rarity') return s.sort((a, b) => (a.placement || 99) - (b.placement || 99));
    return s;
  }, [tournaments, sortBy]);

  const sortedLongestThrows = useMemo(() => {
    const byDate = [...longestThrows].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (sortBy === 'oldest') return byDate.reverse();
    if (sortBy === 'rarity') return [...longestThrows].sort((a, b) => (b.distanceFeet || 0) - (a.distanceFeet || 0));
    return byDate;
  }, [longestThrows, sortBy]);

  const sortedPBs = useMemo(() => {
    const s = [...personalBests].sort((a, b) => b.date.localeCompare(a.date));
    if (sortBy === 'oldest') return s.reverse();
    return s;
  }, [personalBests, sortBy]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-surface border border-border flex items-center justify-center">
          <Trophy size={24} className="text-gap-medium"/>
        </div>
        <div>
          <h2 className="text-xl font-black text-text">Trophy Case</h2>
          <p className="text-xs text-text-muted">Your Hall of Fame</p>
        </div>
      </div>

      {/* Category cards */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {HOF_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const count = cat.count(aces, tournaments, longestThrows, personalBests);
          const value = cat.id === 'longest' ? (maxLongest ? `${maxLongest}ft` : '—') : count;
          const active = category === cat.id;
          return (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)} className={`shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${active ? `bg-gradient-to-br ${cat.accent} border-current` : 'bg-card/80 border-border hover:border-border'}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${active ? 'bg-white/10' : 'bg-surface'}`}><Icon size={20} className={active ? 'text-text' : 'text-text-muted'}/></div>
              <div className="text-left">
                <div className={`text-sm font-bold ${active ? 'text-text' : 'text-text-muted'}`}>{cat.label}</div>
                <div className={`text-lg font-black ${active ? 'text-text' : 'text-text-muted'}`}>{value}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Toolbar: sort + Add (only show Add when category has entries; empty state has its own CTA) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} className="bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="rarity">Rarity</option>
        </select>
        {category === 'tournaments' && sortedTournaments.length > 0 && <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => { setEditingTournament(null); setTournamentFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-secondary/20 text-secondary border border-secondary/30 hover:bg-secondary/30"><Award size={16}/>Add Tournament</motion.button>}
        {category === 'longest' && sortedLongestThrows.length > 0 && <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => { setEditingLongestThrow(null); setLongestThrowFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gap-high/20 text-gap-high border border-gap-high/30 hover:bg-gap-high/30"><Target size={16}/>Add Throw</motion.button>}
        {category === 'pbs' && sortedPBs.length > 0 && <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => { setEditingPersonalBest(null); setPbFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gap-low/20 text-gap-low border border-gap-low/30 hover:bg-gap-low/30"><Star size={16}/>Add Personal Best</motion.button>}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {category === 'tournaments' && (sortedTournaments.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <Award size={64} className="text-secondary/50 mx-auto"/>
            <h3 className="text-lg font-bold text-text mt-4">Add your tournament results!</h3>
            <p className="text-sm text-text-muted max-w-xs mt-2">Track placements and divisions.</p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setEditingTournament(null); setTournamentFormOpen(true); }} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-secondary text-text"><Award size={16}/>Add Tournament</motion.button>
          </div>
        ) : sortedTournaments.map((t, i) => {
          const rarity = getTournamentRarity(t.placement);
          const hasPhoto = !!(t.photo);
          const placementNum = typeof t.placement === 'number' ? t.placement : parseInt(String(t.placement), 10);
          const placementStr = placementNum === 1 ? '1st' : placementNum === 2 ? '2nd' : placementNum === 3 ? '3rd' : placementNum >= 1 ? `#${placementNum}` : '—';
          const isDoubles = t.type === 'doubles';
          const groupCount = isDoubles ? (t.numberOfTeams || 0) : (t.numberOfPlayers || 0);
          const groupLabel = groupCount > 0 ? `${groupCount} ${isDoubles ? 'teams' : 'players'}` : isDoubles ? 'teams' : 'players';
          const typeLabel = isDoubles ? 'Doubles' : 'Singles';
          return (
            <div key={t.id} className="flex">
              <AchievementCardWrapper rarity={rarity} index={i} aspectRatio="">
                {hasPhoto && (
                  <div className="relative w-full shrink-0 h-[180px]">
                    <img src={t.photo} alt="" className="w-full h-full object-cover rounded-t-xl"/>
                    <div className="absolute inset-0 rounded-t-xl pointer-events-none" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 55%)' }}/>
                    <div className="absolute top-2 left-0 right-0 px-3 flex items-center justify-center pointer-events-none">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/80 border border-secondary/70 shadow-lg">
                        <span className="text-xl" role="img" aria-label="placement medal">{rarity.medalEmoji || '🎗️'}</span>
                        <div className="flex flex-col leading-tight text-left">
                          <span className="text-[11px] font-black tracking-widest uppercase text-secondary">{rarity.label}</span>
                          {placementNum >= 1 && (
                            <span className="text-[10px] font-semibold text-secondary">
                              {placementStr} of {groupLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-0 right-0 px-3 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-secondary/30 text-secondary border border-secondary/60 backdrop-blur-sm">
                        {typeLabel}{t.division ? ` · ${t.division}` : ''}
                      </span>
                      {placementNum >= 1 && (
                        <span className="text-2xl font-black drop-shadow" style={{ color: rarity.medalColor || THEME_TOURNAMENT.silver }}>
                          {placementStr}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                <div className={`px-3 py-2 flex-1 min-h-0 overflow-y-auto flex flex-col ${hasPhoto ? '' : 'pt-3'}`}>
                  {!hasPhoto && (
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <div className="inline-flex items-center gap-2">
                        <span className="text-2xl" role="img" aria-label="placement medal">{rarity.medalEmoji || '🎗️'}</span>
                        <div className="flex flex-col leading-tight">
                          <span className="text-[11px] font-black uppercase tracking-widest text-secondary">{rarity.label}</span>
                          {placementNum >= 1 && (
                            <span className="text-[10px] font-semibold text-secondary">
                              {placementStr} of {groupLabel}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end gap-0.5 h-6">
                        <span className="w-1.5 h-3 rounded-t-full bg-secondary/80"/>
                        <span className="w-1.5 h-4 rounded-t-full bg-secondary/90"/>
                        <span className="w-1.5 h-5 rounded-t-full bg-secondary/90"/>
                      </div>
                    </div>
                  )}
                  <h3 className="text-sm font-black text-text truncate">{t.name}</h3>
                  <p className="text-[10px] text-text-muted truncate">{t.course}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {typeLabel}{t.division ? ` · ${t.division}` : ''}{groupCount > 0 ? ` · ${groupLabel}` : ''}
                  </p>
                  {isDoubles && t.teamName && (
                    <p className="text-[10px] text-text-muted mt-0.5">
                      Team: {t.teamName}
                    </p>
                  )}
                  {isDoubles && t.partnerName && (
                    <p className="text-[10px] text-text-muted mt-0.5">Partner: {t.partnerName}</p>
                  )}
                  {t.rounds > 0 && (
                    <p className="text-[10px] text-text-muted mt-0.5 flex items-center gap-1">
                      <Calendar size={10} className="text-secondary"/>
                      {t.rounds} {t.rounds === 1 ? 'Round' : 'Rounds'}
                    </p>
                  )}
                  {t.withWho && (
                    <p className="text-[10px] text-text-muted mt-0.5 truncate">
                      With: {t.withWho}
                    </p>
                  )}
                  <p className="text-[10px] text-text-muted mt-1">{fmtD(t.date)}</p>
                  {t.notes && <p className="text-[10px] text-text-muted italic mt-1 line-clamp-2">"{t.notes}"</p>}
                </div>
                <div className="px-2.5 py-2 flex items-center gap-1.5 shrink-0 border-t border-white/5">
                  <button onClick={() => { setEditingTournament(t); setTournamentFormOpen(true); }} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-secondary border border-border/50"><Edit3 size={12}/></button>
                  <button onClick={() => setConfirmDelete({ type: 'tournament', id: t.id })} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-gap-high border border-border/50"><Trash2 size={12}/></button>
                </div>
              </AchievementCardWrapper>
            </div>
          );
        }))}

        {category === 'longest' && (sortedLongestThrows.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <Target size={64} className="text-gap-high/50 mx-auto"/>
            <h3 className="text-lg font-bold text-text mt-4">How far can you send it?</h3>
            <GlossaryBody as="p" className="text-sm text-text-muted max-w-xs mt-2">Log your longest throws with the disc you used.</GlossaryBody>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setEditingLongestThrow(null); setLongestThrowFormOpen(true); }} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gap-high text-text"><Target size={16}/>Add Longest Throw</motion.button>
          </div>
        ) : sortedLongestThrows.map((t, i) => {
          const disc = dm[t.discId];
          const rarity = getLongestThrowRarity(t.distanceFeet);
          const hasPhoto = !!(t.photo);
          const dist = t.distanceFeet || 0;
          const max = maxLongest || dist || 1;
          const pct = max ? Math.min(100, Math.round((dist / max) * 100)) : 0;
          return (
            <div key={t.id} className="flex">
              <AchievementCardWrapper rarity={rarity} index={i} aspectRatio="">
                {hasPhoto && (
                  <div className="relative w-full shrink-0 h-[180px]">
                    <img src={t.photo} alt="" className="w-full h-full object-cover rounded-t-xl"/>
                    <div className="absolute inset-0 rounded-t-xl pointer-events-none" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 50%)' }}/>
                    <div className="absolute bottom-3 left-0 right-0 px-3 flex items-end justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-text backdrop-blur-sm">{rarity.label}</span>
                      <div className="flex flex-col items-end gap-1">
                        <div className="inline-flex items-baseline gap-1">
                          <Zap size={16} className="text-gap-medium drop-shadow" />
                          <span className="text-3xl font-black text-text drop-shadow-lg">{dist}</span>
                          <span className="text-sm font-bold text-gap-high ml-0.5">ft</span>
                        </div>
                        <div className="w-24 h-1.5 rounded-full bg-card/80 overflow-hidden border border-gap-high/40">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background:'linear-gradient(90deg,#facc15,#fb923c,#ef4444)' }}/>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className={`px-3 py-2 flex-1 min-h-0 overflow-y-auto flex flex-col ${hasPhoto ? '' : 'pt-2'}`}>
                  {!hasPhoto && (
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${rarity.bg} ${rarity.text}`}>{rarity.label}</span>
                      <Target size={14} className="text-gap-high"/>
                    </div>
                  )}
                  {!hasPhoto && (
                    <div className="rounded-lg px-3 py-1.5 mb-1.5 shrink-0 flex items-baseline justify-between gap-2" style={{ background: 'linear-gradient(135deg,rgba(255,69,0,0.25),rgba(220,20,60,0.12))', border: '1px solid rgba(255,99,71,0.5)' }}>
                      <div className="inline-flex items-baseline gap-1">
                        <Zap size={16} className="text-gap-medium" />
                        <span className="text-3xl font-black text-text">{dist}</span>
                        <span className="text-sm text-gap-high font-bold ml-1">ft</span>
                      </div>
                    </div>
                  )}
                  {!hasPhoto && (
                    <div className="mb-1.5">
                      <div className="w-full h-1.5 rounded-full bg-card/90 overflow-hidden border border-gap-high/40">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background:'linear-gradient(90deg,#facc15,#fb923c,#ef4444)' }}/>
                      </div>
                      <p className="text-[9px] text-text-muted mt-0.5 text-right">Power meter</p>
                    </div>
                  )}
                  <p className="text-[11px] text-text-muted truncate">{disc ? (disc.custom_name || disc.mold) : 'Unknown disc'}</p>
                  <p className="text-[10px] text-text-muted">{t.course} · {fmtD(t.date)}</p>
                  {t.notes && <p className="text-[10px] text-text-muted italic mt-1 line-clamp-2">"{t.notes}"</p>}
                </div>
                <div className="px-2.5 py-2 flex items-center gap-1.5 shrink-0 border-t border-white/5">
                  <button onClick={() => { setEditingLongestThrow(t); setLongestThrowFormOpen(true); }} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-gap-high border border-border/50"><Edit3 size={12}/></button>
                  <button onClick={() => setConfirmDelete({ type: 'longest', id: t.id })} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-gap-high border border-border/50"><Trash2 size={12}/></button>
                </div>
              </AchievementCardWrapper>
            </div>
          );
        }))}

        {category === 'pbs' && (sortedPBs.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <Star size={64} className="text-gap-low/50 mx-auto"/>
            <h3 className="text-lg font-bold text-text mt-4">Track your greatest moments!</h3>
            <p className="text-sm text-text-muted max-w-xs mt-2">Lowest round, most birdies, longest putt, and more.</p>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => { setEditingPersonalBest(null); setPbFormOpen(true); }} className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-gap-low text-text"><Star size={16}/>Add Personal Best</motion.button>
          </div>
        ) : sortedPBs.map((pb, i) => {
          const rarity = getPBRarity();
          const hasPhoto = !!(pb.photo);
          let improvementLabel = '';
          const currentVal = parseFloat(pb.value);
          if (!Number.isNaN(currentVal)) {
            const prev = sortedPBs.slice(i + 1).find(other => other.category === pb.category && other.course === pb.course);
            if (prev) {
              const prevVal = parseFloat(prev.value);
              if (!Number.isNaN(prevVal) && prevVal !== currentVal) {
                const cat = (pb.category || '').toLowerCase();
                const lowerIsBetter = /score|stroke|round/.test(cat);
                const delta = lowerIsBetter ? prevVal - currentVal : currentVal - prevVal;
                if (delta > 0.01) {
                  const rounded = Math.round(delta * 10) / 10;
                  const arrow = lowerIsBetter ? '↓' : '↑';
                  improvementLabel = `${arrow}${rounded} from previous`;
                }
              }
            }
          }
          return (
            <div key={pb.id} className="flex">
              <AchievementCardWrapper rarity={rarity} index={i} aspectRatio="">
                {hasPhoto && (
                  <div className="relative w-full shrink-0 h-[180px]">
                    <img src={pb.photo} alt="" className="w-full h-full object-cover rounded-t-xl"/>
                    <div className="absolute inset-0 rounded-t-xl pointer-events-none" style={{ background: 'linear-gradient(to top,rgba(0,0,0,0.85) 0%,transparent 55%)' }}/>
                    <div className="absolute top-2 left-0 right-0 flex justify-center px-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/25 border border-primary/60 backdrop-blur">
                        <Star size={14} className="text-primary" fill="currentColor"/>
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary">New Record</span>
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-0 right-0 px-3 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-text-muted">{pb.course}</span>
                        <span className="text-[9px] text-text-muted">{fmtD(pb.date)}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-primary">{pb.category}</p>
                        <p className="text-xl font-black text-text mt-0.5">{pb.value}</p>
                      </div>
                    </div>
                  </div>
                )}
                <div className={`px-3 py-2 flex-1 min-h-0 overflow-y-auto flex flex-col ${hasPhoto ? '' : 'pt-2'}`}>
                  {!hasPhoto && (
                    <div className="flex items-center justify-between mb-1.5 shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">NEW RECORD</span>
                      <Star size={14} className="text-primary" fill="currentColor"/>
                    </div>
                  )}
                  <h3 className="text-[11px] font-bold text-text-muted">{pb.category}</h3>
                  <p className="text-lg font-black text-text mt-0.5">{pb.value}</p>
                  {improvementLabel && <p className="text-[10px] text-primary font-semibold mt-0.5">{improvementLabel}</p>}
                  <p className="text-[10px] text-text-muted mt-1">{pb.course} · {fmtD(pb.date)}</p>
                  {pb.notes && <p className="text-[10px] text-text-muted italic mt-1 line-clamp-2">"{pb.notes}"</p>}
                </div>
                <div className="px-2.5 py-2 flex items-center gap-1.5 shrink-0 border-t border-white/5">
                  <button onClick={() => { setEditingPersonalBest(pb); setPbFormOpen(true); }} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-primary border border-border/50"><Edit3 size={12}/></button>
                  <button onClick={() => setConfirmDelete({ type: 'pb', id: pb.id })} className="p-2 rounded-lg bg-surface/80 text-text-muted hover:text-gap-high border border-border/50"><Trash2 size={12}/></button>
                </div>
              </AchievementCardWrapper>
            </div>
          );
        }))}
      </div>

      <AnimatePresence>
        {confirmDelete && typeof confirmDelete === 'string' && <ConfirmDialog open title="Delete this Ace?" message="This will permanently remove this ace record." danger confirmLabel="Delete Ace" onCancel={() => setConfirmDelete(null)} onConfirm={() => { onDeleteAce(confirmDelete); setConfirmDelete(null); }}/>}
        {confirmDelete && typeof confirmDelete === 'object' && confirmDelete.type === 'tournament' && <ConfirmDialog open title="Delete this tournament?" message="This will permanently remove this record." danger confirmLabel="Delete" onCancel={() => setConfirmDelete(null)} onConfirm={() => { deleteTournament(confirmDelete.id); setConfirmDelete(null); }}/>}
        {confirmDelete && typeof confirmDelete === 'object' && confirmDelete.type === 'longest' && <ConfirmDialog open title="Delete this longest throw?" message="This will permanently remove this record." danger confirmLabel="Delete" onCancel={() => setConfirmDelete(null)} onConfirm={() => { deleteLongestThrow(confirmDelete.id); setConfirmDelete(null); }}/>}
        {confirmDelete && typeof confirmDelete === 'object' && confirmDelete.type === 'pb' && <ConfirmDialog open title="Delete this personal best?" message="This will permanently remove this record." danger confirmLabel="Delete" onCancel={() => setConfirmDelete(null)} onConfirm={() => { deletePersonalBest(confirmDelete.id); setConfirmDelete(null); }}/>}
      </AnimatePresence>

      <TournamentFormModal open={tournamentFormOpen} tournament={editingTournament} onClose={() => { setTournamentFormOpen(false); setEditingTournament(null); }} onSave={(t) => { if (t.id && tournaments.some(x => x.id === t.id)) updateTournament(t.id, t); else addTournament(t); setTournamentFormOpen(false); }} onDelete={deleteTournament} uploadImage={uploadImage}/>
      <LongestThrowFormModal open={longestThrowFormOpen} throwRecord={editingLongestThrow} discs={discs} onClose={() => { setLongestThrowFormOpen(false); setEditingLongestThrow(null); }} onSave={(t) => { if (t.id && longestThrows.some(x => x.id === t.id)) updateLongestThrow(t.id, t); else addLongestThrow(t); setLongestThrowFormOpen(false); }} onDelete={deleteLongestThrow} uploadImage={uploadImage}/>
      <PersonalBestFormModal open={pbFormOpen} pb={editingPersonalBest} onClose={() => { setPbFormOpen(false); setEditingPersonalBest(null); }} onSave={(pb) => { if (pb.id && personalBests.some(x => x.id === pb.id)) updatePersonalBest(pb.id, pb); else addPersonalBest(pb); setPbFormOpen(false); }} onDelete={deletePersonalBest} uploadImage={uploadImage}/>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// BACKUP / BUY MODAL
// ═══════════════════════════════════════════════════════
function buildDiscRetailerSearchParams(disc) {
  // Manufacturer mapping for Infinite Discs URLs
  const infiniteDiscsManufacturerMap = {
    'clash': 'Clash Discs',
    'clash discs': 'Clash Discs',
    'westside': 'Westside Discs',
    'westside discs': 'Westside Discs',
    'dynamic': 'Dynamic Discs',
    'dynamic discs': 'Dynamic Discs',
    'infinite': 'Infinite Discs',
    'infinite discs': 'Infinite Discs',
    'prodigy': 'Prodigy Disc',
    'prodigy disc': 'Prodigy Disc',
    'lone star': 'Lone Star Disc',
    'lone star disc': 'Lone Star Disc',
    'lone star discs': 'Lone Star Discs',
    'lonestar': 'Lone Star Disc',
    'wild': 'Wild Discs',
    'wild discs': 'Wild Discs',
    'sacred': 'Sacred Discs',
    'sacred discs': 'Sacred Discs',
    'doomsday': 'Doomsday Discs',
    'doomsday discs': 'Doomsday Discs',
    'flight lab': 'Flight Lab Discs',
    'flight lab discs': 'Flight Lab Discs',
    'pie pan': 'Pie Pan Discs',
    'pie pan discs': 'Pie Pan Discs',
    'thought space': 'Thought Space Athletics',
    'tsa': 'Thought Space Athletics',
    'thought space athletics': 'Thought Space Athletics',
    'streamline': 'Streamline',
    'axiom': 'Axiom',
    'mvp': 'MVP',
    'innova': 'Innova',
    'discraft': 'Discraft',
    'discmania': 'Discmania',
    'kastaplast': 'Kastaplast',
    'latitude 64': 'Latitude 64',
    'latitude': 'Latitude 64',
    'gateway': 'Gateway',
    'millennium': 'Millennium',
    'dga': 'DGA',
    'viking': 'Viking Discs',
    'viking discs': 'Viking Discs',
    'yikun': 'Yikun',
    'above ground level': 'Above Ground Level',
    'agl': 'Above Ground Level',
    'mint': 'Mint Discs',
    'mint discs': 'Mint Discs',
    'rpm': 'RPM Discs',
    'rpm discs': 'RPM Discs',
    'prodiscus': 'Prodiscus',
    'eurodisc': 'Eurodisc',
    'guru': 'Guru',
  };

  const manufacturer = (disc?.manufacturer != null ? String(disc.manufacturer) : '').trim();
  const plasticTrim = (disc?.plastic_type != null ? String(disc.plastic_type) : '').trim();
  const moldTrim = (disc?.mold != null ? String(disc.mold) : '').trim();
  const customTrim = (disc?.custom_name != null ? String(disc.custom_name) : '').trim();
  const discNameForSearch = moldTrim || customTrim;
  const corePrimary = [manufacturer, discNameForSearch].filter(Boolean).join(' ');

  // Map manufacturer for Infinite Discs URL
  const mappedManufacturer = infiniteDiscsManufacturerMap[manufacturer.toLowerCase()] || manufacturer;

  const slugifyPath = (parts) =>
    parts
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const slugPrimary = slugifyPath([mappedManufacturer, discNameForSearch]);
  const infiniteDiscsUrl = slugPrimary ? `https://infinitediscs.com/${slugPrimary}` : 'https://infinitediscs.com';

  const hasPlastic = Boolean(plasticTrim);
  let searchQueryWithPlastic;
  let amazonKWithPlastic;
  let infiniteDiscsUrlWithPlastic;
  if (hasPlastic) {
    const coreWithPlastic = [manufacturer, plasticTrim, discNameForSearch].filter(Boolean).join(' ');
    infiniteDiscsUrlWithPlastic = coreWithPlastic
      ? `https://infinitediscs.com/search?searchText=${encodeURIComponent(coreWithPlastic)}`
      : 'https://infinitediscs.com';
    searchQueryWithPlastic = encodeURIComponent(coreWithPlastic || 'disc golf');
    amazonKWithPlastic = encodeURIComponent(coreWithPlastic ? `${coreWithPlastic} disc golf` : 'disc golf');
  }

  console.log('[Buy retailers]', {
    manufacturer,
    plasticTrim: plasticTrim || '(empty)',
    mappedManufacturer,
    discNameForSearch: discNameForSearch || '(empty)',
    infiniteDiscsUrl,
  });

  const searchQuery = encodeURIComponent(corePrimary || 'disc golf');
  const amazonK = encodeURIComponent(corePrimary ? `${corePrimary} disc golf` : 'disc golf');
  return {
    searchQuery,
    amazonK,
    infiniteDiscsUrl,
    hasPlastic,
    searchQueryWithPlastic,
    amazonKWithPlastic,
    infiniteDiscsUrlWithPlastic,
  };
}

/** Trilogy family brands sold via Dynamic Discs — case-insensitive match on manufacturer. */
const TRILOGY_MANUFACTURERS_LOWER = new Set([
  'dynamic discs',
  'latitude 64',
  'westside discs',
  'westside',
  'trilogy',
]);
function isTrilogyFamilyManufacturer(manufacturer) {
  const m = (manufacturer ?? '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
  if (!m) return false;
  return TRILOGY_MANUFACTURERS_LOWER.has(m);
}

function BackupModal({open,disc,onClose}) {
  const [ready,setReady] = useState(false);
  const [includePlasticInSearch, setIncludePlasticInSearch] = useState(false);
  useEffect(() => {
    if (!open) return;
    setIncludePlasticInSearch(false);
    setReady(false);
    const t = setTimeout(() => setReady(true), 1500);
    return () => clearTimeout(t);
  }, [open]);
  if (!open||!disc) return null;
  const { searchQuery, amazonK, infiniteDiscsUrl, hasPlastic, searchQueryWithPlastic, amazonKWithPlastic } = buildDiscRetailerSearchParams(disc);
  const retailers = [
    { name: 'Amazon', url: `https://www.amazon.com/s?k=${amazonK}`, urlWithPlastic: hasPlastic ? `https://www.amazon.com/s?k=${amazonKWithPlastic}` : null, priceRange: '$16 – $22' },
    { name: 'Infinite Discs', url: infiniteDiscsUrl, urlWithPlastic: null, priceRange: '$14 – $20' },
    { name: 'Gotta Go Gotta Throw', url: `https://gottagogottathrow.com/search?q=${searchQuery}`, urlWithPlastic: hasPlastic ? `https://gottagogottathrow.com/search?q=${searchQueryWithPlastic}` : null, priceRange: '$11.99 - $27.99' },
  ];
  if (isTrilogyFamilyManufacturer(disc.manufacturer)) {
    retailers.push({ name: 'Dynamic Discs', url: `https://www.dynamicdiscs.com/search?q=${searchQuery}`, urlWithPlastic: hasPlastic ? `https://www.dynamicdiscs.com/search?q=${searchQueryWithPlastic}` : null, priceRange: '$12.99 - $28.99' });
  }
  const hrefForRetailer = (r) => (includePlasticInSearch && hasPlastic && r.urlWithPlastic ? r.urlWithPlastic : r.url);
  const visibleRetailers = includePlasticInSearch && hasPlastic ? retailers.filter((r) => r.urlWithPlastic) : retailers;
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-sm bg-card rounded-2xl border border-border overflow-hidden">
        <div className="p-5 pb-3 flex items-center gap-3">
          <DiscVisual disc={disc} size="sm"/>
          <div className="flex-1 min-w-0"><h2 className="text-base font-bold text-text truncate">Buy: {disc.mold}</h2><p className="text-xs text-text-muted">{disc.manufacturer} · {disc.plastic_type}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-surface text-text-muted shrink-0"><X size={18}/></button>
        </div>
        {hasPlastic && (
          <div className="px-5 pb-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface/40 px-3 py-2">
              <span className="text-[11px] leading-snug text-text-muted">
                Include plastic in search
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={includePlasticInSearch}
                onClick={() => setIncludePlasticInSearch((v) => !v)}
                className={`relative h-6 w-10 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${includePlasticInSearch ? 'bg-primary/90' : 'bg-border'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-card shadow-sm transition-transform ${includePlasticInSearch ? 'translate-x-4' : 'translate-x-0'}`}
                  aria-hidden
                />
              </button>
            </div>
          </div>
        )}
        <div className="p-5 pt-0">
          <AnimatePresence mode="wait">
            {!ready ? (
              <motion.div key="ld" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center py-8">
                <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}><Loader size={24} className="text-primary"/></motion.div>
                <p className="text-sm text-text-muted mt-3">Searching retailers…</p>
              </motion.div>
            ) : (
              <motion.div key="res" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-2.5">
                {visibleRetailers.map((r,i) => (
                  <motion.a key={r.name} href={hrefForRetailer(r)} target="_blank" rel="noopener noreferrer" initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}}
                    onClick={() => ReactGA.event({ category: 'Affiliate', action: includePlasticInSearch && r.urlWithPlastic ? 'Shop Click With Plastic' : 'Shop Click', label: r.name })}
                    style={{
                      backgroundColor: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      borderColor: 'var(--color-primary-muted)',
                    }}
                    className="w-full flex min-h-[48px] items-center justify-between gap-3 px-4 py-3 rounded-xl border shadow-md hover:opacity-95 transition-opacity block">
                    <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1 text-left">
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-on-primary)' }}>{r.name}</span>
                      <span className="text-xs font-normal leading-tight" style={{ color: 'var(--color-on-primary)', opacity: 0.8 }}>{r.priceRange}</span>
                    </div>
                    <ExternalLink size={14} className="shrink-0" style={{ color: 'var(--color-on-primary)' }} aria-hidden />
                  </motion.a>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// ADD TO BAG PICKER MODAL
// ═══════════════════════════════════════════════════════
function getBuySuggestionsForGap(gap) {
  const key = gap.buySuggestionKey ?? (gap.filterType === 'disc_type' || gap.filterType === 'stability' ? gap.filterValue : null);
  if (key && BUY_SUGGESTIONS[key]) return BUY_SUGGESTIONS[key];
  if (gap.filterType === 'speed_gap' && gap.filterValue) {
    const { minSpeed, maxSpeed } = gap.filterValue;
    const k = maxSpeed <= 5 ? 'speed_4_5' : maxSpeed <= 8 ? 'speed_6_8' : 'speed_9_11';
    return BUY_SUGGESTIONS[k] || [];
  }
  return [];
}

function AddToBagPicker({ open, onClose, discs, bag, onAdd, onAddDisc, onOpenAddDisc, onBuySearch }) {
  const [search, setSearch] = useState('');
  const [selectedGapKey, setSelectedGapKey] = useState(null);
  const [suggestionExpanded, setSuggestionExpanded] = useState(false);
  const [overlapCardExpanded, setOverlapCardExpanded] = useState(false);
  useEffect(() => { if (open) setSelectedGapKey(null); }, [open]);
  useEffect(() => { setSuggestionExpanded(false); setOverlapCardExpanded(false); }, [selectedGapKey]);

  const bagDiscs = useMemo(() => (bag && discs) ? discs.filter(d => discBelongsToBagView(d, bag)) : [], [discs, bag]);
  const gaps = useMemo(() => computeBagGaps(bagDiscs), [bagDiscs]);
  const bagDiscIds = useMemo(() => (bag && discs) ? discs.filter(d => discBelongsToBagView(d, bag)).map(d => d.id) : [], [discs, bag]);
  const available = (discs && bag) ? discs.filter(d => !bagDiscIds.includes(d.id)) : [];

  const selectedGap = selectedGapKey ? gaps.find(g => g.key === selectedGapKey) : null;
  const baseList = selectedGap
    ? getLibraryMatchesForGap(selectedGap, discs || [], bagDiscIds)
    : available;

  const filtered = useMemo(() => {
    if (!search.trim()) return baseList;
    const q = search.toLowerCase();
    return baseList.filter(d =>
      (d.mold || '').toLowerCase().includes(q) ||
      (d.manufacturer || '').toLowerCase().includes(q) ||
      (d.custom_name || '').toLowerCase().includes(q)
    );
  }, [baseList, search]);

  const recommended = useMemo(() => {
    if (selectedGapKey || gaps.length === 0 || !discs) return [];
    const sevOrder = { high: 0, medium: 1, low: 2 };
    const sorted = [...gaps].sort((a, b) => (sevOrder[a.sev] ?? 3) - (sevOrder[b.sev] ?? 3));
    const seen = new Set();
    const out = [];
    for (const gap of sorted) {
      const matches = getLibraryMatchesForGap(gap, discs, bagDiscIds);
      for (const d of matches) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        out.push({ disc: d, gap });
        if (out.length >= 5) return out;
      }
    }
    return out;
  }, [selectedGapKey, gaps, discs, bagDiscIds]);

  const recommendedIds = new Set(recommended.map(r => r.disc.id));
  const mainList = selectedGapKey ? filtered : filtered.filter(d => !recommendedIds.has(d.id));

  const defaultDiscTypeForAdd = selectedGap?.filterType === 'disc_type' ? selectedGap.filterValue : undefined;
  const buySuggestions = selectedGap ? getBuySuggestionsForGap(selectedGap) : [];
  const showPopularPicks = selectedGapKey && filtered.length === 0 && buySuggestions.length > 0;

  if (!open || !bag) return null;

  const chipStyle = (g) => {
    if (g.isRedundancy) return 'bg-secondary/15 text-secondary border-secondary/30';
    if (g.sev === 'high') return 'bg-gap-high/15 text-gap-high border-gap-high/30';
    if (g.sev === 'medium') return 'bg-gap-medium/15 text-gap-medium border-gap-medium/30';
    return 'bg-surface text-text-muted border-border';
  };

  const libraryEmpty = discs.length === 0;

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}} transition={{type:'spring',damping:28}} className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-2xl border border-border flex flex-col overflow-hidden shadow-card-lg" style={{maxHeight:'80vh'}}>
        <div className="flex items-center justify-between p-5 mb-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text">Add to {bag.name}</h2>
            <p className="text-xs text-text-muted mt-0.5">{libraryEmpty ? 'No discs in library' : `${available.length} disc${available.length !== 1 ? 's' : ''} available`}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface text-text-muted"><X size={20}/></button>
        </div>
        {libraryEmpty ? (
          <div className="flex-1 p-5 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center mb-4 text-3xl" role="img" aria-label="Disc">🥏</div>
            <h3 className="text-base font-bold text-text mb-2">Your disc library is empty</h3>
            <p className="text-sm text-text-muted mb-6 max-w-xs">Add discs to your library first, then you can add them to this bag.</p>
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.98}} onClick={() => { onClose(); onAddDisc?.(); }} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm shadow-lg shadow-primary/25">
              <Plus size={18}/>Add disc to library
            </motion.button>
          </div>
        ) : (
          <>
        {gaps.length > 0 && (
          <div className="px-5 pb-3 shrink-0 mb-1">
            <div className="flex gap-2 overflow-x-auto overflow-y-visible py-2 pl-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:[display:none]">
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedGapKey(null)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${!selectedGapKey ? 'bg-accent text-primary border-primary/20' : 'bg-card text-text-muted border-border'}`}
              >
                All Discs
              </motion.button>
              {gaps.map(g => (
                <motion.button
                  key={g.key}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedGapKey(selectedGapKey === g.key ? null : g.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${selectedGapKey === g.key ? 'ring-2 ring-primary/40 ' : ''} ${chipStyle(g)}`}
                >
                  {g.chipLabel || g.msg}
                </motion.button>
              ))}
            </div>
          </div>
        )}
        {selectedGap && (
          <div className="px-5 py-3 shrink-0">
            <div className="rounded-xl border border-border bg-surface/60 p-3">
              {selectedGap.isRedundancy && selectedGap.discs ? (
                <>
                  <button type="button" onClick={() => setOverlapCardExpanded(s => !s)} className="w-full flex items-center justify-between gap-2 text-left">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base" role="img" aria-label="Warning">⚠️</span>
                      <span className="text-xs font-bold text-text">Overlap Detected</span>
                    </div>
                    <ChevronDown size={14} className={`text-text-muted shrink-0 transition-transform duration-200 ${overlapCardExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {overlapCardExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="space-y-3 pt-3">
                          <div className="flex gap-4 flex-wrap">
                            {selectedGap.discs.map(d => (
                              <div key={d.id} className="flex items-center gap-2 min-w-0 flex-1 basis-0">
                                <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center shadow-md border-2 border-border" style={{ backgroundColor: d.color || '#6b7280' }}>
                                  <span className="text-xs font-black" style={{ color: luma(d.color || '#888') > 160 ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }}>{d.speed}</span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-text truncate">{d.custom_name || d.mold}</p>
                                  <p className="text-[11px] text-text-muted truncate">{d.manufacturer} · {d.plastic_type}</p>
                                  <p className="text-xs font-semibold text-text mt-0.5">{d.speed} / {d.glide ?? 0} / {d.turn ?? 0} / {d.fade ?? 0}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <GlossaryBody as="p" className="text-[11px] text-text-muted italic">Consider swapping one for a different stability to cover more shot shapes.</GlossaryBody>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <>
                  {!suggestionExpanded && (
                    <div className="flex items-center justify-center">
                      <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSuggestionExpanded(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        Why?
                        <ChevronDown size={12} className="transition-transform duration-200" />
                      </motion.button>
                    </div>
                  )}
                  <AnimatePresence>
                    {suggestionExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className="space-y-3 pt-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <AlertTriangle size={14} className="text-gap-medium shrink-0" />
                              <span className="text-xs font-bold text-text truncate">
                                {selectedGap.filterType === 'disc_type' && DT[selectedGap.filterValue] ? `Missing ${DT[selectedGap.filterValue].label}` : selectedGap.filterType === 'speed_gap' && selectedGap.filterValue ? `Speed Gap: ${selectedGap.filterValue.minSpeed}–${selectedGap.filterValue.maxSpeed}` : selectedGap.chipLabel || selectedGap.msg}
                              </span>
                            </div>
                            <motion.button type="button" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setSuggestionExpanded(false)} className="shrink-0 p-1 rounded-lg text-text-muted hover:text-text hover:bg-surface/80" aria-label="Collapse">
                              <ChevronDown size={14} className="rotate-180 transition-transform duration-200" />
                            </motion.button>
                          </div>
                          <GlossaryBody as="p" className="text-xs text-text-muted">{selectedGap.suggest}</GlossaryBody>
                          <GlossaryBody as="p" className="text-[11px] text-text-muted italic">Consider adding a disc from your library or the list below to fill this gap.</GlossaryBody>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </div>
          </div>
        )}
        <div className="px-5 pt-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your discs…"
              className="w-full bg-surface border border-border rounded-xl pl-9 pr-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary"/>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {!selectedGapKey && recommended.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Recommended to Fill Gaps</h4>
              <div className="space-y-2">
                {recommended.map(({ disc: d, gap }) => (
                  <motion.button key={d.id} whileHover={{scale:1.01}} whileTap={{scale:0.98}}
                    onClick={() => { onAdd(bag.id, d.id); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20 hover:border-primary/40 transition-all text-left"
                  >
                    <div className="w-8 h-8 rounded-full border-2 border-border shrink-0" style={{backgroundColor: d.color || '#22c55e'}}/>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text truncate">{d.custom_name || d.mold}</p>
                      <p className="text-xs text-text-muted truncate">{d.manufacturer} · {d.plastic_type}</p>
                      <span className="text-[10px] font-medium text-primary mt-0.5 inline-block">Fills: {gap.reasonTag || gap.chipLabel || gap.msg}</span>
                    </div>
                    <Plus size={18} className="text-primary shrink-0"/>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
          {filtered.length === 0 && mainList.length === 0 ? (
            <div className="space-y-4">
              {showPopularPicks ? (
                <>
                  <div className="flex items-center gap-2 bg-surface/60 rounded-lg px-3 py-2.5">
                    <Library size={13} className="text-text-muted shrink-0"/><span className="text-xs text-text-muted">No matching discs in your collection</span>
                  </div>
                  {onBuySearch && buySuggestions.length > 0 && (
                    <div>
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-gap-medium uppercase tracking-wider mb-2"><ShoppingCart size={11}/>Popular Picks to Buy</h4>
                      <div className="space-y-1.5">
                        {buySuggestions.map((s, si) => (
                          <div key={si} className="flex items-center gap-2.5 bg-surface/40 rounded-lg px-3 py-2.5">
                            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{backgroundColor: s.color||'#6b7280'}}>
                              <span className="text-xs font-black" style={{color: luma(s.color||'#888')>160?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.85)'}}>{s.speed}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-text">{s.mold}</div>
                              <div className="text-xs text-text-muted">{s.manufacturer} · {s.plastic}</div>
                            </div>
                            <span className="text-xs font-bold text-primary">{s.price}</span>
                            <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={() => onBuySearch(s)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gap-medium/12 text-gap-medium text-xs font-semibold border border-gap-medium/20"><ShoppingCart size={10}/>Shop</motion.button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {onOpenAddDisc && (
                    <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={() => onOpenAddDisc({ defaultDiscType: defaultDiscTypeForAdd })} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm"><Plus size={16}/>Add New Disc</motion.button>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-text-muted text-sm mb-4">
                    {available.length === 0 ? 'All your discs are already in this bag!' : selectedGapKey ? 'No discs in your library fill this gap' : 'No discs match your search'}
                  </p>
                  {available.length === 0 && onAddDisc && (
                    <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.98}} onClick={() => { onClose(); onAddDisc(); }} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm mx-auto">
                      <Plus size={16}/>Add new disc to library
                    </motion.button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              {!selectedGapKey && recommended.length > 0 && mainList.length > 0 && <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-2">All your discs</h4>}
              {mainList.map(d => (
                <motion.button key={d.id} whileHover={{scale:1.01}} whileTap={{scale:0.98}}
                  onClick={() => { onAdd(bag.id, d.id); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface border border-border hover:border-primary/30 transition-all text-left"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-border shrink-0" style={{backgroundColor: d.color || '#22c55e'}}/>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text truncate">{d.custom_name || d.mold}</p>
                    <p className="text-xs text-text-muted truncate">{d.manufacturer} · {d.plastic_type}</p>
                    {selectedGap && (selectedGap.reasonTag || selectedGap.chipLabel || selectedGap.msg) && (
                      <span className="text-[10px] font-medium text-primary mt-0.5 inline-block">Fills: {selectedGap.reasonTag || selectedGap.chipLabel || selectedGap.msg}</span>
                    )}
                  </div>
                  <Plus size={18} className="text-primary shrink-0"/>
                </motion.button>
              ))}
            </>
          )}
        </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC DETAIL MODAL
// ═══════════════════════════════════════════════════════
function DiscDetailModal({ open, disc, onClose, bags, onEdit, onDelete, onBackup, onToggleBag, defaultThrowStyle }) {
  const [bagDrop,setBagDrop] = useState(false);
  useEffect(() => {if(open)setBagDrop(false);}, [open]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  if (!open||!disc) return null;
  const cfg = DT[disc.disc_type]; const st = SM[disc.status]; const stab = classifyStability(disc); const stabM = STAB_META[stab];
  const inBags = bags.filter(b => b.disc_ids.includes(disc.id));
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} transition={{type:'spring',damping:30}}
        className="relative w-full max-w-xl bg-card rounded-t-3xl sm:rounded-2xl border border-border flex flex-col overflow-hidden shadow-card-lg" style={{maxHeight:'90vh'}}>
        <div className="h-1.5 shrink-0" style={{background:disc.color||'#6b7280'}}/>
        <div className="shrink-0 p-5 pb-4 mb-4">
          <div className="flex items-start gap-4">
            <DiscVisual disc={disc} size="xl"/>
            <div className="flex-1 min-w-0 pt-1">
              {disc.custom_name ? (
                <>
                  <h2 className="text-2xl font-black text-text leading-tight">{disc.custom_name}</h2>
                  <p className="text-sm text-text-muted font-medium mt-0.5">{disc.manufacturer} · {disc.plastic_type}</p>
                </>
              ) : (
                <>
                  <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">{disc.manufacturer}</p>
                  <h2 className="text-2xl font-black text-text leading-tight">{disc.mold}</h2>
                  <p className="text-sm text-text-muted font-medium mt-0.5">{disc.plastic_type}</p>
                </>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{backgroundColor:stabM.color+'15',color:stabM.color,borderColor:stabM.color+'33'}}>{stabM.icon} {stabM.label}</span>
                {st && disc.status !== 'lost' && disc.status !== 'gave_away_sold' && (
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    {st.label}
                  </span>
                )}
              </div>
              {disc.hasAce && (
                <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full border border-gap-medium/40 bg-gap-medium/10 text-[11px] text-gap-medium">
                  <span className="text-sm">🏆</span>
                  <span className="font-semibold">Ace — {disc.aceDate ? fmtD(disc.aceDate) : 'Recorded'}{disc.aceHole != null && disc.aceHole !== '' ? `, Hole ${disc.aceHole}` : ''}</span>
                </div>
              )}
              {inBags.length>0 && <div className="flex flex-wrap gap-1.5 mt-2.5">{inBags.map(b => (<span key={b.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{backgroundColor:(b.bagColor||'#6b7280')+'20',color:b.bagColor||'#9ca3af',border:`1px solid ${(b.bagColor||'#6b7280')}44`}}><Backpack size={9}/>{b.name}</span>))}</div>}
            </div>
            <div className="flex flex-row items-start gap-2 shrink-0 mt-1">
              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60 shrink-0"
                aria-label="Close"
              >
                <X size={20}/>
              </button>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {(disc.status === 'lost' || disc.status === 'gave_away_sold') && (
            <div className="space-y-1.5">
              {disc.status === 'lost' && (
                <div className="inline-flex px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-orange-600 text-white shadow-sm">LOST</div>
              )}
              {disc.status === 'gave_away_sold' && (
                <div className="inline-flex px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide bg-text-muted/40 text-text border border-border">
                  GAVE AWAY / SOLD
                </div>
              )}
              {disc.status === 'lost' && String(disc.lostNote || '').trim() && (
                <GlossaryBody as="p" className="text-sm text-text-muted italic">{String(disc.lostNote)}</GlossaryBody>
              )}
              {disc.status === 'gave_away_sold' && String(disc.gaveAwayNote || '').trim() && (
                <GlossaryBody as="p" className="text-sm text-text-muted italic">{String(disc.gaveAwayNote)}</GlossaryBody>
              )}
            </div>
          )}
          {/* Flight Path */}
          <section className="bg-card/80 rounded-xl p-5 border border-border/50">
            <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-3"><Target size={12}/>Flight Path</h3>
            <div className="flex justify-center"><FlightPath turn={disc.turn} fade={disc.fade} id={`detail-${disc.id}`} large defaultThrowStyle={defaultThrowStyle}/></div>
          </section>
          {/* Flight numbers */}
          <div className="grid grid-cols-4 gap-2">
            {FN_META.map(fn => (
              <div key={fn.key} className={`rounded-xl py-3 text-center ${fn.bg} border border-border/40`}>
                <div className={`font-black text-xl leading-none ${fn.text}`}>{disc[fn.key]}</div>
                <div className="text-text-muted text-xs mt-1 font-bold tracking-widest">{fn.label}</div>
              </div>
            ))}
          </div>
          {/* Specs */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-3"><Info size={12}/>Specs</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{l:'Weight',v:disc.weight_grams?`${disc.weight_grams}g`:'—'},{l:'Plastic',v:disc.plastic_type},{l:'Acquired',v:disc.date_acquired?fmtD(disc.date_acquired):'—'},{l:'Value',v:`$${disc.estimated_value||0}`}].map(s => (
                <div key={s.l} className="bg-card/60 border border-border/40 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-text-muted">{s.l}</div><div className="text-sm text-text font-semibold truncate">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 bg-card/60 border border-border/40 rounded-lg px-3 py-3">
              <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-text-muted">Condition</span><span className="text-xs text-text-muted font-bold">{disc.wear_level}/10 · {ww(disc.wear_level)}</span></div>
              <div className="h-2 bg-surface rounded-full overflow-hidden"><motion.div className={`h-full rounded-full ${wc(disc.wear_level)}`} initial={{width:0}} animate={{width:`${disc.wear_level*10}%`}} transition={{duration:.8}}/></div>
              <p className="text-xs text-text-muted mt-1">1 = Poor → 10 = Mint</p>
            </div>
          </section>
        </div>
        {/* Footer actions */}
        <div className="shrink-0 mt-4 pt-4 p-4 bg-surface/50">
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(disc)} className="p-2.5 rounded-xl text-text-muted hover:text-primary hover:bg-primary/10 border border-border"><Edit3 size={16}/></button>
            <button onClick={() => onDelete(disc.id)} className="p-2.5 rounded-xl text-text-muted hover:text-gap-high hover:bg-gap-high/10 border border-border"><Trash2 size={16}/></button>
            <div className="flex-1 flex justify-center relative">
              <button onClick={() => setBagDrop(!bagDrop)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${bagDrop?'bg-secondary/25 text-secondary border-secondary/40':'bg-secondary/10 text-secondary border-secondary/20'}`}><Backpack size={14}/>Add to Bag</button>
              {bagDrop && (
                <>
                  <div className="fixed inset-0" style={{zIndex:9}} onClick={() => setBagDrop(false)}/>
                  <div className="absolute bottom-full mb-2 bg-card border border-border rounded-xl overflow-hidden shadow-card w-52" style={{zIndex:10}}>
                    {bags.length===0 && <div className="px-3 py-3 text-xs text-text-muted">No bags yet</div>}
                    {bags.map(b => {
                      const inBag = b.disc_ids.includes(disc.id);
                      return (
                        <button key={b.id} onClick={() => onToggleBag(b.id,disc.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-surface/60">
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${inBag?'border-primary':'border-border'}`} style={inBag?{backgroundColor:b.bagColor||'#6B8F71',borderColor:b.bagColor||'#6B8F71'}:{}}>{inBag&&<Check size={10} className="text-text"/>}</span>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:b.bagColor||'#6b7280'}}/>
                          <span className={inBag?'text-text font-semibold':'text-text-muted'}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => onBackup(disc)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary/10 text-primary border border-primary/20"><ShoppingCart size={14}/>Buy Backup</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC CARDS (List + Gallery views)
// ═══════════════════════════════════════════════════════
function DiscCard({
  disc,
  bags,
  viewMode,
  onBackup,
  onToggleBag,
  onEdit,
  onDelete,
  onDetail,
  onRemoveFromBag,
  activeBagId,
  bagMenuOpen,
  setBagMenu,
  statusMenuOpen,
  setStatusMenu,
  onStatusChange,
  onCreateBag,
  bagDetailCompact = false,
  idx,
  defaultThrowStyle,
}) {
  const [newBagOpen, setNewBagOpen] = useState(false);
  const [newBagName, setNewBagName] = useState('');
  const cfg = DT[disc.disc_type];
  const st = SM[disc.status];
  const inBags = bags.filter((b) => b.disc_ids.includes(disc.id));
  const hasNick = !!disc.custom_name;
  const isGallery = viewMode === 'gallery';
  const lostNotePreview = String(disc.lostNote || '').trim();
  const gaveAwayPreview = String(disc.gaveAwayNote || '').trim();
  const showLostNoteHint = disc.status === 'lost' && lostNotePreview.length > 0;
  const showGaveAwayHint = disc.status === 'gave_away_sold' && gaveAwayPreview.length > 0;

  /** Bag detail grid only: minimal at-a-glance card; tap opens detail. */
  if (bagDetailCompact) {
    const displayName = (disc.custom_name && String(disc.custom_name).trim()) || disc.mold;
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.28, delay: idx * 0.02, layout: { duration: 0.2, ease: 'easeOut' } }}
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        onClick={() => onDetail(disc)}
        className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/35 transition-colors duration-200 cursor-pointer shadow-card p-2"
      >
        <div className="flex flex-col items-center text-center">
          <DiscVisual disc={disc} size="md" />
          <p className="text-[10px] text-text-muted leading-tight w-full mt-1.5 px-0.5">{disc.manufacturer}</p>
            <div className="w-full mt-0.5 px-0.5">
            <FittedDiscText text={displayName} maxPx={12} hardMinPx={10} className="font-bold text-text leading-snug text-center" />
          </div>
          <div className="grid grid-cols-4 gap-0.5 w-full mt-2">
            {FN_META.map((fn) => (
              <div key={fn.key} className={`rounded-md py-0.5 text-center ${fn.bg}`}>
                <div className={`font-bold text-[11px] leading-none ${fn.text}`}>{disc[fn.key]}</div>
                <div className="text-text-muted text-[8px] mt-0.5 font-bold tracking-widest">{fn.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  const bagMenuExtra = onCreateBag && (
    <>
      {!newBagOpen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setNewBagOpen(true);
            setNewBagName('');
          }}
          className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-primary border-t border-border/60 hover:bg-surface/60"
        >
          <Plus size={12} className="shrink-0" />
          New Bag
        </button>
      ) : (
        <div className="px-2 py-2 border-t border-border/60 space-y-1.5 bg-surface/30">
          <input
            value={newBagName}
            onChange={(e) => setNewBagName(e.target.value)}
            placeholder="Bag name…"
            className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs text-text placeholder-text-muted focus:outline-none focus:border-primary"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
          <div className="flex gap-1">
            <button
              type="button"
              className="flex-1 py-1 rounded-lg text-[10px] font-semibold bg-card border border-border text-text-muted"
              onClick={(e) => {
                e.stopPropagation();
                setNewBagOpen(false);
                setNewBagName('');
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!newBagName.trim()}
              className={`flex-1 py-1 rounded-lg text-[10px] font-semibold ${newBagName.trim() ? 'bg-primary text-on-primary' : 'bg-surface text-text-muted cursor-not-allowed'}`}
              onClick={(e) => {
                e.stopPropagation();
                const name = newBagName.trim();
                if (!name) return;
                const id = onCreateBag(name);
                if (id) onToggleBag(id, disc.id);
                setNewBagOpen(false);
                setNewBagName('');
                setBagMenu(null);
              }}
            >
              Create
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <motion.div layout initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.96}} transition={{duration:.35,delay:idx*.025,layout:{duration:0.25,ease:'easeOut'}}}
      whileHover={{y:-4,transition:{duration:.2}}} onClick={() => onDetail(disc)}
      className={`bg-card rounded-2xl border border-border overflow-hidden hover:border-primary/40 transition-[border-color,box-shadow] duration-200 ease-out group cursor-pointer shadow-card ${bagMenuOpen || statusMenuOpen ? 'z-30 relative' : 'relative'} pb-14`}>
      <div className={`p-4 ${isGallery?'flex flex-col items-center min-h-[200px]':''}`}>
        {/* Type badge + status (list only) */}
        {!isGallery && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
            {disc.hasAce && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gap-medium/90 text-on-primary shadow-md" title="Ace disc">
                <Trophy size={11} strokeWidth={2.2}/>
              </span>
            )}
          </div>
          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStatusMenu(statusMenuOpen ? null : disc.id);
              }}
              className={`flex items-center gap-1 text-xs rounded-lg px-2 py-0.5 border transition-colors max-w-[11rem] ${statusMenuOpen ? 'bg-surface text-text border-border' : 'bg-surface/60 text-text-muted border-border/70'}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st?.dot || 'bg-text-muted'}`} />
              <span className="truncate">{st?.label || 'Status'}</span>
            </button>
            {statusMenuOpen && (
              <>
                <div className="fixed inset-0 z-[38]" onClick={(e) => { e.stopPropagation(); setStatusMenu(null); }} />
                <div className="absolute right-0 top-full mt-1 z-[39] w-52 max-h-64 overflow-y-auto bg-card border border-border rounded-xl shadow-card py-1">
                  {Object.entries(SM).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-surface/70 flex items-center gap-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusChange(disc, k);
                      }}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${v.dot}`} />
                      {v.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        )}
        {/* Main content */}
        {isGallery ? (
          <>
            <DiscVisual disc={disc} size="lg"/>
            <div className="text-center mt-3 w-full min-w-0 px-0.5">
              {hasNick ? (<><FittedDiscText text={disc.custom_name} maxPx={16} hardMinPx={8} className="font-black text-text group-hover:text-primary text-center" /><p className="text-xs text-text-muted">{disc.manufacturer} · {disc.mold}</p></>) : (<><span className="text-xs text-text-muted">{disc.manufacturer}</span><FittedDiscText text={disc.mold} maxPx={16} hardMinPx={8} className="font-extrabold text-text group-hover:text-primary text-center" /></>)}
              {showLostNoteHint && (
                <p className="text-[10px] text-text-muted italic truncate mt-1.5 max-w-full px-0.5" title={lostNotePreview}>📝 {lostNotePreview.length > 44 ? `${lostNotePreview.slice(0, 44)}…` : lostNotePreview}</p>
              )}
              {showGaveAwayHint && (
                <p className="text-[10px] text-text-muted italic truncate mt-1.5 max-w-full px-0.5" title={gaveAwayPreview}>📝 {gaveAwayPreview.length > 44 ? `${gaveAwayPreview.slice(0, 44)}…` : gaveAwayPreview}</p>
              )}
            </div>
            <div className="relative w-full flex justify-center mt-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStatusMenu(statusMenuOpen ? null : disc.id);
                }}
                className={`flex items-center gap-1 text-[10px] rounded-lg px-2 py-0.5 border ${statusMenuOpen ? 'bg-surface text-text border-border' : 'bg-surface/60 text-text-muted border-border/70'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${st?.dot || 'bg-text-muted'}`} />
                {st?.label || 'Status'}
              </button>
              {statusMenuOpen && (
                <>
                  <div className="fixed inset-0 z-[38]" onClick={(e) => { e.stopPropagation(); setStatusMenu(null); }} />
                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 z-[39] w-52 max-h-64 overflow-y-auto bg-card border border-border rounded-xl shadow-card py-1">
                    {Object.entries(SM).map(([k, v]) => (
                      <button
                        key={k}
                        type="button"
                        className="w-full text-left px-3 py-2 text-xs hover:bg-surface/70 flex items-center gap-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(disc, k);
                        }}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${v.dot}`} />
                        {v.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 text-xs">{FN_META.map(fn => <span key={fn.key} className={`font-bold ${fn.text}`}>{disc[fn.key]}</span>)}</div>
            {inBags.length>0 && <div className="flex flex-wrap gap-1 mt-2 justify-center">{inBags.map(b=>(<span key={b.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{backgroundColor:(b.bagColor||'#6b7280')+'18',color:b.bagColor||'#9ca3af',border:`1px solid ${(b.bagColor||'#6b7280')}40`}}><Backpack size={7}/>{b.name}</span>))}</div>}
          </>
        ) : (
          <div className="flex gap-3 mb-3">
            <DiscVisual disc={disc} size="md"/>
            <div className="flex-1 min-w-0">
              {hasNick ? (<><FittedDiscText text={disc.custom_name} maxPx={18} hardMinPx={8} className="font-black text-text group-hover:text-primary" /><p className="text-xs text-text-muted mt-0.5">{disc.manufacturer} · {disc.mold} · {disc.plastic_type}</p></>) : (<><span className="text-xs text-text-muted">{disc.manufacturer}</span><FittedDiscText text={disc.mold} maxPx={18} hardMinPx={8} className="font-extrabold text-text group-hover:text-primary" /><span className="text-xs text-text-muted">{disc.plastic_type}{disc.weight_grams?` · ${disc.weight_grams}g`:''}</span></>)}
              {showLostNoteHint && (
                <p className="text-[10px] text-text-muted italic truncate mt-1 max-w-full" title={lostNotePreview}>📝 {lostNotePreview.length > 56 ? `${lostNotePreview.slice(0, 56)}…` : lostNotePreview}</p>
              )}
              {showGaveAwayHint && (
                <p className="text-[10px] text-text-muted italic truncate mt-1 max-w-full" title={gaveAwayPreview}>📝 {gaveAwayPreview.length > 56 ? `${gaveAwayPreview.slice(0, 56)}…` : gaveAwayPreview}</p>
              )}
              {disc.estimated_value && <span className="text-xs text-primary/60 font-semibold block">${disc.estimated_value}</span>}
              {inBags.length>0 && <div className="flex flex-wrap gap-1 mt-1.5">{inBags.map(b=>(<span key={b.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{backgroundColor:(b.bagColor||'#6b7280')+'18',color:b.bagColor||'#9ca3af',border:`1px solid ${(b.bagColor||'#6b7280')}40`}}><Backpack size={8}/>{b.name}</span>))}</div>}
            </div>
            <div onClick={e=>e.stopPropagation()}><FlightPath turn={disc.turn} fade={disc.fade} id={disc.id} defaultThrowStyle={defaultThrowStyle}/></div>
          </div>
        )}
        {/* Flight numbers (list only) */}
        {!isGallery && <div className="grid grid-cols-4 gap-1 mb-3">{FN_META.map(fn => (<div key={fn.key} className={`rounded-lg py-1 text-center ${fn.bg}`}><div className={`font-bold text-sm leading-none ${fn.text}`}>{disc[fn.key]}</div><div className="text-text-muted text-xs mt-0.5 font-bold tracking-widest">{fn.label}</div></div>))}</div>}
        {/* Condition bar (list only) */}
        {!isGallery && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-text-muted shrink-0 w-14">Condition</span>
          <div className="flex-1 h-1.5 bg-surface rounded-full overflow-hidden"><motion.div className={`h-full rounded-full ${wc(disc.wear_level)}`} initial={{width:0}} animate={{width:`${disc.wear_level*10}%`}} transition={{duration:.6}}/></div>
          <span className="text-xs text-text-muted">{disc.wear_level}/10</span>
        </div>
        )}
        {/* Actions */}
        <div className={`pt-2 mt-2 transition-[gap,padding] duration-200 ease-out ${isGallery?'w-full mt-1 grid grid-cols-[auto_1fr] md:grid-cols-[auto_1fr_auto_1fr] grid-rows-[auto_auto] md:grid-rows-1 gap-1.5 items-center':'flex items-center gap-1.5'} relative`} onClick={e=>e.stopPropagation()}>
          <div className="flex gap-0.5 shrink-0">
            {!isGallery && (
              <>
                <button type="button" onClick={() => onEdit(disc)} className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors duration-200" aria-label="Edit">
                  <Edit3 size={14}/>
                </button>
                <button type="button" onClick={() => onDelete(disc.id)} className="p-1.5 rounded-md text-text-muted hover:text-gap-high hover:bg-gap-high/10 transition-colors duration-200" aria-label="Delete">
                  <Trash2 size={14}/>
                </button>
              </>
            )}
          </div>
          {activeBagId && !isGallery ? (
            <button
              onClick={() => onRemoveFromBag(activeBagId,disc.id)}
              className="flex-1 min-w-0 flex items-center justify-center px-2 py-1.5 rounded-lg text-xs font-semibold bg-gap-high/10 text-gap-high border border-gap-high/20 shrink-0"
              aria-label="Remove from bag"
            >
              <Minus size={11}/>
            </button>
          ) : isGallery ? (
            <>
              <div className="min-w-0" aria-hidden="true" />
              <div className="flex flex-col md:contents items-center gap-1 col-span-2 row-start-2 md:row-start-auto min-w-0">
                <div className="relative md:col-start-3 w-full flex justify-center md:w-auto">
                  <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => setBagMenu(bagMenuOpen?null:disc.id)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${bagMenuOpen?'bg-secondary/25 text-primary border-secondary/40':'bg-secondary/10 text-primary border-secondary/20'}`}>
                    <Backpack size={11}/>Bag
                  </motion.button>
                  {bagMenuOpen && (
                    <>
                      <div className="fixed inset-0" style={{zIndex:39}} onClick={e=>{e.stopPropagation();setBagMenu(null);}}/>
                      <div className="absolute bottom-full mb-2 bg-card border border-border rounded-xl overflow-hidden shadow-card w-44 left-1/2 -translate-x-1/2" style={{zIndex:40}}>
                        {bags.length===0 && <div className="px-3 py-2.5 text-xs text-text-muted">No bags yet</div>}
                        {bags.map(b => {
                          const inBag = b.disc_ids.includes(disc.id);
                          return (
                            <button key={b.id} onClick={() => onToggleBag(b.id,disc.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface/60">
                              <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${inBag?'border-primary':'border-border'}`} style={inBag?{backgroundColor:b.bagColor||'#6B8F71',borderColor:b.bagColor||'#6B8F71'}:{}}>{inBag&&<Check size={8} className="text-text"/>}</span>
                              <span className={`truncate ${inBag?'text-text':'text-text-muted'}`}>{b.name}</span>
                            </button>
                          );
                        })}
                        {bagMenuExtra}
                      </div>
                    </>
                  )}
                </div>
                <button onClick={() => onBackup(disc)} title="Buy backup" className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20 transition-colors duration-200 hover:bg-primary/15 shrink-0 md:col-start-4 md:justify-self-end" aria-label="Buy backup"><ShoppingCart size={11}/>Buy</button>
              </div>
            </>
          ) : (
            <div className="flex-1 min-w-[60px] flex justify-center relative shrink-0">
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} onClick={() => setBagMenu(bagMenuOpen?null:disc.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bagMenuOpen?'bg-secondary/25 text-primary border-secondary/40':'bg-secondary/10 text-primary border-secondary/20'}`}>
                <Backpack size={11}/>Bag
              </motion.button>
              {bagMenuOpen && (
                <>
                  <div className="fixed inset-0" style={{zIndex:39}} onClick={e=>{e.stopPropagation();setBagMenu(null);}}/>
                  <div className="absolute bottom-full mb-2 bg-card border border-border rounded-xl overflow-hidden shadow-card w-44 left-1/2 -translate-x-1/2" style={{zIndex:40}}>
                    {bags.length===0 && <div className="px-3 py-2.5 text-xs text-text-muted">No bags yet</div>}
                    {bags.map(b => {
                      const inBag = b.disc_ids.includes(disc.id);
                      return (
                        <button key={b.id} onClick={() => onToggleBag(b.id,disc.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-surface/60">
                          <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${inBag?'border-primary':'border-border'}`} style={inBag?{backgroundColor:b.bagColor||'#6B8F71',borderColor:b.bagColor||'#6B8F71'}:{}}>{inBag&&<Check size={8} className="text-text"/>}</span>
                          <span className={`truncate ${inBag?'text-text':'text-text-muted'}`}>{b.name}</span>
                        </button>
                      );
                    })}
                    {bagMenuExtra}
                  </div>
                </>
              )}
            </div>
          )}
          {!isGallery && <button onClick={() => onBackup(disc)} title="Buy backup" className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 text-primary border border-primary/20" aria-label="Buy backup"><ShoppingCart size={11}/>Buy Backup</button>}
        </div>
      </div>
      {isGallery && (
        <>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit(disc); }}
            className="absolute bottom-3 left-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
            aria-label="Edit disc"
          >
            <Edit3 size={18}/>
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(disc.id); }}
            className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
            aria-label="Delete disc"
          >
            <Trash2 size={18}/>
          </button>
        </>
      )}
    </motion.div>
  );
}

// Google logo SVG for Sign in with Google button
function GoogleLogo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════
// WELCOME / LANDING SCREEN
// ═══════════════════════════════════════════════════════
function WelcomeScreen({ onGuestClick, onGoogleClick, onEmailSignUp, onEmailLogin, theme, onThemeChange }) {
  const [view, setView] = useState('main'); // 'main' | 'signup' | 'signupSkill' | 'signupThrowStyle' | 'login'
  const [authError, setAuthError] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [pendingSignup, setPendingSignup] = useState(null);
  const [signupSkillLevel, setSignupSkillLevel] = useState(null);
  const [signupThrowStyle, setSignupThrowStyle] = useState('rhbh');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const goMain = () => { setView('main'); setAuthError(''); };
  const goSignup = () => {
    setView('signup');
    setAuthError('');
    setSignupEmail('');
    setSignupName('');
    setSignupPassword('');
    setSignupConfirm('');
    setPendingSignup(null);
    setSignupSkillLevel(null);
    setSignupThrowStyle('rhbh');
  };
  const goLogin = () => { setView('login'); setAuthError(''); setLoginEmail(''); setLoginPassword(''); };

  const handleContinueToSkill = (e) => {
    e.preventDefault();
    setAuthError('');
    const email = signupEmail.trim().toLowerCase();
    const displayName = signupName.trim();
    if (!email) { setAuthError('Please enter an email address.'); return; }
    if (!displayName) { setAuthError('Please enter a display name.'); return; }
    if (signupPassword.length < MIN_PASSWORD_LENGTH) { setAuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (signupPassword !== signupConfirm) { setAuthError('Passwords do not match.'); return; }
    setPendingSignup({ email, displayName, password: signupPassword });
    setSignupSkillLevel(null);
    setSignupThrowStyle('rhbh');
    setView('signupSkill');
  };

  const handleContinueToThrowStyle = () => {
    setAuthError('');
    const sk = normalizeSkillLevel(signupSkillLevel);
    if (!sk) { setAuthError('Please select your skill level.'); return; }
    setSignupThrowStyle((v) => normalizeThrowStyle(v) ?? 'rhbh');
    setView('signupThrowStyle');
  };

  const handleCreateAccountWithThrowStyle = () => {
    setAuthError('');
    const sk = normalizeSkillLevel(signupSkillLevel);
    if (!sk) { setAuthError('Please select your skill level.'); return; }
    const ts = normalizeThrowStyle(signupThrowStyle) ?? 'rhbh';
    if (!pendingSignup) { setAuthError('Something went wrong. Go back and try again.'); return; }
    const result = onEmailSignUp({ ...pendingSignup, skillLevel: sk, throwStyle: ts });
    if (result && result.error) { setAuthError(result.error); return; }
    setPendingSignup(null);
    setView('main');
  };

  const handleLogin = (e) => {
    e.preventDefault();
    setAuthError('');
    const email = loginEmail.trim().toLowerCase();
    if (!email) { setAuthError('Please enter your email.'); return; }
    if (!loginPassword) { setAuthError('Please enter your password.'); return; }
    const result = onEmailLogin({ email, password: loginPassword });
    if (result && result.error) { setAuthError(result.error); return; }
    setView('main');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-bg px-4 py-8 overflow-y-auto"
    >
      {onThemeChange && (
        <div className="absolute top-4 right-4 flex gap-1 p-0.5 bg-surface rounded-lg border border-border">
          {[
            { value: 'light', icon: Sun, label: 'Light' },
            { value: 'dark', icon: Moon, label: 'Dark' },
            { value: 'system', icon: Monitor, label: 'System' },
          ].map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => onThemeChange(value)}
              className={`p-2 rounded-md transition-colors ${theme === value ? 'bg-card text-primary' : 'text-text-muted hover:text-text'}`}
              title={label}
              aria-label={`Theme: ${label}`}
            >
              <Icon size={18}/>
            </button>
          ))}
        </div>
      )}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-center max-w-sm w-full"
      >
        <span className="text-6xl sm:text-7xl block mb-4" role="img" aria-label="Disc">🥏</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight mb-2">Disc Golf Companion</h1>
        <p className="text-text-muted text-sm sm:text-base mb-6">Track your bag. Improve your game.</p>

        {view === 'signup' && (
          <motion.div key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-left">
            <button type="button" onClick={goMain} className="flex items-center gap-1.5 text-text-muted hover:text-text text-sm mb-4">
              <ChevronRight size={16} className="rotate-180"/> Back
            </button>
            <form onSubmit={handleContinueToSkill} className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Email</label>
                <input type="email" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary" autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Display name</label>
                <input type="text" value={signupName} onChange={e=>setSignupName(e.target.value)} placeholder="Your name" className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary" autoComplete="name" />
              </div>
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Password</label>
                <input type="password" value={signupPassword} onChange={e=>setSignupPassword(e.target.value)} placeholder="At least 6 characters" className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Confirm password</label>
                <input type="password" value={signupConfirm} onChange={e=>setSignupConfirm(e.target.value)} placeholder="Repeat password" className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary" autoComplete="new-password" />
              </div>
              {authError && <p className="text-sm text-gap-high">{authError}</p>}
              <motion.button type="submit" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm shadow-lg shadow-primary/25 transition-colors">Continue</motion.button>
            </form>
          </motion.div>
        )}

        {view === 'signupSkill' && (
          <motion.div key="signupSkill" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-left">
            <button type="button" onClick={() => { setView('signup'); setAuthError(''); }} className="flex items-center gap-1.5 text-text-muted hover:text-text text-sm mb-4">
              <ChevronRight size={16} className="rotate-180"/> Back
            </button>
            <h2 className="text-sm font-bold text-text mb-1">Your skill level</h2>
            <p className="text-xs text-text-muted mb-3">Pick the option that best describes you.</p>
            <SkillLevelPicker value={signupSkillLevel} onChange={setSignupSkillLevel} />
            {authError && <p className="text-sm text-gap-high mt-2">{authError}</p>}
            <motion.button type="button" onClick={handleContinueToThrowStyle} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} className="w-full mt-4 py-3.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm shadow-lg shadow-primary/25 transition-colors">Continue</motion.button>
          </motion.div>
        )}

        {view === 'signupThrowStyle' && (
          <motion.div key="signupThrowStyle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-left max-w-md mx-auto">
            <button type="button" onClick={() => { setView('signupSkill'); setAuthError(''); }} className="flex items-center gap-1.5 text-text-muted hover:text-text text-sm mb-4">
              <ChevronRight size={16} className="rotate-180"/> Back
            </button>
            <h2 className="text-sm font-bold text-text mb-1">Primary throwing style</h2>
            <p className="text-xs text-text-muted mb-2">How do you usually throw?</p>
            <GlossaryBody as="p" className="text-[11px] text-text-muted mb-3 leading-snug">This adjusts your flight charts to match your throw. You can always view other styles too.</GlossaryBody>
            <ThrowStylePicker value={signupThrowStyle} onChange={setSignupThrowStyle} />
            {authError && <p className="text-sm text-gap-high mt-2">{authError}</p>}
            <motion.button type="button" onClick={handleCreateAccountWithThrowStyle} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} className="w-full mt-4 py-3.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm shadow-lg shadow-primary/25 transition-colors">Create account</motion.button>
          </motion.div>
        )}

        {view === 'login' && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-left">
            <button type="button" onClick={goMain} className="flex items-center gap-1.5 text-text-muted hover:text-text text-sm mb-4">
              <ChevronRight size={16} className="rotate-180"/> Back
            </button>
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Email</label>
                <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary" autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs text-text-muted font-medium mb-1">Password</label>
                <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Your password" className="w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary" autoComplete="current-password" />
              </div>
              {authError && <p className="text-sm text-gap-high">{authError}</p>}
              <motion.button type="submit" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }} className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm shadow-lg shadow-primary/25 transition-colors">Log in</motion.button>
            </form>
          </motion.div>
        )}

        {view === 'main' && (
          <div className="space-y-3 w-full">
            <motion.button
              type="button"
              onClick={onGoogleClick}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-surface border border-border text-text font-semibold text-sm transition-colors"
            >
              <GoogleLogo className="w-[18px] h-[18px] shrink-0" />
              Sign in with Google
            </motion.button>
            <motion.button
              type="button"
              onClick={goSignup}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="relative z-10 w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-surface hover:bg-surface text-text font-semibold text-sm border border-border transition-colors"
            >
              <Mail size={18}/> Sign up with Email
            </motion.button>
            <button
              type="button"
              onClick={goLogin}
              className="no-hover-scale group w-full text-sm text-text-muted transition-colors text-center py-2"
            >
              Already have an account? <span className="font-semibold text-primary group-hover:text-primary/90 group-hover:underline transition-colors">Log in</span>
            </button>
            <motion.button
              type="button"
              onClick={onGuestClick}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm shadow-lg shadow-primary/25 transition-colors"
            >
              Continue as Guest
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN APP COMPONENT — with localStorage
// Wrapped in IIFE so default export is evaluated after all declarations (avoids minifier TDZ).
// ═══════════════════════════════════════════════════════
function DiscLibrary() {
  const [guestMode, setGuestMode] = useState(() => {
    try { return localStorage.getItem(GUEST_MODE_KEY) === 'true'; } catch(_) { return false; }
  });
  const [userAuth, setUserAuth] = useState(() => loadAuth());

  const showApp = guestMode || userAuth;
  /** Saved profile throw style for flight visualizations; RHBH when unset. */
  const chartDefaultThrowStyle = normalizeThrowStyle(userAuth?.throwStyle) ?? 'rhbh';

  // Load initial state from localStorage
  const [discs,setDiscs] = useState(() => {
    const s = loadState();
    console.log('[DiscLibrary] initial discs from localStorage:', s?.discs?.length ?? 0, 'example disc:', s?.discs?.[0], 'hasPhoto:', !!s?.discs?.[0]?.photo);
    return s?.discs ?? [];
  });
  const [aceHistory,setAceHistory] = useState(() => { const s = loadState(); return s?.aceHistory ?? []; });
  const [bags,setBags] = useState(() => { const s = loadState(); return s?.bags ?? []; });
  const [tournaments,setTournaments] = useState(() => { const s = loadState(); return s?.tournaments ?? []; });
  const [longestThrows,setLongestThrows] = useState(() => { const s = loadState(); return s?.longestThrows ?? []; });
  const [personalBests,setPersonalBests] = useState(() => { const s = loadState(); return s?.personalBests ?? []; });

  // One-time migration: clear old localStorage (including previous base64 photos)
  // Preserve email accounts and auth so users can log back in
  useEffect(() => {
    try {
      const MIGRATION_KEY = 'discgolf_storage_migrated_v3';
      if (!localStorage.getItem(MIGRATION_KEY)) {
        const preserved = {
          [EMAIL_ACCOUNTS_KEY]: localStorage.getItem(EMAIL_ACCOUNTS_KEY),
          [AUTH_KEY]: localStorage.getItem(AUTH_KEY),
          [USER_PROFILE_PIC_KEY]: localStorage.getItem(USER_PROFILE_PIC_KEY),
          [THEME_KEY]: localStorage.getItem(THEME_KEY),
        };
        localStorage.clear();
        Object.entries(preserved).forEach(([k, v]) => { if (v) localStorage.setItem(k, v); });
        localStorage.setItem(MIGRATION_KEY, '1');
      }
    } catch(_) {}
  }, []);

  useEffect(() => {
    const discsForCache = guestMode
      // In guest mode, keep photos in localStorage so photos persist without Firestore
      ? discs
      // When signed in, strip photos from the localStorage cache (Firestore holds photos)
      : discs.map(d => {
          if (!d) return d;
          const { photo, ...rest } = d;
          return rest;
        });
    saveState({discs:discsForCache,aceHistory,bags,tournaments,longestThrows,personalBests});
  }, [guestMode, discs,aceHistory,bags,tournaments,longestThrows,personalBests]);

  const firestoreSyncUserIdRef = useRef(null);
  const firestoreInitialLoadDoneRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'
  const [firestoreProfileReady, setFirestoreProfileReady] = useState(false);

  // After sign-in: ALWAYS load from Firestore first (new device/domain has different localStorage)
  // Then merge with any localStorage data (dedupe by id); Firestore wins for same id
  useEffect(() => {
    const email = userAuth?.email;
    if (!email) {
      setFirestoreProfileReady(false);
      return;
    }
    const userId = emailToUserId(email);
    if (firestoreSyncUserIdRef.current === userId) return;
    firestoreSyncUserIdRef.current = userId;
    firestoreInitialLoadDoneRef.current = false;
    setSyncStatus('syncing');
    setFirestoreProfileReady(false);
    console.log('[DiscLibrary] Loading from Firestore first for user:', userId);
    loadFromFirestore(userId)
      .then((data) => {
        const local = loadState();
        const remoteDiscs = data?.discs ?? [];
        const remoteBags = data?.bags ?? [];
        const remoteAces = data?.aceHistory ?? [];
        const remoteTournaments = data?.tournaments ?? [];
        const remoteLongestThrows = data?.longestThrows ?? [];
        const remotePersonalBests = data?.personalBests ?? [];
        const localDiscs = local?.discs ?? [];
        const localBags = local?.bags ?? [];
        const localAces = local?.aceHistory ?? [];
        const localTournaments = local?.tournaments ?? [];
        const localLongestThrows = local?.longestThrows ?? [];
        const localPersonalBests = local?.personalBests ?? [];
        const mergeById = (remote, local, idKey = 'id') => {
          const remoteIds = new Set((remote || []).map((x) => x && x[idKey]).filter(Boolean));
          return [...(remote || []), ...(local || []).filter((x) => x && x[idKey] && !remoteIds.has(x[idKey]))];
        };
        setDiscs(mergeById(remoteDiscs, localDiscs));
        setBags(mergeById(remoteBags, localBags));
        setAceHistory(mergeById(remoteAces, localAces));
        setTournaments(mergeById(remoteTournaments, localTournaments));
        setLongestThrows(mergeById(remoteLongestThrows, localLongestThrows));
        setPersonalBests(mergeById(remotePersonalBests, localPersonalBests));
        setUserAuth((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            ...(data?.skillLevel ? { skillLevel: data.skillLevel } : {}),
            throwStyle: normalizeThrowStyle(data?.throwStyle) ?? 'rhbh',
          };
        });
      })
      .then(() => { setSyncStatus('synced'); firestoreInitialLoadDoneRef.current = true; })
      .catch((e) => { console.warn('[DiscLibrary] Initial Firestore sync failed', e); setSyncStatus('error'); firestoreInitialLoadDoneRef.current = true; })
      .finally(() => setFirestoreProfileReady(true));
  }, [userAuth?.email]);

  // On discs/bags/aceHistory change, sync to Firestore when signed in (after initial load done)
  useEffect(() => {
    const email = userAuth?.email;
    if (!email || !firestoreInitialLoadDoneRef.current || firestoreSyncUserIdRef.current !== emailToUserId(email)) return;
    setSyncStatus('syncing');
    const userId = emailToUserId(email);
    const discsCopy = [...discs];
    const acesCopy = [...aceHistory];
    const tournamentsCopy = [...tournaments];
    const longestCopy = [...longestThrows];
    const pbsCopy = [...personalBests];
    syncToFirestore(userId, discsCopy, bags, acesCopy, tournamentsCopy, longestCopy, pbsCopy, true, userAuth?.skillLevel, userAuth?.throwStyle ?? 'rhbh')
      .then(() => { setSyncStatus('synced'); })
      .catch(() => { setSyncStatus('error'); });
  }, [userAuth?.email, userAuth?.skillLevel, userAuth?.throwStyle, discs, bags, aceHistory, tournaments, longestThrows, personalBests]);

  useEffect(() => {
    if (guestMode) try { localStorage.setItem(GUEST_MODE_KEY, 'true'); } catch(_) {}
  }, [guestMode]);

  useEffect(() => {
    saveAuth(userAuth);
  }, [userAuth]);

  useEffect(() => {
    ReactGA.initialize('G-4Y36FE2K1W');
  }, []);

  useEffect(() => {
    if (!showApp) ReactGA.send({ hitType: 'pageview', page: '/welcome' });
  }, [showApp]);

  useEffect(() => {
    if (showApp) ReactGA.send({ hitType: 'pageview', page: '/bag' });
  }, [showApp]);

  const handleEmailSignUp = useCallback(({ email, displayName, password, skillLevel, throwStyle }) => {
    const accounts = loadEmailAccounts();
    if (accounts[email]) return { error: 'An account with this email already exists.' };
    const sk = normalizeSkillLevel(skillLevel);
    if (!sk) return { error: 'Please select a skill level.' };
    const ts = normalizeThrowStyle(throwStyle) ?? 'rhbh';
    accounts[email] = { displayName, password, skillLevel: sk, throwStyle: ts };
    saveEmailAccounts(accounts);
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
    setGuestMode(false);
    setUserAuth({ type: 'email', email, displayName, skillLevel: sk, throwStyle: ts });
    return null;
  }, []);

  const handleEmailLogin = useCallback(({ email, password }) => {
    const accounts = loadEmailAccounts();
    const account = accounts[email];
    if (!account) return { error: 'No account found with this email.' };
    if (account.password !== password) return { error: 'Wrong password.' };
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
    setGuestMode(false);
    setUserAuth({
      type: 'email',
      email,
      displayName: account.displayName,
      skillLevel: normalizeSkillLevel(account.skillLevel),
      throwStyle: normalizeThrowStyle(account.throwStyle) ?? 'rhbh',
    });
    return null;
  }, []);

  const handleSaveProfile = useCallback(({ displayName, currentPassword, newPassword, skillLevel, throwStyle }) => {
    if (!userAuth) return 'Not signed in.';
    const name = (displayName || '').trim();
    if (!name) return 'Display name cannot be empty.';
    const sk = normalizeSkillLevel(skillLevel);
    if (!sk) return 'Please select a skill level.';
    const ts = normalizeThrowStyle(throwStyle) ?? 'rhbh';
    if (userAuth.type === 'email') {
      const accounts = loadEmailAccounts();
      const account = accounts[userAuth.email];
      if (!account) return 'Account not found.';
      if (newPassword) {
        if (!currentPassword) return 'Enter your current password to change it.';
        if (account.password !== currentPassword) return 'Current password is wrong.';
        if (newPassword.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
        account.password = newPassword;
      }
      account.displayName = name;
      account.skillLevel = sk;
      account.throwStyle = ts;
      saveEmailAccounts(accounts);
    }
    setUserAuth(prev => prev ? { ...prev, displayName: name, skillLevel: sk, throwStyle: ts } : null);
    return null;
  }, [userAuth]);

  const [customProfilePic, setCustomProfilePic] = useState(() => loadProfilePic());
  const effectiveProfilePic = customProfilePic || userAuth?.picture || null;

  const handleProfilePicUpload = useCallback((dataUrl) => {
    saveProfilePic(dataUrl);
    setCustomProfilePic(dataUrl);
    setToast('Profile picture updated!');
  }, []);

  const handleGoogleSignIn = useCallback(() => {
    ReactGA.event({ category: 'Auth', action: 'Google Sign In' });
    signInWithPopup(auth, googleProvider)
      .then((result) => {
        const user = result.user;
        try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
        setGuestMode(false);
        setUserAuth({ type: 'google', email: user.email, displayName: user.displayName, picture: user.photoURL || null });
      })
      .catch((err) => {
        console.warn('[auth] Google sign-in failed', err);
        setToast(err?.code === 'auth/popup-closed-by-user' ? 'Sign-in cancelled.' : 'Google Sign In failed. Try again or use Email.');
      });
  }, []);

  const [activeBagId,setActiveBagId] = useState(null);
  const [mainView,setMainView] = useState('discs'); // 'discs' | 'bags'
  const [search,setSearch] = useState('');
  const [typeFilter,setTypeFilter] = useState('all');
  const [selectedBrand,setSelectedBrand] = useState('All');
  const [selectedSpeed,setSelectedSpeed] = useState('All');
  const [selectedPlastic,setSelectedPlastic] = useState('All');
  const [aceFilter,setAceFilter] = useState(false);
  const [selectedSort,setSelectedSort] = useState('Recent');
  const [viewMode,setViewMode] = useState(() => {
    try { const v = localStorage.getItem(VIEW_MODE_KEY); return (v === 'gallery' || v === 'list') ? v : 'gallery'; } catch(_) { return 'gallery'; }
  });
  useEffect(() => { try { localStorage.setItem(VIEW_MODE_KEY, viewMode); } catch(_) {} }, [viewMode]);

  const [theme, setTheme] = useState(() => {
    try { const t = localStorage.getItem(THEME_KEY); return (t === 'light' || t === 'dark' || t === 'system') ? t : 'system'; } catch(_) { return 'system'; }
  });
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem(THEME_KEY, theme);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const effectiveDark = theme === 'dark' || (theme === 'system' && prefersDark);
        meta.setAttribute('content', effectiveDark ? '#161918' : '#E2E3DE');
      }
    } catch(_) {}
  }, [theme]);
  const [formOpen,setFormOpen] = useState(false);
  const [editingDisc,setEditingDisc] = useState(null);
  const [addDiscContext,setAddDiscContext] = useState(null);
  const [bagMenuDisc,setBagMenuDisc] = useState(null);
  const [statusMenuDiscId, setStatusMenuDiscId] = useState(null);
  const [lostFlowDisc, setLostFlowDisc] = useState(null);
  const [lostNoteQuick, setLostNoteQuick] = useState(null);
  const [gaveAwayModal, setGaveAwayModal] = useState(null);
  const [editingBag,setEditingBag] = useState(null);
  const [backupDisc,setBackupDisc] = useState(null);
  const [detailDisc,setDetailDisc] = useState(null);
  const [toast,setToast] = useState(null);
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [deleteBagConfirm,setDeleteBagConfirm] = useState(null);
  const [duplicateDiscConfirm,setDuplicateDiscConfirm] = useState(null);
  const [showPrivacy,setShowPrivacy] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [addToBagPickerOpen, setAddToBagPickerOpen] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const settingsRef = useRef(null);

  const handleUploadImage = useCallback(async (file, folder) => {
    if (!file || !file.type?.startsWith('image/')) return null;
    try {
      console.log('[ImageUpload] Starting upload pipeline', { name: file.name, size: file.size, type: file.type, folder });
      const dataUrl = await compressImageFileToDataUrl(file);
      console.log('[ImageUpload] Compression done, data URL bytes:', typeof dataUrl === 'string' ? dataUrl.length : 0);
      return dataUrl;
    } catch (e) {
      console.warn('Image upload failed', e);
      setToast('Image upload failed. Please try a smaller photo.');
      return null;
    }
  }, []);

  const handleSignOut = useCallback(() => {
    const email = userAuth?.email;
    if (email) {
      const userId = emailToUserId(email);
      const discsCopy = [...discs];
      const acesCopy = [...aceHistory];
      const tournamentsCopy = [...tournaments];
      const longestCopy = [...longestThrows];
      const pbsCopy = [...personalBests];
      // Sync in background — don't block sign-out (so user can always log out)
      syncToFirestore(userId, discsCopy, bags, acesCopy, tournamentsCopy, longestCopy, pbsCopy, true, userAuth?.skillLevel, userAuth?.throwStyle ?? 'rhbh')
        .then(() => console.log('[signOut] Firestore save on sign-out completed'))
        .catch((e) => console.warn('[signOut] Firestore save on sign-out failed', e));
      firebaseSignOut(getAuth()).catch((e) => console.warn('[auth] Firebase signOut failed', e));
    }
    try {
      const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
      const savedEmailAccounts = localStorage.getItem(EMAIL_ACCOUNTS_KEY);
      const savedTheme = localStorage.getItem(THEME_KEY);
      localStorage.clear();
      if (savedViewMode === 'gallery' || savedViewMode === 'list') localStorage.setItem(VIEW_MODE_KEY, savedViewMode);
      if (savedEmailAccounts) localStorage.setItem(EMAIL_ACCOUNTS_KEY, savedEmailAccounts);
      if (savedTheme) localStorage.setItem(THEME_KEY, savedTheme);
    } catch(_) {}
    firestoreSyncUserIdRef.current = null;
    firestoreInitialLoadDoneRef.current = false;
    setDiscs([]);
    setBags([]);
    setAceHistory([]);
    setTournaments([]);
    setLongestThrows([]);
    setPersonalBests([]);
    setGuestMode(false);
    setUserAuth(null);
    setCustomProfilePic(null);
    setSyncStatus('idle');
    setSettingsOpen(false);
    setShowProfileModal(false);
    setFirestoreProfileReady(false);
  }, [userAuth?.email, userAuth?.skillLevel, discs, bags, aceHistory, tournaments, longestThrows, personalBests]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      const userId = firestoreSyncUserIdRef.current;
      if (userId) {
        await deleteUserDataFromFirestore(userId);
      }
      // Clear all local data
      try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
      try { localStorage.removeItem(AUTH_KEY); } catch(_) {}
      try { localStorage.removeItem(USER_PROFILE_PIC_KEY); } catch(_) {}
      firestoreSyncUserIdRef.current = null;
      firestoreInitialLoadDoneRef.current = false;
      setDiscs([]);
      setBags([]);
      setAceHistory([]);
      setTournaments([]);
      setLongestThrows([]);
      setPersonalBests([]);
      setGuestMode(false);
      setUserAuth(null);
      setCustomProfilePic(null);
      setSyncStatus('idle');
      setSettingsOpen(false);
      setShowProfileModal(false);
      setShowDeleteAccount(false);
      setFirestoreProfileReady(false);
      setToast('Account deleted successfully.');
    } catch (e) {
      console.error('Delete account failed', e);
      setToast('Failed to delete account. Please try again.');
      throw e;
    }
  }, []);

  // Derived data
  const brandOptions = useMemo(() => { const u=[...new Set(discs.map(d=>d.manufacturer))].sort(); return [{value:'All',label:'All Brands'},...u.map(b=>({value:b,label:b}))]; }, [discs]);
  const plasticOptions = useMemo(() => {
    const seen = new Map();
    for (const d of discs) {
      const raw = (d.plastic_type != null ? String(d.plastic_type) : '').trim();
      if (!raw) continue;
      const low = raw.toLowerCase();
      if (!seen.has(low)) seen.set(low, raw);
    }
    const sorted = [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    return [{ value: 'All', label: 'All plastics' }, ...sorted.map((p) => ({ value: p, label: p }))];
  }, [discs]);
  const activeBag = useMemo(() => bags.find(b=>b.id===activeBagId)||null, [bags,activeBagId]);

  /** Open bag detail at top of page (bag flight chart uses disc picker, not chip strip). */
  useEffect(() => {
    if (!showApp) return;
    if (mainView !== 'bags' || !activeBagId) return;
    window.scrollTo(0, 0);
  }, [showApp, mainView, activeBagId]);

  const bagDiscsForDashboard = useMemo(() => activeBag ? discs.filter(d => discBelongsToBagView(d, activeBag)) : [], [activeBag, discs]);
  const bagDiscsSortedForGrid = useMemo(() => [...bagDiscsForDashboard].sort((a,b)=>b.speed-a.speed), [bagDiscsForDashboard]);
  const bagTotalValue = useMemo(() => bagDiscsForDashboard.reduce((s,d)=>s+(d.estimated_value||0),0), [bagDiscsForDashboard]);

  const filteredDiscs = useMemo(() => {
    let result = [...discs];
    if (activeBagId && activeBag) result = result.filter(d => discBelongsToBagView(d, activeBag));
    if (search.trim()) { const q=search.toLowerCase(); result=result.filter(d => d.manufacturer.toLowerCase().includes(q)||d.mold.toLowerCase().includes(q)||d.plastic_type.toLowerCase().includes(q)||(d.custom_name&&d.custom_name.toLowerCase().includes(q))); }
    if (typeFilter!=='all') result = result.filter(d => d.disc_type===typeFilter);
    if (selectedBrand!=='All') result = result.filter(d => d.manufacturer===selectedBrand);
    if (selectedSpeed!=='All') { const range=SPEED_RANGES.find(sr=>sr.value===selectedSpeed); if(range)result=result.filter(d=>d.speed>=range.min&&d.speed<=range.max); }
    if (selectedPlastic !== 'All') {
      const sel = selectedPlastic.trim().toLowerCase();
      result = result.filter((d) => (d.plastic_type || '').trim().toLowerCase() === sel);
    }
    if (aceFilter) result = result.filter(d => !!d.hasAce);
    switch(selectedSort) { case'Name':result.sort((a,b)=>a.mold.localeCompare(b.mold));break; case'Speed':result.sort((a,b)=>b.speed-a.speed);break; case'Wear':result.sort((a,b)=>a.wear_level-b.wear_level);break; default:result.sort((a,b)=>(b.date_acquired||'').localeCompare(a.date_acquired||'')); }
    return result;
  }, [discs, activeBag, activeBagId, search, typeFilter, selectedBrand, selectedSpeed, selectedPlastic, aceFilter, selectedSort]);

  const counts = useMemo(() => {
    const base = activeBagId && activeBag ? discs.filter(d => discBelongsToBagView(d, activeBag)) : discs;
    const c = {all:base.length}; Object.keys(DT).forEach(t => c[t]=base.filter(d=>d.disc_type===t).length); c.aces=base.filter(d=>!!d.hasAce).length; return c;
  }, [discs, activeBag, activeBagId]);

  const activeFilterCount = [selectedBrand!=='All', selectedSpeed!=='All', selectedPlastic!=='All', aceFilter].filter(Boolean).length;

  useEffect(() => {
    if (selectedPlastic === 'All') return;
    const values = plasticOptions.map((o) => o.value);
    if (!values.includes(selectedPlastic)) setSelectedPlastic('All');
  }, [plasticOptions, selectedPlastic]);

  // ── Handlers ──
  const clearAllFilters = useCallback(() => { setSelectedBrand('All'); setSelectedSpeed('All'); setSelectedPlastic('All'); setAceFilter(false); setSelectedSort('Recent'); setTypeFilter('all'); setSearch(''); }, []);

  const toggleBag = useCallback((bagId, discId) => {
    const wasIn = bags.find((b) => b.id === bagId)?.disc_ids.includes(discId);
    setBags((prev) =>
      prev.map((b) => {
        if (b.id !== bagId) return b;
        if (wasIn) return { ...b, disc_ids: b.disc_ids.filter((id) => id !== discId) };
        return { ...b, disc_ids: [...b.disc_ids, discId] };
      })
    );
    setDiscs((prev) =>
      prev.map((d) => {
        if (d.id !== discId) return d;
        const prevIds = getDiscBagIds(d);
        if (wasIn) {
          const next = prevIds.filter((id) => id !== bagId);
          return {
            ...d,
            bagIds: next,
            bagId: null,
            status: next.length === 0 && d.status === 'in_bag' ? 'backup' : d.status,
          };
        }
        const next = [...new Set([...prevIds, bagId])];
        return { ...d, bagIds: next, bagId: null, status: 'in_bag' };
      })
    );
  }, [bags]);

  const addDiscToBag = useCallback((bagId, discId) => {
    setBags((prev) =>
      prev.map((b) => {
        if (b.id !== bagId) return b;
        if (b.disc_ids.includes(discId)) return b;
        return { ...b, disc_ids: [...b.disc_ids, discId] };
      })
    );
    setDiscs((prev) =>
      prev.map((d) => {
        if (d.id !== discId) return d;
        const prevIds = getDiscBagIds(d);
        if (prevIds.includes(bagId)) return { ...d, status: 'in_bag', bagIds: prevIds, bagId: null };
        return { ...d, status: 'in_bag', bagIds: [...prevIds, bagId], bagId: null };
      })
    );
    const d = discs.find((x) => x.id === discId);
    const bg = bags.find((x) => x.id === bagId);
    setToast(`✅ ${d?.mold || 'Disc'} added to ${bg?.name || 'bag'}`);
    track.discAddedToBag({
      mold: d?.mold,
      brand: d?.manufacturer,
      plastic: d?.plastic_type,
      bag_id: bagId,
      bag_name: bg?.name,
    });
  }, [discs, bags]);

  const removeDiscFromBag = useCallback((bagId, discId) => {
    setBags((prev) =>
      prev.map((b) => (b.id !== bagId ? b : { ...b, disc_ids: b.disc_ids.filter((id) => id !== discId) }))
    );
    setDiscs((prev) =>
      prev.map((d) => {
        if (d.id !== discId) return d;
        const prevIds = getDiscBagIds(d);
        const next = prevIds.filter((id) => id !== bagId);
        return {
          ...d,
          bagIds: next,
          bagId: null,
          status: next.length === 0 && d.status === 'in_bag' ? 'backup' : d.status,
        };
      })
    );
    const d = discs.find((x) => x.id === discId);
    setToast(`🗑️ ${d?.mold || 'Disc'} removed from bag`);
  }, [discs]);

  const removeDiscFromAllBags = useCallback((discId) => {
    setBags((prev) => prev.map((b) => ({ ...b, disc_ids: b.disc_ids.filter((id) => id !== discId) })));
  }, []);

  const syncDiscBagMembership = useCallback((disc) => {
    setBags((prev) => {
      const without = prev.map((b) => ({ ...b, disc_ids: b.disc_ids.filter((id) => id !== disc.id) }));
      if (disc.status === 'in_bag') {
        const ids = getDiscBagIds(disc);
        if (ids.length) {
          return without.map((b) => (ids.includes(b.id) ? { ...b, disc_ids: [...b.disc_ids, disc.id] } : b));
        }
        return without;
      }
      if (disc.status === 'lost') {
        const ids = getDiscBagIds(disc);
        if (ids.length) {
          return without.map((b) => (ids.includes(b.id) ? { ...b, disc_ids: [...b.disc_ids, disc.id] } : b));
        }
        if (disc.bagId) {
          return without.map((b) => (b.id === disc.bagId ? { ...b, disc_ids: [...b.disc_ids, disc.id] } : b));
        }
        return without;
      }
      return without;
    });
  }, []);

  const patchDisc = useCallback(
    (id, updates) => {
      setDiscs((prev) => {
        const merged = prev.map((d) => (d.id === id ? { ...d, ...updates } : d));
        const disc = merged.find((d) => d.id === id);
        if (disc) queueMicrotask(() => syncDiscBagMembership(disc));
        return merged;
      });
    },
    [syncDiscBagMembership]
  );

  const handleDiscStatusChange = useCallback(
    (disc, newStatus) => {
      if (newStatus === 'lost') {
        setLostFlowDisc(disc);
        setStatusMenuDiscId(null);
        return;
      }
      if (newStatus === 'gave_away_sold') {
        setGaveAwayModal({ id: disc.id, draft: String(disc.gaveAwayNote || '') });
        setStatusMenuDiscId(null);
        return;
      }
      if (newStatus === 'in_bag') {
        patchDisc(disc.id, { status: 'in_bag' });
        setBagMenuDisc(disc.id);
        setStatusMenuDiscId(null);
        return;
      }
      patchDisc(disc.id, { status: newStatus, bagIds: [], bagId: null });
      setStatusMenuDiscId(null);
    },
    [patchDisc]
  );

  const addTournament = useCallback((t) => { setTournaments(p=>[...p,{...t,id:t.id||`t${Date.now()}`}]); setToast('🏅 Tournament added!'); }, []);
  const updateTournament = useCallback((id, t) => { setTournaments(p=>p.map(x=>x.id===id?{...t,id}:x)); setToast('✏️ Tournament updated!'); }, []);
  const deleteTournament = useCallback((id) => { setTournaments(p=>p.filter(x=>x.id!==id)); setToast('🗑️ Tournament deleted'); }, []);

  const addLongestThrow = useCallback((t) => { setLongestThrows(p=>[...p,{...t,id:t.id||`lt${Date.now()}`}]); setToast('🎯 Longest throw added!'); }, []);
  const updateLongestThrow = useCallback((id, t) => { setLongestThrows(p=>p.map(x=>x.id===id?{...t,id}:x)); setToast('✏️ Longest throw updated!'); }, []);
  const deleteLongestThrow = useCallback((id) => { setLongestThrows(p=>p.filter(x=>x.id!==id)); setToast('🗑️ Longest throw deleted'); }, []);

  const addPersonalBest = useCallback((t) => { setPersonalBests(p=>[...p,{...t,id:t.id||`pb${Date.now()}`}]); setToast('⭐ Personal best added!'); }, []);
  const updatePersonalBest = useCallback((id, t) => { setPersonalBests(p=>p.map(x=>x.id===id?{...t,id}:x)); setToast('✏️ Personal best updated!'); }, []);
  const deletePersonalBest = useCallback((id) => { setPersonalBests(p=>p.filter(x=>x.id!==id)); setToast('🗑️ Personal best deleted'); }, []);

  const performAddDisc = useCallback((data) => {
    ReactGA.event({ category: 'Disc', action: 'Add Disc' });
    console.log('[performAddDisc] adding disc', { id: data.id, hasPhoto: !!data.photo, photoBytes: typeof data.photo === 'string' ? data.photo.length : 0 });
    const added = { ...data, date_acquired: data.date_acquired || td() };
    setDiscs((p) => [...p, added]);
    syncDiscBagMembership(added);
    if (addDiscContext) {
      const bag = bags.find((b) => b.id === addDiscContext.bagId);
      const ids = getDiscBagIds(added);
      if (added.status === 'in_bag' && ids.length === 0 && addDiscContext.bagId) {
        addDiscToBag(addDiscContext.bagId, data.id);
      }
      setToast(bag ? `✅ ${data.mold} added and added to ${bag.name}!` : `✅ ${data.mold} added!`);
      setAddDiscContext(null);
      setAddToBagPickerOpen(true);
    } else {
      setToast(`✅ ${data.mold} added!`);
    }
    setEditingDisc(null); setFormOpen(false);
  }, [addDiscContext, bags, addDiscToBag, syncDiscBagMembership]);

  const handleSaveDisc = useCallback((data) => {
    console.log('[handleSaveDisc] saving disc', {
      id: data.id,
      hasPhoto: !!data.photo,
      photoBytes: typeof data.photo === 'string' ? data.photo.length : 0,
      editing: !!editingDisc,
      disc: data,
    });
    if (editingDisc) {
      console.log('[handleSaveDisc] Updating existing disc in state...');
      setDiscs(p=>p.map(d=>d.id===data.id?data:d));
      syncDiscBagMembership(data);
      setToast(`✅ ${data.mold} updated!`);
      setEditingDisc(null); setFormOpen(false);
      return;
    }
    const man = (data.manufacturer || '').trim().toLowerCase();
    const mold = (data.mold || '').trim().toLowerCase();
    const isDuplicate = discs.some(d => (d.manufacturer||'').trim().toLowerCase() === man && (d.mold||'').trim().toLowerCase() === mold);
    if (isDuplicate) {
      setDuplicateDiscConfirm({ data });
      return;
    }
    console.log('[handleSaveDisc] Adding new disc to state...');
    performAddDisc(data);
  }, [editingDisc, discs, performAddDisc, syncDiscBagMembership]);

  const confirmAddDuplicateDisc = useCallback(() => {
    if (!duplicateDiscConfirm) return;
    performAddDisc(duplicateDiscConfirm.data);
    setDuplicateDiscConfirm(null);
  }, [duplicateDiscConfirm, performAddDisc]);

  const requestDeleteDisc = useCallback(id => { const disc=discs.find(x=>x.id===id); setDeleteConfirm({id,disc}); }, [discs]);
  const confirmDeleteDisc = useCallback(() => {
    if (!deleteConfirm) return;
    const {id,disc} = deleteConfirm;
    setDiscs(p=>p.filter(x=>x.id!==id));
    setBags(p=>p.map(b=>({...b,disc_ids:b.disc_ids.filter(did=>did!==id)})));
    setAceHistory(p=>p.filter(a=>a.discId!==id));
    setToast(`🗑️ ${disc?.mold||'Disc'} deleted`);
    setDeleteConfirm(null);
    if (detailDisc?.id===id) setDetailDisc(null);
  }, [deleteConfirm,detailDisc]);

  const openEdit = useCallback(disc => { setEditingDisc(disc); setFormOpen(true); }, []);
  const openAdd = useCallback(() => {
    setEditingDisc(null); setFormOpen(true);
  }, []);
  const createBag = useCallback(({ name, bagColor }) => {
    const id = `b${Date.now()}`;
    setBags((p) => [...p, { id, name, bagColor: bagColor || BAG_COLORS[p.length % BAG_COLORS.length], disc_ids: [] }]);
    return id;
  }, []);
  const deleteBag = useCallback(id => { setBags(p=>p.filter(b=>b.id!==id)); if(activeBagId===id)setActiveBagId(null); }, [activeBagId]);
  const requestDeleteBag = useCallback(id => {
    const bag = bags.find(b => b.id === id);
    if (bag) setDeleteBagConfirm({ id: bag.id, name: bag.name });
  }, [bags]);
  const confirmDeleteBag = useCallback(() => {
    if (!deleteBagConfirm) return;
    deleteBag(deleteBagConfirm.id);
    setDeleteBagConfirm(null);
    if (editingBag?.id === deleteBagConfirm.id) setEditingBag(null);
  }, [deleteBagConfirm, deleteBag, editingBag]);
  const updateBag = (id,data) => setBags(p=>p.map(b=>b.id===id?{...b,...data}:b));

  const handleBuySearch = useCallback(suggestion => {
    track.buyLinkClicked({
      mold: suggestion.mold,
      brand: suggestion.manufacturer,
      plastic: suggestion.plastic,
      source: 'gap_finder',
    });
    setBackupDisc({id:'sug_'+Date.now(),manufacturer:suggestion.manufacturer,mold:suggestion.mold,plastic_type:suggestion.plastic,color:suggestion.color||'#6b7280',speed:suggestion.speed,glide:suggestion.glide,turn:suggestion.turn,fade:suggestion.fade,wear_level:10,weight_grams:175,custom_name:'',photo:null});
  }, []);

  const headerDiscCount = activeBag ? discs.filter(d => discBelongsToBagView(d, activeBag)).length : discs.length;
  const gridCls = viewMode==='gallery' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  if (!showApp) {
    return (
      <GlossaryProvider>
        <>
          <AnimatePresence>{toast && <Toast key={toast} message={toast} onDone={() => setToast(null)}/>}</AnimatePresence>
          <WelcomeScreen
            onGuestClick={() => { ReactGA.event({ category: 'Auth', action: 'Guest Mode' }); setGuestMode(true); }}
            onGoogleClick={handleGoogleSignIn}
            onEmailSignUp={handleEmailSignUp}
            onEmailLogin={handleEmailLogin}
            theme={theme}
            onThemeChange={setTheme}
          />
          <Analytics />
        </>
      </GlossaryProvider>
    );
  }

  const showBagsGrid = mainView === 'bags' && !activeBagId;
  const showSingleBag = mainView === 'bags' && activeBagId && activeBag;
  const goToBagsGrid = () => { setMainView('bags'); setActiveBagId(null); };
  const goToDiscs = () => { setMainView('discs'); setActiveBagId(null); };

  return (
    <GlossaryProvider>
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="min-h-screen bg-bg text-text">
      <AnimatePresence>{toast && <Toast key={toast} message={toast} onDone={() => setToast(null)}/>}</AnimatePresence>
      <InstallPromptBanner />

      {/* ── STICKY TOP: One consistent nav across all views ── */}
      <div className="sticky top-0 z-20 bg-bg border-b border-border/50 shadow-card">
        <div className="bg-gradient-to-b from-primary/20 to-transparent">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <h1 className="text-lg font-extrabold tracking-tight truncate text-text">Disc Golf Companion</h1>
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex bg-card rounded-lg border border-border p-0.5 shrink-0">
                <button onClick={() => setViewMode('gallery')} className={`p-1.5 rounded-md transition-all ${viewMode==='gallery'?'bg-surface text-text':'text-text-muted hover:text-text-muted'}`} aria-label="Grid view"><LayoutGrid size={14}/></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode==='list'?'bg-surface text-text':'text-text-muted hover:text-text-muted'}`} aria-label="List view"><List size={14}/></button>
              </div>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:.95}} onClick={() => showSingleBag ? setAddToBagPickerOpen(true) : openAdd()} className="flex items-center gap-1.5 bg-primary hover:bg-primary text-on-primary font-semibold text-xs px-3 py-2 rounded-lg shrink-0"><Plus size={16}/><span className="hidden sm:inline">Add Disc</span></motion.button>
              {userAuth && syncStatus === 'synced' && (
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0" title="Data saved to cloud" aria-label="Synced"><Check size={12}/></span>
              )}
              {userAuth && syncStatus === 'syncing' && (
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-surface text-text-muted shrink-0" title="Syncing…" aria-label="Syncing"><Loader size={12} className="animate-spin"/></span>
              )}
              <div className="relative shrink-0" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(o => !o)}
                  className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-card border border-border text-text-muted hover:text-text hover:border-primary/30 transition-all"
                  aria-label="Profile and settings"
                  title="Profile"
                >
                  <ProfileAvatar src={effectiveProfilePic} displayName={userAuth?.displayName} size="sm"/>
                  {userAuth?.displayName && <span className="hidden sm:block text-sm font-semibold truncate max-w-[100px]">{userAuth.displayName}</span>}
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0" style={{ zIndex: 45 }} onClick={() => setSettingsOpen(false)} aria-hidden="true"/>
                    <div className="absolute right-0 top-full mt-1.5 py-1 min-w-[11rem] bg-card border border-border rounded-xl shadow-card overflow-hidden" style={{ zIndex: 46 }}>
                      {userAuth && (
                        <>
                          <div className="flex items-center gap-3 px-3 py-2.5 mb-2">
                            <ProfileAvatar src={effectiveProfilePic} displayName={userAuth.displayName} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-text truncate">{userAuth.displayName}</p>
                              {userAuth.email && <p className="text-xs text-text-muted truncate">{userAuth.email}</p>}
                            </div>
                          </div>
                          <button type="button" onClick={() => { setShowProfileModal(true); setSettingsOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-text-muted hover:bg-surface/80 hover:text-text transition-colors">
                            <User size={16} className="shrink-0 text-text-muted"/> Edit Profile
                          </button>
                        </>
                      )}
                      <div className="px-3 py-2 border-t border-border/50">
                        <p className="text-xs text-text-muted font-medium mb-2">Theme</p>
                        <div className="flex gap-1 p-0.5 bg-surface rounded-lg">
                          {[
                            { value: 'light', icon: Sun, label: 'Light' },
                            { value: 'dark', icon: Moon, label: 'Dark' },
                            { value: 'system', icon: Monitor, label: 'System' },
                          ].map(({ value, icon: Icon, label }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => { setTheme(value); }}
                              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${theme === value ? 'bg-card text-primary shadow-sm' : 'text-text-muted hover:text-text'}`}
                              title={label}
                            >
                              <Icon size={14} className="shrink-0"/>
                              <span className="hidden sm:inline">{label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <button type="button" onClick={handleSignOut} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-text-muted hover:bg-surface/80 hover:text-text transition-colors">
                        <LogOut size={16} className="shrink-0 text-text-muted"/> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAGE CONTENT (below sticky header) ── */}
      <div className="max-w-7xl mx-auto px-4 pt-4 pb-8">
        {/* Navigation cards row — dashboard and bag view (breadcrumb / quick nav) */}
        {(mainView === 'discs' || mainView === 'bags') && (
          <div className="grid grid-cols-2 gap-2 mb-4" aria-label="Main navigation">
            <button type="button" onClick={goToDiscs} className={`no-hover-scale flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all text-left min-w-0 ${mainView === 'discs' && !showSingleBag ? 'bg-accent border-primary/30 text-primary shadow-card' : 'bg-card border-border text-text-muted hover:border-border hover:bg-surface/80'}`}>
              <LayoutGrid size={22} className="shrink-0 mb-1.5 opacity-90"/>
              <span className="text-xl font-black tabular-nums">{discs.length}</span>
              <span className="text-[11px] font-semibold text-text-muted mt-0.5">Disc Library</span>
            </button>
            <button type="button" onClick={goToBagsGrid} className={`no-hover-scale flex flex-col items-center justify-center py-4 px-2 rounded-xl border-2 transition-all text-left min-w-0 ${mainView === 'bags' && !showSingleBag ? 'bg-accent border-primary/30 text-primary shadow-card' : 'bg-card border-border text-text-muted hover:border-border hover:bg-surface/80'}`}>
              <Backpack size={22} className="shrink-0 mb-1.5 opacity-90"/>
              <span className="text-xl font-black tabular-nums">{bags.length}</span>
              <span className="text-[11px] font-semibold text-text-muted mt-0.5">My Bags</span>
            </button>
          </div>
        )}
        {/* Search + filters — My Discs only, directly below nav cards */}
        {mainView === 'discs' && (
          <>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mold, plastic, nickname…" className="w-full bg-card border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none focus:border-primary/50 transition-colors"/>
              {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"><X size={16}/></button>}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4">
              <button onClick={() => setTypeFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${typeFilter==='all'?'bg-accent text-primary border-primary/20':'bg-card text-text-muted border-border'}`}>All ({counts.all})</button>
              {Object.entries(DT).map(([k,c]) => (
                <button key={k} onClick={() => setTypeFilter(k)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${typeFilter===k?`bg-accent ${c.text} border-primary/20`:'bg-card text-text-muted border-border'}`}>{c.label} ({counts[k]||0})</button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap pb-2 mb-2">
              <Filter size={14} className="text-text-muted shrink-0"/>
              <FilterDropdown label="Brand" value={selectedBrand} options={brandOptions} onChange={setSelectedBrand}/>
              <FilterDropdown label="Speed" value={selectedSpeed} options={SPEED_RANGES.map(sr=>({value:sr.value,label:sr.label}))} onChange={setSelectedSpeed}/>
              {plasticOptions.length > 1 && (
                <FilterDropdown label="Plastic" value={selectedPlastic} options={plasticOptions} onChange={setSelectedPlastic}/>
              )}
              <button onClick={() => setAceFilter(a=>!a)} className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${aceFilter?'bg-gap-medium/20 text-gap-medium border-gap-medium/30':'bg-card text-text-muted border-border'}`} title="Show only discs you've aced with"><Trophy size={12}/>Aces ({counts.aces??0})</button>
              {activeFilterCount>0 && (
                <button onClick={() => {setSelectedBrand('All');setSelectedSpeed('All');setSelectedPlastic('All');setAceFilter(false);}} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-gap-high bg-gap-high/10 border border-gap-high/20"><X size={12}/>Clear ({activeFilterCount})</button>
              )}
              <div className="flex-1"/>
              <FilterDropdown label="Sort" value={selectedSort} options={SORT_OPTIONS.map(s=>({value:s.value,label:s.label}))} onChange={setSelectedSort}/>
            </div>
          </>
        )}
        {/* My Bags grid */}
        {showBagsGrid && <MyBagsGridPage bags={bags} discs={discs} onSelectBag={(id) => setActiveBagId(id)} onCreateBag={createBag}/>}

        {/* Single bag view: nav cards above, then dashboard (stats → gap finder → disc list → flight chart) */}
        {showSingleBag && (
          <div className="relative">
            {bagDiscsForDashboard.length === 0 ? (
              <>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: activeBag.bagColor || '#6b7280' }}/>
                  <h2 className="text-lg font-bold text-text truncate">{activeBag?.name || 'My Bag'}</h2>
                  <span className="text-sm font-semibold text-text-muted tabular-nums shrink-0">0 discs</span>
                  <button onClick={() => setEditingBag(activeBag)} className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 shrink-0" aria-label="Edit bag"><Edit3 size={14}/></button>
                  <button onClick={() => requestDeleteBag(activeBag.id)} className="p-1.5 rounded-lg text-text-muted hover:text-gap-high hover:bg-gap-high/10 shrink-0" aria-label="Delete bag"><Trash2 size={14}/></button>
                </div>
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
                  <Backpack size={40} className="text-text-muted mb-4"/>
                  <h2 className="text-lg font-bold text-text mb-2">This bag is empty</h2>
                  <p className="text-text-muted text-sm max-w-xs mb-4">Add discs from your collection.</p>
                  <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => setAddToBagPickerOpen(true)} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-sm"><Plus size={18}/>Add Discs to Bag</motion.button>
                </motion.div>
              </>
            ) : (
              <BagDashboard
                key={activeBag.id}
                bagDiscs={bagDiscsForDashboard}
                bag={activeBag}
                allDiscs={discs}
                userSkillLevel={normalizeSkillLevel(userAuth?.skillLevel) ?? 'intermediate'}
                defaultThrowStyle={chartDefaultThrowStyle}
                onAddToBag={addDiscToBag}
                onRemoveFromBag={removeDiscFromBag}
                onBuySearch={handleBuySearch}
                onEditBag={setEditingBag}
                onRequestDeleteBag={requestDeleteBag}
                discListSlot={
                  <>
                    <h3 className="text-sm font-bold text-text mt-6 mb-2">Discs in this bag</h3>
                    <motion.div layout className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
                      <AnimatePresence mode="popLayout">
                        {bagDiscsSortedForGrid.map((d,i) => (
                          <DiscCard key={d.id} disc={d} bags={bags} viewMode="gallery" bagDetailCompact
                            onBackup={setBackupDisc} onToggleBag={toggleBag} onEdit={openEdit} onDelete={requestDeleteDisc}
                            onDetail={setDetailDisc} onRemoveFromBag={removeDiscFromBag} activeBagId={activeBagId}
                            bagMenuOpen={bagMenuDisc===d.id} setBagMenu={setBagMenuDisc}
                            statusMenuOpen={statusMenuDiscId===d.id} setStatusMenu={setStatusMenuDiscId}
                            onStatusChange={handleDiscStatusChange}
                            onCreateBag={(name) => createBag({ name, bagColor: BAG_COLORS[bags.length % BAG_COLORS.length] })}
                            defaultThrowStyle={chartDefaultThrowStyle}
                            idx={i}/>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  </>
                }
              />
            )}
          </div>
        )}

        {/* My Discs: all discs (activeBagId is null when on this tab) */}
        {mainView === 'discs' && (
          <>
            {discs.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col items-center justify-center py-20 sm:py-28 text-center">
                <div className="w-24 h-24 rounded-2xl bg-card border border-border flex items-center justify-center mb-6 text-4xl" role="img" aria-label="Disc">🥏</div>
                <h2 className="text-xl sm:text-2xl font-bold text-text mb-2">Start building your collection!</h2>
                <p className="text-text-muted text-sm sm:text-base mb-8 max-w-xs">Tap + to add your first disc 🥏</p>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={openAdd} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary hover:bg-primary text-on-primary font-semibold text-base shadow-lg shadow-primary/25"><Plus size={20}/>Add Your First Disc</motion.button>
              </motion.div>
            ) : filteredDiscs.length > 0 ? (
              <motion.div layout className={`grid ${gridCls} gap-4`}>
                <AnimatePresence mode="popLayout">
                  {filteredDiscs.map((d,i) => (
                    <DiscCard key={d.id} disc={d} bags={bags} viewMode={viewMode}
                      onBackup={setBackupDisc} onToggleBag={toggleBag} onEdit={openEdit} onDelete={requestDeleteDisc}
                      onDetail={setDetailDisc} onRemoveFromBag={removeDiscFromBag} activeBagId={null}
                      bagMenuOpen={bagMenuDisc===d.id} setBagMenu={setBagMenuDisc}
                      statusMenuOpen={statusMenuDiscId===d.id} setStatusMenu={setStatusMenuDiscId}
                      onStatusChange={handleDiscStatusChange}
                      onCreateBag={(name) => createBag({ name, bagColor: BAG_COLORS[bags.length % BAG_COLORS.length] })}
                      defaultThrowStyle={chartDefaultThrowStyle}
                      idx={i}/>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4"><Search size={28} className="text-text-muted"/></div>
                <h3 className="text-lg font-semibold text-text-muted mb-1">No discs match your filters</h3>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={clearAllFilters} className="mt-3 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold shadow-lg"><X size={14} className="inline mr-1"/>Reset All Filters</motion.button>
              </motion.div>
            )}
          </>
        )}
      </div>

      {(bagMenuDisc || statusMenuDiscId) && <div className="fixed inset-0 z-20" onClick={() => { setBagMenuDisc(null); setStatusMenuDiscId(null); }}/>}

      {/* ── FOOTER ── */}
      <div className="mt-8 pt-6">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-text-muted">
          <span className="text-text-muted">Disc Golf Companion · Your digital disc library</span>
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-primary hover:text-primary font-medium underline-offset-4 hover:underline"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>{detailDisc && <DiscDetailModal open disc={detailDisc} onClose={() => setDetailDisc(null)} bags={bags} onEdit={d=>{setDetailDisc(null);openEdit(d);}} onDelete={id=>{setDetailDisc(null);requestDeleteDisc(id);}} onBackup={d=>{setDetailDisc(null);setBackupDisc(d);}} onToggleBag={toggleBag} defaultThrowStyle={chartDefaultThrowStyle}/>}</AnimatePresence>
      <DiscFormModal open={formOpen} onClose={() => { if (addDiscContext) setAddToBagPickerOpen(true); setFormOpen(false); setEditingDisc(null); setAddDiscContext(null); }} onSave={handleSaveDisc} editDisc={editingDisc} uploadImage={handleUploadImage} defaultDiscType={addDiscContext?.defaultDiscType} defaultBagId={addDiscContext?.bagId} bags={bags} onRemoveDiscFromAllBags={removeDiscFromAllBags} onCreateBag={(name) => createBag({ name, bagColor: BAG_COLORS[bags.length % BAG_COLORS.length] })} defaultThrowStyle={chartDefaultThrowStyle}/>
      <AnimatePresence>
        {lostFlowDisc && (
          <LostDiscDialog
            onDismiss={() => setLostFlowDisc(null)}
            onRemoveFromBags={() => {
              removeDiscFromAllBags(lostFlowDisc.id);
              patchDisc(lostFlowDisc.id, { status: 'lost', bagIds: [], bagId: null });
              setLostNoteQuick({ id: lostFlowDisc.id, draft: String(lostFlowDisc.lostNote || '') });
              setLostFlowDisc(null);
            }}
            onKeepInBags={() => {
              patchDisc(lostFlowDisc.id, { status: 'lost' });
              setLostNoteQuick({ id: lostFlowDisc.id, draft: String(lostFlowDisc.lostNote || '') });
              setLostFlowDisc(null);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {lostNoteQuick && (
          <LostNoteQuickModal
            open
            draft={lostNoteQuick.draft}
            onDraft={(t) => setLostNoteQuick((q) => (q ? { ...q, draft: t } : q))}
            onCancel={() => setLostNoteQuick(null)}
            onSave={() => {
              setLostNoteQuick((q) => {
                if (q) patchDisc(q.id, { lostNote: q.draft });
                return null;
              });
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {gaveAwayModal && (
          <GaveAwayNoteModal
            open
            draft={gaveAwayModal.draft}
            onDraft={(t) => setGaveAwayModal((m) => (m ? { ...m, draft: t } : m))}
            onCancel={() => setGaveAwayModal(null)}
            onSave={() => {
              setGaveAwayModal((m) => {
                if (m) patchDisc(m.id, { status: 'gave_away_sold', gaveAwayNote: m.draft, bagIds: [], bagId: null });
                return null;
              });
            }}
          />
        )}
      </AnimatePresence>
      <BackupModal open={!!backupDisc} disc={backupDisc} onClose={() => setBackupDisc(null)}/>
      <AnimatePresence>{addToBagPickerOpen && activeBag && <AddToBagPicker open onClose={() => setAddToBagPickerOpen(false)} discs={discs} bag={activeBag} onAdd={(bagId, discId) => { addDiscToBag(bagId, discId); }} onAddDisc={() => { setAddToBagPickerOpen(false); openAdd(); }} onOpenAddDisc={({ defaultDiscType } = {}) => { setAddDiscContext({ bagId: activeBag.id, defaultDiscType }); setAddToBagPickerOpen(false); setFormOpen(true); }} onBuySearch={handleBuySearch}/>}</AnimatePresence>
      <AnimatePresence>{editingBag && <EditBagModal open bag={editingBag} onClose={() => setEditingBag(null)} onSave={(id, data) => { updateBag(id, data); setEditingBag(null); }} onDelete={id => { requestDeleteBag(id); setEditingBag(null); }}/>}</AnimatePresence>
      <AnimatePresence>{deleteConfirm && <ConfirmDialog key="del" open title="Delete this disc?" message={`Remove ${deleteConfirm.disc?.custom_name||deleteConfirm.disc?.mold||'this disc'} permanently?`} danger confirmLabel="Delete Disc" discInfo={deleteConfirm.disc} onCancel={() => setDeleteConfirm(null)} onConfirm={confirmDeleteDisc}/>}</AnimatePresence>
      <AnimatePresence>{duplicateDiscConfirm && (
        <ConfirmDialog
          key="dup"
          open
          title="Add another?"
          message={`You already have a ${duplicateDiscConfirm.data.manufacturer || 'Unknown'} ${duplicateDiscConfirm.data.mold || 'disc'} in your collection. Add another one?`}
          confirmLabel="Add Anyway"
          onCancel={() => setDuplicateDiscConfirm(null)}
          onConfirm={confirmAddDuplicateDisc}
        />
      )}</AnimatePresence>
      <AnimatePresence>{deleteBagConfirm && <ConfirmDialog key="delBag" open title="Delete this bag?" message="Are you sure you want to delete this bag? All discs will be removed from the bag." danger confirmLabel="Delete" onCancel={() => setDeleteBagConfirm(null)} onConfirm={confirmDeleteBag}/>}</AnimatePresence>
      <AnimatePresence>{showPrivacy && <PrivacyPolicyModal open onClose={() => setShowPrivacy(false)}/>}</AnimatePresence>
      <AnimatePresence>{showDeleteAccount && <DeleteAccountModal open onClose={() => setShowDeleteAccount(false)} onConfirm={handleDeleteAccount} />}</AnimatePresence>
      <AnimatePresence>{showProfileModal && userAuth && (
        <ProfileModal
          open={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          userAuth={userAuth}
          profilePic={effectiveProfilePic}
          onProfilePicUpload={handleProfilePicUpload}
          onSave={handleSaveProfile}
          setToast={setToast}
          onDeleteAccount={() => { setShowProfileModal(false); setTimeout(() => setShowDeleteAccount(true), 200); }}
        />
      )}</AnimatePresence>
      {showApp && firestoreProfileReady && userAuth && !guestMode && !normalizeSkillLevel(userAuth.skillLevel) && (
        <SkillLevelRequiredModal
          open
          onComplete={(sk) => {
            const v = normalizeSkillLevel(sk);
            if (!v) return;
            setUserAuth((prev) => (prev ? { ...prev, skillLevel: v, throwStyle: normalizeThrowStyle(prev.throwStyle) ?? 'rhbh' } : null));
          }}
        />
      )}
      <Analytics />
    </motion.div>
    </GlossaryProvider>
  );
}

export default (function () { return DiscLibrary; })();