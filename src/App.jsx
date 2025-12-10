import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Star, Navigation, Utensils, Heart, Users, 
  Share2, Sparkles, X, Home, Settings, List, ChevronLeft, 
  Locate, Send, AlertCircle, Clock, Search, ChevronDown, ArrowLeft,
  MessageCircle, Camera, User, LogOut, ThumbsUp, PlusCircle, Link as LinkIcon,
  Bike, Car, Footprints, Vote, Edit2, CheckCircle, Circle, Trash2, Plus, ArrowRight,
  Minimize2, Maximize2, Tag, DollarSign, Check, Filter
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, doc, onSnapshot, 
  updateDoc, arrayUnion, query, where, getDocs, orderBy, deleteDoc, serverTimestamp, getDoc, setDoc
} from "firebase/firestore";

// ==========================================
// ⚠️ 設定區
// ==========================================
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""; 
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";         

// 🔥 Firebase 設定
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBp8ni5BDM4NRpPgqBPe2x9pUi3rPPnv5w",
  authDomain: "foodvotingapp.firebaseapp.com",
  projectId: "foodvotingapp",
  storageBucket: "foodvotingapp.firebasestorage.app",
  messagingSenderId: "765035779856",
  appId: "1:765035779856:web:fd38c7b2e88f4a44f3b795",
  measurementId: "G-XC9G7C62GD"
};

// --- 初始化 Firebase ---
let db = null;
try {
  if (FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.length > 10) {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    console.log("🔥 Firebase 已嘗試連線...");
  } else {
    console.log("⚠️ Firebase 設定為空，將使用單機模擬模式");
  }
} catch (error) {
  console.error("Firebase 初始化失敗", error);
  db = null;
}

// --- 常數定義 ---
const DEFAULT_CATEGORIES = ['全部', '台式', '日式', '韓式', '美式', '義式', '泰式', '火鍋', '燒肉', '早午餐', '甜點', '素食', '小吃', '其他'];

// --- 工具函數 ---

const mapGoogleTypeToCategory = (types) => {
  if (!types || types.length === 0) return '其他';
  const t = types.join(' ').toLowerCase();
  if (t.includes('japanese') || t.includes('sushi') || t.includes('ramen')) return '日式';
  if (t.includes('korean')) return '韓式';
  if (t.includes('taiwanese') || t.includes('chinese')) return '台式';
  if (t.includes('american') || t.includes('burger') || t.includes('steak')) return '美式';
  if (t.includes('italian') || t.includes('pizza') || t.includes('pasta')) return '義式';
  if (t.includes('thai')) return '泰式';
  if (t.includes('cafe') || t.includes('coffee') || t.includes('bakery') || t.includes('dessert')) return '甜點';
  if (t.includes('breakfast') || t.includes('brunch')) return '早午餐';
  if (t.includes('bar') || t.includes('pub') || t.includes('wine')) return '餐酒館';
  if (t.includes('vegetarian') || t.includes('vegan')) return '素食';
  return '其他';
};

// 轉換 Google Price Level 字串為數字
const convertPriceLevel = (level) => {
    if (typeof level === 'number') return level;
    if (!level) return 0;
    
    // 處理 Google Maps New Places API 的 Enum 字串
    if (level === 'PRICE_LEVEL_FREE') return 0;
    if (level === 'PRICE_LEVEL_INEXPENSIVE') return 1;
    if (level === 'PRICE_LEVEL_MODERATE') return 2;
    if (level === 'PRICE_LEVEL_EXPENSIVE') return 3;
    if (level === 'PRICE_LEVEL_VERY_EXPENSIVE') return 4;
    
    return 0; // 預設為無標示
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return "N/A";
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
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
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    if (!response.ok) throw new Error("Network error");
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 暫時無法回應。";
  } catch (error) {
    return "AI 連線發生問題。";
  }
};

const PriceDisplay = ({ level }) => {
  const numLevel = convertPriceLevel(level);
  return (
    <div className="flex text-emerald-600 text-[10px] font-bold bg-emerald-50 px-2 py-1 rounded-full border border-emerald-100">
      {numLevel > 0 
        ? [...Array(numLevel)].map((_, i) => <span key={i}>$</span>) 
        : <span>$</span> // 預設顯示一個 $ (平價/未知)
      }
    </div>
  );
};

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-1 bg-orange-50 px-2 py-1 rounded-full text-orange-600 font-bold text-[10px] border border-orange-100">
    <Star size={10} fill="currentColor" />
    <span>{rating || "N/A"}</span>
  </div>
);

const InteractiveStarRating = ({ value, onChange, readOnly = false }) => {
  const [hoverValue, setHoverValue] = useState(null);

  const handleMouseMove = (e, index) => {
    if (readOnly) return;
    const { left, width } = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - left) / width;
    setHoverValue(index + (percent > 0.5 ? 1 : 0.5));
  };

  const displayValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className="flex" onMouseLeave={() => setHoverValue(null)}>
      {[0, 1, 2, 3, 4].map((index) => {
        const fill = Math.max(0, Math.min(1, displayValue - index)); 
        return (
          <div
            key={index}
            className={`relative w-6 h-6 ${readOnly ? '' : 'cursor-pointer'}`}
            onMouseMove={(e) => handleMouseMove(e, index)}
            onClick={() => !readOnly && onChange(hoverValue)}
          >
            <Star size={18} className="text-stone-300 absolute top-0 left-0" />
            <div className="absolute top-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
               <Star size={18} className="text-yellow-400 fill-yellow-400" />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const calculateTravelTime = (meters) => {
  const walk = Math.ceil(meters / 83);
  const bike = Math.ceil(meters / 250);
  const car = Math.ceil(meters / 500);
  return { walk, bike, car };
};

// --- 子組件 ---

const CategoryTabs = ({ categories, selected, onSelect }) => (
  <div className="flex gap-2 overflow-x-auto pb-2 px-1 custom-scrollbar">
    {categories.map(cat => (
      <button
        key={cat}
        onClick={() => onSelect(cat)}
        className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow-sm border ${
          selected === cat 
            ? 'bg-orange-500 text-white border-orange-500 shadow-orange-200' 
            : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
        }`}
      >
        {cat}
      </button>
    ))}
  </div>
);

const RealMapSelector = ({ initialLocation, onConfirm, onCancel, userLocation }) => {
  const mapRef = useRef(null);
  const [selectedLoc, setSelectedLoc] = useState(initialLocation);
  const [mapError, setMapError] = useState("");
  const [addressInput, setAddressInput] = useState("");
  const [foundPlaceName, setFoundPlaceName] = useState(""); // 儲存找到的地點名稱
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  
  useEffect(() => {
    if (!window.google || !window.google.maps) {
        setMapError("Google Maps API 未載入，請確認 API Key。");
        return;
    }
    if (!mapRef.current) return;

    try {
      const map = new window.google.maps.Map(mapRef.current, { center: initialLocation, zoom: 15, disableDefaultUI: true, clickableIcons: false, mapId: "DEMO_MAP_ID" });
      const marker = new window.google.maps.Marker({ position: initialLocation, map: map, draggable: true, animation: window.google.maps.Animation.DROP, title: "拖曳我來修改位置" });
      
      mapInstanceRef.current = map;
      markerRef.current = marker;

      map.addListener("click", (e) => { 
          const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() }; 
          marker.setPosition(newLoc); 
          setSelectedLoc(newLoc); 
          setFoundPlaceName("地圖選取位置"); // 重置名稱
          map.panTo(newLoc); 
      });
      marker.addListener("dragend", (e) => { 
          const newLoc = { lat: e.latLng.lat(), lng: e.latLng.lng() }; 
          setSelectedLoc(newLoc); 
          setFoundPlaceName("地圖選取位置"); // 重置名稱
          map.panTo(newLoc); 
      });
    } catch (e) { setMapError("地圖載入發生錯誤：" + e.message); }
  }, []);

  const handleAddressSearch = () => {
      if (!window.google || !window.google.maps || !addressInput.trim()) return;
      
      // 使用 Places Service 進行更精確的「地標」與「地址」搜尋
      const service = new window.google.maps.places.PlacesService(mapInstanceRef.current);
      const request = {
          query: addressInput,
          fields: ['name', 'geometry', 'formatted_address'],
      };

      service.findPlaceFromQuery(request, (results, status) => {
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
              const place = results[0];
              const location = place.geometry.location;
              const newLoc = { lat: location.lat(), lng: location.lng() };
              
              setSelectedLoc(newLoc);
              setFoundPlaceName(place.name || place.formatted_address); // 顯示找到的地點名稱
              
              if (mapInstanceRef.current) {
                  mapInstanceRef.current.panTo(newLoc);
                  mapInstanceRef.current.setZoom(16);
              }
              if (markerRef.current) markerRef.current.setPosition(newLoc);
          } else {
              // 如果 Places 找不到，回退到 Geocoder 嘗試
              const geocoder = new window.google.maps.Geocoder();
              geocoder.geocode({ address: addressInput }, (results, status) => {
                  if (status === 'OK' && results[0]) {
                      const location = results[0].geometry.location;
                      const newLoc = { lat: location.lat(), lng: location.lng() };
                      setSelectedLoc(newLoc);
                      setFoundPlaceName(results[0].formatted_address);
                      if (mapInstanceRef.current) mapInstanceRef.current.panTo(newLoc);
                      if (markerRef.current) markerRef.current.setPosition(newLoc);
                  } else {
                      alert('找不到該地點，請嘗試更具體的名稱或地址。');
                  }
              });
          }
      });
  };

  return (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col animate-in fade-in font-rounded">
      <div className="p-4 bg-white/80 backdrop-blur-md border-b flex justify-between items-center shadow-sm z-10 absolute top-0 w-full">
        <h3 className="font-bold text-slate-800 flex items-center gap-2"><MapPin className="text-rose-500" /> 修改目前位置</h3>
        <button onClick={onCancel} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} /></button>
      </div>
      
      <div className="flex-1 relative bg-slate-100 flex items-center justify-center h-full pt-16 pb-40">
        {mapError ? <div className="text-center p-6 bg-white rounded-xl shadow-sm"><AlertCircle className="mx-auto text-red-500 mb-2" size={32} /><p className="text-slate-600 font-bold">{mapError}</p><button onClick={onCancel} className="mt-4 px-4 py-2 bg-slate-200 rounded-lg text-sm">關閉</button></div> : <div ref={mapRef} className="w-full h-full" />}
        {!mapError && <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-4 py-2 rounded-full text-xs font-bold text-slate-600 shadow-lg pointer-events-none border border-slate-100">點擊地圖或拖曳紅點來移動</div>}
      </div>

      <div className="absolute bottom-0 w-full p-4 space-y-3 bg-white border-t rounded-t-3xl shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
         {/* 地址搜尋欄 */}
         <div className="flex gap-2">
             <input 
                type="text" 
                value={addressInput} 
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddressSearch()}
                placeholder="輸入地標或地址 (例: 台北101, 台中歌劇院)" 
                className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500"
             />
             <button onClick={handleAddressSearch} className="bg-stone-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0">搜尋</button>
         </div>

         {/* 找到的地點確認區塊 */}
         {foundPlaceName && (
             <div className="bg-orange-50 px-3 py-2 rounded-lg flex items-center gap-2 text-xs font-bold text-orange-700 animate-in fade-in">
                 <Check size={14} />
                 <span>定位至: {foundPlaceName}</span>
             </div>
         )}

         <div className="flex justify-between text-xs text-slate-500 px-1 pt-1"><span>經度: {selectedLoc?.lng.toFixed(5)}</span><span>緯度: {selectedLoc?.lat.toFixed(5)}</span></div>
         <div className="flex gap-2">
            <button onClick={() => { if(userLocation) { setSelectedLoc(userLocation); setFoundPlaceName("我的位置"); onConfirm(userLocation); } }} className="flex-1 py-3 bg-teal-50 text-teal-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-teal-100 transition-colors"><Locate size={18}/> 真實 GPS</button>
            <button onClick={() => onConfirm(selectedLoc)} className="flex-[2] py-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-200 active:scale-95 transition-all">確認此地點</button>
         </div>
      </div>
    </div>
  );
};

const ProfileModal = ({ userProfile, setUserProfile, onClose }) => {
  const [localName, setLocalName] = useState(userProfile.name);
  const avatarSeeds = ["Felix", "Maria", "Jack", "Aneka", "Jocelyn", "Granny", "Bear", "Leo", "Zoe", "Max", "Luna", "Tiger"];
  const handleFileUpload = (e) => { const file = e.target.files[0]; if (file) { const url = URL.createObjectURL(file); setUserProfile(prev => ({ ...prev, customAvatar: url })); } };

  return (
    <div className="fixed inset-0 z-[80] bg-stone-900/80 flex items-center justify-center p-4 animate-in fade-in font-rounded backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl border border-white/50">
        <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-stone-100 rounded-full hover:bg-stone-200"><X size={20}/></button>
        <h2 className="text-xl font-black text-stone-800 mb-6 text-center">設定個人檔案</h2>
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-orange-200 relative group shadow-lg ring-4 ring-orange-50">
             <img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} alt="Avatar" className="w-full h-full object-cover" />
             <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs font-bold backdrop-blur-sm"><Camera size={24} className="mb-1"/><input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} /></label>
          </div>
          <input type="text" value={localName} onChange={(e) => setLocalName(e.target.value)} className="text-center font-bold text-xl border-b-2 border-stone-200 focus:border-orange-500 outline-none pb-2 w-3/4 bg-transparent transition-colors" placeholder="輸入暱稱"/>
        </div>
        <div className="space-y-3 mb-6"><label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">形象風格</label><div className="flex gap-3 bg-stone-100 p-1 rounded-2xl"><button onClick={() => setUserProfile({...userProfile, gender: 'male', customAvatar: null})} className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${userProfile.gender === 'male' && !userProfile.customAvatar ? 'bg-white text-blue-600 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><User size={18} /> 男生</button><button onClick={() => setUserProfile({...userProfile, gender: 'female', customAvatar: null})} className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${userProfile.gender === 'female' && !userProfile.customAvatar ? 'bg-white text-rose-500 shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}><User size={18} /> 女生</button></div></div>
        <div className="space-y-3"><label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">快速選擇頭像</label><div className="grid grid-cols-4 gap-3">{avatarSeeds.map(seed => (<div key={seed} onClick={() => setUserProfile({...userProfile, customAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`})} className="aspect-square rounded-2xl bg-stone-50 overflow-hidden cursor-pointer hover:ring-4 hover:ring-rose-200 transition-all shadow-sm border border-stone-100"><img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`} className="w-full h-full object-cover" /></div>))}</div></div>
        <button onClick={() => { setUserProfile(prev => ({...prev, name: localName})); onClose(); }} className="w-full mt-8 bg-stone-800 text-white py-4 rounded-2xl font-bold shadow-lg shadow-stone-300 hover:bg-stone-700 active:scale-95 transition-all">儲存設定</button>
      </div>
    </div>
  );
};

const RoomRestaurantSearchModal = ({ onClose, onSelect, virtualLocation }) => {
    // ... code identical to previous version, omitting for brevity ...
    // Since this component uses basic searchByText, it's fine.
    // The main search panel is where the logic changes.
    const [queryText, setQueryText] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleSearch = async () => {
        if(!window.google || !window.google.maps || !queryText.trim()) return;
        setLoading(true);
        try {
            const { Place } = await google.maps.importLibrary("places");
            const { places } = await Place.searchByText({
                textQuery: queryText,
                fields: ['id', 'displayName', 'types', 'rating', 'userRatingCount', 'priceLevel', 'regularOpeningHours', 'location', 'formattedAddress', 'photos'],
                locationBias: virtualLocation ? { center: { lat: virtualLocation.lat, lng: virtualLocation.lng }, radius: 1000 } : undefined,
                maxResultCount: 10,
            });
            const formatted = await Promise.all(places.map(async (place) => {
                let photoUrl = null;
                if (place.photos && place.photos.length > 0) photoUrl = place.photos[0].getURI({ maxWidth: 200 });
                let isOpenStatus = null;
                try { isOpenStatus = await place.isOpen(); } catch(e) {}
                return {
                    id: place.id, name: place.displayName, type: mapGoogleTypeToCategory(place.types), rating: place.rating, priceLevel: place.priceLevel, address: place.formattedAddress, photoUrl, isOpen: isOpenStatus, lat: place.location.lat(), lng: place.location.lng(), regularOpeningHours: place.regularOpeningHours 
                };
            }));
            setResults(formatted);
        } catch(e) { console.error(e); alert("搜尋失敗"); } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 bg-stone-900/50 z-[80] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md h-[80vh] flex flex-col shadow-2xl animate-in zoom-in font-rounded overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center gap-2">
                    <input className="flex-1 bg-stone-100 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500" placeholder="輸入餐廳名稱..." value={queryText} onChange={e => setQueryText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} autoFocus />
                    <button onClick={onClose} className="p-3 bg-stone-100 rounded-xl hover:bg-stone-200"><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50">
                    {loading && <div className="text-center text-stone-400 py-10">搜尋中...</div>}
                    {results.map(r => (
                        <div key={r.id} onClick={() => onSelect(r)} className="bg-white p-3 rounded-xl border border-stone-200 shadow-sm flex gap-3 cursor-pointer hover:border-orange-300 transition-colors">
                            <div className="w-16 h-16 bg-stone-100 rounded-lg flex-shrink-0 overflow-hidden">{r.photoUrl ? <img src={r.photoUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center text-stone-300 text-xl font-bold">{r.name.charAt(0)}</div>}</div>
                            <div className="flex-1 min-w-0"><h4 className="font-bold text-stone-800 truncate">{r.name}</h4><div className="flex items-center gap-2 mt-1"><span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">{r.type}</span><span className="text-xs text-stone-500 truncate">{r.address}</span></div></div>
                            <button className="self-center p-2 bg-orange-50 text-orange-500 rounded-full"><Plus size={18}/></button>
                        </div>
                    ))}
                    {!loading && results.length === 0 && <div className="text-center text-slate-400 py-10 text-sm">輸入關鍵字尋找餐廳<br/>點擊 + 加入共同清單</div>}
                </div>
            </div>
        </div>
    );
};

// SocialView Component ... (unchanged)
const SocialView = ({ userProfile, room, setRoom, messages, setMessages, db, onBack, addToSharedList, removeFromSharedList, setShowDetail, virtualLocation, sharedRestaurants, updateSharedItemStatus }) => {
  const [msgInput, setMsgInput] = useState("");
  const [subTab, setSubTab] = useState("chat"); 
  const messagesEndRef = useRef(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("全部");

  const getAvatarUrl = () => { if (userProfile.customAvatar) return userProfile.customAvatar; const seed = userProfile.gender === 'male' ? 'Felix' : 'Maria'; return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`; };

  useEffect(() => { if(subTab === 'chat' && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [messages, subTab]);

  const handleRenameRoom = async () => {
      const newName = prompt("請輸入新的房間名稱：", room.name);
      if (newName && newName.trim() && db) {
          try { await updateDoc(doc(db, "rooms", room.id), { name: newName.trim() }); setRoom(prev => ({ ...prev, name: newName.trim() })); } catch (e) { alert("改名失敗"); }
      }
  };

  const handleAddRestaurantFromSearch = async (restaurantData) => { await addToSharedList(restaurantData); setShowSearchModal(false); };

  const handleEditCategory = async (itemId, currentCat) => {
      const newCat = prompt("請輸入新的分類名稱：", currentCat);
      if (newCat && newCat.trim() && db) {
          try {
              const ref = doc(db, "rooms", room.id, "shared_restaurants", itemId);
              await updateDoc(ref, { type: newCat.trim() });
          } catch(e) { console.error(e); }
      }
  };

  const sendMessage = async (text) => {
      if (!text.trim()) return;
      const msgData = { sender: userProfile.name, avatar: getAvatarUrl(), text: text, type: 'text', createdAt: new Date() };
      if (db && room) await addDoc(collection(db, "rooms", room.id, "messages"), msgData); else setMessages(prev => [...prev, { id: Date.now(), ...msgData }]);
  };

  const voteForMessage = async (msgId, currentVoters, currentVotes) => {
      if (currentVoters && currentVoters.includes(userProfile.name)) return;
      if (db && room) { const msgRef = doc(db, "rooms", room.id, "messages", msgId); await updateDoc(msgRef, { votes: (currentVotes || 0) + 1, voters: arrayUnion(userProfile.name) }); }
  };

  const enableVoting = async (msgId) => { if (db && room) { const msgRef = doc(db, "rooms", room.id, "messages", msgId); await updateDoc(msgRef, { votingEnabled: true }); } };

  const copyInviteLink = () => { if (!room) return; const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`; if (navigator.share) navigator.share({ title: '加入美食團', text: `加入代碼：${room.code}`, url }).catch(console.error); else { navigator.clipboard.writeText(url); alert("連結已複製！"); } };

  const filteredSharedList = selectedCategory === '全部' ? sharedRestaurants : sharedRestaurants.filter(r => r.type === selectedCategory);
  const availableCategories = ['全部', ...new Set([...DEFAULT_CATEGORIES.slice(1), ...sharedRestaurants.map(r => r.type)])];

  return (
    <div className="flex flex-col h-full bg-stone-50">
       <div className="bg-white/90 backdrop-blur px-4 py-3 shadow-sm flex justify-between items-center z-10 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="p-2 -ml-2 text-stone-500 hover:bg-stone-100 rounded-full"><ChevronLeft size={24}/></button>
            <div>
                <h3 className="font-bold text-stone-800 flex items-center gap-2 text-lg">
                  {room.name}
                  <button onClick={handleRenameRoom} className="p-1 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100"><Edit2 size={16}/></button>
                </h3>
                <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-extrabold">#{room.code}</span>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={copyInviteLink} className="p-2 text-teal-600 bg-teal-50 rounded-full hover:bg-teal-100 transition-colors"><LinkIcon size={20} /></button>
             <button onClick={() => setRoom(null)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors"><LogOut size={20} /></button>
          </div>
       </div>

       <div className="flex bg-white border-b border-stone-200 shrink-0">
          <button onClick={() => setSubTab('chat')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${subTab === 'chat' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-stone-400'}`}><MessageCircle size={16}/> 聊天室</button>
          <button onClick={() => setSubTab('list')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${subTab === 'list' ? 'text-orange-600 border-b-2 border-orange-600' : 'text-stone-400'}`}><List size={16}/> 共同清單</button>
       </div>
       
       <div className="flex-1 overflow-y-auto relative scroll-smooth">
          {subTab === 'chat' ? (
              <div className="p-4 space-y-6 pb-24">
                  {messages.map((msg) => {
                      if (msg.type === 'system') return <div key={msg.id} className="text-center text-xs text-stone-400 my-4"><span className="bg-stone-200/50 px-3 py-1 rounded-full">{msg.text}</span></div>
                      const isMe = msg.sender === userProfile.name;
                      return (
                          <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''} group`}>
                              {!isMe && <div className="w-8 h-8 rounded-full bg-stone-200 overflow-hidden flex-shrink-0 border-2 border-white shadow-sm mt-1"><img src={msg.avatar} className="w-full h-full object-cover" /></div>}
                              <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                  <span className="text-[10px] text-stone-400 mb-1 px-1">{msg.sender}</span>
                                  {msg.type === 'text' ? (
                                      <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm ${isMe ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white rounded-tr-sm' : 'bg-white text-stone-800 border border-stone-200 rounded-tl-sm'}`}>{msg.text}</div>
                                  ) : (
                                      <div onClick={() => setShowDetail(msg.restaurant)} className={`bg-white p-3 rounded-2xl border ${isMe ? 'border-orange-100' : 'border-stone-200'} shadow-sm w-60 overflow-hidden cursor-pointer`}>
                                          <div className="w-full h-32 bg-stone-100 rounded-xl mb-3 overflow-hidden relative">
                                              {msg.restaurant.photoUrl ? <img src={msg.restaurant.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl text-stone-300 font-bold bg-stone-50">{msg.restaurant.name.charAt(0)}</div>}
                                          </div>
                                          <h4 className="font-bold text-stone-800 truncate text-lg mb-0.5">{msg.restaurant.name}</h4>
                                          {msg.votingEnabled ? (
                                              <button onClick={(e) => { e.stopPropagation(); voteForMessage(msg.id, msg.voters, msg.votes); }} className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-2 ${msg.voters?.includes(userProfile.name) ? 'bg-teal-500 text-white' : 'bg-stone-50 text-stone-600'}`}><ThumbsUp size={14}/> {msg.votes > 0 ? `${msg.votes} 人想吃` : '投一票'}</button>
                                          ) : (
                                              <button onClick={(e) => { e.stopPropagation(); enableVoting(msg.id); }} className="w-full py-2.5 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-orange-100 mt-2"><Vote size={14} /> 發起投票</button>
                                          )}
                                          <button onClick={(e) => { e.stopPropagation(); addToSharedList(msg.restaurant); }} className="w-full mt-2 py-2 text-xs text-stone-400 hover:text-stone-600 border-t border-stone-100 flex items-center justify-center gap-1"><List size={12}/> 加入共同清單</button>
                                      </div>
                                  )}
                              </div>
                          </div>
                      )
                  })}
                  <div ref={messagesEndRef} />
              </div>
          ) : (
              <div className="p-4 space-y-4 pb-24">
                  <div className="sticky top-0 bg-stone-50 z-10 pb-2">
                     <CategoryTabs categories={availableCategories} selected={selectedCategory} onSelect={setSelectedCategory} />
                  </div>
                  <button onClick={() => setShowSearchModal(true)} className="w-full py-3 bg-white border-2 border-dashed border-stone-300 rounded-xl text-stone-400 font-bold flex items-center justify-center gap-2 hover:border-orange-300 hover:text-orange-500 transition-colors"><Plus size={20}/> 新增餐廳到清單</button>
                  {filteredSharedList.map(item => (
                      <div key={item.id} className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-3 relative group">
                          <div className="flex justify-between items-start cursor-pointer" onClick={() => setShowDetail(item)}>
                              <div className="flex gap-3">
                                  <div className="w-12 h-12 bg-stone-100 rounded-lg overflow-hidden flex-shrink-0">{item.photoUrl ? <img src={item.photoUrl} className="w-full h-full object-cover"/> : <div className="w-full h-full flex items-center justify-center font-bold text-stone-300">{item.name.charAt(0)}</div>}</div>
                                  <div>
                                      <h4 className="font-bold text-stone-800 text-lg flex items-center gap-1">{item.name}<ArrowRight size={14} className="text-stone-300"/></h4>
                                      <div className="flex items-center gap-2 mt-1">
                                          <button onClick={(e) => { e.stopPropagation(); handleEditCategory(item.id, item.type); }} className="text-[10px] bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded flex items-center gap-0.5 hover:bg-orange-100"><Tag size={10}/> {item.type} <Edit2 size={8}/></button>
                                          <p className="text-xs text-stone-400">新增: {item.addedBy}</p>
                                      </div>
                                  </div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); removeFromSharedList(item); }} className="text-stone-300 hover:text-red-400 p-2"><Trash2 size={16}/></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="bg-stone-50 p-2 rounded-xl"><span className="text-[10px] font-bold text-stone-400 block mb-1">我的狀態</span><div className="flex gap-1"><button onClick={() => updateSharedItemStatus(item.id, 'eaten', true)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${item.eatenStatus?.[userProfile.name] ? 'bg-green-100 text-green-700' : 'bg-white border border-stone-200 text-stone-400'}`}><CheckCircle size={10}/> 吃過</button><button onClick={() => updateSharedItemStatus(item.id, 'eaten', false)} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${item.eatenStatus?.[userProfile.name] === false ? 'bg-orange-100 text-orange-700' : 'bg-white border border-stone-200 text-stone-400'}`}><Circle size={10}/> 沒吃</button></div></div>
                              <div className="bg-stone-50 p-2 rounded-xl">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-bold text-stone-400">我的評分</span>
                                  {item.ratings && Object.keys(item.ratings).length > 0 && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-1.5 rounded-md">均 {(Object.values(item.ratings).reduce((a,b)=>a+b,0) / Object.values(item.ratings).length).toFixed(1)}</span>}
                                </div>
                              
                                <div className="space-y-1 mb-2 max-h-20 overflow-y-auto custom-scrollbar">
                                    {item.ratings && Object.entries(item.ratings).map(([user, score]) => (
                                        <div key={user} className="flex justify-between text-[10px] items-center text-stone-500">
                                            <span>{user}</span>
                                            <span className="flex items-center gap-0.5 text-yellow-500 font-bold"><Star size={8} fill="currentColor"/> {score}</span>
                                        </div>
                                    ))}
                                    {(!item.ratings || Object.keys(item.ratings).length === 0) && <div className="text-[10px] text-stone-300 text-center py-1">尚無評分</div>}
                                </div>

                                <div className="flex justify-center border-t border-stone-200 pt-2">
                                    <InteractiveStarRating value={item.ratings?.[userProfile.name] || 0} onChange={(val) => updateSharedItemStatus(item.id, 'rating', val)} />
                                </div>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          )}
       </div>

       {subTab === 'chat' && (
           <div className="p-3 bg-white border-t border-stone-200 flex gap-2 items-center shrink-0">
              <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (sendMessage(msgInput), setMsgInput(""))} className="flex-1 bg-stone-100 rounded-full px-5 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 transition-shadow" placeholder="輸入訊息..." />
              <button onClick={() => { sendMessage(msgInput); setMsgInput(""); }} className={`p-3 rounded-full transition-all shadow-md ${msgInput.trim() ? 'bg-orange-500 text-white hover:bg-orange-600' : 'bg-stone-200 text-stone-400'}`} disabled={!msgInput.trim()}><Send size={20} /></button>
           </div>
       )}

       {showSearchModal && <RoomRestaurantSearchModal onClose={() => setShowSearchModal(false)} onSelect={handleAddRestaurantFromSearch} virtualLocation={virtualLocation} />}
    </div>
  );
};

const LobbyView = ({ userProfile, onJoinRoom, onCreateRoom, myRooms, onEnterRoom, setShowProfileModal, onDeleteRoom }) => {
    // ... LobbyView code is same ...
    const [joinCodeInput, setJoinCodeInput] = useState("");

    return (
      <div className="p-6 h-full flex flex-col items-center font-rounded bg-gradient-to-b from-stone-100 to-white overflow-y-auto">
         <div onClick={() => setShowProfileModal(true)} className="w-20 h-20 rounded-full overflow-hidden mb-6 border-4 border-white shadow-xl cursor-pointer relative group transition-transform hover:scale-105 mt-8">
             <img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} alt="Profile" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Settings className="text-white" size={24}/></div>
         </div>
         <h1 className="text-3xl font-black text-stone-800 mb-2">揪團大廳</h1>
         <p className="text-stone-400 text-sm mb-8">管理你的所有美食房間</p>

         <div className="w-full max-w-sm space-y-6">
             {myRooms.length > 0 && (
                 <div className="space-y-3">
                     <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">已加入的房間</label>
                     {myRooms.map(r => (
                         <div key={r.id} onClick={() => onEnterRoom(r)} className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex justify-between items-center group">
                             <div><h3 className="font-bold text-stone-800">{r.name}</h3><span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded font-mono">#{r.code}</span></div>
                             <div className="flex items-center gap-2">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteRoom(r.id); }}
                                    className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                >
                                    <Trash2 size={16}/>
                                </button>
                                <ArrowRight size={16} className="text-stone-300 group-hover:text-orange-500"/>
                             </div>
                         </div>
                     ))}
                 </div>
             )}

             <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-200 space-y-4">
                <button onClick={onCreateRoom} className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold shadow-lg shadow-orange-200 hover:shadow-orange-300 hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"><PlusCircle size={20} /> 建立新房間</button>
                <div className="relative py-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-stone-200"></div></div><div className="relative flex justify-center text-xs font-bold text-stone-400 tracking-wider"><span className="px-2 bg-white">或是</span></div></div>
                <div className="flex gap-2">
                    <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="輸入代碼" className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-4 font-bold outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-center" maxLength={4} />
                    <button onClick={() => onJoinRoom(joinCodeInput)} className="px-6 bg-stone-800 text-white rounded-2xl font-bold shadow-md hover:bg-stone-700 transition-colors">加入</button>
                </div>
             </div>
         </div>
      </div>
    );
};

const DetailModal = ({ showDetail, ...props }) => {
    // ... DetailModal code is unchanged, keeping for context ...
    // Just ensuring we pass props correctly if we spread them
    // But since no logic changed inside, I'll keep the previous implementation block structure
    // Re-pasting the component to ensure file integrity
    if (!showDetail) return null;
    const r = showDetail;
    const { shortlist, toggleShortlist, room, addToSharedList, removeFromSharedList, handleSystemShare, sharedRestaurants, updateSharedItemStatus, userProfile } = props;
    const isShortlisted = shortlist.some(item => item.id === r.id);
    const isInSharedList = room && sharedRestaurants.some(item => item.id === r.id);
    
    let todayHours = "暫無資料";
    let displayOpeningHours = r.openingHours; 
    // Compatibility check for new/legacy API data structure
    if(r.regularOpeningHours && r.regularOpeningHours.weekdayDescriptions) {
        displayOpeningHours = r.regularOpeningHours.weekdayDescriptions;
    }

    if (Array.isArray(displayOpeningHours)) {
       const day = new Date().getDay(); 
       const daysMap = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
       const todayStr = daysMap[day];
       const todayInfo = displayOpeningHours.find(h => h.includes(todayStr) || h.includes(todayStr.substring(0, 3))); 
       if (todayInfo) todayHours = todayInfo;
       else if(displayOpeningHours.length > 0) todayHours = displayOpeningHours[(day + 6) % 7]; 
    } else if (typeof displayOpeningHours === 'string') todayHours = displayOpeningHours;

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

const NavBar = ({ activeTab, setActiveTab }) => {
  return (
    <div className="h-24 bg-white/90 backdrop-blur-md border-t border-stone-200 flex items-center justify-around px-6 pb-6 fixed bottom-0 w-full max-w-md z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
      <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-all duration-300 ${activeTab === 'home' ? 'text-stone-800 -translate-y-2' : 'text-stone-400 hover:text-stone-500'}`}><div className={`p-2 rounded-2xl transition-all ${activeTab === 'home' ? 'bg-stone-100 shadow-sm' : ''}`}><Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} /></div><span className="text-[10px] font-bold">搜尋</span></button>
      <button onClick={() => setActiveTab('shortlist')} className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-all duration-300 relative ${activeTab === 'shortlist' ? 'text-rose-500 -translate-y-2' : 'text-stone-400 hover:text-stone-500'}`}><div className={`p-2 rounded-2xl transition-all ${activeTab === 'shortlist' ? 'bg-rose-50 shadow-sm' : ''}`}><div className="relative"><Heart size={24} strokeWidth={activeTab === 'shortlist' ? 2.5 : 2} /></div></div><span className="text-[10px] font-bold">清單</span></button>
      <button onClick={() => setActiveTab('social')} className={`flex flex-col items-center justify-center w-14 h-full space-y-1 transition-all duration-300 relative ${activeTab === 'social' ? 'text-teal-600 -translate-y-2' : 'text-stone-400 hover:text-stone-500'}`}><div className={`p-2 rounded-2xl transition-all ${activeTab === 'social' ? 'bg-teal-50 shadow-sm' : ''}`}><MessageCircle size={24} strokeWidth={activeTab === 'social' ? 2.5 : 2} /></div><span className="text-[10px] font-bold">揪團</span></button>
    </div>
  );
};

const SearchPanelComponent = ({ userProfile, setShowProfileModal, setIsMapMode, virtualLocation, realLocation, timeFilter, setTimeFilter, distFilter, setDistFilter, ratingFilter, setRatingFilter, priceFilter, setPriceFilter, travelTimes, executeSearch, loading, sortBy, setSortBy }) => (
  <div className="p-6 space-y-8 font-rounded bg-gradient-to-b from-stone-50 to-white min-h-full pb-32">
     <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@400;700;900&display=swap'); .font-rounded { font-family: 'Zen Maru Gothic', sans-serif; }`}</style>
     <div className="text-center mt-6 flex flex-col items-center">
       <div onClick={() => setShowProfileModal(true)} className="w-20 h-20 rounded-full overflow-hidden mb-4 border-4 border-white shadow-xl cursor-pointer relative group transition-transform hover:scale-105">
           <img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} alt="Profile" className="w-full h-full object-cover" />
           <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Settings className="text-white" size={24}/></div>
       </div>
       <h1 className="text-3xl font-black text-stone-800 flex items-center justify-center gap-2 tracking-tight">今天吃什麼 <Utensils className="text-orange-500 fill-orange-500" /></h1>
       <p className="text-stone-400 text-sm mt-1 font-medium">Hello, {userProfile.name}！想吃點什麼？</p>
     </div>
     <div className="bg-white p-5 rounded-3xl shadow-sm border border-stone-200 relative overflow-hidden group hover:shadow-md transition-shadow cursor-pointer" onClick={() => setIsMapMode(true)}>
       <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-orange-400 to-red-400"></div>
       <div className="flex justify-between items-center mb-3">
           <label className="text-xs font-bold text-stone-400 flex items-center gap-1 uppercase tracking-wider"><MapPin size={12}/> 目前搜尋位置</label>
           <span className="text-orange-500 text-xs font-bold bg-orange-50 px-2 py-0.5 rounded-full">點擊修改</span>
       </div>
       <div className="flex items-center gap-3">
           <div className="flex-1">
              <div className="text-lg font-bold text-stone-800 truncate tracking-tight">{virtualLocation === realLocation ? "📍 我的目前位置" : "🗺️ 自訂地圖位置"}</div>
              <div className="text-xs text-stone-400 font-mono mt-1 opacity-60">{virtualLocation?.lat.toFixed(4)}, {virtualLocation?.lng.toFixed(4)}</div>
           </div>
       </div>
     </div>
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
              <option value="1">$ (平價 - 含未標示)</option>
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
     <button onClick={executeSearch} disabled={loading} className="w-full bg-stone-800 text-white py-4 rounded-2xl font-bold text-base shadow-lg shadow-stone-300 hover:bg-stone-700 active:scale-95 transition-all flex items-center justify-center gap-2">
        {loading ? <span className="animate-spin">⌛</span> : <Search size={20} />} {loading ? "搜尋中..." : "開始搜尋"}
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
                        <button 
                            key={opt.id}
                            onClick={() => setSortBy(opt.id)} 
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${sortBy === opt.id ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-500 border-stone-200'}`}
                        >
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
                            <div className="w-20 h-20 bg-stone-100 rounded-xl flex-shrink-0 overflow-hidden">
                                {r.photoUrl ? <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /> : <div className="w-full h-full flex items-center justify-center text-2xl text-stone-300 font-bold">{r.name.charAt(0)}</div>}
                            </div>
                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                <div>
                                    <h4 className="font-bold text-stone-800 truncate">{r.name}</h4>
                                    <div className="flex items-center gap-2 mt-1 text-xs">
                                        <span className="text-stone-400 bg-stone-50 px-1.5 py-0.5 rounded truncate max-w-[80px]">{r.type}</span>
                                        <span className="text-orange-500 font-bold flex items-center gap-0.5"><MapPin size={10}/> {r.distance}km</span>
                                        {r.isOpen ? <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-bold">營業中</span> : <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">休息</span>}
                                    </div>
                                </div>
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

const ShortlistScreenComponent = ({ shortlist, setActiveTab, aiAnalysis, setAiAnalysis, handleAiGroupAnalysis, isAiAnalyzing, setShowDetail, handleSystemShare, toggleShortlist }) => {
    // ... ShortlistScreenComponent remains unchanged ...
    // Keeping structure for brevity
    const [selectedCategory, setSelectedCategory] = useState('全部');
    const categories = ['全部', ...new Set([...DEFAULT_CATEGORIES.slice(1), ...shortlist.map(r => r.customCategory || r.type)])];
    const filteredList = selectedCategory === '全部' ? shortlist : shortlist.filter(r => (r.customCategory || r.type) === selectedCategory);

    return (
        <div className="p-4 pb-24 h-full flex flex-col font-rounded bg-stone-50">
            <div className="flex items-center justify-between mb-4 px-2 pt-2">
                <h1 className="text-2xl font-black text-stone-800">候選清單</h1>
                <span className="text-xs font-bold bg-white px-3 py-1 rounded-full text-stone-400 shadow-sm border border-stone-200">{shortlist.length} 間</span>
            </div>
            
            {shortlist.length > 0 && (
                 <div className="mb-4 sticky top-0 bg-stone-50 z-10 pb-2">
                    <CategoryTabs categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} />
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
                                            <span className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded flex items-center gap-1">
                                               {r.customCategory || r.type}
                                            </span>
                                            <div className="text-[10px] text-stone-400 flex gap-1 font-bold">
                                                <span className="flex items-center gap-0.5"><Star size={10} className="text-yellow-400 fill-yellow-400"/> {r.rating}</span>
                                                <span>{r.distance}km</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={(e) => { e.stopPropagation(); handleSystemShare(r); }} className="p-2.5 text-teal-600 bg-teal-50 rounded-xl hover:bg-teal-100 transition-colors"><Share2 size={18} /></button>
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

const Header = ({ userProfile, setShowProfileModal }) => (
    <div className="px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div onClick={() => setShowProfileModal(true)} className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-md cursor-pointer relative group transition-transform active:scale-95">
                <img src={userProfile.customAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.name}`} alt="Profile" className="w-full h-full object-cover" />
            </div>
            <div>
                <h1 className="text-lg font-black text-stone-800 leading-tight">今天吃什麼 <Utensils className="inline text-orange-500 w-4 h-4" /></h1>
                <p className="text-xs text-stone-400 font-bold">Hi, {userProfile.name}</p>
            </div>
        </div>
        <button className="p-2 bg-white rounded-full shadow-sm text-stone-400 hover:text-stone-600 transition-colors">
            <Settings size={20} />
        </button>
    </div>
);

// --- App Component ---

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
  const [timeFilter, setTimeFilter] = useState('lunch'); 
  const [distFilter, setDistFilter] = useState(500); 
  const [ratingFilter, setRatingFilter] = useState('all');
  const [priceFilter, setPriceFilter] = useState('all'); 
  const [hasSearched, setHasSearched] = useState(false);
  const [travelTimes, setTravelTimes] = useState(calculateTravelTime(500));
  const [restaurants, setRestaurants] = useState([]);
  const [shortlist, setShortlist] = useState([]); 
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const isSearchingRef = useRef(false);
  const [myRooms, setMyRooms] = useState([]);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [sharedRestaurants, setSharedRestaurants] = useState([]); 
  
  // 新增：排序狀態
  const [sortBy, setSortBy] = useState('default');

  useEffect(() => {
    // Geo Init
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setRealLocation(loc);
          setVirtualLocation(loc);
        },
        () => {
          const defaultLoc = { lat: 25.0330, lng: 121.5654 }; // Taipei
          setRealLocation(defaultLoc);
          setVirtualLocation(defaultLoc);
        }
      );
    } else {
      const defaultLoc = { lat: 25.0330, lng: 121.5654 };
      setRealLocation(defaultLoc);
      setVirtualLocation(defaultLoc);
    }

    if (GOOGLE_MAPS_API_KEY) {
      loadGoogleMapsScript(GOOGLE_MAPS_API_KEY)
        .then(() => setIsGoogleMapsReady(true))
        .catch(err => {
          console.error("Google Maps Load Failed", err);
          setErrorMsg("無法載入 Google Maps，請檢查 API Key 設置。");
        });
    }
  }, []);

  useEffect(() => { setTravelTimes(calculateTravelTime(distFilter)); }, [distFilter]);

  // Load My Rooms
  useEffect(() => {
      if(db && userProfile.name) {
          const q = query(collection(db, "rooms"), where("members", "array-contains", userProfile.name)); 
          const unsubscribe = onSnapshot(q, (snapshot) => {
              const rooms = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
              rooms.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 
              setMyRooms(rooms);
          });
          return () => unsubscribe();
      }
  }, [userProfile.name]);

  // Load Shared Restaurants for Current Room
  useEffect(() => {
      if (!db || !room?.id) return;
      const q = query(collection(db, "rooms", room.id, "shared_restaurants")); 
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
          list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); 
          setSharedRestaurants(list);
      });
      return () => unsubscribe();
  }, [room?.id]);

  // Load Messages for Current Room (修復訊息不顯示問題)
  useEffect(() => {
      if (!db || !room?.id) {
          if(!room) setMessages([]); // 離開房間清空訊息
          return;
      }
      const q = query(collection(db, "rooms", room.id, "messages"), orderBy("createdAt", "asc")); 
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); 
          setMessages(msgs);
      });
      return () => unsubscribe();
  }, [room?.id]);

  // Define updateSharedItemStatus here at App level so it can be passed down
  const updateSharedItemStatus = async (itemId, type, value) => {
      if (!db || !room?.id) return;
      const ref = doc(db, "rooms", room.id, "shared_restaurants", itemId);
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
    if (db) {
      try {
        let simpleOpeningHours = null;
        if (restaurant.regularOpeningHours && restaurant.regularOpeningHours.weekdayDescriptions) {
             simpleOpeningHours = {
                 weekdayDescriptions: restaurant.regularOpeningHours.weekdayDescriptions
             };
        }

        const docRef = doc(db, "rooms", room.id, "shared_restaurants", restaurant.id);
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
      alert("單機模式暫不支援共同清單功能");
    }
  };

  const removeFromSharedList = async (restaurant) => {
     if (!db || !room) return;
     if (!confirm("確定要從共同清單中移除這間餐廳嗎？")) return;
     try {
         await deleteDoc(doc(db, "rooms", room.id, "shared_restaurants", restaurant.id));
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
                  // 0 (未知) 視為較便宜的優先? 或者排最後? 這裡設為 0 最優先
                  return pA - pB; 
              });
          }
          // 'default' 通常保留原本搜尋結果的排序 (關聯性)，或依照距離
          
          // 避免無限迴圈，只有當排序結果不同時才更新? 
          // React state 更新會觸發 re-render，這裡簡單直接更新即可，因為使用者點擊按鈕才觸發
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
        // 使用 Legacy PlacesService 來支援分頁 (取得 > 20 筆結果)
        // 建立一個隱藏的 div 給 PlacesService 使用
        const service = new window.google.maps.places.PlacesService(document.createElement('div'));
        
        let queryText = "restaurant";
        if (timeFilter === 'breakfast') queryText = "breakfast spots";
        if (timeFilter === 'lunch') queryText = "lunch restaurants";
        if (timeFilter === 'dinner') queryText = "dinner restaurants";
        if (timeFilter === 'latenight') queryText = "late night food";

        // 判斷是否「正在」該時段
        const currentHour = new Date().getHours();
        let isCurrentlyInSlot = false;
        
        if (timeFilter === 'breakfast' && currentHour >= 5 && currentHour < 12) isCurrentlyInSlot = true;
        else if (timeFilter === 'lunch' && currentHour >= 12 && currentHour < 18) isCurrentlyInSlot = true;
        else if (timeFilter === 'dinner' && currentHour >= 18) isCurrentlyInSlot = true; // 18:00 - 24:00
        else if (timeFilter === 'latenight' && (currentHour >= 0 && currentHour < 5)) isCurrentlyInSlot = true;

        // 如果現在就在該時段，可以開啟 openNow 過濾
        // 如果使用者是在早上查晚餐，就不能開 openNow
        const openNowFilter = isCurrentlyInSlot;

        const request = {
            query: queryText,
            location: new window.google.maps.LatLng(virtualLocation.lat, virtualLocation.lng),
            radius: distFilter,
            openNow: openNowFilter, // 關鍵：根據是否為當下時段來決定是否只查營業中
        };

        let allResults = [];
        let pageCount = 0;

        // 遞迴函式處理分頁
        const fetchPage = (results, status, pagination) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                allResults = [...allResults, ...results];
                pageCount++;

                // 獲取 3 頁 (約 60 筆) 或直到沒有下一頁
                if (pagination && pagination.hasNextPage && pageCount < 3 && isSearchingRef.current) {
                    // Google API 要求延遲 2 秒才能抓下一頁
                    setTimeout(() => {
                        pagination.nextPage();
                    }, 2000);
                } else {
                    // 完成抓取，開始處理資料
                    processResults(allResults);
                }
            } else {
                // 如果第一頁就沒結果，或是錯誤
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
                
                // Legacy API 的 opening_hours 只有 open_now
                let isOpenStatus = place.opening_hours ? place.opening_hours.open_now : null;

                return {
                    id: place.place_id, 
                    name: place.name, 
                    type: mapGoogleTypeToCategory(place.types), 
                    rating: place.rating,
                    userRatingsTotal: place.user_ratings_total, 
                    priceLevel: place.price_level, 
                    isOpen: isOpenStatus,
                    lat: place.geometry.location.lat(), 
                    lng: place.geometry.location.lng(),
                    distance: calculateDistance(virtualLocation.lat, virtualLocation.lng, place.geometry.location.lat(), place.geometry.location.lng()),
                    address: place.formatted_address, 
                    photoUrl: photoUrl
                };
            });

            // 過濾距離 (Legacy API radius 有時候不準確，client 端再濾一次但放寬標準)
            let filtered = formatted.filter(r => parseFloat(r.distance) * 1000 <= distFilter * 1.5);

            if (ratingFilter !== 'all') filtered = filtered.filter(r => (r.rating || 0) >= parseInt(ratingFilter));
            
            if (priceFilter !== 'all') {
                const targetPrice = parseInt(priceFilter);
                filtered = filtered.filter(r => {
                    const p = r.priceLevel;
                    // Legacy API 也回傳 0-4，undefined 視為 0
                    const effectivePrice = (p === undefined || p === null) ? 0 : p;
                    if (targetPrice === 1) return effectivePrice <= 1; 
                    return effectivePrice === targetPrice || effectivePrice === 0;
                });
            }

            // 預設依照距離排序
            filtered.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
            
            if (filtered.length === 0) setErrorMsg("篩選條件太嚴格，附近找不到餐廳 QQ");
            setRestaurants(filtered);
            setLoading(false);
            isSearchingRef.current = false;
        };

        // 開始搜尋
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

  const handleSystemShare = (restaurant) => {
    const text = `我們吃這家：${restaurant.name}\n📍 ${restaurant.address}\n⭐ ${restaurant.rating}\nGoogle Map: https://maps.google.com/?q=${encodeURIComponent(restaurant.name)}`;
    if (navigator.share) navigator.share({ title: '今天吃什麼？', text }).catch(console.error);
    else { navigator.clipboard.writeText(text); alert("已複製！"); }
  };

  // Join Room logic
  const onJoinRoom = async (code) => {
      if (code.length !== 4) return alert("請輸入 4 位數代碼");
      if (db) {
        try {
          const q = query(collection(db, "rooms"), where("code", "==", code));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const docData = querySnapshot.docs[0];
            const roomData = { id: docData.id, ...docData.data() };
            if(!roomData.members.includes(userProfile.name)) {
                await updateDoc(doc(db, "rooms", docData.id), { members: arrayUnion(userProfile.name) });
                await addDoc(collection(db, "rooms", docData.id, "messages"), {
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
      if (db) {
        try {
          const roomRef = await addDoc(collection(db, "rooms"), {
            code: code, name: roomName, createdAt: new Date(), members: [userProfile.name]
          });
          await addDoc(collection(db, "rooms", roomRef.id, "messages"), {
            sender: 'System', text: `歡迎來到「${roomName}」！代碼：${code}`, type: 'system', createdAt: new Date()
          });
          setRoom({ id: roomRef.id, code, name: roomName });
          setActiveTab('social');
        } catch (e) {
          alert(`建立房間失敗：${e.message}`);
        }
      } else {
          const newRoom = { id: "local", code, name: roomName, members: [userProfile.name] };
          setRoom(newRoom);
          setActiveTab('social');
      }
  };

  const onDeleteRoom = async (roomId) => {
      if (!confirm("確定要刪除這個房間嗎？\n注意：這將會移除所有人的聊天記錄與清單。")) return;
      if (db) {
          try {
              await deleteDoc(doc(db, "rooms", roomId));
          } catch (e) {
              console.error("刪除失敗", e);
              alert("刪除失敗");
          }
      } else {
           setMyRooms(prev => prev.filter(r => r.id !== roomId));
      }
  };

  // --- 補上遺失的 handleAiGroupAnalysis 函式 ---
  const handleAiGroupAnalysis = async () => {
    if (shortlist.length === 0) {
      alert("候選清單是空的，無法進行分析喔！");
      return;
    }

    setIsAiAnalyzing(true);
    setAiAnalysis(""); // 先清空舊的結果

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
          />
        )}
        
        {/* Updated Logic: Social Tab now toggles between Lobby and Room view */}
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

      {/* Hide main NavBar when in a Room to allow focus on chat/list */}
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