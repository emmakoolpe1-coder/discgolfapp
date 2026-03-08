// ═══════════════════════════════════════════════════════
// DISC GOLF COMPANION — COMPLETE SINGLE-FILE APP
// Part 1: Imports, Constants, Helpers, Core Components,
//         Forms, Trophy System
// Part 2: Bags, Dashboard, Detail, Cards, Main App
// ═══════════════════════════════════════════════════════

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Plus, Search, X, ChevronDown, Check, Minus, Target,
  ExternalLink, ChevronRight, Trash2, Package, Edit3, Calendar,
  MapPin, Hash, ShoppingCart, Loader, LayoutGrid, List, Upload,
  Camera, Share2, Filter, Ruler, Library, BookOpen, Info,
  AlertTriangle, TrendingUp, BarChart3, Crosshair, DollarSign,
  Zap, Shield, Copy, Users, Sparkles, Star, Download
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
  { value:'Speed', label:'Speed ↓' },{ value:'Wear', label:'Most Worn' },
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

// ── Helpers ──────────────────────────────────────────
const wc = l => l>=8?'bg-emerald-500':l>=6?'bg-lime-500':l>=4?'bg-amber-500':l>=2?'bg-orange-500':'bg-red-500';
const ww = l => l>=9?'Mint':l>=7?'Good':l>=5?'Used':l>=3?'Beat':'Thrashed';
const td = () => new Date().toISOString().split('T')[0];
const fmtD = d => { try { return new Date(d+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return d; } };
const luma = hex => { const c=(hex||'#888').replace('#',''); return (parseInt(c.substr(0,2),16)*299+parseInt(c.substr(2,2),16)*587+parseInt(c.substr(4,2),16)*114)/1000; };
const classifyStability = d => { const net=(d.turn||0)+(d.fade||0); if(d.turn<=-2||net<=0) return 'understable'; if(d.fade>=3||net>=3) return 'overstable'; return 'stable'; };

const getAceRarity = (distance) => {
  if(distance>=350) return { label:'LEGENDARY', border:'linear-gradient(135deg,#a855f7,#ec4899,#f59e0b,#a855f7)', glow:'rgba(168,85,247,0.3)', text:'text-purple-300', bg:'bg-purple-500/10' };
  if(distance>=300) return { label:'EPIC', border:'linear-gradient(135deg,#fbbf24,#fef08a,#f59e0b,#fbbf24)', glow:'rgba(251,191,36,0.3)', text:'text-amber-300', bg:'bg-amber-500/10' };
  if(distance>=200) return { label:'RARE', border:'linear-gradient(135deg,#38bdf8,#a5f3fc,#0ea5e9,#38bdf8)', glow:'rgba(56,189,248,0.25)', text:'text-sky-300', bg:'bg-sky-500/10' };
  return { label:'ACE', border:'linear-gradient(135deg,#9ca3af,#e5e7eb,#6b7280,#9ca3af)', glow:'rgba(156,163,175,0.15)', text:'text-gray-300', bg:'bg-gray-500/10' };
};

const LS_KEY = 'discgolf_app_v2';
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

// ── Seed Data ────────────────────────────────────────
const SEED_DISCS = [
  {id:'1',manufacturer:'Innova',mold:'Destroyer',plastic_type:'Star',color:'#ef4444',custom_name:'Big D',speed:12,glide:5,turn:-1,fade:3,weight_grams:175,disc_type:'distance_driver',wear_level:7,status:'in_bag',photo:null,date_acquired:'2024-01-15',story:'My first real distance driver.',estimated_value:18},
  {id:'2',manufacturer:'Discraft',mold:'Buzzz',plastic_type:'ESP',color:'#3b82f6',custom_name:'',speed:5,glide:4,turn:-1,fade:1,weight_grams:177,disc_type:'midrange',wear_level:5,status:'in_bag',photo:null,date_acquired:'2024-02-20',story:'Found this in a used bin for $6.',estimated_value:16},
  {id:'3',manufacturer:'MVP',mold:'Envy',plastic_type:'Neutron',color:'#8b5cf6',custom_name:'Ace Machine',speed:3,glide:3,turn:0,fade:2,weight_grams:174,disc_type:'putter',wear_level:8,status:'in_bag',photo:null,date_acquired:'2024-03-10',story:'Three aces and counting.',estimated_value:15},
  {id:'4',manufacturer:'Kastaplast',mold:'Berg',plastic_type:'K1',color:'#22c55e',custom_name:'The Wall',speed:1,glide:1,turn:0,fade:2,weight_grams:175,disc_type:'putter',wear_level:2,status:'in_bag',photo:null,date_acquired:'2024-04-05',story:"The Berg doesn't fly — it just stops.",estimated_value:22},
  {id:'5',manufacturer:'Innova',mold:'Thunderbird',plastic_type:'Champion',color:'#f97316',custom_name:'',speed:9,glide:5,turn:0,fade:2,weight_grams:173,disc_type:'fairway_driver',wear_level:6,status:'in_bag',photo:null,date_acquired:'2024-05-18',story:'',estimated_value:17},
  {id:'6',manufacturer:'Discraft',mold:'Zone',plastic_type:'Z',color:'#eab308',custom_name:'Meat Hook',speed:4,glide:3,turn:0,fade:3,weight_grams:174,disc_type:'putter',wear_level:4,status:'in_bag',photo:null,date_acquired:'2024-06-22',story:'Hard left, every time.',estimated_value:16},
  {id:'7',manufacturer:'Latitude 64',mold:'River',plastic_type:'Gold',color:'#06b6d4',custom_name:'',speed:7,glide:7,turn:-1,fade:1,weight_grams:170,disc_type:'fairway_driver',wear_level:3,status:'backup',photo:null,date_acquired:'2024-07-30',story:'',estimated_value:15},
  {id:'8',manufacturer:'Dynamic Discs',mold:'Emac Truth',plastic_type:'Lucid',color:'#ec4899',custom_name:'',speed:5,glide:5,turn:-1,fade:1,weight_grams:176,disc_type:'midrange',wear_level:9,status:'in_bag',photo:null,date_acquired:'2024-09-14',story:'',estimated_value:18},
  {id:'9',manufacturer:'Innova',mold:'Wraith',plastic_type:'Star',color:'#7c3aed',custom_name:'Purple Reign',speed:11,glide:5,turn:-1,fade:3,weight_grams:172,disc_type:'distance_driver',wear_level:1,status:'in_bag',photo:null,date_acquired:'2025-01-08',story:'Mystery box find turned go-to driver.',estimated_value:20},
  {id:'10',manufacturer:'Prodigy',mold:'D2',plastic_type:'400',color:'#14b8a6',custom_name:'',speed:12,glide:6,turn:-1,fade:3,weight_grams:174,disc_type:'distance_driver',wear_level:10,status:'backup',photo:null,date_acquired:'2025-02-19',story:'',estimated_value:17},
];
const SEED_ACES = [
  {id:'a1',discId:'3',date:'2024-06-15',course:'Maple Hill',hole:7,distance:195,witnessed:true},
  {id:'a2',discId:'1',date:'2024-09-22',course:'Iron Hill',hole:4,distance:340,witnessed:false},
  {id:'a3',discId:'3',date:'2025-03-08',course:'Idlewild',hole:12,distance:228,witnessed:true},
  {id:'a4',discId:'9',date:'2025-07-14',course:'Fox Run Meadows',hole:17,distance:375,witnessed:true},
];
const SEED_BAGS = [
  {id:'b1',name:'Tournament Bag',bagColor:'#1e3a5f',disc_ids:['1','3','5','6','9']},
  {id:'b2',name:'Casual Rounds',bagColor:'#ea580c',disc_ids:['2','4','7','8']},
];

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
            This app is designed to be local-first and lightweight. Below is a summary of how we handle your data.
          </p>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Data Collection</h3>
            <p className="leading-relaxed text-gray-300">
              We only use localStorage to save your bag and discs on your own device. Your collection data stays in your browser and is not sent to our servers.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Cookies &amp; Tracking</h3>
            <p className="leading-relaxed text-gray-300">
              We use cookies and tracking for affiliate links and basic site analytics. These technologies help us understand which links are clicked and support the app through affiliate programs.
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-white mb-1">Third Parties</h3>
            <p className="leading-relaxed text-gray-300">
              When you click a &quot;Buy&quot; link, you are redirected to third-party sites like Amazon or Infinite Discs which have their own privacy policies and data practices. Please review those policies when you visit their websites.
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

// ═══════════════════════════════════════════════════════
// PWA INSTALL PROMPT BANNER
// ═══════════════════════════════════════════════════════
const PWA_INSTALL_DISMISSED_KEY = 'discgolf-pwa-install-dismissed';

function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(PWA_INSTALL_DISMISSED_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || document.referrer.includes('android-app://');
    if (isStandalone || dismissed) setShowBanner(false);
    else if (deferredPrompt) setShowBanner(true);
  }, [deferredPrompt, dismissed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShowBanner(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    try { localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, '1'); } catch (_) {}
  };

  if (!showBanner || !deferredPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 p-3 safe-area-pb"
      >
        <div className="max-w-lg mx-auto rounded-xl border border-emerald-500/30 bg-gray-950/95 backdrop-blur-md shadow-xl shadow-emerald-950/50 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Download size={20} className="text-emerald-400"/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">Install Disc Golf Companion</p>
              <p className="text-xs text-gray-400 mt-0.5">Add to home screen for quick access and offline use.</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-colors"
              >
                Install
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════
// DISC VISUAL
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

// ═══════════════════════════════════════════════════════
// FLIGHT PATH (BH / FH MIRRORING)
// ═══════════════════════════════════════════════════════
function FlightPath({turn,fade,id,large}) {
  const [mode,setMode] = useState('both');
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
      <div className="flex gap-0.5 mt-0.5">
        {[['bh','BH'],['both','Both'],['fh','FH']].map(([k,l]) => (
          <button key={k} onClick={e=>{e.stopPropagation();setMode(k);}}
            className={`px-1.5 py-0.5 rounded transition-all font-bold ${mode===k?'bg-gray-700 text-white':'text-gray-600 hover:text-gray-400'}`}
            style={{fontSize:large?11:8}}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DISC FORM MODAL (Add / Edit)
// ═══════════════════════════════════════════════════════
const EMPTY_DISC = {manufacturer:'',mold:'',plastic_type:'',custom_name:'',speed:7,glide:5,turn:-1,fade:1,weight_grams:175,disc_type:'midrange',wear_level:10,status:'backup',color:'#22c55e',photo:null,date_acquired:'',story:'',estimated_value:18};

function DiscFormModal({open,onClose,onSave,editDisc}) {
  const [f,setF] = useState({...EMPTY_DISC});
  const fileRef = useRef(null);
  const isEdit = !!editDisc;

  useEffect(() => {
    if (open) setF(editDisc ? {...editDisc, story:editDisc.story||'', estimated_value:editDisc.estimated_value||18} : {...EMPTY_DISC, date_acquired:td()});
  }, [open, editDisc]);

  const s = (k,v) => setF(p=>({...p,[k]:v}));
  const ok = f.manufacturer && f.mold && f.plastic_type;
  const save = () => onSave({...f, ...(isEdit?{}:{id:Date.now().toString()})});

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
                <FlightPath turn={f.turn} fade={f.fade} id="preview" large/>
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
              <label className="block text-xs text-gray-400 mb-1">Wear: {f.wear_level}/10 · {ww(f.wear_level)}</label>
              <input type="range" min={1} max={10} value={f.wear_level} onChange={e=>s('wear_level',parseInt(e.target.value))} className="w-full accent-emerald-500"/>
            </section>
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
      <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="relative w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        <div className="p-5 border-b border-gray-800 flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEdit?'bg-sky-500/15':'bg-amber-500/15'}`}>
            {isEdit?<Edit3 size={20} className="text-sky-400"/>:<Trophy size={20} className="text-amber-400"/>}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white">{isEdit?'Edit Ace':'Log an Ace!'}</h2>
            <p className="text-xs text-gray-500 truncate">{displayDisc?`${displayDisc.mold} · ${displayDisc.manufacturer}`:'Select a disc'}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-gray-800 text-gray-500"><X size={18}/></button>
        </div>
        <div className="p-5 space-y-3 max-h-96 overflow-y-auto">
          {/* Disc picker (for edit mode) */}
          {isEdit && discs && (
            <div className="relative">
              <label className="text-xs text-gray-400 font-medium mb-1 block">Disc</label>
              <button onClick={() => setDiscPickerOpen(!discPickerOpen)} className="w-full flex items-center gap-2.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-left hover:border-gray-600">
                {activeDisc && <span className="w-5 h-5 rounded-full shrink-0 border border-gray-600" style={{backgroundColor:activeDisc.color||'#6b7280'}}/>}
                <span className="text-sm text-white flex-1 truncate">{activeDisc?`${activeDisc.custom_name||activeDisc.mold}`:'Select…'}</span>
                <ChevronDown size={14} className={`text-gray-500 transition-transform ${discPickerOpen?'rotate-180':''}`}/>
              </button>
              {discPickerOpen && (
                <>
                  <div className="fixed inset-0" style={{zIndex:9}} onClick={() => setDiscPickerOpen(false)}/>
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-2xl max-h-48 overflow-y-auto" style={{zIndex:10}}>
                    {discs.map(d => (
                      <button key={d.id} onClick={() => {setSelectedDiscId(d.id);setDiscPickerOpen(false);}}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-700/60 ${d.id===selectedDiscId?'bg-emerald-500/10 text-emerald-400':'text-gray-300'}`}>
                        <span className="w-4 h-4 rounded-full shrink-0" style={{backgroundColor:d.color||'#6b7280'}}/>
                        <span className="flex-1 truncate text-left">{d.custom_name||d.mold}</span>
                        {d.id===selectedDiscId && <Check size={12} className="text-emerald-400"/>}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
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
          <button onClick={submit} className={`flex-1 py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-lg ${isEdit?'bg-sky-600 hover:bg-sky-500 text-white':'bg-amber-600 hover:bg-amber-500 text-white'}`}>
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

function ShareOverlay({open,ace,disc,onClose}) {
  const [copied,setCopied] = useState(false);
  if (!open||!ace) return null;
  const rarity = getAceRarity(ace.distance||0);
  const shareText = `🏆 NEW ACE LOGGED!\n${disc?.manufacturer||''} ${disc?.mold||'Unknown'}${disc?.custom_name?` "${disc.custom_name}"`:''}\nat ${ace.course}${ace.hole>0?`, Hole #${ace.hole}`:''}\n${ace.distance||'?'} ft · ${fmtD(ace.date)}\n#discgolf #ace`;

  const handleCopy = () => {
    try { navigator.clipboard.writeText(shareText); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 flex items-center justify-center p-4" style={{zIndex:75}}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}/>
      <motion.div initial={{scale:0.85,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',damping:22}} className="relative w-full max-w-sm">
        <div className="relative rounded-2xl overflow-hidden" style={{padding:'2px',background:rarity.border}}>
          <div className="bg-gray-950 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="relative py-4 px-6 text-center" style={{background:'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(217,119,6,0.06))'}}>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Trophy size={20} className="text-amber-400"/>
                <span className="text-xl font-black bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">NEW ACE LOGGED!</span>
                <Trophy size={20} className="text-amber-400"/>
              </div>
            </div>
            {/* Content */}
            <div className="px-6 py-5 flex flex-col items-center">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full blur-xl" style={{backgroundColor:disc?.color||'#fbbf24',opacity:0.2}}/>
                <DiscVisual disc={disc||{color:'#6b7280',mold:'?',manufacturer:'?',wear_level:10}} size="xl"/>
              </div>
              <h3 className="text-xl font-black text-white mt-4">{disc?.custom_name||disc?.mold||'Unknown'}</h3>
              <p className="text-sm text-gray-400 font-medium">{disc?.manufacturer||''}{disc?.plastic_type?` · ${disc.plastic_type}`:''}</p>
              <div className="w-full mt-5">
                <div className="h-px w-full mb-3" style={{background:rarity.border,opacity:0.2}}/>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <MapPin size={15} className="text-emerald-400"/>
                  <span className="text-base font-bold text-white">{ace.course}</span>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm">
                  {ace.hole>0 && <span className="flex items-center gap-1.5 text-gray-300"><Target size={13} className="text-sky-400"/>Hole #{ace.hole}</span>}
                  {ace.distance>0 && <span className="flex items-center gap-1.5 font-bold text-amber-400"><Ruler size={13}/>{ace.distance} ft</span>}
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-3 text-gray-500 text-xs"><Calendar size={11}/>{fmtD(ace.date)}</div>
                {ace.witnessed && <div className="flex items-center justify-center gap-1.5 mt-2"><Shield size={11} className="text-emerald-400" fill="currentColor"/><span className="text-xs font-semibold text-emerald-400">Witness Verified</span></div>}
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 pb-5 space-y-3">
              <p className="text-center text-xs text-gray-600 font-medium">📱 Screenshot this card to share!</p>
              <div className="flex gap-2">
                <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={handleCopy}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold border ${copied?'bg-emerald-500/20 border-emerald-500/30 text-emerald-400':'bg-gray-800 border-gray-700 text-gray-300'}`}>
                  {copied?<><Check size={15}/>Copied!</>:<><Copy size={15}/>Copy Text</>}
                </motion.button>
                <button onClick={onClose} className="px-5 py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 text-sm font-semibold">Close</button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
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
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-800 text-gray-400"><X size={20}/></button>
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
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={() => onLogAce && onLogAce()}
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
function BagDashboard({bagDiscs,bag,allDiscs,onAddToBag,onRemoveFromBag,onBuySearch}) {
  const [expandedGap,setExpandedGap] = useState(null);
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

  if (bagDiscs.length===0) return null;
  const maxTC = Math.max(...Object.values(typeCounts),1);
  const maxSC = Math.max(...Object.values(stabCounts),1);

  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} className="space-y-4 mb-6">
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
                          {libraryMatches.length>0 && (
                            <div>
                              <h4 className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2"><Library size={11}/>From Your Collection ({libraryMatches.length})</h4>
                              <div className="space-y-1.5">
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
                            </div>
                          )}
                          {libraryMatches.length===0 && (
                            <div className="flex items-center gap-2 bg-gray-800/40 rounded-lg px-3 py-2.5">
                              <Library size={13} className="text-gray-600 shrink-0"/><span className="text-xs text-gray-500">No matching discs in your collection</span>
                            </div>
                          )}
                          {/* Buy suggestions */}
                          {buySuggestions.length>0 && (
                            <div>
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
        <div className="mt-4 pt-3 border-t border-amber-900/40 text-[10px] sm:text-xs text-amber-100/90 flex items-center gap-2">
          <ShoppingCart size={12} className="text-amber-400 shrink-0"/>
          <span>As an Amazon Associate I earn from qualifying purchases.</span>
        </div>
      </div>
    </motion.div>
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
            <div className="flex justify-center"><FlightPath turn={disc.turn} fade={disc.fade} id={`detail-${disc.id}`} large/></div>
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
              <div className="flex items-center justify-between mb-1.5"><span className="text-xs text-gray-500">Wear</span><span className="text-xs text-gray-300 font-bold">{disc.wear_level}/10 · {ww(disc.wear_level)}</span></div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden"><motion.div className={`h-full rounded-full ${wc(disc.wear_level)}`} initial={{width:0}} animate={{width:`${disc.wear_level*10}%`}} transition={{duration:.8}}/></div>
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
            <div onClick={e=>e.stopPropagation()}><FlightPath turn={disc.turn} fade={disc.fade} id={disc.id}/></div>
          </div>
        )}
        {/* Flight numbers (list only) */}
        {!isGallery && <div className="grid grid-cols-4 gap-1 mb-3">{FN_META.map(fn => (<div key={fn.key} className={`rounded-lg py-1 text-center ${fn.bg}`}><div className={`font-bold text-sm leading-none ${fn.text}`}>{disc[fn.key]}</div><div className="text-gray-600 text-xs mt-0.5 font-bold tracking-widest">{fn.label}</div></div>))}</div>}
        {/* Wear bar */}
        <div className={`flex items-center gap-2 ${isGallery?'w-full mt-2':'mb-3'}`}>
          {!isGallery && <span className="text-xs text-gray-600 w-6">Wear</span>}
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
// MAIN APP COMPONENT — with localStorage
// ═══════════════════════════════════════════════════════
export default function DiscLibrary() {
  // Load initial state from localStorage or seeds
  const [discs,setDiscs] = useState(() => { const s = loadState(); return s?.discs || SEED_DISCS; });
  const [aceHistory,setAceHistory] = useState(() => { const s = loadState(); return s?.aceHistory || SEED_ACES; });
  const [bags,setBags] = useState(() => { const s = loadState(); return s?.bags || SEED_BAGS; });

  // Save to localStorage whenever data changes
  useEffect(() => { saveState({discs,aceHistory,bags}); }, [discs,aceHistory,bags]);

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
  const [shareAce,setShareAce] = useState(null);
  const [showPrivacy,setShowPrivacy] = useState(false);

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
    if (isEdit) { setAceHistory(p=>p.map(a=>a.id===aceData.id?aceData:a)); setToast('✏️ Ace updated!'); }
    else { setAceHistory(p=>[...p,aceData]); setConfettiKey(k=>k+1); setShowConfetti(true); setTimeout(()=>setShowConfetti(false),2800); const d=discs.find(x=>x.id===aceData.discId); setToast(`🏆 Ace logged for ${d?.mold||'disc'}!`); }
  }, [discs]);

  const handleDeleteAce = useCallback(aceId => { setAceHistory(p=>p.filter(a=>a.id!==aceId)); setToast('🗑️ Ace deleted'); }, []);

  const handleSaveDisc = useCallback(data => {
    if (editingDisc) { setDiscs(p=>p.map(d=>d.id===data.id?data:d)); setToast(`✅ ${data.mold} updated!`); }
    else { setDiscs(p=>[...p,{...data,date_acquired:data.date_acquired||td()}]); setToast(`✅ ${data.mold} added!`); }
    setEditingDisc(null); setFormOpen(false);
  }, [editingDisc]);

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
  const openAdd = useCallback(() => { setEditingDisc(null); setFormOpen(true); }, []);
  const createBag = ({name,bagColor}) => setBags(p => [...p, {id:`b${Date.now()}`,name,bagColor,disc_ids:[]}]);
  const deleteBag = id => { setBags(p=>p.filter(b=>b.id!==id)); if(activeBagId===id)setActiveBagId(null); };
  const updateBag = (id,data) => setBags(p=>p.map(b=>b.id===id?{...b,...data}:b));

  const handleBuySearch = useCallback(suggestion => {
    setBackupDisc({id:'sug_'+Date.now(),manufacturer:suggestion.manufacturer,mold:suggestion.mold,plastic_type:suggestion.plastic,color:suggestion.color||'#6b7280',speed:suggestion.speed,glide:suggestion.glide,turn:suggestion.turn,fade:suggestion.fade,wear_level:10,weight_grams:175,custom_name:'',photo:null});
  }, []);

  const handleShareAce = useCallback((ace,disc) => { setShareAce({ace,disc}); }, []);

  const headerDiscCount = activeBag ? activeBag.disc_ids.length : discs.length;
  const gridCls = viewMode==='gallery' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-12">
      <AnimatePresence>{showConfetti && <Confetti key={confettiKey}/>}</AnimatePresence>
      <AnimatePresence>{toast && <Toast key={toast} message={toast} onDone={() => setToast(null)}/>}</AnimatePresence>
      <InstallPromptBanner />

      {/* ── HEADER ── */}
      <div className="bg-gradient-to-b from-emerald-950/40 to-gray-950 border-b border-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-emerald-400 hover:border-emerald-500/30 transition-all"><Library size={20}/></button>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
                  {activeBag ? (<><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:activeBag.bagColor||'#6b7280'}}/><span>{activeBag.name}</span><span className="text-gray-500 font-semibold text-base">({headerDiscCount})</span></>) : 'My Disc Library'}
                </h1>
                <p className="text-xs text-gray-400">{activeBag?`${filteredDiscs.length} disc${filteredDiscs.length!==1?'s':''} shown`:`${discs.length} disc${discs.length!==1?'s':''} in collection`}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowTrophyRoom(true)} className="flex items-center gap-1.5 p-2.5 rounded-xl bg-gray-900 border border-gray-800 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all relative">
                <Trophy size={18}/>{totalAces>0 && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-xs font-black flex items-center justify-center" style={{fontSize:9}}>{totalAces}</span>}
              </button>
              <div className="flex bg-gray-900 rounded-lg border border-gray-800 p-0.5">
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-md transition-all ${viewMode==='list'?'bg-gray-700 text-white':'text-gray-500 hover:text-gray-300'}`}><List size={16}/></button>
                <button onClick={() => setViewMode('gallery')} className={`p-2 rounded-md transition-all ${viewMode==='gallery'?'bg-gray-700 text-white':'text-gray-500 hover:text-gray-300'}`}><LayoutGrid size={16}/></button>
              </div>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:.95}} onClick={openAdd} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/20"><Plus size={18}/><span className="hidden sm:inline">Add Disc</span></motion.button>
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
        {activeBag && <BagDashboard key={activeBag.id} bagDiscs={bagDiscsForDashboard} bag={activeBag} allDiscs={discs} onAddToBag={addDiscToBag} onRemoveFromBag={removeDiscFromBag} onBuySearch={handleBuySearch}/>}

        {filteredDiscs.length>0 ? (
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

      {/* ── LIBRARY AFFILIATE DISCLOSURE ── */}
      <div className="max-w-7xl mx-auto px-4 mt-6">
        <div className="sticky bottom-3 z-20">
          <div className="rounded-xl border border-amber-900/50 bg-gradient-to-r from-amber-950/80 to-gray-950/90 px-3 py-2 flex items-center gap-2 text-[10px] sm:text-xs text-amber-100 shadow-lg shadow-amber-500/20">
            <ShoppingCart size={12} className="text-amber-400 shrink-0"/>
            <span>As an Amazon Associate I earn from qualifying purchases.</span>
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="border-t border-gray-800/60 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-xs text-gray-500">
          <span className="text-gray-600">Disc Golf Companion · Local-first disc library</span>
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
      <AnimatePresence>{showTrophyRoom && <TrophyRoomModal open onClose={() => setShowTrophyRoom(false)} aces={aceHistory} discs={discs} onShare={handleShareAce} onEditAce={ace=>{setShowTrophyRoom(false);setEditingAce(ace);}} onDeleteAce={handleDeleteAce} onLogAce={() => {setShowTrophyRoom(false);if(discs[0])setAceLogDisc(discs[0]);}}/>}</AnimatePresence>
      <AnimatePresence>{shareAce && <ShareOverlay open ace={shareAce.ace} disc={shareAce.disc} onClose={() => setShareAce(null)}/>}</AnimatePresence>
      <AnimatePresence>{detailDisc && <DiscDetailModal open disc={detailDisc} onClose={() => setDetailDisc(null)} aceHistory={aceHistory} bags={bags} onEdit={d=>{setDetailDisc(null);openEdit(d);}} onDelete={id=>{setDetailDisc(null);requestDeleteDisc(id);}} onLogAce={d=>{setDetailDisc(null);setAceLogDisc(d);}} onBackup={d=>{setDetailDisc(null);setBackupDisc(d);}} onToggleBag={toggleBag} onViewTrophyRoom={() => {setDetailDisc(null);setShowTrophyRoom(true);}} onEditAce={ace=>{setDetailDisc(null);setEditingAce(ace);}}/>}</AnimatePresence>
      <DiscFormModal open={formOpen} onClose={() => {setFormOpen(false);setEditingDisc(null);}} onSave={handleSaveDisc} editDisc={editingDisc}/>
      <AnimatePresence>{(aceLogDisc||editingAce) && <AceFormModal open disc={aceLogDisc||null} existingAce={editingAce||null} discs={discs} onClose={() => {setAceLogDisc(null);setEditingAce(null);}} onSave={handleSaveAce}/>}</AnimatePresence>
      <BackupModal open={!!backupDisc} disc={backupDisc} onClose={() => setBackupDisc(null)}/>
      <BagSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} bags={bags} discs={discs} activeBagId={activeBagId} setActiveBagId={setActiveBagId} onCreateBag={createBag} onRemoveDisc={removeDiscFromBag} onDeleteBag={deleteBag} onUpdateBag={updateBag}/>
      <AnimatePresence>{deleteConfirm && <ConfirmDialog key="del" open title="Delete this disc?" message={`Remove ${deleteConfirm.disc?.custom_name||deleteConfirm.disc?.mold||'this disc'} permanently? Its ace records will also be removed.`} danger confirmLabel="Delete Disc" discInfo={deleteConfirm.disc} onCancel={() => setDeleteConfirm(null)} onConfirm={confirmDeleteDisc}/>}</AnimatePresence>
      <AnimatePresence>{showPrivacy && <PrivacyPolicyModal open onClose={() => setShowPrivacy(false)}/>}</AnimatePresence>
    </div>
  );
}