// ═══════════════════════════════════════════════════════
// DISC GOLF COMPANION — COMPLETE SINGLE-FILE APP
// Part 1: Imports, Constants, Helpers, Core Components,
//         Forms, Trophy System
// Part 2: Bags, Dashboard, Detail, Cards, Main App
// ═══════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { emailToUserId, syncToFirestore, loadFromFirestore, deleteUserDataFromFirestore } from './firestoreSync.js';
import ReactGA from 'react-ga4';
import html2canvas from 'html2canvas';
import {
  Trophy, Plus, Search, X, ChevronDown, Check, Minus, Target,
  ExternalLink, ChevronRight, Trash2, Package, Edit3, Calendar,
  MapPin, Hash, ShoppingCart, Loader, LayoutGrid, List, Upload,
  Camera, Share2, Filter, Ruler, Library, BookOpen, Info,
  AlertTriangle, TrendingUp, BarChart3, Crosshair, DollarSign,
  Zap, Shield, Copy, Users, Sparkles, Star, Download, Settings, LogOut, User, Mail, Lock
} from 'lucide-react';

// ── Constants ────────────────────────────────────────
const MFRS = ['Axiom','Clash','DGA','Discraft','Dynamic Discs','Gateway','Innova','Kastaplast','Latitude 64','Lone Star','Mint','MVP','Prodigy','RPM','Streamline','TSA','Westside'];
const DT = {
  putter:          { label:'Putter',   bg:'bg-sky-500/15',     text:'text-sky-400',     border:'border-sky-500/30',   color:'#38bdf8' },
  midrange:        { label:'Midrange', bg:'bg-emerald-500/15', text:'text-emerald-400', border:'border-emerald-500/30',color:'#34d399' },
  fairway_driver:  { label:'Fairway',  bg:'bg-amber-500/15',   text:'text-amber-400',   border:'border-amber-500/30', color:'#fbbf24' },
  distance_driver: { label:'Distance', bg:'bg-rose-500/15',    text:'text-rose-400',    border:'border-rose-500/30',  color:'#fb7185' },
};
const SM = { in_bag:{label:'In Bag',dot:'bg-emerald-400'}, backup:{label:'Backup',dot:'bg-sky-400'}, wall_hanger:{label:'Wall',dot:'bg-purple-400'}, lost:{label:'Lost',dot:'bg-gray-500'} };
const FN_META = [
  { key:'speed',label:'SPD',bg:'bg-sky-500/10',text:'text-sky-400' },
  { key:'glide',label:'GLD',bg:'bg-emerald-500/10',text:'text-emerald-400' },
  { key:'turn', label:'TRN',bg:'bg-amber-500/10',text:'text-amber-400' },
  { key:'fade', label:'FAD',bg:'bg-rose-500/10',text:'text-rose-400' },
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

const STAB_META = {
  understable:{label:'Understable',color:'#38bdf8',bg:'bg-sky-500/15',text:'text-sky-400',border:'border-sky-500/30',icon:'↗'},
  stable:{label:'Stable',color:'#a3e635',bg:'bg-lime-500/15',text:'text-lime-400',border:'border-lime-500/30',icon:'↑'},
  overstable:{label:'Overstable',color:'#fb923c',bg:'bg-orange-500/15',text:'text-orange-400',border:'border-orange-500/30',icon:'↙'},
};

const SPEED_TIERS = [
  { id: 'putters', label: 'Putters', min: 1, max: 3 },
  { id: 'mids', label: 'Mids', min: 4, max: 5 },
  { id: 'fairways', label: 'Fairways', min: 6, max: 8 },
  { id: 'drivers', label: 'Drivers', min: 9, max: 15 },
];

const BUY_SUGGESTIONS = {
  putter: [
    { mold:'Luna', manufacturer:'Discraft', plastic:'Z Line', speed:3, glide:3, turn:0, fade:3, price:'$14–18', color:'#3b82f6', desc:'Tour-favorite putter with reliable fade' },
    { mold:'Aviar', manufacturer:'Innova', plastic:'Star', speed:2, glide:3, turn:0, fade:1, price:'$12–16', color:'#ef4444', desc:'The original do-everything putter' },
  ],
  midrange: [
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#06b6d4', desc:'The gold standard of midranges' },
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
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#3b82f6', desc:'Dead straight, the most popular mid' },
    { mold:'Reactor', manufacturer:'MVP', plastic:'Neutron', speed:5, glide:5, turn:-0.5, fade:1.5, price:'$15–19', color:'#14b8a6', desc:'Straight flying complement to the Hex' },
  ],
  overstable: [
    { mold:'Firebird', manufacturer:'Innova', plastic:'Champion', speed:9, glide:3, turn:0, fade:4, price:'$14–18', color:'#ef4444', desc:'The ultimate utility disc' },
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Overstable approach that always fades' },
  ],
  // Speed gap fillers (by range)
  speed_4_5: [
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#06b6d4', desc:'Fills the midrange slot' },
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
    { mold:'Deputy', manufacturer:'Dynamic Discs', plastic:'Lucid', speed:3, glide:4, turn:-1, fade:0, price:'$12–16', color:'#3b82f6', desc:'Understable approach putter' },
  ],
  stability_putters_overstable: [
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Overstable approach and putter' },
    { mold:'Harp', manufacturer:'Westside', plastic:'VIP', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#8b5cf6', desc:'Overstable putter slot' },
  ],
  stability_mids_understable: [
    { mold:'Comet', manufacturer:'Discraft', plastic:'Z', speed:5, glide:5, turn:-2, fade:1, price:'$14–18', color:'#22c55e', desc:'Understable mid' },
    { mold:'Mako3', manufacturer:'Innova', plastic:'Star', speed:5, glide:5, turn:0, fade:0, price:'$14–18', color:'#06b6d4', desc:'Neutral to understable mid' },
  ],
  stability_mids_overstable: [
    { mold:'Roc3', manufacturer:'Innova', plastic:'Champion', speed:5, glide:4, turn:0, fade:3, price:'$14–18', color:'#6b7280', desc:'Overstable mid' },
    { mold:'Verdict', manufacturer:'Dynamic Discs', plastic:'Lucid', speed:5, glide:4, turn:0, fade:3, price:'$14–18', color:'#ef4444', desc:'Overstable midrange' },
  ],
  stability_fairways_understable: [
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Understable fairway' },
    { mold:'River', manufacturer:'Latitude 64', plastic:'Gold', speed:7, glide:7, turn:-1, fade:1, price:'$15–19', color:'#06b6d4', desc:'Glidey understable fairway' },
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
    { mold:'Buzzz', manufacturer:'Discraft', plastic:'ESP', speed:5, glide:4, turn:-1, fade:1, price:'$14–18', color:'#06b6d4', desc:'Straight flying neutral mid' },
    { mold:'Hex', manufacturer:'MVP', plastic:'Neutron', speed:5, glide:5, turn:-1, fade:1, price:'$15–19', color:'#8b5cf6', desc:'Dead straight mid' },
    { mold:'Mako3', manufacturer:'Innova', plastic:'Star', speed:5, glide:5, turn:0, fade:0, price:'$14–18', color:'#14b8a6', desc:'Neutral mid' },
  ],
  redundancy: [
    { mold:'Roadrunner', manufacturer:'Innova', plastic:'Star', speed:9, glide:5, turn:-4, fade:1, price:'$15–19', color:'#f97316', desc:'Add variety — understable option' },
    { mold:'Zone', manufacturer:'Discraft', plastic:'Z', speed:4, glide:3, turn:0, fade:3, price:'$14–18', color:'#eab308', desc:'Add variety — overstable approach' },
    { mold:'Leopard3', manufacturer:'Innova', plastic:'Champion', speed:7, glide:5, turn:-2, fade:1, price:'$13–17', color:'#22c55e', desc:'Consider swapping one for different shot shape' },
  ],
};

// ── Helpers (function declarations so they are hoisted and safe with minification) ───
function wc(l) { return l>=8?'bg-emerald-500':l>=6?'bg-lime-500':l>=4?'bg-amber-500':l>=2?'bg-orange-500':'bg-red-500'; }
function ww(l) { return l>=9?'Mint':l>=7?'Good':l>=5?'Used':l>=3?'Fair':'Poor'; }
function td() { return new Date().toISOString().split('T')[0]; }
function fmtD(d) { try { return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return d; } }
function luma(hex) { const c=(hex||'#888').replace('#',''); return (parseInt(c.substr(0,2),16)*299+parseInt(c.substr(2,2),16)*587+parseInt(c.substr(4,2),16)*114)/1000; }
function classifyStability(d) { const net=(d.turn||0)+(d.fade||0); if(d.turn<=-2||net<=0) return 'understable'; if(d.fade>=3||net>=3) return 'overstable'; return 'stable'; }

function getAceRarity(distance) {
  if(distance>=350) return { label:'LEGENDARY', border:'linear-gradient(135deg,#a855f7,#ec4899,#f59e0b,#a855f7)', glow:'rgba(168,85,247,0.3)', text:'text-purple-300', bg:'bg-purple-500/10' };
  if(distance>=300) return { label:'EPIC', border:'linear-gradient(135deg,#fbbf24,#fef08a,#f59e0b,#fbbf24)', glow:'rgba(251,191,36,0.3)', text:'text-amber-300', bg:'bg-amber-500/10' };
  if(distance>=200) return { label:'RARE', border:'linear-gradient(135deg,#38bdf8,#a5f3fc,#0ea5e9,#38bdf8)', glow:'rgba(56,189,248,0.25)', text:'text-sky-300', bg:'bg-sky-500/10' };
  return { label:'ACE', border:'linear-gradient(135deg,#9ca3af,#e5e7eb,#6b7280,#9ca3af)', glow:'rgba(156,163,175,0.15)', text:'text-gray-300', bg:'bg-gray-500/10' };
}

const APP_URL = 'Disc Golf Companion';
const SHARE_APP_URL = 'https://discgolfcompanion.vercel.app';
const GUEST_MODE_KEY = 'discgolf_guest_mode';
const AUTH_KEY = 'discgolf_auth';
const GOOGLE_CLIENT_ID = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID ? import.meta.env.VITE_GOOGLE_CLIENT_ID : '';
const EMAIL_ACCOUNTS_KEY = 'discgolf_email_accounts';
const USER_PROFILE_PIC_KEY = 'discgolf_user_profile_pic';
const PROFILE_PIC_MAX_SIZE = 200;
const LS_KEY = 'discgolf_app_v2';
const MIN_PASSWORD_LENGTH = 6;
const TIER_KEY = 'discgolf_user_tier';
const FREE_DISC_LIMIT = 8;
const FREE_BAG_LIMIT = 1;
const FREE_ACE_LIMIT = 3;

const EMPTY_DISC = {manufacturer:'',mold:'',plastic_type:'',custom_name:'',speed:7,glide:5,turn:-1,fade:1,weight_grams:175,disc_type:'midrange',wear_level:10,status:'backup',flight_preference:'both',color:'#22c55e',photo:null,date_acquired:'',story:'',estimated_value:18};
const PWA_INSTALL_DISMISSED_KEY = 'discgolf-pwa-install-dismissed';
const PWA_DISMISS_DAYS = 7;
const PWA_SHOW_DELAY_MS = 30_000;

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) { console.warn('Failed to load state', e); }
  return null;
}
function saveState(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch(e) { console.warn('Failed to save', e); }
}

function getStoredTier() {
  try { return localStorage.getItem(TIER_KEY) || 'free'; } catch(_) { return 'free'; }
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
      picture: decoded.picture || null,
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
      className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 border border-gray-700 px-5 py-3 rounded-xl shadow-2xl max-w-sm text-center" style={{zIndex:60}}>
      <span className="text-sm text-white">{message}</span>
    </motion.div>
  );
}

function Stepper({value,onChange,min,max,step=1,label}) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1 font-medium">{label}</label>
      <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
        <button type="button" onClick={() => onChange(Math.max(min,+(value-step).toFixed(1)))} className="px-2 py-2 text-gray-400 hover:text-white transition rounded-l-lg"><Minus size={12}/></button>
        <span className="flex-1 text-center text-white font-semibold text-sm">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max,+(value+step).toFixed(1)))} className="px-2 py-2 text-gray-400 hover:text-white transition rounded-r-lg"><Plus size={12}/></button>
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
        className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-xs font-semibold border transition-all ${isActive?'bg-emerald-500/15 text-emerald-400 border-emerald-500/30':'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600'}`}>
        {label&&<span className="text-gray-600 mr-0.5">{label}:</span>}{selected.label}
        <ChevronDown size={12} className={`transition-transform duration-200 ${open?'rotate-180':''}`}/>
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{zIndex:45}} onClick={() => setOpen(false)}/>
          <div className="absolute top-full left-0 mt-1.5 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl" style={{zIndex:46,minWidth:'12rem',maxHeight:'16rem',overflowY:'auto'}}>
            {options.map(o => (
              <button key={o.value} onClick={() => {onChange(o.value);setOpen(false);}}
                className={`w-full text-left px-3 py-2.5 text-xs font-medium transition-colors flex items-center gap-2 ${o.value===value?'bg-emerald-500/15 text-emerald-400':'text-gray-300 hover:bg-gray-700/60'}`}>
                <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${o.value===value?'bg-emerald-500 border-emerald-500':'border-gray-600'}`}>
                  {o.value===value && <Check size={10} className="text-white"/>}
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
function DiscVisual({disc,size='md'}) {
  const sz = {sm:'w-14 h-14',md:'w-20 h-20',lg:'w-28 h-28',xl:'w-36 h-36'}[size]||'w-20 h-20';
  const dark = luma(disc.color||'#888')>160;
  const tc = dark?'rgba(0,0,0,0.8)':'rgba(255,255,255,0.9)';
  const sc2 = dark?'rgba(0,0,0,0.45)':'rgba(255,255,255,0.55)';
  const mfs = {sm:8,md:9,lg:10,xl:11}[size]||9;
  const dfs = {sm:11,md:14,lg:17,xl:22}[size]||14;
  return (
    <div className={`relative rounded-full overflow-hidden ${sz} shrink-0 shadow-lg`}
      style={disc.wear_level<=4?{filter:`saturate(${0.55+disc.wear_level*0.1})`}:undefined}>
      {disc.photo ? (
        <img src={disc.photo} className="w-full h-full object-cover" alt={disc.mold}/>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-1"
          style={{backgroundColor:disc.color||'#6b7280',boxShadow:'inset 0 2px 8px rgba(255,255,255,0.15), inset 0 -2px 8px rgba(0,0,0,0.2)'}}>
          <span className="text-center leading-tight font-semibold truncate w-full px-0.5" style={{color:sc2,fontSize:mfs}}>{disc.manufacturer}</span>
          <span className="text-center leading-tight font-extrabold truncate w-full px-0.5" style={{color:tc,fontSize:dfs}}>{disc.mold}</span>
        </div>
      )}
    </div>
  );
}

function ConfirmDialog({open,title,message,onConfirm,onCancel,danger,confirmLabel,discInfo}) {
  if (!open) return null;
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 flex items-center justify-center p-4" style={{zIndex:70}}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${danger?'bg-red-500/15':'bg-amber-500/15'}`}>
              {danger ? <Trash2 size={22} className="text-red-400"/> : <AlertTriangle size={22} className="text-amber-400"/>}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-white">{title}</h3>
              <p className="text-sm text-gray-400 mt-1.5 leading-relaxed">{message}</p>
            </div>
          </div>
          {discInfo && (
            <div className="mt-4 flex items-center gap-3 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-3">
              <DiscVisual disc={discInfo} size="sm"/>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white truncate">{discInfo.custom_name||discInfo.mold}</div>
                <div className="text-xs text-gray-500">{discInfo.manufacturer} · {discInfo.plastic_type}</div>
              </div>
            </div>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-semibold text-sm hover:bg-gray-700 transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${danger?'bg-red-600 hover:bg-red-500 text-white':'bg-amber-600 hover:bg-amber-500 text-white'}`}>
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
        className="relative w-full max-w-lg bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800/80">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-emerald-400"/>
            <h2 className="text-sm font-semibold text-white">Privacy Policy</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400">
            <X size={16}/>
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 text-xs text-gray-300 max-h-[60vh] overflow-y-auto">
          <p className="text-gray-400 text-xs">
            Last updated: March 2026. This policy explains how Disc Golf Companion collects, uses, and protects your data.
          </p>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Account &amp; Authentication</h3>
            <p className="leading-relaxed text-gray-300">
              When you create an account we collect your email address and an encrypted password (or OAuth token if you sign in with Google/Apple). This is used solely for authentication and account recovery. We do not sell or share your email with marketers.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Data We Store</h3>
            <p className="leading-relaxed text-gray-300">
              Your disc collection, bags, bag assignments, profile information (display name, avatar), and app preferences are stored in a cloud database powered by Firebase/Firestore (hosted by Google Cloud). This allows your data to sync across devices and persist if you clear your browser. Your data is protected by Firebase security rules so only you can access it.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Payments</h3>
            <p className="leading-relaxed text-gray-300">
              Pro subscriptions are processed by Stripe. We never see or store your full credit card number. Stripe handles all payment data under their own privacy policy. We only receive confirmation of your subscription status.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Cookies &amp; Analytics</h3>
            <p className="leading-relaxed text-gray-300">
              We use cookies for authentication sessions and basic site analytics to understand how the app is used. We do not run targeted advertising.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Third Parties</h3>
            <p className="leading-relaxed text-gray-300">
              When you click a &quot;Buy&quot; or &quot;Shop&quot; link, you are redirected to third-party retailers (e.g. Amazon, Infinite Discs) which have their own privacy policies. We may earn a small commission from these links at no extra cost to you.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Data Security</h3>
            <p className="leading-relaxed text-gray-300">
              All data is transmitted over HTTPS (TLS encryption). Passwords are hashed and never stored in plain text. Database access is restricted by Firebase security rules.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Your Rights</h3>
            <p className="leading-relaxed text-gray-300">
              You can view, edit, or delete your disc and bag data at any time within the app. To delete your account and all associated data, go to your profile settings and select &quot;Delete Account,&quot; or contact us at discgolfcompanionsupport@gmail.com. Under GDPR and CCPA, you have the right to request a copy of your data or ask us to erase it.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Contact</h3>
            <p className="leading-relaxed text-gray-300">
              Questions about this policy? Reach us at discgolfcompanionsupport@gmail.com.
            </p>
          </div>
        </div>
        <div className="px-5 py-3 border-t border-gray-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-800 text-gray-200 hover:bg-gray-700"
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
      <button
        type="button"
        onClick={onUpload ? handleClick : undefined}
        className={`${sizeCls} rounded-full overflow-hidden border-2 border-gray-700 flex items-center justify-center text-white font-bold text-sm select-none transition-all ${onUpload ? 'cursor-pointer hover:border-emerald-500/50 hover:ring-2 hover:ring-emerald-500/20' : 'cursor-default'}`}
        style={!src ? { backgroundColor: bgColor } : undefined}
        aria-label={onUpload ? 'Change profile picture' : 'Profile picture'}
      >
        {uploading ? (
          <Loader size={iconSize} className="animate-spin text-white/90" />
        ) : src ? (
          <img src={src} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="leading-none">{initials}</span>
        )}
      </button>
      {onUpload && !uploading && (
        <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-gray-800 border-2 border-gray-950 flex items-center justify-center" aria-hidden="true">
          <Camera size={iconSize - 4} className="text-emerald-400" />
        </span>
      )}
    </div>
  );
}

function ProfileModal({ open, onClose, userAuth, profilePic, onProfilePicUpload, onSave, setToast, onDeleteAccount }) {
  const [displayName, setDisplayName] = useState(userAuth?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const isEmail = userAuth?.type === 'email';

  useEffect(() => {
    if (open && userAuth) {
      setDisplayName(userAuth.displayName ?? '');
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
    const err = onSave({
      displayName: name,
      ...(isEmail && { currentPassword: currentPassword || undefined, newPassword: newPassword || undefined }),
    });
    if (err) { setError(err); return; }
    setToast?.('Profile updated!');
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 75 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <User size={18} className="text-emerald-400"/> Edit Profile
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"><X size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex flex-col items-center gap-3 pb-2">
            <ProfileAvatar src={profilePic} displayName={userAuth.displayName} size="lg" onUpload={onProfilePicUpload} />
            <p className="text-xs text-gray-500">Click the avatar to change your photo</p>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">Display name</label>
            <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" placeholder="Your name" />
          </div>
          {userAuth.email && (
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Email</label>
              <input type="email" value={userAuth.email} readOnly className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-400 cursor-not-allowed" />
            </div>
          )}
          {isEmail && (
            <>
              <div className="pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-500 font-medium mb-2">Change password (optional)</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Current password</label>
                    <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" placeholder="Current password" autoComplete="current-password" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">New password</label>
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" placeholder="At least 6 characters" autoComplete="new-password" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Confirm new password</label>
                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" placeholder="Repeat new password" autoComplete="new-password" />
                  </div>
                </div>
              </div>
            </>
          )}
          <div className="pt-3 border-t border-gray-800">
            <button
              type="button"
              onClick={onDeleteAccount}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-red-400 hover:bg-red-500/10 border border-red-900/40 transition-colors"
            >
              Delete Account
            </button>
            <p className="text-xs text-gray-600 mt-1.5 text-center">Permanently delete your account and all data</p>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-semibold text-sm hover:bg-gray-700">Cancel</button>
            <button type="submit" className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm">Save</button>
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
        className="relative w-full max-w-sm bg-gray-950 rounded-2xl border border-red-900/50 shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-bold text-red-400 flex items-center gap-2">
            <Trash2 size={18} className="text-red-400" /> Delete Account
          </h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-300">
            This will <span className="text-red-400 font-semibold">permanently delete</span> your account and all your data, including your disc collection, bags, and ace history. This action cannot be undone.
          </p>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">
              Type <span className="text-red-400 font-bold">DELETE</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
              placeholder="DELETE"
              disabled={deleting}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={deleting} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-semibold text-sm hover:bg-gray-700">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={confirmText !== 'DELETE' || deleting}
              className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-all"
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
// FREEMIUM: ProBadge & UpgradeModal
// ═══════════════════════════════════════════════════════
function ProBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 ${className}`}>
      PRO
    </span>
  );
}

function UpgradeModal({ open, onClose, onStartTrial }) {
  if (!open) return null;
  const benefits = [
    'Unlimited bags',
    'Unlimited discs in your library',
    'Full Gap Finder with buy recommendations',
    'Unlimited aces in your Trophy Room',
    'Coming soon: AI Bag Review & Throw Translator',
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 80 }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.98, opacity: 0 }}
        className="relative w-full max-w-md bg-gray-950 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden"
      >
        <div className="p-6 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={20} className="text-emerald-400 shrink-0" />
            <ProBadge />
          </div>
          <h2 className="text-xl font-black text-white mt-2">Unlock Your Full Bag Potential</h2>
          <p className="text-sm text-gray-400 mt-1.5">Get the most out of your disc golf game with Pro.</p>
          <ul className="mt-5 space-y-2.5">
            {benefits.map((item, i) => (
              <li key={i} className="flex items-center gap-2.5 text-sm text-gray-300">
                <Check size={16} className="text-emerald-400 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex items-center gap-4 text-sm">
            <span className="text-gray-500">$2.99<span className="text-gray-600">/month</span></span>
            <span className="text-gray-600">or</span>
            <span className="text-emerald-400 font-bold">$24.99<span className="text-emerald-500/80 font-medium">/year</span></span>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors">
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => { onStartTrial(); onClose(); }}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25 transition-colors"
          >
            Start Free Trial
          </button>
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
        <div className="max-w-lg mx-auto rounded-xl border border-gray-800 bg-gray-950/95 backdrop-blur-md shadow-xl border-emerald-500/20 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-xl">
              {bannerType === 'android' ? (
                <Download size={20} className="text-emerald-400" />
              ) : (
                <span aria-hidden="true">⬆️</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {bannerType === 'android' ? (
                <>
                  <p className="text-sm font-semibold text-white">Install Disc Golf Companion for the best experience!</p>
                  <p className="text-xs text-gray-400 mt-0.5">Add to home screen for quick access and offline use.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-white">Install this app: tap the Share button then &quot;Add to Home Screen&quot;</p>
                  <p className="text-xs text-gray-400 mt-1">Tap <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-700 text-base">⬆️</span> then &quot;Add to Home Screen&quot;</p>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {bannerType === 'android' && (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-colors"
                >
                  Install
                </button>
              )}
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
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
// FLIGHT PATH (BH / FH MIRRORING)
// ═══════════════════════════════════════════════════════
function FlightPath({turn,fade,id,large,defaultMode='both',hideToggle=false}) {
  const [mode,setMode] = useState(defaultMode);
  useEffect(() => { setMode(defaultMode); }, [defaultMode]);
  const sc = large?1.55:1;
  const w = Math.round(82*sc), h = Math.round(96*sc), cx = w/2;

  const makePath = (mirror) => {
    const m = mirror ? -1 : 1;
    const tp = turn*-5.5*m*sc, fp = fade*-5*m*sc;
    const cl = (v,mn,mx) => Math.max(mn,Math.min(mx,v));
    const sy = h-Math.round(10*sc), ty = h*0.38, ey = Math.round(10*sc);
    const tx = cl(cx+tp,8,w-8), ex = cl(cx+tp*0.5+fp,8,w-8);
    return {
      d:`M ${cx} ${sy} C ${cx} ${(sy+ty)/2}, ${tx} ${ty+15*sc}, ${tx} ${ty} C ${tx} ${ty-12*sc}, ${ex} ${ey+15*sc}, ${ex} ${ey}`,
      ex, ey, sx:cx, sy
    };
  };

  const bh = makePath(false), fh = makePath(true);
  const showBH = mode!=='fh', showFH = mode!=='bh';
  const fs = large?9:7, lfs = large?8:6;

  return (
    <div className="flex flex-col items-center">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
        <line x1={cx} y1={6} x2={cx} y2={h-6} stroke="white" strokeOpacity={0.06} strokeDasharray="2,4"/>
        <text x={cx} y={h-1} textAnchor="middle" fill="white" fillOpacity={0.1} fontSize={fs} fontWeight="bold">TEE</text>
        {showBH && <motion.path key={`bh-${mode}`} d={bh.d} fill="none" stroke={`url(#bh_${id})`} strokeWidth={2.5} strokeLinecap="round" initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:0.9,ease:'easeOut'}}/>}
        {showFH && <motion.path key={`fh-${mode}`} d={fh.d} fill="none" stroke={`url(#fh_${id})`} strokeWidth={2} strokeLinecap="round" strokeDasharray={mode==='both'?'5,3':undefined} initial={{pathLength:0}} animate={{pathLength:1}} transition={{duration:0.9,ease:'easeOut'}}/>}
        {showBH && <circle cx={bh.sx} cy={bh.sy} r={2.5} fill="#10b981"/>}
        {showBH && <motion.g initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7}}><circle cx={bh.ex} cy={bh.ey} r={2} fill="#10b981"/>{mode==='both'&&<text x={bh.ex} y={bh.ey-5} textAnchor="middle" fill="#10b981" fontSize={lfs} fontWeight="bold">BH</text>}</motion.g>}
        {showFH && <motion.g initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.7}}><circle cx={fh.ex} cy={fh.ey} r={2} fill="#a78bfa"/>{mode==='both'&&<text x={fh.ex} y={fh.ey-5} textAnchor="middle" fill="#a78bfa" fontSize={lfs} fontWeight="bold">FH</text>}</motion.g>}
        <defs>
          <linearGradient id={`bh_${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#10b981"/><stop offset="100%" stopColor="#f87171"/></linearGradient>
          <linearGradient id={`fh_${id}`} x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#8b5cf6"/><stop offset="100%" stopColor="#fbbf24"/></linearGradient>
        </defs>
      </svg>
      {!hideToggle && (
        <div className="flex gap-0.5 mt-0.5">
          {[['bh','BH'],['both','Both'],['fh','FH']].map(([k,l]) => (
            <button key={k} onClick={e=>{e.stopPropagation();setMode(k);}}
              className={`px-1.5 py-0.5 rounded transition-all font-bold ${mode===k?'bg-gray-700 text-white':'text-gray-600 hover:text-gray-400'}`}
              style={{fontSize:large?11:8}}>{l}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC FORM MODAL (Add / Edit)
// ═══════════════════════════════════════════════════════
function DiscFormModal({open,onClose,onSave,editDisc}) {
  const [f,setF] = useState({...EMPTY_DISC});
  const fileRef = useRef(null);
  const isEdit = !!editDisc;
  const [logAceWithDisc,setLogAceWithDisc] = useState(false);
  const [aceCourse,setAceCourse] = useState('');
  const [aceHole,setAceHole] = useState('');
  const [aceDate,setAceDate] = useState(td());
  const [aceNotes,setAceNotes] = useState('');
  const [aceDistance,setAceDistance] = useState('');

  useEffect(() => {
    if (open) {
      setF(editDisc ? {...editDisc, story:editDisc.story||'', estimated_value:editDisc.estimated_value||18} : {...EMPTY_DISC, date_acquired:td()});
      if (!editDisc) {
        setLogAceWithDisc(false);
        setAceCourse(''); setAceHole(''); setAceDate(td()); setAceNotes(''); setAceDistance('');
      }
    }
  }, [open, editDisc]);

  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const ok = f.manufacturer && f.mold && f.plastic_type;
  const save = () => {
    const discId = isEdit ? f.id : Date.now().toString();
    const discPayload = {...f, ...(isEdit?{}:{id:discId})};
    const acePayload = logAceWithDisc ? {
      course: aceCourse.trim() || 'Unknown Course',
      hole: parseInt(aceHole) || 0,
      date: aceDate,
      distance: parseInt(aceDistance) || 0,
      notes: aceNotes.trim() || ''
    } : null;
    onSave(discPayload, acePayload);
  };

  const handlePhoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onloadend = () => s('photo', r.result);
    r.readAsDataURL(file);
  };

  return (
    <AnimatePresence>{open && (
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
        <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}} transition={{type:'spring',damping:28}} className="relative w-full max-w-lg bg-gray-900 rounded-t-3xl sm:rounded-2xl border border-gray-800 flex flex-col overflow-hidden" style={{maxHeight:'92vh'}}>
          <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
            <div><h2 className="text-lg font-bold text-white">{isEdit?'Edit Disc':'Add New Disc'}</h2><p className="text-xs text-gray-500 mt-0.5">{isEdit?`Editing ${editDisc.mold}`:'Log a disc to your collection'}</p></div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400"><X size={20}/></button>
          </div>
          <div className="overflow-y-auto flex-1 p-5 space-y-5">
            {/* Photo */}
            <section>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-3">Photo</h3>
              <div className="flex items-center gap-4">
                <DiscVisual disc={f} size="lg"/>
                <div className="flex-1 space-y-2">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto}/>
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-600 text-gray-400 hover:border-emerald-500/50 hover:text-emerald-400 transition-all text-sm font-medium">
                    {f.photo?<><Camera size={14}/>Change</>:<><Upload size={14}/>Upload Photo</>}
                  </button>
                  {f.photo && <button type="button" onClick={() => s('photo',null)} className="w-full text-xs text-red-400 hover:text-red-300 py-1">Remove</button>}
                </div>
              </div>
            </section>
            {/* Identity */}
            <section>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Identity</h3>
              <div className="space-y-2">
                <select value={f.manufacturer} onChange={e=>s('manufacturer',e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500">
                  <option value="">Select manufacturer…</option>{MFRS.map(m=><option key={m}>{m}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input value={f.mold} onChange={e=>s('mold',e.target.value)} placeholder="Mold *" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"/>
                  <input value={f.plastic_type} onChange={e=>s('plastic_type',e.target.value)} placeholder="Plastic *" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"/>
                </div>
                <input value={f.custom_name} onChange={e=>s('custom_name',e.target.value)} placeholder="Nickname (optional)" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"/>
              </div>
            </section>
            {/* Story */}
            <section>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Personal Story</h3>
              <textarea value={f.story} onChange={e=>s('story',e.target.value)} placeholder="What's the story behind this disc?" rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500 resize-none"/>
            </section>
            {/* Type & Status */}
            <section>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Type & Status</h3>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {Object.entries(DT).map(([k,c]) => (
                  <button key={k} type="button" onClick={() => s('disc_type',k)}
                    className={`py-2 rounded-lg text-xs font-bold border transition-all ${f.disc_type===k?`${c.bg} ${c.text} ${c.border}`:'bg-gray-800 text-gray-500 border-gray-700'}`}>{c.label}</button>
                ))}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(SM).map(([k,v]) => (
                  <button key={k} type="button" onClick={() => s('status',k)}
                    className={`py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center justify-center gap-1 ${f.status===k?'bg-gray-700 text-white border-gray-600':'bg-gray-800 text-gray-500 border-gray-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${v.dot}`}/>{v.label}
                  </button>
                ))}
              </div>
            </section>
            {/* Flight Numbers */}
            <section>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Flight Numbers</h3>
              <div className="grid grid-cols-4 gap-2">
                <Stepper label="Speed" value={f.speed} onChange={v=>s('speed',v)} min={1} max={15} step={0.5}/>
                <Stepper label="Glide" value={f.glide} onChange={v=>s('glide',v)} min={1} max={7} step={0.5}/>
                <Stepper label="Turn" value={f.turn} onChange={v=>s('turn',v)} min={-5} max={1} step={0.5}/>
                <Stepper label="Fade" value={f.fade} onChange={v=>s('fade',v)} min={0} max={5} step={0.5}/>
              </div>
              <div className="mt-3 flex justify-center bg-gray-800/50 rounded-xl p-3">
                <FlightPath turn={f.turn} fade={f.fade} id="preview" large defaultMode={f.flight_preference || 'both'} hideToggle/>
              </div>
              <div className="mt-3">
                <label className="block text-xs text-gray-400 mb-1.5 font-medium">Default Flight View</label>
                <div className="flex gap-1.5">
                  {[['bh','Backhand Only','🫲'],['both','Both','↔️'],['fh','Forehand Only','🫱']].map(([k,l,icon]) => (
                    <button key={k} type="button" onClick={() => s('flight_preference',k)}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-all ${
                        f.flight_preference===k 
                          ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50' 
                          : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                      }`}>{icon} {l}</button>
                  ))}
                </div>
              </div>
            </section>
            {/* Physical */}
            <section>
              <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider mb-2">Physical & Value</h3>
              <div className="grid grid-cols-3 gap-2 mb-2">
                <input type="number" value={f.weight_grams} onChange={e=>s('weight_grams',parseInt(e.target.value)||0)} placeholder="Weight (g)" className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"/>
                <input type="date" value={f.date_acquired} onChange={e=>s('date_acquired',e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"/>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">$</span><input type="number" value={f.estimated_value} onChange={e=>s('estimated_value',parseFloat(e.target.value)||0)} className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-7 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"/></div>
              </div>
              <label className="block text-xs text-gray-400 mb-1.5 font-medium">Disc Color</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {DISC_COLORS.map(c => (
                  <button key={c} type="button" onClick={() => s('color',c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${f.color===c?'border-white scale-110':'border-gray-700'}`}
                    style={{backgroundColor:c}}/>
                ))}
              </div>
              <label className="block text-xs text-gray-400 mb-1">Condition: {f.wear_level}/10 · {ww(f.wear_level)}</label>
              <input type="range" min={1} max={10} value={f.wear_level} onChange={e=>s('wear_level',parseInt(e.target.value))} className="w-full accent-emerald-500"/>
              <p className="text-xs text-gray-400 mt-1">1 = Poor (heavily used) → 10 = Mint (brand new)</p>
            </section>
            {/* Log an Ace with this disc (add-only) */}
            {(
              <section>
                <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">{isEdit ? 'Log an Ace' : 'Optional'}</h3>
                <button type="button" onClick={() => setLogAceWithDisc(!logAceWithDisc)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${logAceWithDisc?'bg-amber-500/10 border-amber-500/30':'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${logAceWithDisc?'bg-amber-500 border-amber-500':'border-gray-600'}`}>
                    {logAceWithDisc && <Check size={14} className="text-white"/>}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-semibold ${logAceWithDisc?'text-amber-400':'text-white'}`}>Log an Ace with this disc?</span>
                    <p className="text-xs text-gray-500 mt-0.5">{isEdit ? 'Log a new ace for this disc.' : 'Record your first ace for this disc when you add it.'}</p>
                  </div>
                  {logAceWithDisc && <Trophy size={18} className="text-amber-400 shrink-0"/>}
                </button>
                {logAceWithDisc && (
                  <div className="mt-4 space-y-3 pl-1">
                    <div>
                      <label className="text-xs text-gray-400 font-medium mb-1 block">Course name</label>
                      <input value={aceCourse} onChange={e=>setAceCourse(e.target.value)} placeholder="e.g. Maple Hill" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-medium mb-1 block">Hole number</label>
                      <input type="number" value={aceHole} onChange={e=>setAceHole(e.target.value)} placeholder="7" min={1} max={36} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-medium mb-1 block">Distance (ft)</label>
                      <input type="number" value={aceDistance} onChange={e=>setAceDistance(e.target.value)} placeholder="250" min={50} max={600} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-medium mb-1 block">Date</label>
                      <input type="date" value={aceDate} onChange={e=>setAceDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"/>
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 font-medium mb-1 block">Notes (optional)</label>
                      <input value={aceNotes} onChange={e=>setAceNotes(e.target.value)} placeholder="Any details…" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
          <div className="p-5 border-t border-gray-800 shrink-0 flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-400 font-semibold text-sm">Cancel</button>
            <button onClick={save} disabled={!ok} className={`flex-1 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${ok?'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25':'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>
              {isEdit?<><Check size={16}/>Save Changes</>:<><Plus size={16}/>Add Disc</>}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}</AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════
// ACE FORM MODAL (Log / Edit Ace)
// ═══════════════════════════════════════════════════════
function AceFormModal({open,disc,existingAce,discs,onClose,onSave}) {
  const [date,setDate] = useState(td());
  const [course,setCourse] = useState('');
  const [hole,setHole] = useState('');
  const [distance,setDistance] = useState(250);
  const [selectedDiscId,setSelectedDiscId] = useState('');
  const [witnessed,setWitnessed] = useState(false);
  const [discPickerOpen,setDiscPickerOpen] = useState(false);
  const isEdit = !!existingAce;

  useEffect(() => {
    if (open) {
      if (existingAce) {
        setDate(existingAce.date||td()); setCourse(existingAce.course||'');
        setHole(existingAce.hole?String(existingAce.hole):''); setDistance(existingAce.distance||250);
        setSelectedDiscId(existingAce.discId||''); setWitnessed(existingAce.witnessed||false);
      } else {
        setDate(td()); setCourse(''); setHole(''); setDistance(250);
        setSelectedDiscId(disc?.id||''); setWitnessed(false);
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
      hole: parseInt(hole)||0, distance: parseInt(distance)||0, witnessed
    }, isEdit);
    onClose();
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} onClick={e=>e.stopPropagation()} className="relative w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEdit?'bg-sky-500/15':'bg-amber-500/15'}`}>
            {isEdit?<Edit3 size={20} className="text-sky-400"/>:<Trophy size={20} className="text-amber-400"/>}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">{isEdit?'Edit Ace':'Log an Ace!'}</h2>
            <p className="text-xs text-gray-500 truncate">{displayDisc ? `${displayDisc.manufacturer || 'Unknown'} ${displayDisc.mold}` : 'Select a disc'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-gray-800 text-gray-500"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
          {/* No discs message when opening without a disc and collection is empty */}
          {noDiscsInCollection && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-200">
              Add a disc to your collection first, then log an ace for it.
            </div>
          )}
          {/* Disc picker: always show when logging an ace and user has discs (so they can select which disc) */}
          {discs?.length > 0 ? (
            <div className="relative">
              <label className="text-xs text-gray-400 font-medium mb-1 block">Disc</label>
              <button onClick={() => setDiscPickerOpen(!discPickerOpen)} className="w-full flex items-center gap-2.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-left hover:border-gray-600">
                {activeDisc && <span className="w-5 h-5 rounded-full shrink-0 border border-gray-600" style={{backgroundColor:activeDisc.color||'#6b7280'}}/>}
                <span className="text-sm text-white flex-1 truncate">
                  {activeDisc ? `${activeDisc.manufacturer || 'Unknown'} ${activeDisc.mold}${activeDisc.custom_name ? ` (${activeDisc.custom_name})` : ''}` : 'Select a disc…'}
                </span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${discPickerOpen?'rotate-180':''}`}/>
              </button>
              {discPickerOpen && (
                <>
                  <div className="fixed inset-0" style={{zIndex:9}} onClick={() => setDiscPickerOpen(false)}/>
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto" style={{zIndex:10}}>
                    {discs.map(d => (
                      <button key={d.id} onClick={() => {setSelectedDiscId(d.id);setDiscPickerOpen(false);}}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-700/60 ${d.id===selectedDiscId?'bg-emerald-500/10 text-emerald-400':'text-gray-300'}`}>
                        <span className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor:d.color||'#6b7280'}}/>
                        <span className="flex-1 truncate text-sm">{d.manufacturer || 'Unknown'} {d.mold}{d.custom_name ? ` (${d.custom_name})` : ''}</span>
                        {d.id===selectedDiscId && <Check size={12} className="text-emerald-400 shrink-0"/>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1 block">Date</label>
            <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500"/>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium mb-1 block">Course</label>
            <input value={course} onChange={e=>setCourse(e.target.value)} placeholder="e.g. Maple Hill" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Hole #</label>
              <input type="number" value={hole} onChange={e=>setHole(e.target.value)} placeholder="7" min={1} max={36} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
            </div>
            <div>
              <label className="text-xs text-gray-400 font-medium mb-1 block">Distance (ft)</label>
              <input type="number" value={distance} onChange={e=>setDistance(e.target.value)} placeholder="250" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"/>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium mb-1.5 block">Quick pick</label>
            <div className="flex gap-1.5 flex-wrap">
              {[150,200,250,300,350,400].map(d => (
                <button key={d} type="button" onClick={() => setDistance(d)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${parseInt(distance)===d?'bg-amber-500/20 text-amber-400 border-amber-500/30':'bg-gray-800 text-gray-500 border-gray-700'}`}>{d} ft</button>
              ))}
            </div>
          </div>
          {/* Witnesses toggle */}
          <button type="button" onClick={() => setWitnessed(!witnessed)}
            className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all text-left ${witnessed?'bg-emerald-500/10 border-emerald-500/30':'bg-gray-800 border-gray-700 hover:border-gray-600'}`}>
            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${witnessed?'bg-emerald-500 border-emerald-500':'border-gray-600'}`}>
              {witnessed && <Check size={14} className="text-white"/>}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Users size={13} className={witnessed?'text-emerald-400':'text-gray-500'}/>
                <span className={`text-sm font-semibold ${witnessed?'text-emerald-400':'text-white'}`}>Witnessed Ace</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">Was this ace witnessed by other players?</p>
            </div>
            {witnessed && <Shield size={16} className="text-emerald-400 shrink-0" fill="currentColor"/>}
          </button>
        </div>
        <div className="p-5 border-t border-gray-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-400 font-semibold text-sm">Cancel</button>
          <button onClick={submit} disabled={!isEdit && !hasDiscSelected} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${isEdit?'bg-sky-600 hover:bg-sky-500 text-white':'bg-amber-600 hover:bg-amber-500 text-white'}`}>
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
        <Trophy size={size*0.28} className="text-amber-400" strokeWidth={2.5}/>
        <span className="text-amber-400 font-black tracking-widest" style={{fontSize:size*0.11,marginTop:size*0.02}}>ACE</span>
      </div>
    </div>
  );
}

function AceTradingCard({ace,disc,index,totalAces,onShare,onEdit,onDelete}) {
  const rarity = getAceRarity(ace.distance||0);
  const [hovered,setHovered] = useState(false);
  return (
    <motion.div layout initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} transition={{duration:0.5,delay:index*0.08,type:'spring',damping:25}}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} className="relative group">
      <motion.div className="absolute -inset-1 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-lg" style={{background:rarity.border}}/>
      <div className="relative rounded-2xl overflow-hidden" style={{padding:'1.5px',background:rarity.border}}>
        <div className="relative bg-gray-950 rounded-2xl overflow-hidden">
          {/* Holographic shimmer */}
          <motion.div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{zIndex:5,background:'linear-gradient(105deg,transparent 35%,rgba(255,255,255,0.03) 40%,rgba(255,255,255,0.08) 45%,rgba(255,255,255,0.03) 50%,transparent 55%)',backgroundSize:'250% 100%'}}
            animate={hovered?{backgroundPosition:['200% 0','-100% 0']}:{}} transition={{duration:1.5,repeat:Infinity,ease:'linear'}}/>
          {/* Top banner */}
          <div className="relative px-4 py-3" style={{background:'linear-gradient(135deg,rgba(0,0,0,0.6),rgba(0,0,0,0.3))'}}>
            <div className="absolute inset-0 opacity-20" style={{background:rarity.border}}/>
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black tracking-widest uppercase ${rarity.text}`}>✦ Ace #{totalAces-index}</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${rarity.bg} ${rarity.text}`} style={{fontSize:9,border:'1px solid currentColor',opacity:0.6}}>{rarity.label}</span>
              </div>
              {ace.witnessed && (
                <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:0.3,type:'spring'}} className="flex items-center gap-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full px-2 py-0.5">
                  <Shield size={10} className="text-emerald-400" fill="currentColor"/>
                  <span className="text-xs font-bold text-emerald-400" style={{fontSize:9}}>VERIFIED</span>
                </motion.div>
              )}
            </div>
          </div>
          {/* Emblem + Disc */}
          <div className="relative px-5 pt-5 pb-3">
            <div className="relative flex flex-col items-center">
              <AceEmblem size={64}/>
              <div className="mt-2">
                <div className="relative">
                  <div className="absolute -inset-1 rounded-full blur-md" style={{backgroundColor:disc?.color||'#6b7280',opacity:0.3}}/>
                  <DiscVisual disc={disc||{color:'#6b7280',mold:'?',manufacturer:'?',wear_level:10}} size="lg"/>
                </div>
              </div>
              <div className="text-center mt-2 w-full">
                <h3 className="text-base font-black text-white leading-tight truncate">{disc?.custom_name||disc?.mold||'Unknown Disc'}</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{disc?.manufacturer||''}{disc?.plastic_type?` · ${disc.plastic_type}`:''}</p>
              </div>
            </div>
          </div>
          {/* Divider */}
          <div className="mx-5 h-px" style={{background:rarity.border,opacity:0.3}}/>
          {/* Stats */}
          <div className="px-5 py-4 space-y-2.5">
            {ace.distance>0 && (
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="flex items-center gap-2 rounded-xl px-4 py-2" style={{background:'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(217,119,6,0.05))',border:'1px solid rgba(251,191,36,0.2)'}}>
                  <Ruler size={14} className="text-amber-400"/>
                  <span className="text-2xl font-black text-amber-400">{ace.distance}</span>
                  <span className="text-xs text-amber-500/70 font-bold uppercase">ft</span>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0"><MapPin size={13} className="text-emerald-400"/></div>
              <div className="flex-1 min-w-0"><span className="text-xs text-gray-600">Course</span><div className="text-sm text-white font-semibold truncate">{ace.course}</div></div>
            </div>
            <div className="flex items-center gap-3">
              {ace.hole>0 && (
                <div className="flex items-center gap-2 flex-1">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/10 flex items-center justify-center shrink-0"><Target size={13} className="text-sky-400"/></div>
                  <div><span className="text-xs text-gray-600">Hole</span><div className="text-sm text-white font-bold">#{ace.hole}</div></div>
                </div>
              )}
              <div className="flex items-center gap-2 flex-1">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0"><Calendar size={13} className="text-purple-400"/></div>
                <div><span className="text-xs text-gray-600">Date</span><div className="text-sm text-white font-semibold">{fmtD(ace.date)}</div></div>
              </div>
            </div>
          </div>
          {/* Actions */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={e=>{e.stopPropagation();onShare(ace,disc);}}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold"
              style={{background:'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(217,119,6,0.1))',border:'1px solid rgba(251,191,36,0.25)',color:'#fbbf24'}}>
              <Share2 size={13}/>Share to Social
            </motion.button>
            <button onClick={e=>{e.stopPropagation();onEdit(ace);}} className="p-2.5 rounded-xl bg-gray-800/80 text-gray-500 hover:text-sky-400 border border-gray-700/50"><Edit3 size={13}/></button>
            <button onClick={e=>{e.stopPropagation();onDelete(ace.id);}} className="p-2.5 rounded-xl bg-gray-800/80 text-gray-500 hover:text-red-400 border border-gray-700/50"><Trash2 size={13}/></button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Platform icon SVGs (brand-style; function declarations so hoisted and safe with minification)
function IconInstagram() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.268 4.771 1.691 5.077 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.299 3.225-1.825 4.771-5.077 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.691-4.919-5.077-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
  );
}
function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
  );
}
function IconX() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
  );
}

function ShareMenuModal({ open, onClose, shareType, message, url, ace, disc, getImageBlob }) {
  const [copied, setCopied] = useState(false);
  const [creatingImage, setCreatingImage] = useState(false);
  const aceCardRef = useRef(null);
  const fullMessage = message + ' ' + (url || SHARE_APP_URL);
  const shareUrl = url || SHARE_APP_URL;
  const hasNativeShare = typeof navigator !== 'undefined' && navigator.share;

  const downloadBlob = (blob, filename) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleInstagram = async () => {
    setCreatingImage(true);
    try {
      if (shareType === 'ace' && ace && aceCardRef.current) {
        const canvas = await html2canvas(aceCardRef.current, { scale: 2, backgroundColor: '#0a0a0a', useCORS: true, logging: false });
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png', 1));
        if (blob) downloadBlob(blob, `ace-${ace.course.replace(/\s/g, '-')}-${ace.date}.png`);
      } else if (shareType === 'bag' && getImageBlob) {
        const blob = await getImageBlob();
        if (blob) downloadBlob(blob, `disc-golf-bag-${Date.now()}.png`);
      }
    } catch (_) {}
    setCreatingImage(false);
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(message)}`, '_blank', 'width=600,height=400');
  };
  const handleTwitter = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}&url=${encodeURIComponent(shareUrl)}`, '_blank', 'width=550,height=420');
  };
  const handleSMS = () => {
    window.location.href = `sms:?&body=${encodeURIComponent(fullMessage)}`;
  };
  const handleCopyLink = () => {
    try {
      navigator.clipboard.writeText(fullMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };
  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: 'Disc Golf Companion', text: message, url: shareUrl });
      onClose();
    } catch (e) { if (e.name !== 'AbortError') {} }
  };

  if (!open) return null;

  const title = shareType === 'ace' ? 'Share your ace' : 'Share your bag';

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}} className="fixed inset-0 flex items-center justify-center p-4 z-[75]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md"/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.95,opacity:0}} transition={{type:'spring',damping:25}} onClick={e=>e.stopPropagation()} className="relative w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-800 text-gray-400"><X size={20}/></button>
          </div>
          <p className="text-xs text-gray-500 mt-1">Choose how to share</p>
        </div>
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {/* Instagram - save image */}
          {(shareType === 'ace' && ace) || (shareType === 'bag' && getImageBlob) ? (
            <button type="button" onClick={handleInstagram} disabled={creatingImage} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm text-white transition-all hover:opacity-90 disabled:opacity-60" style={{background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'}}>
              {creatingImage ? <Loader size={20} className="animate-spin shrink-0"/> : <IconInstagram/>}
              {creatingImage ? 'Creating image…' : 'Save image for Instagram'}
            </button>
          ) : null}
          <button type="button" onClick={handleFacebook} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm text-white transition-all hover:opacity-90" style={{backgroundColor:'#1877f2'}}>
            <IconFacebook/> Share on Facebook
          </button>
          <button type="button" onClick={handleTwitter} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm text-white transition-all hover:opacity-90 bg-black">
            <IconX/> Post on X (Twitter)
          </button>
          <button type="button" onClick={handleSMS} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm text-white transition-all hover:opacity-90" style={{backgroundColor:'#34c759'}}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
            iMessage / SMS
          </button>
          <button type="button" onClick={handleCopyLink} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm bg-gray-800 border border-gray-700 text-gray-200 hover:border-gray-600 transition-all">
            {copied ? <Check size={20} className="shrink-0 text-emerald-400"/> : <Copy size={20} className="shrink-0 text-gray-400"/>}
            {copied ? 'Copied!' : 'Copy link'}
          </button>
          {hasNativeShare && (
            <button type="button" onClick={handleNativeShare} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left font-semibold text-sm bg-gray-800 border border-gray-700 text-gray-200 hover:border-gray-600 transition-all">
              <Share2 size={20} className="shrink-0 text-gray-400"/> More…
            </button>
          )}
        </div>
        {/* Hidden ace card for Instagram capture (ace share only) */}
        {shareType === 'ace' && ace && disc && (
          <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
            <div ref={aceCardRef} style={{ width: 520, minHeight: 380, background: '#0a0a0a', borderRadius: 16, padding: 24, fontFamily: 'system-ui, sans-serif', color: '#fff', boxSizing: 'border-box' }}>
              <div style={{ textAlign: 'center', padding: '16px 0', background: 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(217,119,6,0.08))', margin: '-24px -24px 20px -24px', borderRadius: '16px 16px 0 0' }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fbbf24' }}>NEW ACE LOGGED!</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: disc.color || '#6b7280', marginBottom: 12 }}/>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{disc.custom_name || disc.mold || 'Unknown'}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>{disc.manufacturer || ''}{disc.plastic_type ? ` · ${disc.plastic_type}` : ''}</div>
                <div style={{ width: '100%', height: 1, background: 'rgba(251,191,36,0.3)', marginBottom: 12 }}/>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{ace.course}</div>
                <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
                  {ace.hole > 0 && <span>Hole #{ace.hole}</span>}
                  {ace.distance > 0 && <span style={{ color: '#fbbf24', fontWeight: 700 }}>{ace.distance} ft</span>}
                </div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{fmtD(ace.date)}</div>
              </div>
              <div style={{ marginTop: 20, fontSize: 10, color: '#4b5563', textAlign: 'center' }}>Disc Golf Companion · discgolfcompanion.vercel.app</div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

function ShareOverlay({open,ace,disc,onClose}) {
  if (!open || !ace) return null;
  const message = `Check out my ace on Disc Golf Companion! 🥏`;
  return (
    <ShareMenuModal open={open} onClose={onClose} shareType="ace" message={message} ace={ace} disc={disc}/>
  );
}

function TrophyRoomModal({open,onClose,aces,discs,onShare,onEditAce,onDeleteAce,onLogAce}) {
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
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} className="relative w-full max-w-3xl bg-gray-950 rounded-t-3xl sm:rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl" style={{maxHeight:'92vh'}}>
        {/* Gold bar */}
        <div className="h-1.5 shrink-0" style={{background:'linear-gradient(90deg,#d97706,#fbbf24,#fef08a,#fbbf24,#d97706)'}}/>
        {/* Header */}
        <div className="shrink-0 border-b border-gray-800 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center relative" style={{background:'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(217,119,6,0.08))',border:'1px solid rgba(251,191,36,0.25)'}}>
                <motion.div animate={{rotate:[0,5,-5,0]}} transition={{duration:4,repeat:Infinity}}><Trophy size={28} className="text-amber-400"/></motion.div>
                {aces.length>0 && <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-amber-500 text-gray-950 text-xs font-black flex items-center justify-center shadow-lg">{aces.length}</span>}
              </div>
              <div>
                <h2 className="text-xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">Trophy Case</h2>
                <p className="text-xs text-gray-500 mt-0.5">{aces.length===0?'Start your legendary collection':'Your legendary ace collection'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {aces.length>0 && (
                <button type="button" onClick={e => { e.stopPropagation(); onLogAce?.(); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-all">
                  <Trophy size={14}/>Add an Ace
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400"><X size={20}/></button>
            </div>
          </div>
          {aces.length>0 && (
            <div className="grid grid-cols-4 gap-2 mt-4">
              <div className="rounded-xl p-2.5 text-center" style={{background:'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(217,119,6,0.05))',border:'1px solid rgba(251,191,36,0.2)'}}><div className="text-xl font-black text-amber-400">{aces.length}</div><div className="text-xs text-amber-500/60 font-medium">Total</div></div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-white">{uniqueCourses}</div><div className="text-xs text-gray-500">Courses</div></div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-amber-400">{longestAce?longestAce.distance+'ft':'—'}</div><div className="text-xs text-gray-500">Longest</div></div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-2.5 text-center"><div className="text-lg font-bold text-emerald-400">{witnessedCount}</div><div className="text-xs text-gray-500">Verified</div></div>
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
              <h3 className="text-xl font-black text-white mb-2">Your first Ace is waiting.</h3>
              <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">Log your rounds to start your collection!</p>
              <div className="flex items-center gap-3 mb-6">
                {[0,1,2].map(i => (
                  <motion.div key={i} animate={{opacity:[0.2,0.6,0.2],scale:[0.8,1.1,0.8]}} transition={{duration:2,repeat:Infinity,delay:i*0.5}}>
                    <Sparkles size={16} className="text-amber-500/40"/>
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
                  onShare={onShare} onEdit={onEditAce} onDelete={id=>setConfirmDelete(id)}/>
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
// BAG DASHBOARD with GAP FINDER
// ═══════════════════════════════════════════════════════
function BagDashboard({bagDiscs,bag,allDiscs,onAddToBag,onRemoveFromBag,onBuySearch,isPro,onUpgradeClick}) {
  const [expandedGap,setExpandedGap] = useState(null);
  const shareCardRef = useRef(null);
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

  const bagDiscIds = useMemo(() => bag ? bag.disc_ids : [], [bag]);

  // Gap Finder Logic — deep analysis
  const gaps = useMemo(() => {
    const g = [];
    const seenKeys = new Set();

    const add = (entry) => {
      if (seenKeys.has(entry.key)) return;
      seenKeys.add(entry.key);
      g.push(entry);
    };

    // 1) Missing entire disc type (high)
    Object.entries(DT).forEach(([type, cfg]) => {
      if (typeCounts[type] === 0) add({ key: `type_${type}`, sev: 'high', msg: `No ${cfg.label}s in this bag`, suggest: `Add a ${cfg.label.toLowerCase()}`, filterType: 'disc_type', filterValue: type, buySuggestionKey: type === 'fairway_driver' ? 'fairway_driver' : type === 'distance_driver' ? 'distance_driver' : type });
    });

    // 2) Speed gap analysis: consecutive discs (sorted by speed) with gap of 3+
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
          suggest: `Add a disc in the speed ${minS}–${maxS} range`,
          filterType: 'speed_gap',
          filterValue: { minSpeed: minS, maxSpeed: maxS },
          disc1Name: lowName,
          disc2Name: highName,
          buySuggestionKey: maxS <= 5 ? 'speed_4_5' : maxS <= 8 ? 'speed_6_8' : 'speed_9_11',
        });
      }
    }

    // 3) Stability coverage per speed tier: need at least one understable and one overstable per tier
    SPEED_TIERS.forEach(tier => {
      const inTier = bagDiscs.filter(d => d.speed >= tier.min && d.speed <= tier.max);
      if (inTier.length === 0) return;
      const hasUnder = inTier.some(d => classifyStability(d) === 'understable');
      const hasOver = inTier.some(d => classifyStability(d) === 'overstable');
      if (!hasUnder) add({
        key: `stab_${tier.id}_under`,
        sev: 'medium',
        msg: `${tier.label}: no understable option`,
        suggest: `Add an understable disc in the speed ${tier.min}–${tier.max} range`,
        filterType: 'stability_slot',
        filterValue: { tier: tier.id, stability: 'understable', minSpeed: tier.min, maxSpeed: tier.max },
        buySuggestionKey: `stability_${tier.id}_understable`,
      });
      if (!hasOver) add({
        key: `stab_${tier.id}_over`,
        sev: 'medium',
        msg: `${tier.label}: no overstable option`,
        suggest: `Add an overstable disc in the speed ${tier.min}–${tier.max} range`,
        filterType: 'stability_slot',
        filterValue: { tier: tier.id, stability: 'overstable', minSpeed: tier.min, maxSpeed: tier.max },
        buySuggestionKey: `stability_${tier.id}_overstable`,
      });
    });

    // 4) Missing utility shots
    const overstableApproach = bagDiscs.some(d => d.speed >= 2 && d.speed <= 4 && (d.fade ?? 0) >= 3);
    if (!overstableApproach) add({
      key: 'utility_overstable_approach',
      sev: 'medium',
      msg: 'No overstable approach disc (speed 2–4, fade ≥ 3)',
      suggest: 'Add a Zone, Harp, or similar for reliable fade upshots',
      filterType: 'utility',
      filterValue: 'overstable_approach',
      buySuggestionKey: 'utility_overstable_approach',
    });
    const turnover = bagDiscs.some(d => d.speed >= 6 && d.speed <= 9 && (d.turn ?? 0) <= -2);
    if (!turnover) add({
      key: 'utility_turnover',
      sev: 'medium',
      msg: 'No understable turnover disc (speed 6–9, turn ≤ -2)',
      suggest: 'Add a Leopard3, Roadrunner, or similar for turnover shots',
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
      suggest: 'Add a Buzzz, Hex, or Mako3 for dead-straight mid shots',
      filterType: 'utility',
      filterValue: 'neutral_mid',
      buySuggestionKey: 'utility_neutral_mid',
    });

    // 5) Overlap / redundancy: flight numbers within 0.5 (connected components)
    const near = (a, b) => Math.abs((a ?? 0) - (b ?? 0)) <= 0.5;
    const sameFlight = (d1, d2) => near(d1.speed, d2.speed) && near(d1.glide, d2.glide) && near(d1.turn, d2.turn) && near(d1.fade, d2.fade);
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
          if (sameFlight(d2, other)) {
            group.push(other);
            used.add(other.id);
            queue.push(other);
          }
        });
      }
      if (group.length >= 2) redundantGroups.push(group);
    });
    redundantGroups.forEach((group, idx) => {
      const names = group.map(d => d.custom_name || d.mold).join(', ');
      add({
        key: `redundancy_${idx}`,
        sev: 'low',
        msg: 'These discs overlap — consider swapping one for something different',
        suggest: names,
        filterType: 'redundancy',
        filterValue: group.map(d => d.id),
        discs: group,
        isRedundancy: true,
        buySuggestionKey: 'redundancy',
      });
    });

    return g;
  }, [bagDiscs, typeCounts]);

  const getLibraryMatches = useCallback((gap) => {
    if (!allDiscs || !bag) return [];
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
  }, [allDiscs, bagDiscIds, bag]);

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

  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const getBagImageBlob = useCallback(async () => {
    if (!shareCardRef.current) return null;
    await new Promise(r => setTimeout(r, 100));
    const canvas = await html2canvas(shareCardRef.current, {
      scale: 2,
      backgroundColor: '#030712',
      useCORS: true,
      logging: false,
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 1));
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
      {/* Bag name + Share */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:bagColor}}/>
          <h2 className="text-lg font-bold text-white truncate">{bag?.name || 'My Bag'}</h2>
        </div>
        <motion.button
          whileHover={{scale:1.02}} whileTap={{scale:0.98}}
          onClick={() => setShareMenuOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-gray-200 hover:border-emerald-500/40 hover:text-emerald-400 transition-all text-sm font-semibold"
        >
          <Share2 size={16}/>Share My Bag
        </motion.button>
      </div>

      {/* Hidden card for html2canvas (inline styles for capture) */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, zIndex: -1, pointerEvents: 'none' }}>
        <div
          ref={shareCardRef}
          style={{
            width: 600,
            minHeight: 400,
            background: '#030712',
            borderRadius: 20,
            padding: 28,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            color: '#fff',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: bagColor, flexShrink: 0 }}/>
            <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>{bag?.name || 'My Bag'}</span>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Discs</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '6px 16px', marginBottom: 20, fontSize: 13 }}>
            {bagDiscs.map(d => (
              <div key={d.id} style={{ display: 'contents' }}>
                <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{d.custom_name || d.mold}</span>
                <span style={{ color: '#6b7280', textAlign: 'right' }}>{d.speed}/{d.glide}/{d.turn}/{d.fade}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Type breakdown</div>
              {Object.entries(DT).map(([k, cfg]) => {
                const ct = typeCounts[k] || 0;
                const pct = maxTC > 0 ? (ct / maxTC) * 100 : 0;
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.color, flexShrink: 0 }}/>
                    <span style={{ fontSize: 12, color: '#9ca3af', width: 72 }}>{cfg.label}s</span>
                    <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: cfg.color, borderRadius: 4, opacity: ct === 0 ? 0.3 : 0.8 }}/>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color, width: 20, textAlign: 'right' }}>{ct}</span>
                  </div>
                );
              })}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Stability</div>
              {Object.entries(STAB_META).map(([k, meta]) => {
                const ct = stabCounts[k] || 0;
                const pct = maxSC > 0 ? (ct / maxSC) * 100 : 0;
                return (
                  <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: meta.color, width: 12, textAlign: 'center' }}>{meta.icon}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', width: 88 }}>{meta.label}</span>
                    <div style={{ flex: 1, height: 8, background: '#1f2937', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: meta.color, borderRadius: 4, opacity: ct === 0 ? 0.3 : 0.8 }}/>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: meta.color, width: 20, textAlign: 'right' }}>{ct}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 14px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Discs</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>{bagDiscs.length}</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 14px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Avg speed</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>{avgSpeed}</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 14px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Speed range</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#a78bfa' }}>{speedRange}</div>
            </div>
            <div style={{ background: '#0f172a', borderRadius: 12, padding: '12px 14px', border: '1px solid #1e293b' }}>
              <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bag value</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>${totalValue}</div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #1f2937', paddingTop: 14, fontSize: 10, color: '#4b5563', textAlign: 'center' }}>
            Built with {APP_URL}
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-gradient-to-br from-emerald-950/50 to-gray-900 rounded-xl p-4 border border-emerald-800/30">
          <div className="flex items-center gap-2 mb-1"><DollarSign size={14} className="text-emerald-400"/><span className="text-xs text-emerald-500/80 font-bold uppercase tracking-wider">Bag Value</span></div>
          <div className="text-2xl font-black text-emerald-400">${totalValue}</div>
          <div className="text-xs text-gray-500 mt-0.5">{bagDiscs.length} disc{bagDiscs.length!==1?'s':''}</div>
        </div>
        <div className="bg-gradient-to-br from-sky-950/40 to-gray-900 rounded-xl p-4 border border-sky-800/30">
          <div className="flex items-center gap-2 mb-1"><Zap size={14} className="text-sky-400"/><span className="text-xs text-sky-500/80 font-bold uppercase tracking-wider">Avg Weight</span></div>
          <div className="text-2xl font-black text-sky-400">{avgWeight.toFixed(1)}<span className="text-sm text-gray-500">g</span></div>
        </div>
        <div className="bg-gradient-to-br from-amber-950/40 to-gray-900 rounded-xl p-4 border border-amber-800/30">
          <div className="flex items-center gap-2 mb-1"><BarChart3 size={14} className="text-amber-400"/><span className="text-xs text-amber-500/80 font-bold uppercase tracking-wider">Avg Speed</span></div>
          <div className="text-2xl font-black text-amber-400">{(bagDiscs.reduce((s,d)=>s+d.speed,0)/bagDiscs.length).toFixed(1)}</div>
        </div>
        <div className="bg-gradient-to-br from-purple-950/40 to-gray-900 rounded-xl p-4 border border-purple-800/30">
          <div className="flex items-center gap-2 mb-1"><Crosshair size={14} className="text-purple-400"/><span className="text-xs text-purple-500/80 font-bold uppercase tracking-wider">Speed Range</span></div>
          <div className="text-2xl font-black text-purple-400">{Math.min(...bagDiscs.map(d=>d.speed))}–{Math.max(...bagDiscs.map(d=>d.speed))}</div>
        </div>
      </div>
      {/* Type + Stability breakdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800/50">
          <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3"><BarChart3 size={12}/>Type Breakdown</h3>
          <div className="space-y-2.5">
            {Object.entries(DT).map(([k,cfg]) => {
              const ct = typeCounts[k]; const pct = maxTC>0?(ct/maxTC)*100:0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor:cfg.color}}/><span className="text-xs text-gray-300 font-medium">{cfg.label}s</span></div>
                    <span className={`text-sm font-black ${ct===0?'text-gray-600':cfg.text}`}>{ct}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.6}} className="h-full rounded-full" style={{backgroundColor:cfg.color,opacity:ct===0?0.2:0.7}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800/50">
          <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3"><Crosshair size={12}/>Stability Spectrum</h3>
          <div className="space-y-2.5">
            {Object.entries(STAB_META).map(([k,meta]) => {
              const ct = stabCounts[k]; const pct = maxSC>0?(ct/maxSC)*100:0;
              return (
                <div key={k}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2"><span className="text-sm">{meta.icon}</span><span className="text-xs text-gray-300 font-medium">{meta.label}</span></div>
                    <span className={`text-sm font-black ${ct===0?'text-gray-600':meta.text}`}>{ct}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:.6}} className="h-full rounded-full" style={{backgroundColor:meta.color,opacity:ct===0?0.2:0.7}}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {/* Discs in bag */}
      <div className="bg-gray-900/80 rounded-xl p-4 border border-gray-800/50">
        <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3"><Package size={12}/>Discs in Bag ({bagDiscs.length})</h3>
        <div className="space-y-1.5">
          {bagDiscs.map(d => {
            const cfg = DT[d.disc_type];
            return (
              <div key={d.id} className="flex items-center gap-2.5 bg-gray-800/60 rounded-lg px-3 py-2.5 group hover:bg-gray-800 transition-colors">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{backgroundColor:d.color||'#6b7280'}}>
                  <span className="text-xs font-black" style={{color:luma(d.color||'#888')>160?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.85)'}}>{d.speed}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-sm font-bold text-white truncate">{d.custom_name||d.mold}</span><span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`} style={{fontSize:9}}>{cfg.label}</span></div>
                  <span className="text-xs text-gray-500">{d.manufacturer} · {d.speed}/{d.glide}/{d.turn}/{d.fade}</span>
                </div>
                <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={() => onRemoveFromBag(bag.id,d.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-bold border border-red-500/20 hover:bg-red-500/20 shrink-0 opacity-60 group-hover:opacity-100">
                  <X size={12}/>Remove
                </motion.button>
              </div>
            );
          })}
        </div>
      </div>
      {/* GAP FINDER */}
      <div className="bg-gradient-to-r from-amber-950/30 to-gray-900/50 rounded-xl p-4 border border-amber-800/25">
        <h3 className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-3">
          <AlertTriangle size={12}/>Gap Finder
          {gaps.length>0 ? <span className="text-gray-600 font-medium normal-case tracking-normal ml-1">· {gaps.length} gap{gaps.length!==1?'s':''}</span> : <span className="text-emerald-400 font-medium normal-case tracking-normal ml-1">· ✓ No gaps!</span>}
        </h3>
        {gaps.length===0 && (
          <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0"><Check size={20} className="text-emerald-400"/></div>
            <div><div className="text-sm font-bold text-emerald-400">All categories covered!</div><div className="text-xs text-emerald-500/60 mt-0.5">Your bag has all disc types and stability profiles.</div></div>
          </div>
        )}
        {gaps.length>0 && (
          <div className="space-y-2">
            {gaps.map(g => {
              const isExp = expandedGap===g.key;
              const libraryMatches = getLibraryMatches(g);
              const buySuggestions = getBuySuggestions(g);
              const isRedundancy = g.isRedundancy === true;
              const cardCls = isRedundancy ? 'bg-sky-500/5 border-sky-500/20' : (g.sev==='high'?'bg-red-500/5 border-red-500/20':'bg-amber-500/5 border-amber-500/15');
              const iconCls = isRedundancy ? 'text-sky-400' : (g.sev==='high'?'text-red-400':'text-amber-500/70');
              const titleCls = isRedundancy ? 'text-sky-400' : (g.sev==='high'?'text-red-400':'text-amber-400');
              return (
                <div key={g.key} className={`rounded-xl border cursor-pointer transition-all overflow-hidden ${cardCls}`} onClick={() => setExpandedGap(isExp?null:g.key)}>
                  <div className="flex items-start gap-2.5 px-3.5 py-3">
                    {isRedundancy ? <Info size={14} className={`mt-0.5 shrink-0 ${iconCls}`}/> : <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${iconCls}`}/>}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-bold ${titleCls}`}>{g.msg}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{g.suggest}</div>
                    </div>
                    <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 shrink-0 ${isExp?'rotate-180':''}`}/>
                  </div>
                  <AnimatePresence>
                    {isExp && (
                      <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                        <div className="px-3.5 pb-4 space-y-3" onClick={e=>e.stopPropagation()}>
                          <div className="border-t border-gray-800/50 pt-3"/>
                          {/* From your collection */}
                          {libraryMatches.length > 0 && (
                            <div className="relative">
                              <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2"><Library size={11}/>From Your Collection ({libraryMatches.length}) {!isPro && <ProBadge />}</h4>
                              <div className={`space-y-1.5 ${!isPro ? 'select-none pointer-events-none blur-sm' : ''}`}>
                                {libraryMatches.slice(0,4).map(d => (
                                  <div key={d.id} className="flex items-center gap-2.5 bg-gray-800/60 rounded-lg px-3 py-2.5">
                                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{backgroundColor:d.color||'#6b7280'}}>
                                      <span className="text-xs font-black" style={{color:luma(d.color||'#888')>160?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.85)'}}>{d.speed}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-bold text-white truncate block">{d.custom_name||d.mold}</span>
                                      <span className="text-xs text-gray-500">{d.manufacturer} · {d.speed}/{d.glide}/{d.turn}/{d.fade}</span>
                                    </div>
                                    <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={() => onAddToBag(bag.id,d.id)}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-bold border border-emerald-500/25">
                                      <Plus size={12}/>Add
                                    </motion.button>
                                  </div>
                                ))}
                              </div>
                              {!isPro && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-950/80" onClick={onUpgradeClick}>
                                  <button type="button" className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-bold hover:bg-emerald-500/20 transition-colors">
                                    <Sparkles size={20}/>
                                    <span>Upgrade to Pro</span>
                                    <span className="text-xs font-medium text-gray-400">to see matches from your collection</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {libraryMatches.length === 0 && isPro && (
                            <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2.5">
                              <Library size={13} className="text-gray-600 shrink-0"/><span className="text-xs text-gray-500">No matching discs in your collection</span>
                            </div>
                          )}
                          {!isPro && libraryMatches.length === 0 && (
                            <div className="relative rounded-lg overflow-hidden">
                              <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2.5 blur-sm select-none">
                                <Library size={13} className="text-gray-600 shrink-0"/><span className="text-xs text-gray-500">3 matching discs found in your collection</span>
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center bg-gray-950/60" onClick={onUpgradeClick}>
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1"><Sparkles size={12}/>Upgrade to see collection matches</span>
                              </div>
                            </div>
                          )}
                          {/* Buy suggestions */}
                          {buySuggestions.length>0 && (
                            <div className="relative">
                              <h4 className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-wider mb-2"><ShoppingCart size={11}/>Popular Picks to Buy</h4>
                              <div className="space-y-1.5">
                                {buySuggestions.map((s,si) => (
                                  <div key={si} className="flex items-center gap-2.5 bg-gray-800/40 rounded-lg px-3 py-2.5">
                                    <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center shadow-md" style={{backgroundColor:s.color||'#6b7280'}}>
                                      <span className="text-xs font-black" style={{color:luma(s.color||'#888')>160?'rgba(0,0,0,0.7)':'rgba(255,255,255,0.85)'}}>{s.speed}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-bold text-white">{s.mold}</div>
                                      <div className="text-xs text-gray-500">{s.manufacturer} · {s.plastic}</div>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-400">{s.price}</span>
                                    <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={() => onBuySearch(s)}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/12 text-amber-400 text-xs font-semibold border border-amber-500/20">
                                      <ShoppingCart size={10}/>Shop
                                    </motion.button>
                                  </div>
                                ))}
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
        )}
      </div>
    </motion.div>
    <AnimatePresence>{shareMenuOpen && <ShareMenuModal key="bagShare" open onClose={() => setShareMenuOpen(false)} shareType="bag" message="Check out my disc golf bag on Disc Golf Companion! 🥏" getImageBlob={getBagImageBlob}/>}</AnimatePresence>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// BAG SIDEBAR
// ═══════════════════════════════════════════════════════
function BagSidebar({open,onClose,bags,discs,activeBagId,setActiveBagId,onCreateBag,onRemoveDisc,onDeleteBag,onUpdateBag}) {
  const [creating,setCreating] = useState(false);
  const [newName,setNewName] = useState('');
  const [newColor,setNewColor] = useState(BAG_COLORS[0]);
  const [expanded,setExpanded] = useState(null);
  const [editingId,setEditingId] = useState(null);
  const [editName,setEditName] = useState('');
  const [editColor,setEditColor] = useState('');

  const create = () => { if(!newName.trim())return; onCreateBag({name:newName.trim(),bagColor:newColor}); setNewName(''); setCreating(false); };
  const startEdit = b => { setEditingId(b.id); setEditName(b.name); setEditColor(b.bagColor||BAG_COLORS[0]); };
  const saveEdit = () => { if(editName.trim()) onUpdateBag(editingId,{name:editName.trim(),bagColor:editColor}); setEditingId(null); };

  return (
    <AnimatePresence>{open && (
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-40">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}/>
        <motion.div initial={{x:-320}} animate={{x:0}} exit={{x:-320}} transition={{type:'spring',damping:30,stiffness:350}}
          className="absolute left-0 top-0 bottom-0 w-80 bg-gray-950 border-r border-gray-800 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
            <div><h2 className="text-lg font-bold text-white">My Bags</h2><p className="text-xs text-gray-500 mt-0.5">{bags.length} bag{bags.length!==1?'s':''}</p></div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400"><X size={20}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {/* All Discs button */}
            <button onClick={() => {setActiveBagId(null);onClose();}}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${!activeBagId?'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400':'bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-700'}`}>
              <Target size={18}/><div className="text-left flex-1"><div className="font-semibold text-sm">All Discs</div><div className="text-xs text-gray-500">{discs.length} total</div></div>{!activeBagId&&<Check size={16}/>}
            </button>
            {/* Bag list */}
            {bags.map(bag => {
              const active = activeBagId===bag.id;
              const exp = expanded===bag.id;
              const bd = discs.filter(d => bag.disc_ids.includes(d.id));
              const bc = bag.bagColor||'#6b7280';
              const isEditing = editingId===bag.id;
              return (
                <div key={bag.id} className="rounded-xl border transition-all" style={{borderColor:active?bc+'66':'rgb(31,41,55)',backgroundColor:active?bc+'15':'rgb(17,24,39)'}}>
                  {isEditing ? (
                    <div className="p-3 space-y-2">
                      <input value={editName} onChange={e=>setEditName(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" autoFocus/>
                      <div className="flex flex-wrap gap-1.5">{BAG_COLORS.map(c => (<button key={c} onClick={() => setEditColor(c)} className={`w-5 h-5 rounded-full border-2 ${editColor===c?'border-white scale-110':'border-gray-600'}`} style={{backgroundColor:c}}/>))}</div>
                      <div className="flex gap-2"><button onClick={() => setEditingId(null)} className="flex-1 py-1.5 rounded-lg bg-gray-800 text-gray-400 text-xs font-semibold">Cancel</button><button onClick={saveEdit} className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">Save</button></div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:bc}}/>
                        <button onClick={() => {setActiveBagId(active?null:bag.id);onClose();}} className="text-left flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate" style={{color:active?bc:'rgb(209,213,219)'}}>{bag.name}</div>
                          <div className="text-xs text-gray-500">{bd.length} disc{bd.length!==1?'s':''}</div>
                        </button>
                        <button onClick={() => setExpanded(exp?null:bag.id)} className="p-1 text-gray-500 hover:text-white"><ChevronRight size={14} className={`transition-transform ${exp?'rotate-90':''}`}/></button>
                        <button onClick={() => startEdit(bag)} className="p-1 text-gray-600 hover:text-emerald-400"><Edit3 size={13}/></button>
                        <button onClick={() => onDeleteBag(bag.id)} className="p-1 text-gray-600 hover:text-red-400"><Trash2 size={13}/></button>
                      </div>
                      <AnimatePresence>{exp && (
                        <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                          <div className="px-4 pb-3 space-y-1">
                            {bd.length===0 && <p className="text-xs text-gray-600 py-1">Empty — assign discs from library</p>}
                            {bd.map(d => (
                              <div key={d.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-gray-800/50">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:d.color}}/>
                                <span className="text-xs text-gray-300 flex-1 truncate">{d.custom_name||d.mold}</span>
                                <button onClick={() => onRemoveDisc(bag.id,d.id)} className="text-gray-600 hover:text-red-400 shrink-0"><X size={12}/></button>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}</AnimatePresence>
                    </>
                  )}
                </div>
              );
            })}
            {/* Create new bag */}
            {creating ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Bag name…" autoFocus className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" onKeyDown={e=>e.key==='Enter'&&create()}/>
                <div><label className="block text-xs text-gray-500 mb-1.5 font-medium">Color</label><div className="flex flex-wrap gap-1.5">{BAG_COLORS.map(c => (<button key={c} onClick={() => setNewColor(c)} className={`w-6 h-6 rounded-full border-2 ${newColor===c?'border-white scale-110':'border-gray-600'}`} style={{backgroundColor:c}}/>))}</div></div>
                <div className="flex gap-2"><button onClick={() => setCreating(false)} className="flex-1 py-2 rounded-lg bg-gray-800 text-gray-400 text-xs font-semibold">Cancel</button><button onClick={create} disabled={!newName.trim()} className={`flex-1 py-2 rounded-lg text-xs font-semibold ${newName.trim()?'bg-emerald-600 text-white':'bg-gray-800 text-gray-600 cursor-not-allowed'}`}>Create</button></div>
              </div>
            ) : (
              <button onClick={() => setCreating(true)} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-gray-700 text-gray-500 hover:border-emerald-500/50 hover:text-emerald-400 transition-all text-sm font-medium">
                <Plus size={16}/>Create New Bag
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    )}</AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════
// BACKUP / BUY MODAL
// ═══════════════════════════════════════════════════════
function BackupModal({open,disc,onClose}) {
  const [ready,setReady] = useState(false);
  useEffect(() => { if(open){setReady(false); const t=setTimeout(()=>setReady(true),1500); return ()=>clearTimeout(t);} }, [open]);
  if (!open||!disc) return null;
  const sq = encodeURIComponent(`${disc.manufacturer} ${disc.mold} ${disc.plastic_type} disc golf`);
  const retailers = [
    {name:'Amazon',est:'$16 – $22',text:'text-amber-400',url:`https://www.amazon.com/s?k=${sq}`},
    {name:'Infinite Discs',est:'$14 – $20',text:'text-sky-400',url:`https://infinitediscs.com/search?query=${sq}`},
    {name:'OTB Discs',est:'$15 – $21',text:'text-emerald-400',url:`https://otbdiscs.com/search?q=${sq}`},
  ];
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <DiscVisual disc={disc} size="sm"/>
          <div className="flex-1 min-w-0"><h2 className="text-base font-bold text-white truncate">Buy: {disc.mold}</h2><p className="text-xs text-gray-500">{disc.manufacturer} · {disc.plastic_type}</p></div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-800 text-gray-500 shrink-0"><X size={18}/></button>
        </div>
        <div className="p-5">
          <AnimatePresence mode="wait">
            {!ready ? (
              <motion.div key="ld" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="flex flex-col items-center py-8">
                <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}}><Loader size={24} className="text-emerald-400"/></motion.div>
                <p className="text-sm text-gray-400 mt-3">Searching retailers…</p>
              </motion.div>
            ) : (
              <motion.div key="res" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-2.5">
                {retailers.map((r,i) => (
                  <motion.a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" initial={{opacity:0,x:-12}} animate={{opacity:1,x:0}} transition={{delay:i*0.1}}
                    onClick={() => ReactGA.event({ category: 'Affiliate', action: 'Shop Click', label: r.name })}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-700/50 bg-gray-800/50 hover:bg-gray-800 transition-all block">
                    <ShoppingCart size={16} className={r.text}/><div className="flex-1"><div className={`text-sm font-semibold ${r.text}`}>{r.name}</div></div>
                    <div className="text-sm font-bold text-white">{r.est}</div><ExternalLink size={14} className="text-gray-600 shrink-0"/>
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
function AddToBagPicker({ open, onClose, discs, bag, onAdd }) {
  const [search, setSearch] = useState('');
  if (!open || !bag) return null;

  const available = discs.filter(d => !bag.disc_ids.includes(d.id));
  const filtered = available.filter(d => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (d.mold || '').toLowerCase().includes(q) || (d.manufacturer || '').toLowerCase().includes(q) || (d.custom_name || '').toLowerCase().includes(q);
  });

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}} transition={{type:'spring',damping:28}} className="relative w-full max-w-md bg-gray-900 rounded-t-3xl sm:rounded-2xl border border-gray-800 flex flex-col overflow-hidden" style={{maxHeight:'80vh'}}>
        <div className="flex items-center justify-between p-5 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Add to {bag.name}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{available.length} disc{available.length !== 1 ? 's' : ''} available</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400"><X size={20}/></button>
        </div>
        <div className="px-5 pt-3 shrink-0">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search your discs…"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500"/>
          </div>
        </div>
        <div className="overflow-y-auto flex-1 p-5 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              {available.length === 0 ? 'All your discs are already in this bag!' : 'No discs match your search'}
            </div>
          ) : filtered.map(d => (
            <motion.button key={d.id} whileHover={{scale:1.01}} whileTap={{scale:0.98}}
              onClick={() => { onAdd(bag.id, d.id); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 hover:border-emerald-500/30 transition-all text-left">
              <div className="w-8 h-8 rounded-full border-2 border-gray-600 shrink-0" style={{backgroundColor: d.color || '#22c55e'}}/>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{d.custom_name || d.mold}</p>
                <p className="text-xs text-gray-500 truncate">{d.manufacturer} · {d.plastic_type}</p>
              </div>
              <Plus size={18} className="text-emerald-400 shrink-0"/>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC DETAIL MODAL
// ═══════════════════════════════════════════════════════
function DiscDetailModal({open,disc,onClose,aceHistory,bags,onEdit,onDelete,onLogAce,onBackup,onToggleBag,onViewTrophyRoom,onEditAce}) {
  const [bagDrop,setBagDrop] = useState(false);
  useEffect(() => {if(open)setBagDrop(false);}, [open]);
  if (!open||!disc) return null;
  const cfg = DT[disc.disc_type]; const st = SM[disc.status]; const stab = classifyStability(disc); const stabM = STAB_META[stab];
  const discAces = aceHistory.filter(a => a.discId===disc.id).sort((a,b) => b.date.localeCompare(a.date));
  const inBags = bags.filter(b => b.disc_ids.includes(disc.id));
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}/>
      <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} transition={{type:'spring',damping:30}}
        className="relative w-full max-w-xl bg-gray-950 rounded-t-3xl sm:rounded-2xl border border-gray-800 flex flex-col overflow-hidden shadow-2xl" style={{maxHeight:'90vh'}}>
        <div className="h-1.5 shrink-0" style={{background:disc.color||'#6b7280'}}/>
        <div className="shrink-0 p-5 pb-4 border-b border-gray-800/60">
          <div className="flex items-start gap-4">
            <DiscVisual disc={disc} size="xl"/>
            <div className="flex-1 min-w-0 pt-1">
              {disc.custom_name ? (<><h2 className="text-2xl font-black text-white leading-tight">{disc.custom_name}</h2><p className="text-sm text-gray-400 font-medium mt-0.5">{disc.manufacturer} · {disc.mold} · {disc.plastic_type}</p></>) : (<><p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">{disc.manufacturer}</p><h2 className="text-2xl font-black text-white leading-tight">{disc.mold}</h2><p className="text-sm text-gray-400 font-medium mt-0.5">{disc.plastic_type}</p></>)}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full border" style={{backgroundColor:stabM.color+'15',color:stabM.color,borderColor:stabM.color+'33'}}>{stabM.icon} {stabM.label}</span>
                {st && <span className="flex items-center gap-1.5 text-xs text-gray-400"><span className={`w-2 h-2 rounded-full ${st.dot}`}/>{st.label}</span>}
                {discAces.length>0 && <button onClick={onViewTrophyRoom} className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full"><Trophy size={10}/>×{discAces.length}</button>}
              </div>
              {inBags.length>0 && <div className="flex flex-wrap gap-1.5 mt-2.5">{inBags.map(b => (<span key={b.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{backgroundColor:(b.bagColor||'#6b7280')+'20',color:b.bagColor||'#9ca3af',border:`1px solid ${(b.bagColor||'#6b7280')}44`}}><Package size={9}/>{b.name}</span>))}</div>}
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-500 shrink-0 mt-1"><X size={20}/></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Flight Path */}
          <section className="bg-gray-900/80 rounded-xl p-5 border border-gray-800/50">
            <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3"><Target size={12}/>Flight Path</h3>
            <div className="flex justify-center"><FlightPath turn={disc.turn} fade={disc.fade} id={`detail-${disc.id}`} large defaultMode={disc.flight_preference || 'both'}/></div>
          </section>
          {/* Flight numbers */}
          <div className="grid grid-cols-4 gap-2">
            {FN_META.map(fn => (
              <div key={fn.key} className={`rounded-xl py-3 text-center ${fn.bg} border border-gray-800/40`}>
                <div className={`font-black text-xl leading-none ${fn.text}`}>{disc[fn.key]}</div>
                <div className="text-gray-500 text-xs mt-1 font-bold tracking-widest">{fn.label}</div>
              </div>
            ))}
          </div>
          {/* Specs */}
          <section>
            <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3"><Info size={12}/>Specs</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{l:'Weight',v:disc.weight_grams?`${disc.weight_grams}g`:'—'},{l:'Plastic',v:disc.plastic_type},{l:'Acquired',v:disc.date_acquired?fmtD(disc.date_acquired):'—'},{l:'Value',v:`$${disc.estimated_value||0}`}].map(s => (
                <div key={s.l} className="bg-gray-900/60 border border-gray-800/40 rounded-lg px-3 py-2.5">
                  <div className="text-xs text-gray-500">{s.l}</div><div className="text-sm text-white font-semibold truncate">{s.v}</div>
                </div>
              ))}
            </div>
            <div className="mt-2 bg-gray-900/60 border border-gray-800/40 rounded-lg px-3 py-3">
              <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-500">Condition</span><span className="text-xs text-gray-300 font-bold">{disc.wear_level}/10 · {ww(disc.wear_level)}</span></div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><motion.div className={`h-full rounded-full ${wc(disc.wear_level)}`} initial={{width:0}} animate={{width:`${disc.wear_level*10}%`}} transition={{duration:.8}}/></div>
              <p className="text-xs text-gray-400 mt-1">1 = Poor → 10 = Mint</p>
            </div>
          </section>
          {/* Story */}
          {disc.story && (
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3"><BookOpen size={12}/>The Story</h3>
              <div className="bg-emerald-950/30 rounded-r-xl px-5 py-4" style={{borderLeft:'3px solid rgba(16,185,129,0.4)'}}>
                <p className="text-sm text-gray-300/90 leading-relaxed italic" style={{fontFamily:'Georgia, serif'}}>"{disc.story}"</p>
              </div>
            </section>
          )}
          {/* Ace History */}
          {discAces.length>0 && (
            <section>
              <h3 className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest mb-3"><Trophy size={12}/>Aces ({discAces.length})</h3>
              <div className="space-y-2">{discAces.map((a,i) => (
                <div key={a.id} className="flex items-center gap-3 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 group">
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0"><Trophy size={14} className="text-amber-400"/></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><span className="text-sm font-bold text-white">{a.course}</span>{a.hole>0&&<span className="text-xs text-gray-500">Hole #{a.hole}</span>}{a.witnessed&&<Shield size={10} className="text-emerald-400" fill="currentColor"/>}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{fmtD(a.date)}</div>
                  </div>
                  {a.distance>0 && <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5 shrink-0"><span className="text-sm font-black text-amber-400">{a.distance}</span><span className="text-xs text-amber-500/60 font-bold">ft</span></div>}
                  <button onClick={() => onEditAce(a)} className="p-1.5 rounded-lg text-gray-600 hover:text-sky-400 opacity-0 group-hover:opacity-100 shrink-0"><Edit3 size={13}/></button>
                </div>
              ))}</div>
            </section>
          )}
        </div>
        {/* Footer actions */}
        <div className="shrink-0 border-t border-gray-800/60 p-4 bg-gray-950">
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(disc)} className="p-2.5 rounded-xl text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 border border-gray-800"><Edit3 size={16}/></button>
            <button onClick={() => onDelete(disc.id)} className="p-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-gray-800"><Trash2 size={16}/></button>
            <button onClick={() => onLogAce(disc)} className="p-2.5 rounded-xl text-gray-400 hover:text-amber-400 hover:bg-amber-500/10 border border-gray-800"><Trophy size={16}/></button>
            <div className="flex-1 flex justify-center relative">
              <button onClick={() => setBagDrop(!bagDrop)} className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-all ${bagDrop?'bg-sky-500/25 text-sky-300 border-sky-500/40':'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}><Package size={14}/>Add to Bag</button>
              {bagDrop && (
                <>
                  <div className="fixed inset-0" style={{zIndex:9}} onClick={() => setBagDrop(false)}/>
                  <div className="absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl w-52" style={{zIndex:10}}>
                    {bags.length===0 && <div className="px-3 py-3 text-xs text-gray-500">No bags yet</div>}
                    {bags.map(b => {
                      const inBag = b.disc_ids.includes(disc.id);
                      return (
                        <button key={b.id} onClick={() => onToggleBag(b.id,disc.id)} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-gray-700/60">
                          <span className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${inBag?'border-emerald-500':'border-gray-600'}`} style={inBag?{backgroundColor:b.bagColor||'#10b981',borderColor:b.bagColor||'#10b981'}:{}}>{inBag&&<Check size={10} className="text-white"/>}</span>
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:b.bagColor||'#6b7280'}}/>
                          <span className={inBag?'text-white font-semibold':'text-gray-400'}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <button onClick={() => onBackup(disc)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><ShoppingCart size={14}/>Buy Backup</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC CARDS (List + Gallery views)
// ═══════════════════════════════════════════════════════
function DiscCard({disc,aceCount,bags,viewMode,onLogAce,onViewTrophyRoom,onBackup,onToggleBag,onEdit,onDelete,onDetail,onRemoveFromBag,activeBagId,bagMenuOpen,setBagMenu,idx}) {
  const cfg = DT[disc.disc_type]; const st = SM[disc.status]; const inBags = bags.filter(b=>b.disc_ids.includes(disc.id)); const hasNick = !!disc.custom_name;
  const isGallery = viewMode==='gallery';

  return (
    <motion.div layout initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:.96}} transition={{duration:.35,delay:idx*.025}}
      whileHover={{y:-4,transition:{duration:.2}}} onClick={() => onDetail(disc)}
      className={`bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden hover:border-emerald-600/40 transition-colors group cursor-pointer ${bagMenuOpen?'z-30 relative':'relative'}`}>
      <div className="h-1" style={{background:disc.color||'#6b7280'}}/>
      <div className={`p-4 ${isGallery?'flex flex-col items-center':''}`}>
        {/* Type badge + ace count */}
        <div className={`flex items-center justify-between ${isGallery?'w-full':''} mb-2`}>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>{cfg.label}</span>
          <div className="flex items-center gap-1.5">
            {aceCount>0 && <button onClick={e=>{e.stopPropagation();onViewTrophyRoom();}} className="flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold px-2 py-0.5 rounded-full"><Trophy size={10}/>×{aceCount}</button>}
            {st && !isGallery && <span className="flex items-center gap-1 text-xs text-gray-500"><span className={`w-1.5 h-1.5 rounded-full ${st.dot}`}/>{st.label}</span>}
          </div>
        </div>
        {/* Main content */}
        {isGallery ? (
          <>
            <DiscVisual disc={disc} size="lg"/>
            <div className="text-center mt-3 w-full">
              {hasNick ? (<><h3 className="text-base font-black text-white group-hover:text-emerald-400 truncate">{disc.custom_name}</h3><p className="text-xs text-gray-400 truncate">{disc.manufacturer} · {disc.mold}</p></>) : (<><span className="text-xs text-gray-500">{disc.manufacturer}</span><h3 className="text-base font-extrabold text-white group-hover:text-emerald-400 truncate">{disc.mold}</h3></>)}
            </div>
            <div className="flex items-center justify-center gap-2 mt-2 text-xs">{FN_META.map(fn => <span key={fn.key} className={`font-bold ${fn.text}`}>{disc[fn.key]}</span>)}</div>
          </>
        ) : (
          <div className="flex gap-3 mb-3">
            <DiscVisual disc={disc} size="md"/>
            <div className="flex-1 min-w-0">
              {hasNick ? (<><h3 className="text-lg font-black text-white group-hover:text-emerald-400 truncate">{disc.custom_name}</h3><p className="text-xs text-gray-400 mt-0.5">{disc.manufacturer} · {disc.mold} · {disc.plastic_type}</p></>) : (<><span className="text-xs text-gray-500">{disc.manufacturer}</span><h3 className="text-lg font-extrabold text-white group-hover:text-emerald-400 truncate">{disc.mold}</h3><span className="text-xs text-gray-400">{disc.plastic_type}{disc.weight_grams?` · ${disc.weight_grams}g`:''}</span></>)}
              {disc.estimated_value && <span className="text-xs text-emerald-500/60 font-semibold block">${disc.estimated_value}</span>}
              {disc.story && <p className="text-xs text-gray-500/70 italic mt-1 truncate">"{disc.story.slice(0,60)}{disc.story.length>60?'…':''}"</p>}
              {inBags.length>0 && <div className="flex flex-wrap gap-1 mt-1.5">{inBags.map(b=>(<span key={b.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{backgroundColor:(b.bagColor||'#6b7280')+'18',color:b.bagColor||'#9ca3af',border:`1px solid ${(b.bagColor||'#6b7280')}40`}}><Package size={8}/>{b.name}</span>))}</div>}
            </div>
            <div onClick={e=>e.stopPropagation()}><FlightPath turn={disc.turn} fade={disc.fade} id={disc.id} defaultMode={disc.flight_preference || 'both'}/></div>
          </div>
        )}
        {/* Flight numbers (list only) */}
        {!isGallery && <div className="grid grid-cols-4 gap-1 mb-3">{FN_META.map(fn => (<div key={fn.key} className={`rounded-lg py-1 text-center ${fn.bg}`}><div className={`font-bold text-sm leading-none ${fn.text}`}>{disc[fn.key]}</div><div className="text-gray-600 text-xs mt-0.5 font-bold tracking-widest">{fn.label}</div></div>))}</div>}
        {/* Condition bar */}
        <div className={`flex items-center gap-2 ${isGallery?'w-full mt-2':'mb-3'}`}>
          {!isGallery && <span className="text-xs text-gray-600 w-6">Condition</span>}
          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden"><motion.div className={`h-full rounded-full ${wc(disc.wear_level)}`} initial={{width:0}} animate={{width:`${disc.wear_level*10}%`}} transition={{duration:.6}}/></div>
          <span className="text-xs text-gray-500">{disc.wear_level}/10</span>
        </div>
        {/* Actions */}
        <div className={`flex items-center gap-${isGallery?'1.5':'2'} pt-2 border-t border-gray-800/60 ${isGallery?'w-full mt-1':''}`} onClick={e=>e.stopPropagation()}>
          <div className="flex gap-0.5">
            <button onClick={() => onEdit(disc)} className="p-1.5 rounded-md text-gray-500 hover:text-emerald-400 hover:bg-emerald-500/10"><Edit3 size={isGallery?12:14}/></button>
            <button onClick={() => onDelete(disc.id)} className="p-1.5 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 size={isGallery?12:14}/></button>
            <button onClick={() => onLogAce(disc)} className="p-1.5 rounded-md text-gray-500 hover:text-amber-400 hover:bg-amber-500/10"><Trophy size={isGallery?12:14}/></button>
          </div>
          {activeBagId ? (
            <button onClick={() => onRemoveFromBag(activeBagId,disc.id)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20"><Minus size={11}/>Remove</button>
          ) : (
            <div className="flex-1 flex justify-center relative">
              <button onClick={() => setBagMenu(bagMenuOpen?null:disc.id)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${bagMenuOpen?'bg-sky-500/25 text-sky-300 border-sky-500/40':'bg-sky-500/10 text-sky-400 border-sky-500/20'}`}>
                <Package size={11}/>Bag
              </button>
              {bagMenuOpen && (
                <>
                  <div className="fixed inset-0" style={{zIndex:39}} onClick={e=>{e.stopPropagation();setBagMenu(null);}}/>
                  <div className="absolute bottom-full mb-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl w-44 left-1/2 -translate-x-1/2" style={{zIndex:40}}>
                    {bags.length===0 && <div className="px-3 py-2.5 text-xs text-gray-500">No bags yet</div>}
                    {bags.map(b => {
                      const inBag = b.disc_ids.includes(disc.id);
                      return (
                        <button key={b.id} onClick={() => onToggleBag(b.id,disc.id)} className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700/60">
                          <span className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${inBag?'border-emerald-500':'border-gray-600'}`} style={inBag?{backgroundColor:b.bagColor||'#10b981',borderColor:b.bagColor||'#10b981'}:{}}>{inBag&&<Check size={8} className="text-white"/>}</span>
                          <span className={`truncate ${inBag?'text-white':'text-gray-400'}`}>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
          <button onClick={() => onBackup(disc)} className={`flex items-center gap-1 ${isGallery?'px-2':'px-2.5'} py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20`}><ShoppingCart size={11}/>{isGallery?'Buy':'Buy Backup'}</button>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════
// WELCOME / LANDING SCREEN
// ═══════════════════════════════════════════════════════
function WelcomeScreen({ onGuestClick, onGoogleClick, onEmailSignUp, onEmailLogin, googleButtonContainerRef }) {
  const [view, setView] = useState('main'); // 'main' | 'signup' | 'login'
  const [authError, setAuthError] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const goMain = () => { setView('main'); setAuthError(''); };
  const goSignup = () => { setView('signup'); setAuthError(''); setSignupEmail(''); setSignupName(''); setSignupPassword(''); setSignupConfirm(''); };
  const goLogin = () => { setView('login'); setAuthError(''); setLoginEmail(''); setLoginPassword(''); };

  const handleSignUp = (e) => {
    e.preventDefault();
    setAuthError('');
    const email = signupEmail.trim().toLowerCase();
    const displayName = signupName.trim();
    if (!email) { setAuthError('Please enter an email address.'); return; }
    if (!displayName) { setAuthError('Please enter a display name.'); return; }
    if (signupPassword.length < MIN_PASSWORD_LENGTH) { setAuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`); return; }
    if (signupPassword !== signupConfirm) { setAuthError('Passwords do not match.'); return; }
    const result = onEmailSignUp({ email, displayName, password: signupPassword });
    if (result && result.error) { setAuthError(result.error); return; }
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gray-950 px-4 py-8 overflow-y-auto"
    >
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-center max-w-sm w-full"
      >
        <span className="text-6xl sm:text-7xl block mb-4" role="img" aria-label="Disc">🥏</span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">Disc Golf Companion</h1>
        <p className="text-gray-400 text-sm sm:text-base mb-6">Track your bag. Improve your game.</p>

        {view === 'signup' && (
          <motion.div key="signup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-left">
            <button type="button" onClick={goMain} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-4">
              <ChevronRight size={16} className="rotate-180"/> Back
            </button>
            <form onSubmit={handleSignUp} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Email</label>
                <input type="email" value={signupEmail} onChange={e=>setSignupEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Display name</label>
                <input type="text" value={signupName} onChange={e=>setSignupName(e.target.value)} placeholder="Your name" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" autoComplete="name" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Password</label>
                <input type="password" value={signupPassword} onChange={e=>setSignupPassword(e.target.value)} placeholder="At least 6 characters" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Confirm password</label>
                <input type="password" value={signupConfirm} onChange={e=>setSignupConfirm(e.target.value)} placeholder="Repeat password" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" autoComplete="new-password" />
              </div>
              {authError && <p className="text-sm text-red-400">{authError}</p>}
              <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/25 transition-colors">Sign up</button>
            </form>
          </motion.div>
        )}

        {view === 'login' && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-left">
            <button type="button" onClick={goMain} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm mb-4">
              <ChevronRight size={16} className="rotate-180"/> Back
            </button>
            <form onSubmit={handleLogin} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Email</label>
                <input type="email" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@example.com" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" autoComplete="email" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Password</label>
                <input type="password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Your password" className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500" autoComplete="current-password" />
              </div>
              {authError && <p className="text-sm text-red-400">{authError}</p>}
              <button type="submit" className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/25 transition-colors">Log in</button>
            </form>
          </motion.div>
        )}

        {view === 'main' && (
          <div className="space-y-3 w-full">
            <div className="w-full relative">
              {googleButtonContainerRef && (
                <div
                  ref={googleButtonContainerRef}
                  className="absolute opacity-0 pointer-events-none overflow-hidden"
                  style={{ position: 'absolute', left: '-9999px', top: 0, width: '320px', height: '50px' }}
                  aria-hidden="true"
                />
              )}
              <button
                type="button"
                onClick={onGoogleClick}
                className="relative w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-semibold text-sm border border-gray-200 transition-colors z-[1]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            </div>
            <button
              type="button"
              onClick={goSignup}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm border border-gray-700 transition-colors"
            >
              <Mail size={18}/> Sign up with Email
            </button>
            <button
              type="button"
              onClick={goLogin}
              className="w-full text-sm text-gray-400 hover:text-emerald-400 transition-colors"
            >
              Already have an account? Log in
            </button>
            <motion.button
              type="button"
              onClick={onGuestClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-600/25 transition-colors"
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

  // Load initial state from localStorage; new users get empty arrays (no demo/sample discs or aces)
  const [discs,setDiscs] = useState(() => { const s = loadState(); return s?.discs ?? []; });
  const [aceHistory,setAceHistory] = useState(() => { const s = loadState(); return s?.aceHistory ?? []; });
  const [bags,setBags] = useState(() => { const s = loadState(); return s?.bags ?? []; });

  // Save to localStorage whenever data changes
  useEffect(() => { saveState({discs,aceHistory,bags}); }, [discs,aceHistory,bags]);

  const firestoreSyncUserIdRef = useRef(null);
  const firestoreInitialLoadDoneRef = useRef(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'error'

  // After sign-in: load from Firestore or push current data (guest uses localStorage only)
  useEffect(() => {
    const email = userAuth?.email;
    if (!email) return;
    const userId = emailToUserId(email);
    if (firestoreSyncUserIdRef.current === userId) return;
    firestoreSyncUserIdRef.current = userId;
    firestoreInitialLoadDoneRef.current = false;
    setSyncStatus('syncing');
    loadFromFirestore(userId)
      .then((data) => {
        const localState = loadState();
        const localDiscs = localState?.discs ?? [];
        const localBags = localState?.bags ?? [];
        const localAces = localState?.aceHistory ?? [];
        const remoteDiscs = data?.discs ?? [];
        const remoteBags = data?.bags ?? [];
        const remoteAces = data?.aceHistory ?? [];

        // Use whichever source has more data to prevent data loss
        const localTotal = localDiscs.length + localBags.length + localAces.length;
        const remoteTotal = remoteDiscs.length + remoteBags.length + remoteAces.length;

        if (remoteTotal > 0 && remoteTotal >= localTotal) {
          // Firestore has same or more data — use it
          setDiscs(remoteDiscs);
          setBags(remoteBags);
          setAceHistory(remoteAces);
        } else if (localTotal > 0) {
          // Local has more data — keep local and push to Firestore
          setDiscs(localDiscs);
          setBags(localBags);
          setAceHistory(localAces);
          return syncToFirestore(userId, localDiscs, localBags, localAces);
        }
      })
      .then(() => { setSyncStatus('synced'); firestoreInitialLoadDoneRef.current = true; })
      .catch(() => { setSyncStatus('error'); firestoreInitialLoadDoneRef.current = true; });
  }, [userAuth?.email]);

  // On discs/bags/aceHistory change, sync to Firestore when signed in (after initial load done)
  useEffect(() => {
    const email = userAuth?.email;
    if (!email || !firestoreInitialLoadDoneRef.current || firestoreSyncUserIdRef.current !== emailToUserId(email)) return;
    setSyncStatus('syncing');
    const userId = emailToUserId(email);
    syncToFirestore(userId, discs, bags, aceHistory)
      .then(() => { setSyncStatus('synced'); })
      .catch(() => { setSyncStatus('error'); });
  }, [userAuth?.email, discs, bags, aceHistory]);

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

  const handleEmailSignUp = useCallback(({ email, displayName, password }) => {
    const accounts = loadEmailAccounts();
    if (accounts[email]) return { error: 'An account with this email already exists.' };
    accounts[email] = { displayName, password };
    saveEmailAccounts(accounts);
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
    setGuestMode(false);
    setUserAuth({ type: 'email', email, displayName });
    return null;
  }, []);

  const handleEmailLogin = useCallback(({ email, password }) => {
    const accounts = loadEmailAccounts();
    const account = accounts[email];
    if (!account) return { error: 'No account found with this email.' };
    if (account.password !== password) return { error: 'Wrong password.' };
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
    setGuestMode(false);
    setUserAuth({ type: 'email', email, displayName: account.displayName });
    return null;
  }, []);

  const handleSaveProfile = useCallback(({ displayName, currentPassword, newPassword }) => {
    if (!userAuth) return 'Not signed in.';
    const name = (displayName || '').trim();
    if (!name) return 'Display name cannot be empty.';
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
      saveEmailAccounts(accounts);
    }
    setUserAuth(prev => prev ? { ...prev, displayName: name } : null);
    return null;
  }, [userAuth]);

  const [customProfilePic, setCustomProfilePic] = useState(() => loadProfilePic());
  const effectiveProfilePic = customProfilePic || userAuth?.picture || null;

  const handleProfilePicUpload = useCallback((dataUrl) => {
    saveProfilePic(dataUrl);
    setCustomProfilePic(dataUrl);
    setToast('Profile picture updated!');
  }, []);

  const googleSignInSuccessRef = useRef(null);
  const googleInitializedRef = useRef(false);
  const googleButtonContainerRef = useRef(null);

  useEffect(() => {
    if (showApp) {
      googleInitializedRef.current = false;
      return;
    }
    if (!GOOGLE_CLIENT_ID) return;
    googleSignInSuccessRef.current = (profile) => {
      try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
      setGuestMode(false);
      setUserAuth({ type: 'google', email: profile.email, displayName: profile.displayName, picture: profile.picture || null });
    };
    const tryInit = () => {
      if (googleInitializedRef.current) return;
      if (typeof window === 'undefined' || !window.google?.accounts?.id) return;
      if (!googleButtonContainerRef.current) return;
      googleInitializedRef.current = true;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        use_fedcm_for_prompt: false,
        ux_mode: 'popup',
        callback: (response) => {
          const profile = decodeGoogleJwt(response.credential);
          if (profile && googleSignInSuccessRef.current) googleSignInSuccessRef.current(profile);
        },
      });
      window.google.accounts.id.renderButton(googleButtonContainerRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: 320,
      });
    };
    tryInit();
    const t = setInterval(tryInit, 100);
    return () => clearInterval(t);
  }, [showApp]);

  const handleGoogleSignIn = useCallback(() => {
    ReactGA.event({ category: 'Auth', action: 'Google Sign In' });
    if (!GOOGLE_CLIENT_ID) {
      setToast('Google Sign In is not configured. Add VITE_GOOGLE_CLIENT_ID to .env.local.');
      return;
    }
    if (typeof window === 'undefined' || !window.google?.accounts?.id) {
      setToast('Loading Google Sign In…');
      return;
    }
    const container = googleButtonContainerRef.current;
    const googleButton = container?.querySelector?.('[role="button"]') || container?.firstElementChild;
    if (googleButton && typeof googleButton.click === 'function') {
      googleButton.click();
    } else {
      setToast('Google Sign In is still loading. Try again in a moment.');
    }
  }, []);

  const [activeBagId,setActiveBagId] = useState(null);
  const [search,setSearch] = useState('');
  const [typeFilter,setTypeFilter] = useState('all');
  const [selectedBrand,setSelectedBrand] = useState('All');
  const [selectedSpeed,setSelectedSpeed] = useState('All');
  const [selectedSort,setSelectedSort] = useState('Recent');
  const [viewMode,setViewMode] = useState('list');
  const [formOpen,setFormOpen] = useState(false);
  const [editingDisc,setEditingDisc] = useState(null);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [bagMenuDisc,setBagMenuDisc] = useState(null);
  const [aceLogDisc,setAceLogDisc] = useState(null);
  const [editingAce,setEditingAce] = useState(null);
  const [showTrophyRoom,setShowTrophyRoom] = useState(false);
  const [backupDisc,setBackupDisc] = useState(null);
  const [detailDisc,setDetailDisc] = useState(null);
  const [showConfetti,setShowConfetti] = useState(false);
  const [confettiKey,setConfettiKey] = useState(0);
  const [toast,setToast] = useState(null);
  const [deleteConfirm,setDeleteConfirm] = useState(null);
  const [deleteBagConfirm,setDeleteBagConfirm] = useState(null);
  const [duplicateDiscConfirm,setDuplicateDiscConfirm] = useState(null);
  const [shareAce,setShareAce] = useState(null);
  const [showPrivacy,setShowPrivacy] = useState(false);
  const [userTier,setUserTier] = useState(() => getStoredTier());
  const [showUpgradeModal,setShowUpgradeModal] = useState(false);
  const [settingsOpen,setSettingsOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [addToBagPickerOpen, setAddToBagPickerOpen] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const settingsRef = useRef(null);

  const isPro = userTier === 'pro';

  const handleSignOut = useCallback(() => {
    try { localStorage.removeItem(GUEST_MODE_KEY); } catch(_) {}
    try { localStorage.removeItem(AUTH_KEY); } catch(_) {}
    try { localStorage.removeItem(USER_PROFILE_PIC_KEY); } catch(_) {}
    firestoreSyncUserIdRef.current = null;
    firestoreInitialLoadDoneRef.current = false;
    setGuestMode(false);
    setUserAuth(null);
    setCustomProfilePic(null);
    setSyncStatus('idle');
    setSettingsOpen(false);
    setShowProfileModal(false);
  }, []);

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
      try { localStorage.removeItem(TIER_KEY); } catch(_) {}
      firestoreSyncUserIdRef.current = null;
      firestoreInitialLoadDoneRef.current = false;
      setDiscs([]);
      setBags([]);
      setAceHistory([]);
      setGuestMode(false);
      setUserAuth(null);
      setCustomProfilePic(null);
      setSyncStatus('idle');
      setSettingsOpen(false);
      setShowProfileModal(false);
      setShowDeleteAccount(false);
      setToast('Account deleted successfully.');
    } catch (e) {
      console.error('Delete account failed', e);
      setToast('Failed to delete account. Please try again.');
      throw e;
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(TIER_KEY, userTier); } catch(_) {}
  }, [userTier]);

  // Derived data
  const aceMap = useMemo(() => { const m={}; aceHistory.forEach(a=>{m[a.discId]=(m[a.discId]||0)+1;}); return m; }, [aceHistory]);
  const brandOptions = useMemo(() => { const u=[...new Set(discs.map(d=>d.manufacturer))].sort(); return [{value:'All',label:'All Brands'},...u.map(b=>({value:b,label:b}))]; }, [discs]);
  const activeBag = useMemo(() => bags.find(b=>b.id===activeBagId)||null, [bags,activeBagId]);
  const bagDiscsForDashboard = useMemo(() => activeBag ? discs.filter(d=>activeBag.disc_ids.includes(d.id)) : [], [activeBag,discs]);
  const totalAces = useMemo(() => Object.values(aceMap).reduce((a,b)=>a+b,0), [aceMap]);

  const filteredDiscs = useMemo(() => {
    let result = [...discs];
    if (activeBagId && activeBag) result = result.filter(d => activeBag.disc_ids.includes(d.id));
    if (search.trim()) { const q=search.toLowerCase(); result=result.filter(d => d.manufacturer.toLowerCase().includes(q)||d.mold.toLowerCase().includes(q)||d.plastic_type.toLowerCase().includes(q)||(d.custom_name&&d.custom_name.toLowerCase().includes(q))||(d.story&&d.story.toLowerCase().includes(q))); }
    if (typeFilter!=='all') result = result.filter(d => d.disc_type===typeFilter);
    if (selectedBrand!=='All') result = result.filter(d => d.manufacturer===selectedBrand);
    if (selectedSpeed!=='All') { const range=SPEED_RANGES.find(sr=>sr.value===selectedSpeed); if(range)result=result.filter(d=>d.speed>=range.min&&d.speed<=range.max); }
    switch(selectedSort) { case'Name':result.sort((a,b)=>a.mold.localeCompare(b.mold));break; case'Speed':result.sort((a,b)=>b.speed-a.speed);break; case'Wear':result.sort((a,b)=>a.wear_level-b.wear_level);break; default:result.sort((a,b)=>(b.date_acquired||'').localeCompare(a.date_acquired||'')); }
    return result;
  }, [discs, activeBag, activeBagId, search, typeFilter, selectedBrand, selectedSpeed, selectedSort]);

  const counts = useMemo(() => {
    const base = activeBagId && activeBag ? discs.filter(d=>activeBag.disc_ids.includes(d.id)) : discs;
    const c = {all:base.length}; Object.keys(DT).forEach(t => c[t]=base.filter(d=>d.disc_type===t).length); return c;
  }, [discs, activeBag, activeBagId]);

  const activeFilterCount = [selectedBrand!=='All', selectedSpeed!=='All'].filter(Boolean).length;

  // ── Handlers ──
  const clearAllFilters = useCallback(() => { setSelectedBrand('All'); setSelectedSpeed('All'); setSelectedSort('Recent'); setTypeFilter('all'); setSearch(''); }, []);

  const toggleBag = (bagId,discId) => setBags(p => p.map(b => b.id!==bagId ? b : {...b, disc_ids:b.disc_ids.includes(discId) ? b.disc_ids.filter(i=>i!==discId) : [...b.disc_ids,discId]}));

  const addDiscToBag = useCallback((bagId,discId) => {
    setBags(prev => prev.map(b => { if(b.id!==bagId)return b; if(b.disc_ids.includes(discId))return b; return{...b,disc_ids:[...b.disc_ids,discId]}; }));
    const d=discs.find(x=>x.id===discId); const bg=bags.find(x=>x.id===bagId); setToast(`✅ ${d?.mold||'Disc'} added to ${bg?.name||'bag'}`);
  }, [discs,bags]);

  const removeDiscFromBag = useCallback((bagId,discId) => {
    setBags(prev => prev.map(b => { if(b.id!==bagId)return b; return{...b,disc_ids:b.disc_ids.filter(id=>id!==discId)}; }));
    const d=discs.find(x=>x.id===discId); setToast(`🗑️ ${d?.mold||'Disc'} removed from bag`);
  }, [discs]);

  const handleSaveAce = useCallback((aceData,isEdit) => {
    if (!isEdit && !isPro && aceHistory.length >= FREE_ACE_LIMIT) { setShowUpgradeModal(true); return; }
    if (isEdit) { setAceHistory(p=>p.map(a=>a.id===aceData.id?aceData:a)); setToast('✏️ Ace updated!'); }
    else { setAceHistory(p=>[...p,aceData]); setConfettiKey(k=>k+1); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),2800); const d=discs.find(x=>x.id===aceData.discId); setToast(`🏆 Ace logged for ${d?.mold||'disc'}!`); }
  }, [discs, isPro, aceHistory.length]);

  const handleDeleteAce = useCallback(aceId => { setAceHistory(p=>p.filter(a=>a.id!==aceId)); setToast('🗑️ Ace deleted'); }, []);

  const performAddDisc = useCallback((data, optionalAce) => {
    ReactGA.event({ category: 'Disc', action: 'Add Disc' });
    setDiscs(p=>[...p,{...data,date_acquired:data.date_acquired||td()}]);
    if (optionalAce) {
      if (!isPro && aceHistory.length >= FREE_ACE_LIMIT) {
        setShowUpgradeModal(true);
        setToast(`✅ ${data.mold} added! Upgrade to Pro to log more aces.`);
      } else {
        const aceEntry = { id: `a${Date.now()}`, discId: data.id, date: optionalAce.date, course: optionalAce.course, hole: optionalAce.hole || 0, distance: 0, witnessed: false, ...(optionalAce.notes ? { notes: optionalAce.notes } : {}) };
        setAceHistory(p=>[...p, aceEntry]);
        setConfettiKey(k=>k+1); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),2800);
        setToast(`🏆 ${data.mold} added and ace logged!`);
      }
    } else {
      setToast(`✅ ${data.mold} added!`);
    }
    setEditingDisc(null); setFormOpen(false);
  }, [isPro, aceHistory.length]);

  const handleSaveDisc = useCallback((data, optionalAce) => {
    if (editingDisc) {
      setDiscs(p=>p.map(d=>d.id===data.id?data:d));
      if (optionalAce) {
        if (!isPro && aceHistory.length >= FREE_ACE_LIMIT) {
          setShowUpgradeModal(true);
          setToast(`✅ ${data.mold} updated! Upgrade to Pro to log more aces.`);
        } else {
          const aceEntry = { id: `a${Date.now()}`, discId: data.id, date: optionalAce.date, course: optionalAce.course, hole: optionalAce.hole || 0, distance: 0, witnessed: false, ...(optionalAce.notes ? { notes: optionalAce.notes } : {}) };
          setAceHistory(p=>[...p, aceEntry]);
          setConfettiKey(k=>k+1); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),2800);
          setToast(`🏆 ${data.mold} updated and ace logged!`);
        }
      } else {
        setToast(`✅ ${data.mold} updated!`);
      }
      setEditingDisc(null); setFormOpen(false);
      return;
    }
    const man = (data.manufacturer || '').trim().toLowerCase();
    const mold = (data.mold || '').trim().toLowerCase();
    const isDuplicate = discs.some(d => (d.manufacturer||'').trim().toLowerCase() === man && (d.mold||'').trim().toLowerCase() === mold);
    if (isDuplicate) {
      setDuplicateDiscConfirm({ data, optionalAce });
      return;
    }
    performAddDisc(data, optionalAce);
  }, [editingDisc, isPro, aceHistory.length, discs, performAddDisc]);

  const confirmAddDuplicateDisc = useCallback(() => {
    if (!duplicateDiscConfirm) return;
    performAddDisc(duplicateDiscConfirm.data, duplicateDiscConfirm.optionalAce);
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
    if (!isPro && discs.length >= FREE_DISC_LIMIT) { setShowUpgradeModal(true); return; }
    setEditingDisc(null); setFormOpen(true);
  }, [isPro, discs.length]);
  const createBag = useCallback(({name,bagColor}) => {
    if (!isPro && bags.length >= FREE_BAG_LIMIT) { setShowUpgradeModal(true); return; }
    setBags(p => [...p, {id:`b${Date.now()}`,name,bagColor,disc_ids:[]}]);
  }, [isPro, bags.length]);
  const deleteBag = useCallback(id => { setBags(p=>p.filter(b=>b.id!==id)); if(activeBagId===id)setActiveBagId(null); }, [activeBagId]);
  const requestDeleteBag = useCallback(id => {
    const bag = bags.find(b => b.id === id);
    if (bag) setDeleteBagConfirm({ id: bag.id, name: bag.name });
  }, [bags]);
  const confirmDeleteBag = useCallback(() => {
    if (!deleteBagConfirm) return;
    deleteBag(deleteBagConfirm.id);
    setDeleteBagConfirm(null);
  }, [deleteBagConfirm, deleteBag]);
  const updateBag = (id,data) => setBags(p=>p.map(b=>b.id===id?{...b,...data}:b));

  const handleBuySearch = useCallback(suggestion => {
    setBackupDisc({id:'sug_'+Date.now(),manufacturer:suggestion.manufacturer,mold:suggestion.mold,plastic_type:suggestion.plastic,color:suggestion.color||'#6b7280',speed:suggestion.speed,glide:suggestion.glide,turn:suggestion.turn,fade:suggestion.fade,wear_level:10,weight_grams:175,custom_name:'',photo:null});
  }, []);

  const handleShareAce = useCallback((ace,disc) => { setShareAce({ace,disc}); }, []);

  const headerDiscCount = activeBag ? activeBag.disc_ids.length : discs.length;
  const gridCls = viewMode==='gallery' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  if (!showApp) {
    return (
      <>
        <AnimatePresence>{toast && <Toast key={toast} message={toast} onDone={() => setToast(null)}/>}</AnimatePresence>
        <WelcomeScreen
          onGuestClick={() => { ReactGA.event({ category: 'Auth', action: 'Guest Mode' }); setGuestMode(true); }}
          onGoogleClick={handleGoogleSignIn}
          onEmailSignUp={handleEmailSignUp}
          onEmailLogin={handleEmailLogin}
          googleButtonContainerRef={GOOGLE_CLIENT_ID ? googleButtonContainerRef : null}
        />
        <Analytics />
      </>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className="min-h-screen bg-gray-950 text-white pb-12">
      <AnimatePresence>{showConfetti && <Confetti key={confettiKey}/>}</AnimatePresence>
      <AnimatePresence>{toast && <Toast key={toast} message={toast} onDone={() => setToast(null)}/>}</AnimatePresence>
      <InstallPromptBanner />

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-b from-emerald-950/40 to-gray-950 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 pt-5 pb-4">
          {/* Single flex row that wraps: no absolute positioning, no overlap */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3 mb-4">
            {/* Left: Library + Title (truncates on small) */}
            <div className="flex items-center gap-3 min-w-0 flex-1 basis-0">
              <button onClick={() => setSidebarOpen(true)} className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0" aria-label="Open sidebar"><Library size={20}/></button>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2 truncate">
                  {activeBag ? (<><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:activeBag.bagColor||'#6b7280'}}/><span className="truncate">{activeBag.name}</span><span className="text-gray-500 font-semibold text-base shrink-0">({headerDiscCount})</span></>) : 'My Disc Library'}
                </h1>
                <p className="text-xs text-gray-400 truncate">{activeBag?`${filteredDiscs.length} disc${filteredDiscs.length!==1?'s':''} shown`:`${discs.length} disc${discs.length!==1?'s':''} in collection`}</p>
              </div>
            </div>
            {/* Right: actions in one wrap group — Add Disc first for priority, then Synced (tiny), Avatar, Settings */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 justify-end">
              {!isPro && (
                <button type="button" onClick={() => setShowUpgradeModal(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all">
                  <Sparkles size={14}/>Upgrade to Pro
                </button>
              )}
              {isPro && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <Sparkles size={12}/>You're on Pro!
                </span>
              )}
              <button onClick={() => setShowTrophyRoom(true)} className="flex items-center gap-1.5 p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all relative shrink-0">
                <Trophy size={18}/>{totalAces>0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center" style={{fontSize:9}}>{totalAces}</span>}
              </button>
              <div className="flex bg-gray-900 rounded-lg border border-gray-800 p-0.5 shrink-0">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode==='list'?'bg-gray-700 text-white':'text-gray-500 hover:text-gray-300'}`}><List size={16}/></button>
                <button onClick={() => setViewMode('gallery')} className={`p-2 rounded-md transition-all ${viewMode==='gallery'?'bg-gray-700 text-white':'text-gray-500 hover:text-gray-300'}`}><LayoutGrid size={16}/></button>
              </div>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:.95}} onClick={openAdd} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20 shrink-0"><Plus size={18}/><span className="hidden sm:inline">Add Disc</span></motion.button>
              {/* Synced: small unobtrusive indicator */}
              {userAuth && syncStatus === 'synced' && (
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0" title="Data saved to cloud" aria-label="Synced">
                  <Check size={14}/>
                </span>
              )}
              {userAuth && syncStatus === 'syncing' && (
                <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-800 text-gray-400 shrink-0" title="Syncing…" aria-label="Syncing">
                  <Loader size={14} className="animate-spin"/>
                </span>
              )}
              {userAuth && (
                <div className="shrink-0">
                  <ProfileAvatar
                    src={effectiveProfilePic}
                    displayName={userAuth.displayName}
                    size="sm"
                  />
                </div>
              )}
              <div className="relative shrink-0" ref={settingsRef}>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(o => !o)}
                  className="flex items-center justify-center p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"
                  aria-label="Settings"
                  title="Settings"
                >
                  <Settings size={20}/>
                </button>
                {settingsOpen && (
                  <>
                    <div className="fixed inset-0" style={{ zIndex: 45 }} onClick={() => setSettingsOpen(false)} aria-hidden="true"/>
                    <div className="absolute right-0 top-full mt-1.5 py-1 min-w-[11rem] bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden" style={{ zIndex: 46 }}>
                      {userAuth && (
                        <>
                          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-700/80">
                            <ProfileAvatar src={effectiveProfilePic} displayName={userAuth.displayName} size="md" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-white truncate">{userAuth.displayName}</p>
                              {userAuth.email && <p className="text-xs text-gray-500 truncate">{userAuth.email}</p>}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => { setShowProfileModal(true); setSettingsOpen(false); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/80 hover:text-white transition-colors"
                          >
                            <User size={16} className="shrink-0 text-gray-500"/>
                            Edit Profile
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/80 hover:text-white transition-colors"
                      >
                        <LogOut size={16} className="shrink-0 text-gray-500"/>
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Quick stats */}
          {!activeBag && (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[{l:'Total',v:discs.length,c:'text-white'},{l:'In Bag',v:discs.filter(d=>d.status==='in_bag').length,c:'text-emerald-400'},{l:'Aces',v:totalAces,c:'text-amber-400',click:()=>setShowTrophyRoom(true)},{l:'Bags',v:bags.length,c:'text-sky-400',click:()=>setSidebarOpen(true)}].map(s => (
                <button key={s.l} onClick={s.click||undefined} className={`bg-gray-900/70 rounded-xl p-2.5 text-center border border-gray-800/60 transition-all ${s.click?'hover:border-gray-700 cursor-pointer':'cursor-default'}`}>
                  <div className={`text-lg font-bold ${s.c}`}>{s.v}</div><div className="text-xs text-gray-500 font-medium">{s.l}</div>
                </button>
              ))}
            </div>
          )}
          {activeBag && (
            <div className="flex items-center gap-2 mb-3 bg-gray-900/50 rounded-lg px-3 py-2">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:activeBag.bagColor||'#6b7280'}}/>
              <span className="text-xs text-gray-400 flex-1">Viewing <span className="text-white font-semibold">{activeBag.name}</span></span>
              <button onClick={() => setActiveBagId(null)} className="text-xs text-emerald-400 hover:text-emerald-300 font-medium">Show All ×</button>
            </div>
          )}
          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search mold, plastic, nickname, story…" className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 transition-colors"/>
            {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16}/></button>}
          </div>
          {/* Type pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2">
            <button onClick={() => setTypeFilter('all')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${typeFilter==='all'?'bg-emerald-500/20 text-emerald-400 border-emerald-500/30':'bg-gray-900 text-gray-500 border-gray-800'}`}>All ({counts.all})</button>
            {Object.entries(DT).map(([k,c]) => (
              <button key={k} onClick={
                () => setTypeFilter(k)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${typeFilter===k?`${c.bg} ${c.text} ${c.border}`:'bg-gray-900 text-gray-500 border-gray-800'}`}>{c.label} ({counts[k]||0})</button>
            ))}
          </div>
          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap pb-1">
            <Filter size={14} className="text-gray-600 shrink-0"/>
            <FilterDropdown label="Brand" value={selectedBrand} options={brandOptions} onChange={setSelectedBrand}/>
            <FilterDropdown label="Speed" value={selectedSpeed} options={SPEED_RANGES.map(sr=>({value:sr.value,label:sr.label}))} onChange={setSelectedSpeed}/>
            {activeFilterCount>0 && (
              <button onClick={() => {setSelectedBrand('All');setSelectedSpeed('All');}} className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20">
                <X size={12}/>Clear ({activeFilterCount})
              </button>
            )}
            <div className="flex-1"/>
            <FilterDropdown label="Sort" value={selectedSort} options={SORT_OPTIONS.map(s=>({value:s.value,label:s.label}))} onChange={setSelectedSort}/>
          </div>
        </div>
      </div>

      {bagMenuDisc && <div className="fixed inset-0 z-20" onClick={() => setBagMenuDisc(null)}/>}

      {/* ── BODY ── */}
      <div className="max-w-7xl mx-auto px-4 pt-5">
        {activeBag && <BagDashboard key={activeBag.id} bagDiscs={bagDiscsForDashboard} bag={activeBag} allDiscs={discs} onAddToBag={addDiscToBag} onRemoveFromBag={removeDiscFromBag} onBuySearch={handleBuySearch} isPro={isPro} onUpgradeClick={() => setShowUpgradeModal(true)}/>}
        {activeBag && discs.length > 0 && (
          <div className="flex justify-end mb-3">
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
              onClick={() => setAddToBagPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 font-semibold text-sm border border-emerald-500/30 transition-all">
              <Plus size={16}/>Add Discs to Bag
            </motion.button>
          </div>
        )}

        {discs.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col items-center justify-center py-20 sm:py-28 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-6 text-4xl" role="img" aria-label="Disc">
              🥏
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Start building your collection!</h2>
            <p className="text-gray-400 text-sm sm:text-base mb-8 max-w-xs">Tap + to add your first disc 🥏</p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={openAdd}
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base shadow-lg shadow-emerald-600/25"
            >
              <Plus size={20}/>Add Your First Disc
            </motion.button>
          </motion.div>
        ) : activeBag && filteredDiscs.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="flex flex-col items-center justify-center py-20 sm:py-28 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-6">
              <Package size={40} className="text-gray-500"/>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">This bag is empty</h2>
            <p className="text-gray-400 text-sm sm:text-base max-w-xs">Add discs from your collection.</p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setAddToBagPickerOpen(true)}
              className="mt-6 flex items-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base shadow-lg shadow-emerald-600/25"
            >
              <Plus size={20}/>Add Discs to Bag
            </motion.button>
          </motion.div>
        ) : filteredDiscs.length > 0 ? (
          <motion.div layout className={`grid ${gridCls} gap-4`}>
            <AnimatePresence mode="popLayout">
              {filteredDiscs.map((d,i) => (
                <DiscCard key={d.id} disc={d} aceCount={aceMap[d.id]||0} bags={bags} viewMode={viewMode}
                  onLogAce={disc => setAceLogDisc(disc)} onViewTrophyRoom={() => setShowTrophyRoom(true)}
                  onBackup={setBackupDisc} onToggleBag={toggleBag} onEdit={openEdit} onDelete={requestDeleteDisc}
                  onDetail={setDetailDisc} onRemoveFromBag={removeDiscFromBag} activeBagId={activeBagId}
                  bagMenuOpen={bagMenuDisc===d.id} setBagMenu={setBagMenuDisc} idx={i}/>
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mb-4"><Search size={28} className="text-gray-700"/></div>
            <h3 className="text-lg font-semibold text-gray-400 mb-1">No discs match your filters</h3>
            <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={clearAllFilters} className="mt-3 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-lg"><X size={14} className="inline mr-1"/>Reset All Filters</motion.button>
          </motion.div>
        )}
      </div>

      {/* ── FOOTER ── */}
      <div className="border-t border-gray-800/60 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-500">
          <span className="text-gray-600">Disc Golf Companion · Your digital disc library</span>
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="text-emerald-400 hover:text-emerald-300 font-medium underline-offset-4 hover:underline"
          >
            Privacy Policy
          </button>
        </div>
      </div>

      {/* ── MODALS ── */}
      <AnimatePresence>{showTrophyRoom && <TrophyRoomModal open onClose={() => setShowTrophyRoom(false)} aces={isPro ? aceHistory : aceHistory.slice(0, FREE_ACE_LIMIT)} discs={discs} onShare={handleShareAce} onEditAce={ace=>{setShowTrophyRoom(false);setEditingAce(ace);}} onDeleteAce={handleDeleteAce} onLogAce={() => { setShowTrophyRoom(false); setAceLogDisc(discs[0] ?? null); }}/>}</AnimatePresence>
      <AnimatePresence>{shareAce && <ShareOverlay open ace={shareAce.ace} disc={shareAce.disc} onClose={() => setShareAce(null)}/>}</AnimatePresence>
      <AnimatePresence>{detailDisc && <DiscDetailModal open disc={detailDisc} onClose={() => setDetailDisc(null)} aceHistory={aceHistory} bags={bags} onEdit={d=>{setDetailDisc(null);openEdit(d);}} onDelete={id=>{setDetailDisc(null);requestDeleteDisc(id);}} onLogAce={d=>{setDetailDisc(null);setAceLogDisc(d);}} onBackup={d=>{setDetailDisc(null);setBackupDisc(d);}} onToggleBag={toggleBag} onViewTrophyRoom={() => {setDetailDisc(null);setShowTrophyRoom(true);}} onEditAce={ace=>{setDetailDisc(null);setEditingAce(ace);}}/>}</AnimatePresence>
      <DiscFormModal open={formOpen} onClose={() => {setFormOpen(false);setEditingDisc(null);}} onSave={handleSaveDisc} editDisc={editingDisc}/>
      <AnimatePresence>{(aceLogDisc||editingAce) && <AceFormModal open disc={aceLogDisc||null} existingAce={editingAce||null} discs={discs} onClose={() => {setAceLogDisc(null);setEditingAce(null);}} onSave={handleSaveAce}/>}</AnimatePresence>
      <BackupModal open={!!backupDisc} disc={backupDisc} onClose={() => setBackupDisc(null)}/>
      <AnimatePresence>{addToBagPickerOpen && activeBag && <AddToBagPicker open onClose={() => setAddToBagPickerOpen(false)} discs={discs} bag={activeBag} onAdd={(bagId, discId) => { addDiscToBag(bagId, discId); }}/>}</AnimatePresence>
      <BagSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} bags={bags} discs={discs} activeBagId={activeBagId} setActiveBagId={setActiveBagId} onCreateBag={createBag} onRemoveDisc={removeDiscFromBag} onDeleteBag={requestDeleteBag} onUpdateBag={updateBag}/>
      <AnimatePresence>{deleteConfirm && <ConfirmDialog key="del" open title="Delete this disc?" message={`Remove ${deleteConfirm.disc?.custom_name||deleteConfirm.disc?.mold||'this disc'} permanently? Its ace records will also be removed.`} danger confirmLabel="Delete Disc" discInfo={deleteConfirm.disc} onCancel={() => setDeleteConfirm(null)} onConfirm={confirmDeleteDisc}/>}</AnimatePresence>
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
      <AnimatePresence>{showUpgradeModal && <UpgradeModal open onClose={() => setShowUpgradeModal(false)} onStartTrial={() => setUserTier('pro')}/>}</AnimatePresence>
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
      <Analytics />
    </motion.div>
  );
}

export default (function () { return DiscLibrary; })();