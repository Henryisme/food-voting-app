import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Star, Navigation, Utensils, Heart, Users, 
  Share2, Sparkles, X, Home, Settings, List, ChevronLeft, 
  Locate, Send, AlertCircle, Clock, Search, ChevronDown, ArrowLeft,
  MessageCircle, Camera, User, LogOut, ThumbsUp, PlusCircle, Link as LinkIcon,
  Bike, Car, Footprints, Vote, Edit2, CheckCircle, Circle, Trash2, Plus, ArrowRight,
  Minimize2, Maximize2, Tag, DollarSign, Check, Filter, Play, RefreshCw, Grid, AlertTriangle
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from "firebase/auth";
import { 
  getFirestore, collection, addDoc, doc, onSnapshot, 
  updateDoc, arrayUnion, query, where, getDocs, orderBy, deleteDoc, serverTimestamp, getDoc, setDoc
} from "firebase/firestore";

// ==========================================
// ⚠️ 設定區
// ==========================================
// 請在此填入您的 API Key
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""; 
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";      

// ⚠️ 請在此填入您的 Firebase Config
const MANUAL_FIREBASE_CONFIG = {
  apiKey: "AIzaSyBp8ni5BDM4NRpPgqBPe2x9pUi3rPPnv5w",
  authDomain: "foodvotingapp.firebaseapp.com",
  projectId: "foodvotingapp",
  storageBucket: "foodvotingapp.firebasestorage.app",
  messagingSenderId: "765035779856",
  appId: "1:765035779856:web:fd38c7b2e88f4a44f3b795",
  measurementId: "G-XC9G7C62GD"
};

// 🔥 Firebase 設定與初始化
let app, auth, db;
let appId = 'default-app-id';
let firebaseErrorMsg = null;
let useStrictPath = true; // 預設使用 Canvas 嚴格路徑

try {
  let config = null;

  // 1. 優先檢查是否手動填寫了 Config (優先使用個人資料庫)
  const isManualConfigValid = MANUAL_FIREBASE_CONFIG.apiKey && MANUAL_FIREBASE_CONFIG.apiKey.length > 0;
  
  if (isManualConfigValid) {
      config = MANUAL_FIREBASE_CONFIG;
      useStrictPath = false; // 使用個人 Firebase 時，切換到簡單路徑模式 (根目錄)
      console.log("Using MANUAL_FIREBASE_CONFIG (Personal DB)");
  } 
  // 2. 如果沒有手動設定，才嘗試讀取環境變數 (Canvas 環境)
  else if (typeof __firebase_config !== 'undefined') {
    try {
        config = JSON.parse(__firebase_config);
        useStrictPath = true; // 環境變數存在，使用 Canvas 深層路徑
        console.log("Using Canvas Environment Config");
    } catch (e) {
        console.warn("解析環境變數失敗");
    }
  }

  if (config && config.apiKey) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
    if (typeof __app_id !== 'undefined') {
        appId = __app_id;
    }
  } else {
    firebaseErrorMsg = "找不到有效的 Firebase 設定。請填寫 MANUAL_FIREBASE_CONFIG。";
  }
} catch (error) {
  firebaseErrorMsg = `Firebase 初始化失敗: ${error.message}`;
  console.error("Firebase initialization failed:", error);
}

// --- 智慧路徑輔助函式 ---
const getSmartCollection = (dbInstance, ...pathSegments) => {
    if (useStrictPath) {
        // Canvas 模式：使用深層路徑
        return collection(dbInstance, 'artifacts', appId, 'public', 'data', ...pathSegments);
    } else {
        // 個人 Firebase 模式：使用根目錄路徑
        return collection(dbInstance, ...pathSegments);
    }
};

const getSmartDoc = (dbInstance, ...pathSegments) => {
    if (useStrictPath) {
        return doc(dbInstance, 'artifacts', appId, 'public', 'data', ...pathSegments);
    } else {
        return doc(dbInstance, ...pathSegments);
    }
};

// --- 常數與工具函數 ---
const DEFAULT_CATEGORIES = ['全部', '台式', '日式', '韓式', '美式', '義式', '泰式', '火鍋', '燒肉', '早午餐', '甜點', '素食', '小吃', '其他'];

const mapGoogleTypeToCategory = (types) => {
  if (!types || types.length === 0) return '其他';
  const t = Array.isArray(types) ? types.join(' ').toLowerCase() : '';
  if (t.includes('japanese') || t.includes('sushi') || t.includes('ramen')) return '日式';
  if (t.includes('korean')) return '韓式';
  if (t.includes('taiwanese') || t.includes('chinese')) return '台式';
  if (t.includes('american') || t.includes('burger') || t.includes('steak')) return '美式';
  if (t.includes('italian') || t.includes('pizza') || t.includes('pasta')) return '義式';
  if (t.includes('thai')) return '泰式';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('bakery') || t.includes('dessert')) return '甜點';
  if (t.includes('breakfast') || t.includes('brunch')) return '早午餐';
  if (t.includes('bar') || t.includes('pub') || t.includes('night_club') || t.includes('wine')) return '餐酒館';
  if (t.includes('vegetarian') || t.includes('vegan')) return '素食';
  return '其他';
};

const convertPriceLevel = (level) => {
    if (typeof level === 'number') return level;
    if (level === 1 || level === 'PRICE_LEVEL_INEXPENSIVE') return 1;
    if (level === 2 || level === 'PRICE_LEVEL_MODERATE') return 2;
    if (level === 3 || level === 'PRICE_LEVEL_EXPENSIVE') return 3;
    if (level === 4 || level === 'PRICE_LEVEL_VERY_EXPENSIVE') return 4;
    return 0; 
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "N/A";
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(2);
};

const loadGoogleMapsScript = (apiKey) => {
  if (!apiKey) return Promise.reject("No API Key");
  if (window.google && window.google.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
};

const callGemini = async (prompt) => {
  if (!GEMINI_API_KEY) return "請先在程式碼中填入 GEMINI_API_KEY 喔！";
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
    );
    if (!response.ok) throw new Error("Network error");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 暫時無法回應。";
  } catch (error) { return "AI 連線發生問題。"; }
};

const PriceDisplay = ({ level }) => {
  const numLevel = convertPriceLevel(level);
  return (
    <div className="flex text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
      {numLevel > 0 ? [...Array(numLevel)].map((_, i) => <span key={i}>$</span>) : <span>$</span>}
    </div>
  );
};

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-full text-orange-600 font-bold text-[10px] border border-orange-100">
    <Star size={10} fill="currentColor" />
    <span>{typeof rating === 'number' ? rating : "N/A"}</span>
  </div>
);

const InteractiveStarRating = ({ value, onChange, readOnly = false }) => {
  const [hoverValue, setHoverValue] = useState(null);
  const displayValue = hoverValue !== null ? hoverValue : value;
  return (
    <div className="flex" onMouseLeave={() => setHoverValue(null)}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, displayValue - index)); 
        return (
          <div key={index} className={`relative w-6 h-6 ${readOnly ? '' : 'cursor-pointer'}`} onMouseMove={(e) => { if (!readOnly) { const { left, width } = e.currentTarget.getBoundingClientRect(); setHoverValue(index + ((e.clientX - left) / width > 0.5 ? 1 : 0.5)); } }} onClick={() => !readOnly && onChange(hoverValue)}>
            <Star size={18} className="text-stone-300 absolute top-0 left-0" />
            <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star size={18} className="text-yellow-400 fill-yellow-400" /></div>
          </div>
        );
      })}
    </div>
  );
};

const calculateTravelTime = (meters) => ({ walk: Math.ceil(meters / 83), bike: Math.ceil(meters / 250), car: Math.ceil(meters / 500) });

// --- Components ---

const NavBar = ({ activeTab, setActiveTab }) => {
  return (
    <div className="h-24 bg-white/90 backdrop-blur-md border-t border-stone-200 flex items-center justify-around px-6 pb-6 fixed bottom-0 w-full max-w-md z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
      <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-all duration-300 ${activeTab === 'home' ? 'text-stone-800 -translate-y-2' : 'text-stone-400 hover:text-stone-500'}`}><div className={`p-2 rounded-2xl transition-all ${activeTab === 'home' ? 'bg-stone-100 shadow-sm' : ''}`}><Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} /></div><span className="text-[10px] font-bold">搜尋</span></button>
      <button onClick={() => setActiveTab('shortlist')} className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-all duration-300 relative ${activeTab === 'shortlist' ? 'text-rose-500 -translate-y-2' : 'text-stone-400 hover:text-stone-500'}`}><div className={`p-2 rounded-2xl transition-all ${activeTab === 'shortlist' ? 'bg-rose-50 shadow-sm' : ''}`}><div className="relative"><Heart size={24} strokeWidth={activeTab === 'shortlist' ? 2.5 : 2} /></div></div><span className="text-[10px] font-bold">清單</span></button>
      <button onClick={() => setActiveTab('social')} className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-all duration-300 relative ${activeTab === 'social' ? 'text-teal-600 -translate-y-2' : 'text-stone-400 hover:text-stone-500'}`}><div className={`p-2 rounded-2xl transition-all ${activeTab === 'social' ? 'bg-teal-50 shadow-sm' : ''}`}><MessageCircle size={24} strokeWidth={activeTab === 'social' ? 2.5 : 2} /></div><span className="text-[10px] font-bold">揪團</span></button>
    </div>
  );
};

const CategoryTabs = ({ categories, selected, onSelect, onAddCategory }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 px-1 custom-scrollbar items-center">
    {categories.map(cat => (
      <button key={cat} onClick={() => onSelect(cat)} className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm border ${selected === cat ? 'bg-orange-500 text-white border-orange-500 shadow-orange-200' : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'}`}>
        {cat}
      </button>
    ))}
    {onAddCategory && <button onClick={onAddCategory} className="whitespace-nowrap px-3 py-1.5 rounded-full bg-stone-100 text-stone-400 border border-stone-200 hover:bg-stone-200 hover:text-stone-600 transition-colors flex items-center justify-center"><Plus size={14} strokeWidth={3}/></button>}
  </div>
);

const RealMapSelector = ({ initialLocation, onConfirm, onCancel, userLocation }) => {
  const mapRef = useRef(null);
  const [selectedLoc, setSelectedLoc] = useState(initialLocation || { lat: 25.0330, lng: 121.5654 });
  const [mapError, setMapError] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [foundPlaceName, setFoundPlaceName] = useState(""); 
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  
  useEffect(() => {
    if (!window.google || !window.google.maps) { setMapError("Google Maps API 未載入"); return; }
    if (!mapRef.current) return;
    try {
      const map = new window.google.maps.Map(mapRef.current, { center: selectedLoc, zoom: 15, disableDefaultUI: true, clickableIcons: false, mapId: "DEMO_MAP_ID" });
      const marker = new window.google.maps.Marker({ position: selectedLoc, map: map, draggable: true, animation: window.google.maps.Animation.DROP });
      mapInstanceRef.current = map; markerRef.current = marker;
      map.addListener("click", (e) => { const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() }; marker.setPosition(newLoc); setSelectedLoc(newLoc); setFoundPlaceName("地圖選取位置"); map.panTo(newLoc); });
      marker.addListener("dragend", (e) => { const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() }; setSelectedLoc(newLoc); setFoundPlaceName("地圖選取位置"); map.panTo(newLoc); });
    } catch (e) { setMapError("地圖載入錯誤：" + e.message); }
  }, []);

  const handleAddressSearch = () => {
      if (!window.google || !window.google.maps || !addressInput.trim()) return;
      const service = new window.google.maps.places.PlacesService(mapInstanceRef.current);
      service.findPlaceFromQuery({ query: addressInput, fields: ['name', 'geometry', 'formatted_address'] }, (results, status) => {
          if (status === 'OK' && results[0]) {
              const loc = results[0].geometry.location;
              const newLoc = { lat: loc.lat(), lng: loc.lng() };
              setSelectedLoc(newLoc);
              setFoundPlaceName(results[0].name || results[0].formatted_address); 
              if (mapInstanceRef.current) { mapInstanceRef.current.panTo(newLoc); mapInstanceRef.current.setZoom(16); }
              if (markerRef.current) markerRef.current.setPosition(newLoc);
          } else { alert('找不到該地點'); }
      });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in fade-in font-rounded">
      <div className="p-4 bg-white/80 backdrop-blur-md border-b flex justify-between items-center shadow-sm z-10 absolute top-0 w-full">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin className="text-rose-500" /> 修改位置</h3>
        <button onClick={onCancel} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} /></button>
      </div>
      <div className="flex-1 relative bg-slate-100 flex items-center justify-center h-full pt-16 pb-40">
        {mapError ? <div className="text-center p-6"><AlertCircle size={32} className="mx-auto text-red-500 mb-2"/><p>{mapError}</p></div> : <div ref={mapRef} className="w-full h-full" />}
      </div>
      <div className="absolute bottom-0 w-full p-4 space-y-3 bg-white border-t rounded-t-3xl shadow-lg">
         <div className="flex gap-2">
             <input type="text" value={addressInput} onChange={(e) => setAddressInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()} placeholder="搜尋地點..." className="flex-1 bg-stone-50 border rounded-xl px-4 py-3" />
             <button onClick={handleAddressSearch} className="bg-stone-800 text-white px-4 py-2 rounded-xl font-bold">搜尋</button>
         </div>
         {foundPlaceName && <div className="bg-orange-50 px-3 py-2 rounded-lg text-xs font-bold text-orange-700">📍 {foundPlaceName}</div>}
         <div className="flex gap-2">
            <button onClick={() => { if(userLocation) { setSelectedLoc(userLocation); setFoundPlaceName("我的位置"); onConfirm(userLocation); } }} className="flex-1 py-3 bg-teal-50 text-teal-600 rounded-xl font-bold flex items-center justify-center gap-2"><Locate size={18}/> GPS</button>
            <button onClick={() => onConfirm(selectedLoc)} className="flex-[2] py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-bold shadow-lg">確認地點</button>
         </div>
      </div>
    </div>
  );
};

const DecisionMakerModal = ({ candidates, onClose }) => {
    const [mode, setMode] = useState('wheel'); 
    const [result, setResult] = useState(null);
    const [isSpinning, setIsSpinning] = useState(false);
    const [wheelRotation, setWheelRotation] = useState(0);
    const WHEEL_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#FF8C42', '#1A535C', '#F7FFF7', '#FFD3B6', '#DCEDC1', '#A8E6CF'];

    const spinWheel = () => {
        if (isSpinning) return;
        setIsSpinning(true); setResult(null);
        const totalRotation = 1800 + Math.random() * 360;
        setWheelRotation(prev => prev + totalRotation);
        setTimeout(() => {
            const normalizedRotation = totalRotation % 360;
            const targetAngle = (360 - normalizedRotation) % 360;
            const sliceAngle = 360 / candidates.length;
            const winningIndex = Math.floor(((360 - normalizedRotation) % 360) / sliceAngle);
            setResult(candidates[winningIndex]);
            setIsSpinning(false);
        }, 4000); 
    };

    const [ladderPaths, setLadderPaths] = useState([]);
    const [ladderActivePath, setLadderActivePath] = useState([]); 
    const [selectedLadderStart, setSelectedLadderStart] = useState(null);
    const [ladderResultIndex, setLadderResultIndex] = useState(-1);

    const generateLadder = (count) => {
        const steps = 12; 
        const bridges = [];
        for(let i=0; i<steps; i++) {
            const row = [];
            for(let j=0; j<count-1; j++) {
                if(Math.random() > 0.6 && (j===0 || !row[j-1])) row.push(true);
                else row.push(false);
            }
            bridges.push(row);
        }
        return bridges;
    };

    useEffect(() => {
        if(mode === 'ladder') {
            setLadderPaths(generateLadder(candidates.length));
            setLadderActivePath([]);
            setResult(null);
            setSelectedLadderStart(null);
            setLadderResultIndex(-1);
        }
    }, [mode, candidates.length]);

    const startLadder = (startIdx) => {
        if(isSpinning) return;
        setSelectedLadderStart(startIdx);
        setIsSpinning(true);
        setResult(null);
        setLadderActivePath([]);
        setLadderResultIndex(-1);
        let currentLane = startIdx;
        let currentStep = 0;
        const pathHistory = [{lane: startIdx, step: 0, type: 'start'}];
        const totalSteps = ladderPaths.length;
        const interval = setInterval(() => {
            if(currentStep >= totalSteps) {
                clearInterval(interval);
                setLadderResultIndex(currentLane);
                setResult(candidates[currentLane]);
                setIsSpinning(false);
                return;
            }
            const bridges = ladderPaths[currentStep];
            let nextLane = currentLane;
            if(currentLane > 0 && bridges[currentLane-1]) nextLane = currentLane - 1;
            else if(currentLane < candidates.length - 1 && bridges[currentLane]) nextLane = currentLane + 1;
            if(nextLane !== currentLane) pathHistory.push({lane: nextLane, step: currentStep + 1, type: 'cross'});
            else pathHistory.push({lane: nextLane, step: currentStep + 1, type: 'down'});
            setLadderActivePath([...pathHistory]);
            currentLane = nextLane;
            currentStep++;
        }, 300); 
    };

    const renderWheelSlice = (index, total) => {
        const angle = 360 / total;
        const midAngle = (index * angle) + angle / 2;
        const x1 = 50 + 50 * Math.cos(Math.PI * ((index * angle) - 90) / 180);
        const y1 = 50 + 50 * Math.sin(Math.PI * ((index * angle) - 90) / 180);
        const x2 = 50 + 50 * Math.cos(Math.PI * (((index + 1) * angle) - 90) / 180);
        const y2 = 50 + 50 * Math.sin(Math.PI * (((index + 1) * angle) - 90) / 180);
        return (
            <g key={index}>
                <path d={`M 50 50 L ${x1} ${y1} A 50 50 0 ${angle > 180 ? 1 : 0} 1 ${x2} ${y2} Z`} fill={WHEEL_COLORS[index % WHEEL_COLORS.length]} stroke="white" strokeWidth="0.5" />
                <text x="50" y="50" fontSize="4" fontWeight="bold" fill="#333" textAnchor="middle" transform={`rotate(${midAngle}, 50, 50) translate(0, -35) rotate(90, 50, 50)`}>{candidates[index].name.substring(0,6)}</text>
            </g>
        );
    };

    return (
        <div className="fixed inset-0 z-[90] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 bg-stone-900 text-white flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><Sparkles className="text-yellow-400"/> 命運決策台</h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full"><X size={20}/></button>
                </div>
                <div className="flex border-b border-stone-200">
                    <button onClick={() => {setMode('wheel'); setResult(null); setIsSpinning(false);}} className={`flex-1 py-3 font-bold text-sm ${mode==='wheel' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-stone-400 hover:bg-stone-50'}`}>幸運轉盤</button>
                    <button onClick={() => {setMode('ladder'); setResult(null); setIsSpinning(false);}} className={`flex-1 py-3 font-bold text-sm ${mode==='ladder' ? 'bg-orange-50 text-orange-600 border-b-2 border-orange-500' : 'text-stone-400 hover:bg-stone-50'}`}>爬梯子</button>
                </div>
                <div className="flex-1 p-6 flex flex-col items-center justify-center bg-stone-50 min-h-[350px]">
                    {mode === 'wheel' && (
                        <div className="relative w-64 h-64">
                            <div className="w-full h-full rounded-full shadow-xl overflow-hidden border-4 border-white" style={{ transform: `rotate(${wheelRotation}deg)`, transition: isSpinning ? 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)' : 'none' }}>
                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                    {candidates.map((_, i) => renderWheelSlice(i, candidates.length))}
                                </svg>
                            </div>
                            <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-10 z-10"><div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[20px] border-t-red-600"></div></div>
                            <button onClick={spinWheel} disabled={isSpinning} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center font-black text-stone-800 border-4 border-stone-100 z-20">GO</button>
                        </div>
                    )}
                    {mode === 'ladder' && (
                        <div className="w-full h-full flex flex-col bg-white rounded-xl border border-stone-200 p-4 select-none relative min-h-[400px]">
                            <div className="flex justify-between mb-4 relative z-10">
                                {candidates.map((_, i) => <button key={i} onClick={() => startLadder(i)} disabled={isSpinning} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm transition-all relative ${selectedLadderStart === i ? 'bg-orange-500 text-white' : 'bg-stone-100 text-stone-500'}`}>{i+1}</button>)}
                            </div>
                            <div className="flex-1 relative w-full mb-8">
                                <svg className="absolute inset-0 w-full h-full" style={{overflow: 'visible'}}>
                                    {candidates.map((_, i) => { const x = (i / (candidates.length - 1)) * 100; return <line key={i} x1={`${x}%`} y1="0%" x2={`${x}%`} y2="100%" stroke="#94a3b8" strokeWidth="4" />; })}
                                    {ladderPaths.map((row, rIdx) => {
                                        const y = ((rIdx + 1) / (ladderPaths.length + 1)) * 100;
                                        return row.map((hasBridge, cIdx) => hasBridge && <line key={`${rIdx}-${cIdx}`} x1={`${(cIdx / (candidates.length - 1)) * 100}%`} y1={`${y}%`} x2={`${((cIdx + 1) / (candidates.length - 1)) * 100}%`} y2={`${y}%`} stroke="#94a3b8" strokeWidth="4" />);
                                    })}
                                    {ladderActivePath.length > 0 && <polyline points={ladderActivePath.map(p => { const x = (p.lane / (candidates.length - 1)) * 100; const y = (p.step / (ladderPaths.length + 1)) * 100; return `${x}%,${y}%`; }).join(' ')} fill="none" stroke="#f97316" strokeWidth="4" />}
                                </svg>
                            </div>
                            <div className="flex justify-between relative mt-auto">
                                {candidates.map((c, i) => <div key={i} className={`w-10 text-[10px] text-center truncate font-bold absolute top-0 transform -translate-x-1/2 ${ladderResultIndex === i ? 'text-red-600' : 'text-stone-400'}`} style={{ left: `${(i / (candidates.length - 1)) * 100}%` }}>{c.name}</div>)}
                            </div>
                        </div>
                    )}
                    {result && !isSpinning && (
                        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in zoom-in">
                            <div className="bg-white p-6 rounded-2xl shadow-2xl text-center w-3/4 border-4 border-yellow-400">
                                <div className="text-4xl mb-2">🎉</div>
                                <div className="text-xl font-black text-stone-800 mb-4">{result.name}</div>
                                <button onClick={() => setResult(null)} className="text-sm font-bold text-orange-500 hover:text-orange-600 underline">再玩一次</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ProfileModal = ({ userProfile, setUserProfile, onClose }) => {
  const [localName, setLocalName] = useState(userProfile.name);
  return (
    <div className="fixed inset-0 z-[80] bg-stone-900/80 flex items-center justify-center p-4 animate-in fade-in font-rounded backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-stone-100 rounded-full"><X size={20}/></button>
        <h2 className="text-xl font-black text-stone-800 mb-6 text-center">設定個人檔案</h2>
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-200"><img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} className="w-full h-full object-cover" /></div>
          <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} className="text-center font-bold text-xl border-b-2 border-stone-200 outline-none pb-2 w-3/4" placeholder="輸入暱稱"/>
        </div>
        <button onClick={() => { setUserProfile(prev => ({...prev, name: localName})); onClose(); }} className="w-full mt-8 bg-stone-800 text-white py-4 rounded-2xl font-bold shadow-lg">儲存設定</button>
      </div>
    </div>
  );
};

const RoomRestaurantSearchModal = ({ onClose, onSelect, virtualLocation }) => {
    const [queryText, setQueryText] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if(!window.google || !window.google.maps || !queryText.trim()) return;
        setLoading(true);
        try {
            const { Place } = await google.maps.importLibrary("places");
            const { places } = await Place.searchByText({ textQuery: queryText, locationBias: virtualLocation ? { center: virtualLocation, radius: 1000 } : undefined });
            const formatted = await Promise.all(places.map(async (place) => ({
                id: place.id, name: place.displayName, address: place.formattedAddress, rating: place.rating, 
                photoUrl: place.photos && place.photos.length > 0 ? place.photos[0].getURI({ maxWidth: 200 }) : null,
                lat: place.location.lat(), lng: place.location.lng()
            })));
            setResults(formatted);
        } catch(e) { console.error(e); alert("搜尋失敗"); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/50 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in zoom-in font-rounded overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center gap-2">
                    <input className="flex-1 bg-stone-100 rounded-xl px-4 py-3 outline-none" placeholder="輸入餐廳名稱..." value={queryText} onChange={e => setQueryText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} autoFocus />
                    <button onClick={onClose} className="p-3 bg-stone-100 rounded-xl"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
                    {loading && <div className="text-center text-stone-400 py-10">搜尋中...</div>}
                    {results.map(r => (
                        <div key={r.id} onClick={() => onSelect(r)} className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm flex gap-3 cursor-pointer hover:border-orange-300">
                            <div className="w-16 h-16 bg-stone-100 rounded-lg flex-shrink-0 overflow-hidden">{r.photoUrl ? <img src={r.photoUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-stone-300">{r.name.charAt(0)}</div>}</div>
                            <div className="flex-1 min-w-0"><h4 className="font-bold text-stone-800 truncate">{r.name}</h4><div className="text-xs text-stone-500 truncate">{r.address}</div></div>
                            <button className="self-center p-2 bg-orange-50 text-orange-500 rounded-full"><Plus size={18}/></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SocialView = ({ userProfile, room, setRoom, messages, setMessages, db, onBack, addToSharedList, removeFromSharedList, setShowDetail, virtualLocation, sharedRestaurants, updateSharedItemStatus }) => {
  const [msgInput, setMsgInput] = useState("");
  const messagesEndRef = useRef(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [selectedForDecision, setSelectedForDecision] = useState([]);
  const [subTab, setSubTab] = useState("chat");

  useEffect(() => { if(subTab === 'chat' && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, subTab]);

  const sendMessage = async () => {
      if (!msgInput.trim()) return;
      // 自動切換路徑
      if (db && room) await addDoc(getSmartCollection(db, "rooms", room.id, "messages"), { sender: userProfile.name, text: msgInput, type: 'text', createdAt: new Date() });
      setMsgInput("");
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 relative">
       {showDecisionModal && <DecisionMakerModal candidates={sharedRestaurants.filter(r => selectedForDecision.includes(r.id))} onClose={() => setShowDecisionModal(false)} />}
       <div className="bg-white/90 backdrop-blur px-4 py-3 shadow-sm flex justify-between items-center z-10 border-b border-stone-200">
          <button onClick={onBack} className="p-2 -ml-2 text-stone-500 rounded-full"><ChevronLeft size={24}/></button>
          <span className="font-bold text-lg">{room.name} (#{room.code})</span>
          <button onClick={() => setRoom(null)} className="p-2 text-stone-400 rounded-full"><LogOut size={20}/></button>
       </div>
       <div className="flex bg-white border-b border-stone-200 shrink-0">
          <button onClick={() => setSubTab('chat')} className={`flex-1 py-3 text-sm font-bold ${subTab === 'chat' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-stone-400'}`}>聊天室</button>
          <button onClick={() => setSubTab('list')} className={`flex-1 py-3 text-sm font-bold ${subTab === 'list' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-stone-400'}`}>共同清單</button>
       </div>
       <div className="flex-1 overflow-y-auto relative scroll-smooth p-4">
          {subTab === 'chat' ? (
              <div className="space-y-4 pb-20">
                  {messages.map((msg, i) => (
                      <div key={i} className={`flex gap-3 ${msg.sender === userProfile.name ? 'flex-row-reverse' : ''}`}>
                          <div className={`px-4 py-2 rounded-2xl text-sm ${msg.sender === userProfile.name ? 'bg-orange-500 text-white' : 'bg-white text-stone-800 shadow-sm'}`}>{msg.text}</div>
                      </div>
                  ))}
                  <div ref={messagesEndRef} />
              </div>
          ) : (
              <div className="space-y-4 pb-32">
                  <button onClick={() => setShowSearchModal(true)} className="w-full py-3 bg-white border-2 border-dashed border-stone-300 rounded-xl text-stone-400 font-bold flex items-center justify-center gap-2"><Plus size={20}/> 新增餐廳</button>
                  {sharedRestaurants.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-2xl border shadow-sm space-y-2">
                          <div className="flex justify-between">
                              <h4 className="font-bold text-stone-800">{item.name}</h4>
                              <button onClick={() => removeFromSharedList(item)}><Trash2 size={16} className="text-stone-300"/></button>
                          </div>
                          <div className="flex justify-between items-center text-xs text-stone-500">
                              <span>{item.address}</span>
                              <div className="flex items-center gap-1"><Star size={12} className="text-yellow-400 fill-yellow-400"/> {item.rating}</div>
                          </div>
                      </div>
                  ))}
                  <button onClick={() => { setSelectedForDecision(sharedRestaurants.map(r=>r.id)); setShowDecisionModal(true); }} className="w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-xl shadow-md">開始轉盤</button>
              </div>
          )}
       </div>
       {subTab === 'chat' && (
           <div className="p-3 bg-white border-t border-stone-200 flex gap-2 items-center shrink-0">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} className="flex-1 bg-stone-100 rounded-full px-5 py-3 outline-none" placeholder="輸入訊息..." />
              <button onClick={sendMessage} className="p-3 bg-orange-500 text-white rounded-full"><Send size={20}/></button>
           </div>
       )}
       {showSearchModal && <RoomRestaurantSearchModal onClose={() => setShowSearchModal(false)} onSelect={async (r) => { await addToSharedList(r); setShowSearchModal(false); }} virtualLocation={virtualLocation} />}
    </div>
  );
};

const LobbyView = ({ userProfile, onJoinRoom, onCreateRoom, myRooms, onEnterRoom, setShowProfileModal, onDeleteRoom }) => {
    const [joinCodeInput, setJoinCodeInput] = useState("");
    return (
      <div className="p-6 h-full flex flex-col items-center font-rounded bg-gradient-to-b from-stone-100 to-white overflow-y-auto">
         <div onClick={() => setShowProfileModal(true)} className="w-20 h-20 rounded-full overflow-hidden mb-6 border-4 border-white shadow-xl cursor-pointer"><img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} className="w-full h-full object-cover" /></div>
         <h1 className="text-3xl font-black text-stone-800 mb-8">揪團大廳</h1>
         <div className="w-full max-w-sm space-y-6">
             {myRooms.map(r => (
                 <div key={r.id} onClick={() => onEnterRoom(r)} className="bg-white p-4 rounded-2xl border shadow-sm flex justify-between items-center cursor-pointer">
                     <div><h3 className="font-bold text-stone-800">{r.name}</h3><span className="text-xs text-stone-500">#{r.code}</span></div>
                     <button onClick={(e) => { e.stopPropagation(); onDeleteRoom(r.id); }}><Trash2 size={16} className="text-stone-300"/></button>
                 </div>
             ))}
             <div className="bg-white p-6 rounded-3xl shadow-sm border space-y-4">
                <button onClick={onCreateRoom} className="w-full py-4 bg-orange-500 text-white rounded-2xl font-bold">建立新房間</button>
                <div className="flex gap-2">
                    <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="輸入代碼" className="flex-1 bg-stone-50 border rounded-2xl px-4 text-center" maxLength={4} />
                    <button onClick={() => onJoinRoom(joinCodeInput)} className="px-6 bg-stone-800 text-white rounded-2xl font-bold">加入</button>
                </div>
             </div>
         </div>
      </div>
    );
};

const SearchPanelComponent = ({ userProfile, setShowProfileModal, setIsMapMode, virtualLocation, executeSearch, loading, timeFilter, setTimeFilter, distFilter, setDistFilter, ratingFilter, setRatingFilter, priceFilter, setPriceFilter, travelTimes, sortBy, setSortBy, errorMsg }) => (
  <div className="p-6 space-y-8">
     <div className="text-center mt-6">
       <div onClick={() => setShowProfileModal(true)} className="w-20 h-20 rounded-full overflow-hidden mb-4 border-4 border-white shadow-xl mx-auto"><img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} className="w-full h-full object-cover" /></div>
       <h1 className="text-3xl font-black text-stone-800">今天吃什麼</h1>
     </div>

     {/* 新增：顯示錯誤訊息 */}
     {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <AlertCircle size={18} className="flex-shrink-0"/>
            <span>{errorMsg}</span>
        </div>
     )}

     <div className="bg-white p-5 rounded-3xl shadow-sm border cursor-pointer" onClick={() => setIsMapMode(true)}>
       <div className="flex items-center gap-2"><MapPin size={16} className="text-orange-500"/> <span className="font-bold text-stone-700">設定搜尋位置</span></div>
       <div className="text-xs text-stone-400 mt-1">{virtualLocation ? `${virtualLocation.lat.toFixed(4)}, ${virtualLocation.lng.toFixed(4)}` : "定位中..."}</div>
     </div>
     
     {/* 篩選器介面 - 補回完整功能 */}
     <div className="space-y-5">
       <div className="space-y-2">
         <label className="text-sm font-bold text-stone-700 flex items-center gap-2"><Clock size={18} className="text-teal-500"/> 用餐時段</label>
         <div className="grid grid-cols-4 gap-2">
             {[ { id: 'breakfast', label: '早餐' }, { id: 'lunch', label: '午餐' }, { id: 'dinner', label: '晚餐' }, { id: 'latenight', label: '宵夜' } ].map(opt => (
                <button key={opt.id} onClick={() => setTimeFilter(opt.id)} className={`py-2 rounded-lg text-xs font-bold transition-all ${timeFilter === opt.id ? 'bg-white text-teal-600 shadow-sm border border-teal-100' : 'text-stone-400 bg-stone-50 border border-transparent'}`}>{opt.label}</button>
             ))}
         </div>
       </div>
       <div className="grid grid-cols-2 gap-4">
           <div className="space-y-2">
               <label className="text-sm font-bold text-stone-700 flex items-center gap-2"><Navigation size={18} className="text-blue-500"/> 距離</label>
               <div className="relative">
                 <select value={distFilter} onChange={(e) => setDistFilter(parseInt(e.target.value))} className="w-full appearance-none bg-white border-2 border-stone-200 text-stone-600 py-3 px-3 rounded-xl text-xs font-bold outline-none focus:border-orange-400 transition-colors">
                   <option value={100}>100m</option><option value={300}>300m</option><option value={500}>500m</option><option value={1000}>1km</option><option value={2000}>2km</option><option value={5000}>5km</option>
                   <option value={10000}>10km</option><option value={20000}>20km</option>
                 </select>
                 <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={14} />
               </div>
           </div>
           <div className="space-y-2">
               <label className="text-sm font-bold text-stone-700 flex items-center gap-2"><Star size={18} className="text-yellow-500"/> 評分</label>
               <div className="relative">
                <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="w-full appearance-none bg-white border-2 border-stone-200 text-stone-600 py-3 px-3 rounded-xl text-xs font-bold outline-none focus:border-yellow-400 transition-colors">
                  <option value="all">評分不限</option><option value="3">3.0+</option><option value="4">4.0+</option><option value="4.5">4.5+</option>
                </select>
                <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={14} />
              </div>
           </div>
       </div>
       <div className="space-y-2">
           <label className="text-sm font-bold text-stone-700 flex items-center gap-2"><DollarSign size={18} className="text-green-500"/> 價格</label>
           <div className="relative">
            <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value)} className="w-full appearance-none bg-white border-2 border-stone-200 text-stone-600 py-3 px-3 rounded-xl text-xs font-bold outline-none focus:border-green-400 transition-colors">
              <option value="all">價格不限</option>
              <option value="1">$ (平價)</option>
              <option value="2">$$ (適中)</option>
              <option value="3">$$$ (稍貴)</option>
              <option value="4">$$$$ (高檔)</option>
            </select>
            <ChevronDown className="absolute right-3 top-3.5 text-stone-400 pointer-events-none" size={14} />
          </div>
       </div>
       <div className="flex gap-2 text-[10px] text-stone-500 font-bold bg-white/50 p-3 rounded-xl border border-stone-200 justify-around">
         <span className="flex items-center gap-1.5"><Footprints size={14} className="text-stone-400"/> 走 {travelTimes.walk} 分</span>
         <div className="w-px bg-stone-200 h-4 self-center"></div>
         <span className="flex items-center gap-1.5"><Bike size={14} className="text-stone-400"/> 騎 {travelTimes.bike} 分</span>
         <div className="w-px bg-stone-200 h-4 self-center"></div>
         <span className="flex items-center gap-1.5"><Car size={14} className="text-stone-400"/> 開 {travelTimes.car} 分</span>
       </div>
     </div>

     <button 
        onClick={executeSearch} 
        disabled={loading} 
        className="w-full bg-stone-800 text-white py-4 rounded-2xl font-bold shadow-lg disabled:opacity-70 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
     >
        {loading && <span className="animate-spin">⌛</span>}
        {loading ? "搜尋中..." : "開始搜尋"}
     </button>
  </div>
);

const SearchResultsComponent = ({ setHasSearched, restaurants, loading, errorMsg, setShowDetail, toggleShortlist, shortlist, hasSearched, sortBy, setSortBy }) => {
    if (!hasSearched) return null;
    return (
        <div className="p-4 space-y-4 pb-32 font-rounded bg-stone-50 min-h-full">
            <div className="flex flex-col gap-3 mb-2 px-1">
                <div className="flex justify-between items-center">
                    <button onClick={() => setHasSearched(false)} className="flex items-center gap-1 text-stone-500 font-bold text-sm bg-white border border-stone-200 px-4 py-2 rounded-xl hover:bg-stone-50 transition-colors shadow-sm"><ArrowLeft size={16} /> 調整篩選</button>
                    <div className="text-xs text-stone-400 font-bold"><span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded-md mr-1">{restaurants.length}</span> 間好選擇</div>
                </div>
                {/* 排序功能 */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <span className="text-xs font-bold text-stone-400 whitespace-nowrap"><Filter size={12} className="inline mr-1"/>排序:</span>
                    {[{id: 'default', label: '最佳'}, {id: 'distance', label: '距離近'}, {id: 'rating', label: '評分高'}, {id: 'price', label: '價格低'}].map(opt => (
                        <button key={opt.id} onClick={() => setSortBy(opt.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${sortBy === opt.id ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}>
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[60vh] space-y-6"><div className="animate-bounce text-6xl drop-shadow-xl">🍙</div><p className="text-stone-400 font-bold animate-pulse">正在幫你找好吃的...</p></div>
            ) : (
                <div className="space-y-4">
                    {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 border border-red-100"><AlertCircle size={18} /> <span className="whitespace-pre-line text-left">{errorMsg}</span></div>}
                    {restaurants.map(r => (
                        <div key={r.id} onClick={() => setShowDetail(r)} className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm active:scale-[0.98] transition-transform flex gap-3 cursor-pointer group hover:border-orange-200">
                            <div className="w-20 h-20 bg-stone-100 rounded-xl flex-shrink-0 overflow-hidden">{r.photoUrl ? <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-2xl text-stone-300 font-bold">{r.name.charAt(0)}</div>}</div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                <div>
                                    <h4 className="font-bold text-stone-800 truncate">{r.name}</h4>
                                    <div className="flex items-center gap-2 mt-1 text-xs">
                                        <span className="text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded truncate max-w-[80px]">{r.type}</span>
                                        <span className="text-orange-500 font-bold flex items-center gap-0.5"><MapPin size={10}/> {r.distance}km</span>
                                        {r.isOpen === true ? <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-bold">營業中</span> : r.isOpen === false ? <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">休息</span> : null}
                                    </div>
                                </div>
                                {r.todayHours && (
                                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-stone-500 bg-stone-50 px-2 py-1 rounded-md border border-stone-100 w-fit">
                                        <Clock size={10} className="text-stone-400"/>
                                        <span className="truncate max-w-[150px] font-medium">{r.todayHours}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-end mt-1">
                                    <div className="flex gap-1.5 items-center"><StarRating rating={r.rating} /><PriceDisplay level={r.priceLevel} /></div>
                                    <button onClick={(e) => toggleShortlist(e, r)} className={`p-2 rounded-full transition-colors ${shortlist.some(item => item.id === r.id) ? 'bg-rose-50 text-rose-500' : 'bg-stone-50 text-stone-300 hover:bg-stone-100'}`}><Heart size={16} fill={shortlist.some(item => item.id === r.id) ? "currentColor" : "none"} /></button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ShortlistScreenComponent = ({ shortlist, setActiveTab, aiAnalysis, setAiAnalysis, handleAiGroupAnalysis, isAiAnalyzing, setShowDetail, handleSystemShare, toggleShortlist, updateShortlistCategory, myRooms, addRestaurantToRoom }) => {
    const [selectedCategory, setSelectedCategory] = useState('全部');
    const [sharingItem, setSharingItem] = useState(null); // Track which item is being shared to show room selector
    const [customCategories, setCustomCategories] = useState([]);

    const categories = ['全部', ...new Set([...DEFAULT_CATEGORIES.slice(1), ...shortlist.map(r => r.customCategory || r.type), ...customCategories])];
    const filteredList = selectedCategory === '全部' ? shortlist : shortlist.filter(r => (r.customCategory || r.type) === selectedCategory);

    const handleEditCategory = (e, item) => {
        e.stopPropagation();
        const newCat = prompt("修改分類名稱:", item.customCategory || item.type);
        if (newCat && newCat.trim()) {
            updateShortlistCategory(item.id, newCat.trim());
        }
    };

    const handleShareClick = (e, item) => {
        e.stopPropagation();
        setSharingItem(item);
    };

    const handleAddCategory = () => {
        const newCat = prompt("請輸入新的分類名稱：");
        if (newCat && newCat.trim() && !categories.includes(newCat.trim())) {
            setCustomCategories(prev => [...prev, newCat.trim()]);
            setSelectedCategory(newCat.trim());
        }
    };

    return (
        <div className="p-4 pb-24 h-full flex flex-col font-rounded bg-stone-50 relative">
            
            {/* Share to Room Modal */}
            {sharingItem && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
                        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50">
                            <h3 className="font-bold text-stone-800">分享至房間</h3>
                            <button onClick={() => setSharingItem(null)} className="p-1 hover:bg-stone-200 rounded-full"><X size={20}/></button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            <p className="text-xs text-stone-500 mb-3 font-bold">選擇要分享「{sharingItem.name}」的房間：</p>
                            {myRooms.length > 0 ? (
                                <div className="space-y-2">
                                    {myRooms.map(room => (
                                        <button 
                                            key={room.id}
                                            onClick={() => {
                                                addRestaurantToRoom(room.id, sharingItem);
                                                setSharingItem(null);
                                            }}
                                            className="w-full flex justify-between items-center p-3 bg-stone-50 border border-stone-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all text-left"
                                        >
                                            <div>
                                                <div className="font-bold text-stone-800 text-sm">{room.name}</div>
                                                <div className="text-[10px] text-stone-400">#{room.code}</div>
                                            </div>
                                            <ArrowRight size={16} className="text-stone-300"/>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center text-stone-400 py-4 text-sm">你還沒有加入任何房間喔！</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between mb-4 px-2 pt-2">
                <h1 className="text-2xl font-black text-stone-800">候選清單</h1>
                <span className="text-xs font-bold bg-white px-3 py-1 rounded-full text-stone-400 shadow-sm border border-stone-200">{shortlist.length} 間</span>
            </div>
            
            {shortlist.length > 0 && (
                 <div className="mb-4 sticky top-0 bg-stone-50 z-10 pb-2">
                    <CategoryTabs categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} onAddCategory={handleAddCategory} />
                 </div>
            )}

            {shortlist.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-stone-300 gap-6">
                    <div className="w-24 h-24 bg-stone-100 rounded-full flex items-center justify-center"><Heart size={48} strokeWidth={1.5} /></div>
                    <p className="text-sm font-bold">還沒有加入任何餐廳喔！</p>
                    <button onClick={() => setActiveTab('home')} className="px-8 py-3 bg-stone-900 text-white rounded-2xl text-sm font-bold shadow-lg hover:scale-105 transition-transform">去逛逛</button>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto space-y-4">
                    <div className="bg-gradient-to-br from-orange-400 to-red-500 rounded-[2rem] p-6 text-white shadow-lg shadow-orange-200 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                        <h3 className="font-bold flex items-center gap-2 mb-3 text-lg"><Sparkles size={20} className="text-yellow-300"/> AI 幫你選</h3>
                        {aiAnalysis ? (
                            <div className="text-sm bg-white/10 p-4 rounded-xl backdrop-blur-md leading-relaxed animate-in fade-in border border-white/10">
                                {aiAnalysis}
                                <button onClick={() => setAiAnalysis("")} className="block w-full text-center text-xs mt-3 text-white/50 hover:text-white transition-colors border-t border-white/10 pt-2">清除重來</button>
                            </div>
                        ) : (
                            <div>
                                <p className="text-xs text-orange-100 mb-4 opacity-90">猶豫不決嗎？讓 AI 毒舌評論家幫你分析這 {shortlist.length} 家餐廳！</p>
                                <button onClick={handleAiGroupAnalysis} disabled={isAiAnalyzing} className="w-full py-3 bg-white text-orange-600 rounded-xl font-bold text-sm hover:bg-orange-50 transition-colors shadow-sm">{isAiAnalyzing ? "正在思考中..." : "✨ 幫我分析"}</button>
                            </div>
                        )}
                    </div>
                    <div className="space-y-3 pb-8">
                        {filteredList.map(r => (
                            <div key={r.id} onClick={() => setShowDetail(r)} className="bg-white p-3 rounded-2xl border border-stone-200 shadow-sm flex justify-between items-center active:scale-[0.98] transition-transform">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-stone-100 rounded-xl flex items-center justify-center font-bold text-stone-400 overflow-hidden shadow-inner">
                                        {r.photoUrl ? <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" /> : r.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-stone-800 text-sm truncate max-w-[140px]">{r.name}</h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <button onClick={(e) => handleEditCategory(e, r)} className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded flex items-center gap-1 hover:bg-stone-200 transition-colors">
                                               {r.customCategory || r.type} <Edit2 size={10} className="opacity-50"/>
                                            </button>
                                            <div className="text-[10px] text-stone-400 flex gap-1 font-bold">
                                                <span className="flex items-center gap-0.5"><Star size={10} className="text-yellow-400 fill-yellow-400"/> {r.rating}</span>
                                                <span>{r.distance}km</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => handleShareClick(e, r)} className="p-2.5 text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"><Share2 size={18} /></button>
                                    <button onClick={(e) => toggleShortlist(e, r)} className="p-2.5 text-red-400 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"><X size={18}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DetailModal (Restored and Placed Before App) ---
const DetailModal = ({ showDetail, ...props }) => {
    if (!showDetail) return null;
    const r = showDetail;
    const { shortlist, toggleShortlist, room, addToSharedList, removeFromSharedList, handleSystemShare, sharedRestaurants, updateSharedItemStatus, userProfile } = props;
    const isShortlisted = shortlist.some(item => item.id === r.id);
    const isInSharedList = room && sharedRestaurants.some(item => item.id === r.id);
    let todayHours = r.todayHours;
    if (!todayHours || typeof todayHours !== 'string') { todayHours = "暫無資料"; }
    let displayOpeningHours = r.openingHours; 
    if(r.regularOpeningHours && r.regularOpeningHours.weekdayDescriptions) { displayOpeningHours = r.regularOpeningHours.weekdayDescriptions; }
    if (todayHours === "暫無資料" && Array.isArray(displayOpeningHours)) {
       const day = new Date().getDay(); 
       const daysMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
       const todayStr = daysMap[day];
       const todayInfo = displayOpeningHours.find(h => typeof h === 'string' && (h.includes(todayStr) || h.includes(todayStr.substring(0, 3)))); 
       if (todayInfo) todayHours = todayInfo;
    }

    return (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-right duration-300 font-rounded">
          <div className="h-72 bg-stone-200 relative group">
             <button onClick={() => props.setShowDetail(null)} className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-stone-800 shadow-sm z-10 hover:bg-white transition-colors"><ChevronLeft size={24} /></button>
             <button onClick={() => handleSystemShare(r)} className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-teal-600 shadow-sm z-10 hover:bg-white transition-colors"><Share2 size={20} /></button>
             <div className="w-full h-full flex items-center justify-center text-6xl text-stone-400 font-bold bg-gradient-to-b from-stone-100 to-stone-300 overflow-hidden">{r.photoUrl ? <img src={r.photoUrl} className="w-full h-full object-cover" /> : r.name.charAt(0)}</div>
             <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-black/60 to-transparent"></div>
             <div className="absolute bottom-4 left-4 text-white"><span className="bg-white/20 px-3 py-1 rounded-full text-xs backdrop-blur-md border border-white/30 font-bold tracking-wide">{r.type}</span></div>
          </div>
          <div className="flex-1 p-6 -mt-6 bg-white rounded-t-3xl overflow-y-auto shadow-[0_-5px_20px_rgba(0,0,0,0.1)] relative">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-2xl font-black text-stone-800 leading-tight flex-1 mr-2">{r.name}</h2>
              <div className="flex flex-col items-end"><PriceDisplay level={r.priceLevel} /><span className={`text-[10px] mt-1 px-2 py-0.5 rounded-full font-bold ${r.isOpen ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>{r.isOpen ? '營業中' : '休息中'}</span></div>
            </div>
            <div className="flex items-center gap-2 mb-6 text-sm"><StarRating rating={r.rating} /> <span className="text-stone-400 font-medium">({r.userRatingsTotal || 0} 則評論)</span></div>
            <div className="bg-orange-50/50 p-4 rounded-2xl mb-6 text-xs text-stone-600 flex flex-col gap-2 border border-orange-100"><span className="font-bold flex items-center gap-2 text-orange-700 uppercase tracking-wider"><Clock size={14}/> 今日營業時間</span><span className="pl-6 text-sm font-medium">{todayHours.replace(/"/g, '')}</span></div>
            {isInSharedList && (
                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 mb-6">
                    <div className="text-xs font-bold text-stone-500 mb-2">你在共同清單中的評價</div>
                    <div className="flex justify-between items-center">
                         <div className="flex gap-2">
                            <button onClick={() => updateSharedItemStatus(r.id, 'eaten', true)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${r.eatenStatus?.[userProfile.name] ? 'bg-green-100 text-green-700' : 'bg-white border border-stone-200 text-stone-400'}`}><CheckCircle size={12}/> 吃過</button>
                            <button onClick={() => updateSharedItemStatus(r.id, 'eaten', false)} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${r.eatenStatus?.[userProfile.name] === false ? 'bg-orange-100 text-orange-700' : 'bg-white border border-stone-200 text-stone-400'}`}><Circle size={12}/> 沒吃</button>
                         </div>
                         <InteractiveStarRating value={r.ratings?.[userProfile.name] || 0} onChange={(val) => updateSharedItemStatus(r.id, 'rating', val)} />
                    </div>
                </div>
            )}
            <div className="space-y-4">
               <div className="bg-stone-50 p-4 rounded-2xl flex items-center gap-4 hover:bg-stone-100 transition-colors cursor-pointer group" onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(r.name)}`)}>
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-stone-400 shadow-sm group-hover:text-orange-500 transition-colors"><MapPin size={20} /></div>
                 <div className="flex-1"><p className="text-sm font-bold text-stone-800">{r.address}</p><p className="text-xs text-stone-500 mt-0.5">距離 {r.distance} 公里</p></div>
                 <ChevronLeft size={16} className="rotate-180 text-stone-300"/>
               </div>
            </div>
          </div>
          <div className="p-4 border-t border-stone-200 flex gap-3 pb-8 bg-white safe-area-bottom">
             <button onClick={(e) => toggleShortlist(e, r)} className={`flex-1 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 ${isShortlisted ? 'bg-rose-50 text-rose-500 border-2 border-rose-100' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'}`}><Heart size={20} fill={isShortlisted ? "currentColor" : "none"} /></button>
             {room ? (
               <div className="flex-[3] flex gap-2">
                   {isInSharedList ? (
                       <button onClick={() => { removeFromSharedList(r); props.setShowDetail(null); }} className="flex-1 bg-white border-2 border-red-500 text-red-600 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 text-xs"><Trash2 size={16} /> 移出清單</button>
                   ) : (
                       <button onClick={() => { addToSharedList(r); props.setShowDetail(null); }} className="flex-1 bg-white border-2 border-orange-500 text-orange-600 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 text-xs"><List size={16} /> 加入清單</button>
                   )}
                   <button onClick={() => { props.setShowDetail(null); /* logic to chat */ }} className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1 shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-95 text-xs"><Send size={16} /> 傳到聊天室</button>
               </div>
             ) : (
               <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.name)}&destination_place_id=${r.id}`)} className="flex-[3] bg-stone-800 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-stone-700 transition-all active:scale-95"><Navigation size={18}/> Google Maps 導航</button>
             )}
          </div>
        </div>
      );
};

// --- Main App Component ---
export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [realLocation, setRealLocation] = useState(null);
  const [virtualLocation, setVirtualLocation] = useState(null);
  const [isMapMode, setIsMapMode] = useState(false);
  const [userProfile, setUserProfile] = useState({ name: '美食探險家', gender: 'male', customAvatar: null });
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [room, setRoom] = useState(null); 
  const [messages, setMessages] = useState([]); 
  const [restaurants, setRestaurants] = useState([]);
  const [shortlist, setShortlist] = useState([]); 
  const [showDetail, setShowDetail] = useState(null);
  const [myRooms, setMyRooms] = useState([]);
  const [sharedRestaurants, setSharedRestaurants] = useState([]); 
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [authError, setAuthError] = useState(firebaseErrorMsg);
  
  // 新增：排序狀態
  const [sortBy, setSortBy] = useState('default');
  
  // Filters State for SearchPanelComponent (Restored)
  const [timeFilter, setTimeFilter] = useState('lunch'); 
  const [distFilter, setDistFilter] = useState(500); 
  const [ratingFilter, setRatingFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all');
  const [travelTimes, setTravelTimes] = useState(calculateTravelTime(500));
  const [hasSearched, setHasSearched] = useState(false);
  
  // AI States (Restored)
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // Firebase Auth
  useEffect(() => {
    if (firebaseErrorMsg) return; 

    const initAuth = async () => {
      if (!auth) { setAuthError("Auth Init Failed"); return; }
      try { await signInAnonymously(auth); } catch (e) { 
        console.error(e); 
        let msg = e.message;
        if (e.code === 'auth/configuration-not-found' || e.code === 'auth/operation-not-allowed' || e.code === 'auth/admin-restricted-operation') {
            msg = "auth/configuration-not-found";
        }
        setAuthError(msg); 
      }
    };
    initAuth();
    if (auth) return onAuthStateChanged(auth, (u) => setFirebaseUser(u));
  }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => { const loc = { lat: p.coords.latitude, lng: p.coords.longitude }; setRealLocation(loc); setVirtualLocation(loc); },
        () => { const def = { lat: 25.0330, lng: 121.5654 }; setRealLocation(def); setVirtualLocation(def); }
      );
    }
    if (GOOGLE_MAPS_API_KEY) loadGoogleMapsScript(GOOGLE_MAPS_API_KEY).catch(e => console.error(e));
  }, []);

  useEffect(() => { setTravelTimes(calculateTravelTime(distFilter)); }, [distFilter]);

  // Load My Rooms
  useEffect(() => {
      if(db && userProfile.name && firebaseUser) {
          // 自動切換路徑
          const q = query(getSmartCollection(db, "rooms"), where("members", "array-contains", userProfile.name)); 
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const rooms = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
              rooms.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 
              setMyRooms(rooms);
          }, (error) => {
              console.error("Room fetch error:", error);
              if (error.code === 'permission-denied') {
                  setAuthError("權限不足 (Permission Denied)。\n請到 Firebase Console > Firestore Database > Rules，將規則改為：\nallow read, write: if true;");
              } else {
                  setAuthError(error.message);
              }
          });
          return () => unsubscribe();
      }
  }, [userProfile.name, firebaseUser]);

  // Load Shared Restaurants for Current Room
  useEffect(() => {
      if (!db || !room?.id || !firebaseUser) return;
      // 自動切換路徑
      const q = query(getSmartCollection(db, "rooms", room.id, "shared_restaurants")); 
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
          list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 
          setSharedRestaurants(list);
      }, (error) => {
          console.error("Shared restaurants error:", error);
          if (error.code !== 'permission-denied') {
             // Optional: Handle other errors silently or show toast
          }
      });
      return () => unsubscribe();
  }, [room?.id, firebaseUser]);

  // Load Messages for Current Room
  useEffect(() => {
      if (!db || !room?.id || !firebaseUser) {
          if(!room) setMessages([]); // 離開房間清空訊息
          return;
      }
      // 自動切換路徑
      const q = query(getSmartCollection(db, "rooms", room.id, "messages"), orderBy("createdAt", "asc")); 
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
          setMessages(msgs);
      }, (error) => console.error("Messages error:", error));
      return () => unsubscribe();
  }, [room?.id, firebaseUser]);

  // Define updateSharedItemStatus here at App level so it can be passed down
  const updateSharedItemStatus = async (itemId, type, value) => {
      if (!db || !room?.id || !firebaseUser) return;
      const ref = getSmartDoc(db, "rooms", room.id, "shared_restaurants", itemId);
      try { 
          if (type === 'rating') await updateDoc(ref, { [`ratings.${userProfile.name}`]: value }); 
          else if (type === 'eaten') await updateDoc(ref, { [`eatenStatus.${userProfile.name}`]: value }); 
      } catch (e) { 
          console.error("更新失敗", e); 
      }
  };

  const addToSharedList = async (restaurant) => {
    if (!room) {
      alert("請先加入房間才能使用共同清單功能喔！");
      setActiveTab('social');
      return;
    }
    if (db && firebaseUser) {
      try {
        let simpleOpeningHours = null;
        if (restaurant.regularOpeningHours && restaurant.regularOpeningHours.weekdayDescriptions) {
             simpleOpeningHours = {
                 weekdayDescriptions: restaurant.regularOpeningHours.weekdayDescriptions
             };
        }

        // 自動切換路徑
        const docRef = getSmartDoc(db, "rooms", room.id, "shared_restaurants", restaurant.id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            alert(`「${restaurant.name}」已經在共同清單中了！`);
            return;
        }

        await setDoc(docRef, {
          name: restaurant.name || "未命名餐廳",
          address: restaurant.address || "",
          addedBy: userProfile.name,
          type: restaurant.customCategory || restaurant.type || "美食", 
          photoUrl: restaurant.photoUrl || null,
          ratings: {}, 
          eatenStatus: {}, 
          createdAt: serverTimestamp(),
          id: restaurant.id || "unknown_id", 
          rating: restaurant.rating || 0,
          userRatingsTotal: restaurant.userRatingsTotal || 0,
          priceLevel: restaurant.priceLevel || 0,
          isOpen: restaurant.isOpen === true, 
          lat: typeof restaurant.lat === 'function' ? restaurant.lat() : (restaurant.lat || 0), 
          lng: typeof restaurant.lng === 'function' ? restaurant.lng() : (restaurant.lng || 0),
          regularOpeningHours: simpleOpeningHours 
        });
        alert(`已將「${restaurant.name}」加入共同清單！`);
      } catch (e) {
        console.error("Firebase Add Error:", e); 
        alert("加入失敗，請稍後再試。(" + e.message + ")");
      }
    } else {
      alert("單機模式或未登入暫不支援共同清單功能");
    }
  };

  const addRestaurantToRoom = async (targetRoomId, restaurant) => {
    if (!db || !firebaseUser) return;
    try {
        // 自動切換路徑
        const docRef = getSmartDoc(db, "rooms", targetRoomId, "shared_restaurants", restaurant.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
             alert(`「${restaurant.name}」已經在該房間的清單中囉！`);
             return;
        }

        let simpleOpeningHours = null;
        if (restaurant.regularOpeningHours && restaurant.regularOpeningHours.weekdayDescriptions) {
           simpleOpeningHours = { weekdayDescriptions: restaurant.regularOpeningHours.weekdayDescriptions };
        }

        await setDoc(docRef, {
            name: restaurant.name || "未命名餐廳",
            address: restaurant.address || "",
            addedBy: userProfile.name,
            type: restaurant.customCategory || restaurant.type || "美食",
            photoUrl: restaurant.photoUrl || null,
            ratings: {},
            eatenStatus: {},
            createdAt: serverTimestamp(),
            id: restaurant.id || "unknown_id",
            rating: restaurant.rating || 0,
            userRatingsTotal: restaurant.userRatingsTotal || 0,
            priceLevel: restaurant.priceLevel || 0,
            isOpen: restaurant.isOpen === true,
            lat: typeof restaurant.lat === 'function' ? restaurant.lat() : (restaurant.lat || 0),
            lng: typeof restaurant.lng === 'function' ? restaurant.lng() : (restaurant.lng || 0),
            regularOpeningHours: simpleOpeningHours
        });
        alert("已分享至房間！");
    } catch(e) {
        console.error(e);
        alert("分享失敗");
    }
  };

  const removeFromSharedList = async (restaurant) => {
     if (!db || !room || !firebaseUser) return;
     if (!confirm("確定要從共同清單中移除這間餐廳嗎？")) return;
     try {
         // 自動切換路徑
         await deleteDoc(getSmartDoc(db, "rooms", room.id, "shared_restaurants", restaurant.id));
     } catch (e) {
         console.error("Remove Error:", e);
         alert("移除失敗");
     }
  };

  // --- 新增: 處理排序 ---
  useEffect(() => {
      if (restaurants.length > 0) {
          let sorted = [...restaurants];
          if (sortBy === 'distance') {
              sorted.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
          } else if (sortBy === 'rating') {
              sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
          } else if (sortBy === 'price') {
              sorted.sort((a, b) => {
                  const pA = a.priceLevel || 0;
                  const pB = b.priceLevel || 0;
                  return pA - pB; 
              });
          }
          setRestaurants(sorted);
      }
  }, [sortBy]);

  // --- 重寫: 執行搜尋 ---
  const executeSearch = async () => {
    if (!virtualLocation) return;
    if (!isGoogleMapsReady || !window.google || !window.google.maps) {
      setErrorMsg("Google Maps API 尚未載入。請檢查 Key 是否正確填入。");
      return;
    }
    setLoading(true); setHasSearched(true); setErrorMsg(""); setRestaurants([]); 
    isSearchingRef.current = true;

    try {
        const service = new window.google.maps.places.PlacesService(document.createElement('div'));
        
        let queryText = "restaurant";
        if (timeFilter === 'breakfast') queryText = "breakfast spots";
        if (timeFilter === 'lunch') queryText = "lunch restaurants";
        if (timeFilter === 'dinner') queryText = "dinner restaurants";
        if (timeFilter === 'latenight') queryText = "late night food";

        const currentHour = new Date().getHours();
        let isCurrentlyInSlot = false;
        
        if (timeFilter === 'breakfast' && currentHour >= 5 && currentHour < 12) isCurrentlyInSlot = true;
        else if (timeFilter === 'lunch' && currentHour >= 12 && currentHour < 18) isCurrentlyInSlot = true;
        else if (timeFilter === 'dinner' && currentHour >= 18) isCurrentlyInSlot = true; 
        else if (timeFilter === 'latenight' && (currentHour >= 0 && currentHour < 5)) isCurrentlyInSlot = true;

        const openNowFilter = isCurrentlyInSlot;

        const request = {
            query: queryText,
            location: new window.google.maps.LatLng(virtualLocation.lat, virtualLocation.lng),
            radius: distFilter,
            openNow: openNowFilter,
        };

        let allResults = [];
        let pageCount = 0;

        const fetchPage = (results, status, pagination) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                allResults = [...allResults, ...results];
                pageCount++;

                if (pagination && pagination.hasNextPage && pageCount < 3 && isSearchingRef.current) {
                    setTimeout(() => {
                        pagination.nextPage();
                    }, 2000);
                } else {
                    processResults(allResults);
                }
            } else {
                if(allResults.length > 0) processResults(allResults);
                else {
                    setLoading(false);
                    setErrorMsg("找不到餐廳，請嘗試放寬條件。");
                }
            }
        };

        const processResults = async (places) => {
            if (!isSearchingRef.current) return;
            
            const formatted = places.map(place => {
                let photoUrl = null;
                if (place.photos && place.photos.length > 0) photoUrl = place.photos[0].getUrl({ maxWidth: 400 });
                
                let isOpenStatus = place.opening_hours ? place.opening_hours.open_now : null;
                
                let todayHours = null;
                let regularOpeningHours = null;

                if (place.opening_hours && place.opening_hours.weekday_text) {
                    regularOpeningHours = { weekdayDescriptions: place.opening_hours.weekday_text };
                    
                    const now = new Date();
                    const dayNames = [
                        new Intl.DateTimeFormat('zh-TW', { weekday: 'long' }).format(now),
                        "週" + "日一二三四五六"[now.getDay()],
                        new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now),
                    ];
                    
                    const todayDesc = place.opening_hours.weekday_text.find(desc => 
                        dayNames.some(name => desc.includes(name))
                    );

                    if (todayDesc) {
                         let timePart = todayDesc.split(/[:：]\s+/).slice(1).join(":").trim();
                         if(!timePart) {
                             timePart = todayDesc;
                             dayNames.forEach(name => { timePart = timePart.replace(name, '').trim(); });
                         }
                         todayHours = timePart;
                    }
                }

                return {
                    id: place.place_id, 
                    name: place.name, 
                    type: mapGoogleTypeToCategory(place.types), 
                    rating: place.rating, 
                    userRatingsTotal: place.user_ratings_total, 
                    priceLevel: place.price_level, 
                    isOpen: isOpenStatus,
                    todayHours: todayHours, 
                    lat: place.geometry.location.lat(), 
                    lng: place.geometry.location.lng(),
                    distance: calculateDistance(virtualLocation.lat, virtualLocation.lng, place.geometry.location.lat(), place.geometry.location.lng()),
                    address: place.formatted_address, 
                    photoUrl: photoUrl,
                    regularOpeningHours: regularOpeningHours 
                };
            });

            // Client-side filtering
            let filtered = formatted.filter(r => parseFloat(r.distance) * 1000 <= distFilter * 1.5);

            if (ratingFilter !== 'all') filtered = filtered.filter(r => (r.rating || 0) >= parseInt(ratingFilter));
            
            if (priceFilter !== 'all') {
                const targetPrice = parseInt(priceFilter);
                filtered = filtered.filter(r => {
                    const p = r.priceLevel;
                    const effectivePrice = convertPriceLevel(p);
                    return effectivePrice === targetPrice;
                });
            }

            filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
            
            if (filtered.length === 0) setErrorMsg("篩選條件太嚴格，附近找不到餐廳 QQ");
            setRestaurants(filtered);
            setLoading(false);
            isSearchingRef.current = false;
        };

        service.textSearch(request, fetchPage);

    } catch (err) {
        setLoading(false);
        setErrorMsg("搜尋發生錯誤：" + err.message);
    }
  };

  const toggleShortlist = (e, restaurant) => {
    e.stopPropagation();
    setShortlist(prev => {
      const exists = prev.some(item => item.id === restaurant.id);
      return exists ? prev.filter(item => item.id !== restaurant.id) : [...prev, restaurant];
    });
  };

  // NEW: Update category in shortlist
  const updateShortlistCategory = (id, newCategory) => {
      setShortlist(prev => prev.map(item => 
          item.id === id ? { ...item, customCategory: newCategory } : item
      ));
  };

  const handleSystemShare = (restaurant) => {
    const text = `我們吃這家：${restaurant.name}\n📍 ${restaurant.address}\n⭐ ${restaurant.rating}\nGoogle Map: https://maps.google.com/?q=${encodeURIComponent(restaurant.name)}`;
    if (navigator.share) navigator.share({ title: '今天吃什麼？', text }).catch(console.error);
    else { navigator.clipboard.writeText(text); alert("已複製！"); }
  };

  // Join Room logic
  const onJoinRoom = async (code) => {
      if (code.length !== 4) return alert("請輸入 4 位數代碼");
      if (db && firebaseUser) {
        try {
          // 自動切換路徑
          const q = query(getSmartCollection(db, "rooms"), where("code", "==", code));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0];
            const roomData = { id: docData.id, ...docData.data() };
            if(!roomData.members.includes(userProfile.name)) {
                // 自動切換路徑
                await updateDoc(getSmartDoc(db, "rooms", docData.id), { members: arrayUnion(userProfile.name) });
                // 自動切換路徑
                await addDoc(getSmartCollection(db, "rooms", docData.id, "messages"), {
                    sender: 'System', text: `${userProfile.name} 加入了房間！`, type: 'system', createdAt: new Date()
                });
            }
            setRoom(roomData);
            setActiveTab('social');
          } else {
            alert("找不到此房間代碼！");
          }
        } catch (e) {
          alert(`加入失敗：${e.message}`);
        }
      }
  };

  const onCreateRoom = async () => {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const roomName = `${userProfile.name} 的美食團`;
      if (db && firebaseUser) {
        try {
          // 自動切換路徑
          const roomRef = await addDoc(getSmartCollection(db, "rooms"), {
            code: code, name: roomName, createdAt: new Date(), members: [userProfile.name]
          });
          // 自動切換路徑
          await addDoc(getSmartCollection(db, "rooms", roomRef.id, "messages"), {
            sender: 'System', text: `歡迎來到「${roomName}」！代碼：${code}`, type: 'system', createdAt: new Date()
          });
          setRoom({ id: roomRef.id, code, name: roomName });
          setActiveTab('social');
        } catch (e) {
          alert(`建立房間失敗：${e.message}`);
        }
      } else {
          // 本地模擬（如果不使用 Firebase）
          const newRoom = { id: "local", code, name: roomName, members: [userProfile.name] };
          setRoom(newRoom);
          setActiveTab('social');
      }
  };

  const onDeleteRoom = async (roomId) => {
      if (!confirm("確定要刪除這個房間嗎？\n注意：這將會移除所有人的聊天記錄與清單。")) return;
      if (db && firebaseUser) {
          try {
              // 自動切換路徑
              await deleteDoc(getSmartDoc(db, "rooms", roomId));
          } catch (e) {
              console.error("刪除失敗", e);
              alert("刪除失敗");
          }
      } else {
           setMyRooms(prev => prev.filter(r => r.id !== roomId));
      }
  };

  const handleAiGroupAnalysis = async () => {
    if (shortlist.length === 0) {
      alert("候選清單是空的，無法進行分析喔！");
      return;
    }

    setIsAiAnalyzing(true);
    setAiAnalysis(""); 

    try {
      // 準備給 AI 的提示詞
      const restaurantNames = shortlist.map(r => r.name).join(", ");
      const prompt = `我們現在有這些餐廳候選名單：${restaurantNames}。
請用幽默、有點毒舌但又中肯的語氣，幫我們分析這些選擇，並根據餐廳類型、口味多樣性給出建議。
最後請推薦一個「大家最可能滿意」的選擇，並給出理由。字數控制在 200 字以內。`;

      // 呼叫 Gemini
      const result = await callGemini(prompt);
      setAiAnalysis(result);
    } catch (error) {
      console.error("AI Analysis Error:", error);
      setAiAnalysis("AI 分析暫時無法使用，請稍後再試。");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  if (authError) {
      return (
          <div className="h-screen flex flex-col items-center justify-center p-6 bg-stone-50 text-center font-rounded">
              <AlertCircle size={48} className="text-red-500 mb-4" />
              <h2 className="text-xl font-black text-stone-800 mb-2">發生錯誤</h2>
              <p className="text-stone-500 text-sm mb-4 max-w-md mx-auto">{typeof authError === 'string' ? authError : '未知錯誤'}</p>
              {
                  // Show debugging info
              }
               <div className="mb-4 text-xs text-stone-400 bg-stone-100 p-2 rounded">
                  <p>Project ID: {MANUAL_FIREBASE_CONFIG.projectId}</p>
                  <p>API Key Prefix: {MANUAL_FIREBASE_CONFIG.apiKey ? MANUAL_FIREBASE_CONFIG.apiKey.substring(0, 5) + '...' : 'None'}</p>
              </div>

              {authError.includes("auth/configuration-not-found") && (
                  <div className="text-left text-xs bg-white p-4 rounded-xl border border-stone-200 shadow-sm max-w-xs mx-auto space-y-2">
                      <p className="font-bold text-stone-700">可能原因與解法：</p>
                      <ul className="list-disc list-inside text-stone-500 space-y-1">
                          <li><strong>專案不符合：</strong>請確認您的 Config 中的 projectId <code>{MANUAL_FIREBASE_CONFIG.projectId}</code> 與您開啟 Auth 的專案一致。</li>
                          <li><strong>尚未啟用：</strong>Firebase Console &gt; Authentication &gt; Sign-in method &gt; Anonymous 必須設為 Enabled。</li>
                          <li><strong>API Key 限制：</strong>若您在 Google Cloud Console 限制了 API Key，請確保已允許 <strong>Identity Toolkit API</strong>。</li>
                      </ul>
                  </div>
              )}
               <button 
                  onClick={() => window.location.reload()} 
                  className="mt-6 px-6 py-2 bg-stone-800 text-white rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
              >
                  重新整理頁面
              </button>
          </div>
      );
  }

  return (
    <div className="h-[100dvh] bg-stone-50 max-w-md mx-auto relative overflow-hidden flex flex-col font-sans font-rounded text-stone-800">
      {isMapMode && <RealMapSelector initialLocation={virtualLocation} userLocation={realLocation} onConfirm={(loc)=>{setVirtualLocation(loc); setIsMapMode(false);}} onCancel={()=>setIsMapMode(false)} />}
      {showProfileModal && <ProfileModal userProfile={userProfile} setUserProfile={setUserProfile} onClose={() => setShowProfileModal(false)} />}
      
      <div className="flex-1 overflow-y-auto no-scrollbar bg-stone-50">
        {activeTab === 'home' && (!hasSearched ? (
          <SearchPanelComponent 
            userProfile={userProfile} 
            setShowProfileModal={setShowProfileModal} 
            setIsMapMode={setIsMapMode} 
            virtualLocation={virtualLocation}
            realLocation={realLocation}
            timeFilter={timeFilter}
            setTimeFilter={setTimeFilter}
            distFilter={distFilter}
            setDistFilter={setDistFilter}
            ratingFilter={ratingFilter}
            setRatingFilter={setRatingFilter}
            priceFilter={priceFilter}
            setPriceFilter={setPriceFilter}
            travelTimes={travelTimes}
            executeSearch={executeSearch}
            loading={loading}
            sortBy={sortBy}
            setSortBy={setSortBy}
            errorMsg={errorMsg} 
          />
        ) : (
          <SearchResultsComponent 
            setHasSearched={setHasSearched}
            restaurants={restaurants}
            loading={loading}
            errorMsg={errorMsg}
            setShowDetail={setShowDetail}
            toggleShortlist={toggleShortlist}
            shortlist={shortlist}
            hasSearched={hasSearched}
            sortBy={sortBy}
            setSortBy={setSortBy}
          />
        ))}
        
        {activeTab === 'shortlist' && (
          <ShortlistScreenComponent 
            shortlist={shortlist}
            setActiveTab={setActiveTab}
            aiAnalysis={aiAnalysis}
            setAiAnalysis={setAiAnalysis}
            handleAiGroupAnalysis={handleAiGroupAnalysis}
            isAiAnalyzing={isAiAnalyzing}
            setShowDetail={setShowDetail}
            handleSystemShare={handleSystemShare}
            toggleShortlist={toggleShortlist}
            updateShortlistCategory={updateShortlistCategory}
            myRooms={myRooms}
            addRestaurantToRoom={addRestaurantToRoom}
          />
        )}
        
        {activeTab === 'social' && (
            room ? (
                <SocialView 
                    userProfile={userProfile} 
                    room={room} 
                    setRoom={setRoom} 
                    messages={messages} 
                    setMessages={setMessages} 
                    db={db} 
                    addToSharedList={addToSharedList} 
                    removeFromSharedList={removeFromSharedList}
                    onBack={() => setRoom(null)} 
                    setShowDetail={setShowDetail} 
                    virtualLocation={virtualLocation}
                    sharedRestaurants={sharedRestaurants}
                    updateSharedItemStatus={updateSharedItemStatus}
                />
            ) : (
                <LobbyView 
                    userProfile={userProfile}
                    myRooms={myRooms}
                    onJoinRoom={onJoinRoom}
                    onCreateRoom={onCreateRoom}
                    onEnterRoom={(r) => setRoom(r)}
                    setShowProfileModal={setShowProfileModal}
                    onDeleteRoom={onDeleteRoom}
                />
            )
        )}
      </div>

      {!room && <NavBar activeTab={activeTab} setActiveTab={setActiveTab} />}
      
      <DetailModal 
        showDetail={showDetail} 
        setShowDetail={setShowDetail}
        shortlist={shortlist}
        toggleShortlist={toggleShortlist}
        room={room}
        addToSharedList={addToSharedList}
        removeFromSharedList={removeFromSharedList}
        handleSystemShare={handleSystemShare}
        setActiveTab={() => {}} 
        sharedRestaurants={sharedRestaurants}
        updateSharedItemStatus={updateSharedItemStatus}
        userProfile={userProfile}
      />
    </div>
  );
}