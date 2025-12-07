import React, { useState, useEffect, useRef } from 'react';
import { 
  MapPin, Star, Navigation, Shuffle, Utensils, Heart, Users, 
  Copy, Crown, Share2, Sparkles, X, Home, Settings, List, ChevronLeft, 
  Locate, Map, Send, AlertCircle, Clock, Filter, Search, ChevronDown, ArrowLeft,
  MessageCircle, Camera, User, LogOut, ThumbsUp, PlusCircle, Link as LinkIcon
} from 'lucide-react';

// --- Firebase Imports ---
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, doc, getDoc, onSnapshot, 
  updateDoc, arrayUnion, query, where, getDocs, setDoc, orderBy 
} from "firebase/firestore";

// ==========================================
// ⚠️ 設定區
// ==========================================
const GOOGLE_MAPS_API_KEY = "AIzaSyB5QauPkcFt8Ye8ynEt7ciJVXFqeu_sbLI"; 
const GEMINI_API_KEY = "AIzaSyD628iilaLN3ZvYlE_9WNTkWSsbeNCGFJ0";      

// 🔥 Firebase 設定 (請填入您的設定)
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
  if (FIREBASE_CONFIG.apiKey) {
    const app = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(app);
    console.log("🔥 Firebase 已嘗試連線...");
  }
} catch (error) {
  console.error("Firebase 初始化失敗", error);
}

// --- 模擬數據生成器 ---
const NAMES_PREFIX = ["軟綿綿", "小確幸", "粉紅", "轉角", "喵喵", "彩虹", "陽光", "夢幻", "巷口", "深夜", "冠軍", "阿嬤"];
const NAMES_SUFFIX = ["鬆餅屋", "咖哩飯", "漢堡包", "義麵坊", "小火鍋", "甜點店", "早午餐", "壽司屋", "牛肉麵", "燒肉", "牛排", "冰店"];
const TYPES_BY_TIME = {
  breakfast: ["早午餐", "甜點店", "台式小吃", "咖啡廳", "三明治"],
  lunch: ["家常咖哩", "義麵坊", "牛肉麵", "壽司屋", "漢堡包", "台式小吃"],
  dinner: ["小火鍋", "日式燒肉", "牛排", "義式料理", "壽司屋", "深夜食堂"]
};
const ALL_TYPES = [...new Set(Object.values(TYPES_BY_TIME).flat())];

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return (R * c).toFixed(2);
};

const generateMockRestaurants = (centerLat, centerLng, radiusMeters, timeFilter, ratingFilter) => {
  const count = 30;
  const radiusDeg = radiusMeters / 111000; 
  const availableTypes = timeFilter === 'all' ? ALL_TYPES : TYPES_BY_TIME[timeFilter] || ALL_TYPES;

  return Array.from({ length: count }).map((_, i) => {
    const r = radiusDeg * Math.sqrt(Math.random());
    const theta = Math.random() * 2 * Math.PI;
    const latOffset = r * Math.cos(theta);
    const lngOffset = r * Math.sin(theta);
    const rating = (Math.random() * 2.5 + 2.5).toFixed(1);
    
    return {
      id: `mock-${i}-${Date.now()}-${Math.floor(Math.random()*1000)}`,
      name: `${NAMES_PREFIX[Math.floor(Math.random() * NAMES_PREFIX.length)]}${NAMES_SUFFIX[Math.floor(Math.random() * NAMES_SUFFIX.length)]}`,
      type: availableTypes[Math.floor(Math.random() * availableTypes.length)],
      rating: rating,
      userRatingsTotal: Math.floor(Math.random() * 300) + 20,
      priceLevel: Math.floor(Math.random() * 3) + 1,
      isOpen: Math.random() > 0.1,
      lat: centerLat + latOffset,
      lng: centerLng + lngOffset,
      distance: calculateDistance(centerLat, centerLng, centerLat + latOffset, centerLng + lngOffset),
      address: `範例路${Math.floor(Math.random() * 888)}號`
    };
  }).filter(r => {
    if (ratingFilter === 'all') return true;
    const minRating = parseInt(ratingFilter);
    return parseFloat(r.rating) >= minRating; 
  });
};

const loadGoogleMapsScript = (apiKey) => {
  if (!apiKey) return Promise.reject("No API Key");
  if (window.google && window.google.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
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

const PriceDisplay = ({ level }) => (
  <div className="flex text-teal-500 text-[10px] font-bold bg-teal-50 px-1.5 py-0.5 rounded-full">
    {level ? [...Array(level)].map((_, i) => <span key={i}>$</span>) : <span>$$</span>}
  </div>
);

const StarRating = ({ rating }) => (
  <div className="flex items-center gap-0.5 bg-yellow-50 px-1.5 py-0.5 rounded-full text-yellow-600 font-bold text-[10px]">
    <Star size={10} fill="currentColor" />
    <span>{rating || "N/A"}</span>
  </div>
);

export default function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // 地理位置
  const [realLocation, setRealLocation] = useState(null);
  const [virtualLocation, setVirtualLocation] = useState(null);
  const [isMapMode, setIsMapMode] = useState(false);

  // User Profile
  const [userProfile, setUserProfile] = useState({
    name: '美食探險家',
    gender: 'male', 
    customAvatar: null
  });
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Social / Room State
  const [room, setRoom] = useState(null); 
  const [messages, setMessages] = useState([]); 
  const [joinCodeInput, setJoinCodeInput] = useState('');
  
  // 搜尋設定
  const [timeFilter, setTimeFilter] = useState('lunch'); 
  const [distFilter, setDistFilter] = useState(500); 
  const [ratingFilter, setRatingFilter] = useState('all');
  const [hasSearched, setHasSearched] = useState(false);
  
  const [restaurants, setRestaurants] = useState([]);
  const [shortlist, setShortlist] = useState([]); 
  const [isUsingRealData, setIsUsingRealData] = useState(false);
  
  // UI State
  const [showDetail, setShowDetail] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);

  // 初始化
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomCodeFromUrl = urlParams.get('room');
    if (roomCodeFromUrl) {
      setActiveTab('social');
      setJoinCodeInput(roomCodeFromUrl);
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
          setRealLocation(loc);
          setVirtualLocation(loc);
        },
        (error) => {
          console.log("定位失敗", error);
          const defaultLoc = { lat: 25.0330, lng: 121.5654 };
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
        .then(() => setIsUsingRealData(true))
        .catch(err => {
          setErrorMsg("Google Maps 載入失敗，將切換回模擬模式");
          setIsUsingRealData(false);
        });
    }
  }, []);

  // Firebase Room Sync
  useEffect(() => {
    if (!db || !room?.id) return;
    const q = query(collection(db, "rooms", room.id, "messages"), orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(newMessages);
    });
    return () => unsubscribe();
  }, [room]);

  const getAvatarUrl = () => {
    if (userProfile.customAvatar) return userProfile.customAvatar;
    const seed = userProfile.gender === 'male' ? 'Felix' : 'Aneka';
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setUserProfile(prev => ({ ...prev, customAvatar: url }));
    }
  };

  // --- Social Actions (Improved Error Handling) ---
  const createRoom = async () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const roomName = `${userProfile.name} 的美食團`;

    if (db) {
      try {
        const roomRef = await addDoc(collection(db, "rooms"), {
          code: code,
          name: roomName,
          createdAt: new Date(),
          members: [userProfile.name]
        });
        await addDoc(collection(db, "rooms", roomRef.id, "messages"), {
          sender: 'System',
          text: `歡迎來到「${roomName}」！代碼：${code}`,
          type: 'system',
          createdAt: new Date()
        });
        setRoom({ id: roomRef.id, code, name: roomName });
      } catch (e) {
        console.error("建立房間失敗", e);
        // 🔥 智慧錯誤提示：偵測 Billing 問題
        if (e.message && e.message.includes("billing")) {
           alert("【Firebase 設定錯誤】\n建立房間失敗。您的 Google Cloud 專案尚未啟用「計費功能」。\n\n請前往 GCP Console 綁定信用卡 (免費額度內不會扣款)。");
        } else {
           alert("建立房間失敗，請檢查網路連線或 API Key 設定。");
        }
      }
    } else {
      const newRoom = { id: Date.now().toString(), code, name: roomName };
      setRoom(newRoom);
      setMessages([{ id: 1, sender: 'System', text: `(單機模式) 歡迎！代碼：${code}`, type: 'system' }]);
    }
  };

  const joinRoom = async () => {
    if (joinCodeInput.length !== 4) return alert("請輸入 4 位數代碼");
    if (db) {
      try {
        const q = query(collection(db, "rooms"), where("code", "==", joinCodeInput));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docData = querySnapshot.docs[0];
          setRoom({ id: docData.id, ...docData.data() });
          await addDoc(collection(db, "rooms", docData.id, "messages"), {
            sender: 'System',
            text: `${userProfile.name} 加入了房間！`,
            type: 'system',
            createdAt: new Date()
          });
        } else {
          alert("找不到此房間代碼！");
        }
      } catch (e) {
        console.error(e);
        if (e.message && e.message.includes("billing")) {
           alert("【Firebase 設定錯誤】\n加入失敗。請確認您的專案已啟用計費功能。");
        } else {
           alert("加入失敗，請檢查代碼或網路。");
        }
      }
    } else {
      const joinedRoom = { id: Date.now().toString(), code: joinCodeInput, name: `美食團 ${joinCodeInput}` };
      setRoom(joinedRoom);
      setMessages([{ id: 1, sender: 'System', text: `(單機) 加入成功！`, type: 'system' }]);
    }
  };

  const copyInviteLink = () => {
    if (!room) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${room.code}`;
    if (navigator.share) {
      navigator.share({ title: '一起來投票！', text: `加入我的美食團：${room.code}`, url }).catch(console.error);
    } else {
      navigator.clipboard.writeText(url);
      alert("連結已複製！傳給朋友即可加入");
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    const msgData = {
      sender: userProfile.name,
      avatar: getAvatarUrl(),
      text: text,
      type: 'text',
      createdAt: new Date()
    };
    if (db && room) {
      await addDoc(collection(db, "rooms", room.id, "messages"), msgData);
    } else {
      setMessages(prev => [...prev, { id: Date.now(), ...msgData }]);
    }
  };

  const shareRestaurantToRoom = async (restaurant) => {
    if (!room) {
      alert("請先建立或加入一個房間喔！");
      setActiveTab('social');
      return;
    }
    const msgData = {
      sender: userProfile.name,
      avatar: getAvatarUrl(),
      text: `我想吃這家！`,
      type: 'share',
      restaurant: restaurant,
      votes: 0,
      voters: [],
      createdAt: new Date()
    };
    if (db) {
      await addDoc(collection(db, "rooms", room.id, "messages"), msgData);
    } else {
      setMessages(prev => [...prev, { id: Date.now(), ...msgData }]);
    }
    setActiveTab('social');
    setShowDetail(null);
  };

  const voteForMessage = async (msgId, currentVoters, currentVotes) => {
    if (currentVoters && currentVoters.includes(userProfile.name)) return;
    if (db && room) {
      const msgRef = doc(db, "rooms", room.id, "messages", msgId);
      await updateDoc(msgRef, {
        votes: (currentVotes || 0) + 1,
        voters: arrayUnion(userProfile.name)
      });
    } else {
      setMessages(prev => prev.map(msg => {
        if (msg.id === msgId) {
          return {
            ...msg,
            votes: (msg.votes || 0) + 1,
            voters: [...(msg.voters || []), userProfile.name]
          };
        }
        return msg;
      }));
    }
  };

  // 搜尋邏輯
  const executeSearch = () => {
    if (!virtualLocation) return;
    setLoading(true);
    setHasSearched(true);
    setErrorMsg("");
    setRestaurants([]); 

    if (isUsingRealData && window.google && window.google.maps) {
      const mapDiv = document.createElement('div');
      const service = new window.google.maps.places.PlacesService(mapDiv);
      let keyword = "";
      if (timeFilter === 'breakfast') keyword = "breakfast cafe bakery";
      if (timeFilter === 'lunch') keyword = "lunch restaurant";
      if (timeFilter === 'dinner') keyword = "dinner restaurant bar";

      const request = {
        location: new window.google.maps.LatLng(virtualLocation.lat, virtualLocation.lng),
        radius: distFilter,
        type: ['restaurant', 'food'],
        keyword: keyword 
      };

      service.nearbySearch(request, (results, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
          let formatted = results.map(place => ({
            id: place.place_id,
            name: place.name,
            type: place.types?.[0] || "餐廳",
            rating: place.rating,
            userRatingsTotal: place.user_ratings_total,
            priceLevel: place.price_level,
            isOpen: place.opening_hours?.isOpen ? place.opening_hours.isOpen() : null,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
            distance: calculateDistance(
              virtualLocation.lat, virtualLocation.lng,
              place.geometry.location.lat(), place.geometry.location.lng()
            ),
            address: place.vicinity,
            photoUrl: place.photos?.[0]?.getUrl({ maxWidth: 400 })
          }));

          if (ratingFilter !== 'all') {
            const minRating = parseInt(ratingFilter);
            formatted = formatted.filter(r => (r.rating || 0) >= minRating);
          }
          formatted.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
          if (formatted.length === 0) setErrorMsg("篩選條件太嚴格，找不到餐廳 QQ");
          setRestaurants(formatted);
        } else {
          setErrorMsg("在此範圍內找不到符合條件的餐廳");
          setRestaurants([]);
        }
        setLoading(false);
      });
    } else {
      setTimeout(() => {
        const data = generateMockRestaurants(virtualLocation.lat, virtualLocation.lng, distFilter, timeFilter, ratingFilter);
        data.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));
        if (data.length === 0) setErrorMsg("篩選條件太嚴格，找不到餐廳 QQ");
        setRestaurants(data);
        setLoading(false);
      }, 800);
    }
  };

  const toggleShortlist = (e, restaurant) => {
    e.stopPropagation();
    setShortlist(prev => {
      const exists = prev.some(item => item.id === restaurant.id);
      return exists ? prev.filter(item => item.id !== restaurant.id) : [...prev, restaurant];
    });
  };

  const handleAiGroupAnalysis = async () => {
    setIsAiAnalyzing(true);
    const names = shortlist.map(r => r.name).join("、");
    const prompt = `我們有選擇障礙，正在猶豫：${names}。請扮演一位說話犀利幽默的美食評論家，用 100 字幫我們決定吃哪家！`;
    const result = await callGemini(prompt);
    setAiAnalysis(result);
    setIsAiAnalyzing(false);
  };

  const handleSystemShare = (restaurant) => {
    const text = `我們吃這家：${restaurant.name}\n📍 ${restaurant.address}\n⭐ ${restaurant.rating}\nGoogle Map: https://maps.google.com/?q=${encodeURIComponent(restaurant.name)}`;
    if (navigator.share) navigator.share({ title: '今天吃什麼？', text }).catch(console.error);
    else { navigator.clipboard.writeText(text); alert("已複製！"); }
  };

  // --- Screens ---

  const ProfileModal = () => (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 relative">
        <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full"><X size={20}/></button>
        <h2 className="text-xl font-black text-gray-800 mb-6 text-center">設定個人檔案</h2>
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-rose-100 relative group">
             <img src={getAvatarUrl()} alt="Avatar" className="w-full h-full object-cover" />
             <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-xs">
                <Camera size={20} className="mb-1"/>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
             </label>
          </div>
          <input 
            type="text" 
            value={userProfile.name}
            onChange={(e) => setUserProfile({...userProfile, name: e.target.value})}
            className="text-center font-bold text-lg border-b-2 border-gray-200 focus:border-rose-500 outline-none pb-1 w-2/3"
            placeholder="輸入暱稱"
          />
        </div>
        <div className="space-y-3">
           <label className="text-sm font-bold text-gray-500">選擇預設形象</label>
           <div className="flex gap-4">
              <button onClick={() => setUserProfile({...userProfile, gender: 'male', customAvatar: null})} className={`flex-1 py-3 rounded-xl border-2 font-bold ${userProfile.gender === 'male' && !userProfile.customAvatar ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-gray-100 text-gray-400'}`}>👦 男生</button>
              <button onClick={() => setUserProfile({...userProfile, gender: 'female', customAvatar: null})} className={`flex-1 py-3 rounded-xl border-2 font-bold ${userProfile.gender === 'female' && !userProfile.customAvatar ? 'border-rose-500 bg-rose-50 text-rose-600' : 'border-gray-100 text-gray-400'}`}>👧 女生</button>
           </div>
        </div>
        <button onClick={() => setShowProfileModal(false)} className="w-full mt-8 bg-gray-900 text-white py-3 rounded-xl font-bold">儲存設定</button>
      </div>
    </div>
  );

  const SocialScreen = () => {
    const [msgInput, setMsgInput] = useState("");
    const messagesEndRef = useRef(null);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    if (!room) {
      return (
        <div className="p-6 h-full flex flex-col justify-center items-center text-center space-y-8">
           <div>
             <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center text-rose-500 mx-auto mb-4"><Users size={40} /></div>
             <h2 className="text-2xl font-black text-gray-800">揪團吃飯</h2>
             <p className="text-gray-400 text-sm mt-2">建立房間或輸入代碼，<br/>和朋友一起投票決定吃什麼！</p>
           </div>
           <div className="w-full space-y-4">
              <button onClick={createRoom} className="w-full py-4 bg-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-rose-200 hover:bg-rose-600 transition-transform active:scale-95 flex items-center justify-center gap-2"><PlusCircle size={20} /> 建立新房間</button>
              <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">或是</span></div></div>
              <div className="flex gap-2">
                 <input type="text" value={joinCodeInput} onChange={(e) => setJoinCodeInput(e.target.value)} placeholder="輸入房間代碼" className="flex-1 bg-gray-100 rounded-xl px-4 font-bold outline-none focus:ring-2 focus:ring-rose-500 text-center" maxLength={4}/>
                 <button onClick={joinRoom} className="px-6 bg-gray-900 text-white rounded-xl font-bold">加入</button>
              </div>
           </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col h-full bg-gray-50">
         <div className="bg-white px-4 py-3 shadow-sm flex justify-between items-center z-10">
            <div><h3 className="font-bold text-gray-800">{room.name}</h3><p className="text-xs text-rose-500 font-bold">代碼: {room.code}</p></div>
            <div className="flex gap-2">
               <button onClick={copyInviteLink} className="p-2 text-teal-600 bg-teal-50 rounded-full hover:bg-teal-100"><LinkIcon size={20} /></button>
               <button onClick={() => setRoom(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-full"><LogOut size={20} /></button>
            </div>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => {
              if (msg.type === 'system') return <div key={msg.id} className="text-center text-xs text-gray-400 my-2 bg-gray-100 py-1 rounded-full mx-auto w-fit px-4">{msg.text}</div>
              const isMe = msg.sender === userProfile.name;
              return (
                 <div key={msg.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && (<div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0"><img src={msg.avatar} className="w-full h-full object-cover" /></div>)}
                    <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                       <span className="text-[10px] text-gray-400 mb-1 px-1">{msg.sender}</span>
                       {msg.type === 'text' ? (
                          <div className={`px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-rose-500 text-white rounded-tr-none' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'}`}>{msg.text}</div>
                       ) : (
                          <div className={`bg-white p-3 rounded-2xl border ${isMe ? 'border-rose-200' : 'border-gray-200'} shadow-sm w-48`}>
                             <div className="w-full h-24 bg-gray-100 rounded-lg mb-2 overflow-hidden relative">
                                {msg.restaurant.photoUrl ? (<img src={msg.restaurant.photoUrl} className="w-full h-full object-cover" />) : (<div className="w-full h-full flex items-center justify-center text-3xl text-gray-300 font-bold">{msg.restaurant.name.charAt(0)}</div>)}
                                <div className="absolute top-1 right-1 bg-white/90 px-1.5 py-0.5 rounded text-[10px] font-bold text-orange-500 flex items-center gap-1"><Star size={8} fill="currentColor"/> {msg.restaurant.rating}</div>
                             </div>
                             <h4 className="font-bold text-sm text-gray-800 truncate">{msg.restaurant.name}</h4>
                             <p className="text-xs text-gray-400 truncate mb-2">{msg.restaurant.type}</p>
                             <button onClick={() => voteForMessage(msg.id, msg.voters, msg.votes)} className={`w-full py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors ${msg.voters?.includes(userProfile.name) ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><ThumbsUp size={12} /> {msg.votes || 0} 票</button>
                          </div>
                       )}
                    </div>
                 </div>
              )
            })}
            <div ref={messagesEndRef} />
         </div>
         <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
            <input value={msgInput} onChange={(e) => setMsgInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (sendMessage(msgInput), setMsgInput(""))} className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-rose-500" placeholder="輸入訊息..."/>
            <button onClick={() => { sendMessage(msgInput); setMsgInput(""); }} className="p-2 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors"><Send size={20} /></button>
         </div>
      </div>
    );
  };

  const DetailModal = () => {
    if (!showDetail) return null;
    const r = showDetail;
    const isShortlisted = shortlist.some(item => item.id === r.id);
    return (
      <div className="fixed inset-0 z-40 bg-white flex flex-col animate-in slide-in-from-right duration-300">
        <div className="h-64 bg-gray-200 relative group">
           <button onClick={() => setShowDetail(null)} className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-800 shadow-sm z-10"><ChevronLeft size={24} /></button>
           <button onClick={() => handleSystemShare(r)} className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-teal-600 shadow-sm z-10"><Share2 size={20} /></button>
           <div className="w-full h-full flex items-center justify-center text-6xl text-gray-400 font-bold bg-gradient-to-b from-gray-100 to-gray-300 overflow-hidden">{r.photoUrl ? <img src={r.photoUrl} className="w-full h-full object-cover" /> : r.name.charAt(0)}</div>
           <div className="absolute bottom-4 left-4 text-white"><span className="bg-black/50 px-2 py-1 rounded text-xs backdrop-blur-md">{r.type}</span></div>
        </div>
        <div className="flex-1 p-6 -mt-6 bg-white rounded-t-3xl overflow-y-auto shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
          <div className="flex justify-between items-start mb-2"><h2 className="text-2xl font-black text-gray-800">{r.name}</h2><div className="flex flex-col items-end"><PriceDisplay level={r.priceLevel} /><span className={`text-[10px] mt-1 px-1.5 py-0.5 rounded ${r.isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{r.isOpen ? '營業中' : '休息中'}</span></div></div>
          <div className="flex items-center gap-2 mb-6 text-sm"><StarRating rating={r.rating} /> <span className="text-gray-400">({r.userRatingsTotal} 評論)</span></div>
          <div className="space-y-4">
             <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3"><MapPin className="text-gray-400" size={20} /><div className="flex-1"><p className="text-sm text-gray-800">{r.address}</p><p className="text-xs text-gray-400">距離 {r.distance} 公里</p></div><button onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(r.name)}`)} className="bg-blue-600 text-white p-2 rounded-lg"><Navigation size={18} /></button></div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100 flex gap-3 pb-8 bg-white">
           <button onClick={(e) => toggleShortlist(e, r)} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors ${isShortlisted ? 'bg-rose-100 text-rose-500' : 'bg-gray-100 text-gray-500'}`}><Heart size={20} fill={isShortlisted ? "currentColor" : "none"} /></button>
           {room ? (
             <button onClick={() => shareRestaurantToRoom(r)} className="flex-[3] bg-teal-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-teal-200"><Send size={18} /> 分享到聊天室</button>
           ) : (
             <button className="flex-[3] bg-gray-900 text-white py-3 rounded-xl font-bold">立即訂位</button>
           )}
        </div>
      </div>
    );
  };

  const SearchPanel = () => (
    <div className="p-6 space-y-6">
       <div className="text-center mb-4 mt-4 flex flex-col items-center">
          <div onClick={() => setShowProfileModal(true)} className="w-16 h-16 rounded-full overflow-hidden mb-2 border-2 border-rose-500 cursor-pointer relative group">
             <img src={getAvatarUrl()} alt="Profile" className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Settings className="text-white" size={20}/></div>
          </div>
          <h1 className="text-3xl font-black text-gray-800 flex items-center justify-center gap-2">今天吃什麼 <Utensils className="text-rose-500" /></h1>
       </div>
       <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-full bg-rose-500"></div>
          <label className="text-xs font-bold text-gray-400 mb-2 block flex items-center gap-1"><MapPin size={12}/> 目前搜尋位置</label>
          <div className="flex items-center gap-3">
             <div className="flex-1"><div className="text-sm font-bold text-gray-800 truncate">{virtualLocation === realLocation ? "📍 我的目前位置 (GPS)" : "🗺️ 自訂地圖位置"}</div></div>
             <button onClick={() => setIsMapMode(true)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl">修改</button>
          </div>
       </div>
       <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Clock size={16} className="text-teal-500"/> 用餐時段</label>
            <div className="relative">
              <select value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)} className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-bold outline-none">
                <option value="breakfast">🥪 早餐 / 早午餐</option>
                <option value="lunch">🍱 午餐</option>
                <option value="dinner">🍲 晚餐 / 宵夜</option>
              </select>
              <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
          <div>
             <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Navigation size={16} className="text-blue-500"/> 距離範圍</label>
             <div className="grid grid-cols-3 gap-2">
                {[200, 500, 1000, 2000].map((dist) => (
                  <button key={dist} onClick={() => setDistFilter(dist)} className={`py-2 rounded-xl text-xs font-bold border ${distFilter === dist ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-500 border-gray-200'}`}>{dist >= 1000 ? `${dist/1000} km` : `${dist} m`}</button>
                ))}
             </div>
          </div>
          <div>
             <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Star size={16} className="text-yellow-500"/> Google 評分要求</label>
             <div className="relative">
              <select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="w-full appearance-none bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-bold outline-none">
                <option value="all">👌 不限評分</option>
                <option value="3">3.0 顆星以上</option>
                <option value="4">4.0 顆星以上</option>
                <option value="4.5">4.5 顆星以上</option>
              </select>
              <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>
       </div>
       <button onClick={executeSearch} className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-gray-200 hover:bg-gray-800 flex items-center justify-center gap-2 mt-8"><Search size={24} /> 開始搜尋</button>
    </div>
  );

  const SearchResults = () => (
    <div className="p-4 space-y-4 pb-24">
      <div className="flex justify-between items-center mb-2">
         <button onClick={() => setHasSearched(false)} className="flex items-center gap-1 text-gray-500 font-bold text-sm bg-gray-100 px-3 py-1.5 rounded-xl"><ArrowLeft size={16} /> 調整篩選</button>
         <div className="text-xs text-gray-400 font-bold">找到 {restaurants.length} 間餐廳</div>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center h-64 space-y-4"><div className="animate-spin text-4xl">🍙</div><p className="text-gray-400 font-bold animate-pulse">正在幫你找好吃的...</p></div>
      ) : (
        <div className="space-y-3">
          {errorMsg && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"><AlertCircle size={18} /> {errorMsg}</div>}
          {restaurants.map(r => (
            <div key={r.id} onClick={() => setShowDetail(r)} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm active:scale-[0.98] transition-transform flex gap-3">
              <div className="w-20 h-20 bg-gray-100 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl font-bold text-gray-300 overflow-hidden relative">
                 {r.photoUrl ? <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" /> : r.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                <div><h3 className="font-bold text-gray-800 truncate">{r.name}</h3><p className="text-xs text-gray-400 truncate">{r.type} • {r.address}</p><p className="text-xs text-rose-500 font-medium">距離 {r.distance} km</p></div>
                <div className="flex justify-between items-end">
                  <div className="flex gap-2"><StarRating rating={r.rating} /><PriceDisplay level={r.priceLevel} /></div>
                  <button onClick={(e) => toggleShortlist(e, r)} className={`p-2 rounded-full ${shortlist.some(item => item.id === r.id) ? 'text-rose-500 bg-rose-50' : 'text-gray-300 hover:text-gray-400'}`}><Heart size={18} fill={shortlist.some(item => item.id === r.id) ? "currentColor" : "none"} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const ShortlistScreen = () => (
    <div className="p-4 pb-24 h-full flex flex-col">
      <h1 className="text-2xl font-black text-gray-800 mb-4">候選清單</h1>
      {shortlist.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 gap-4"><Heart size={64} strokeWidth={1} /><p className="text-sm">還沒有加入任何餐廳喔！</p><button onClick={() => setActiveTab('home')} className="px-6 py-2 bg-gray-800 text-white rounded-full text-sm font-bold mt-2">去逛逛</button></div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden">
            <Sparkles className="absolute top-2 right-2 text-white/20" size={48} />
            <h3 className="font-bold flex items-center gap-2 mb-2"><Sparkles size={16}/> AI 幫你選</h3>
            {aiAnalysis ? (
              <div className="text-sm bg-white/10 p-3 rounded-xl backdrop-blur-sm leading-relaxed animate-in fade-in">{aiAnalysis}<button onClick={() => setAiAnalysis("")} className="block w-full text-center text-xs mt-2 text-white/70 hover:text-white">清除重來</button></div>
            ) : (
              <div><p className="text-xs text-indigo-100 mb-3">猶豫不決嗎？讓 AI 幫你分析這 {shortlist.length} 家餐廳！</p><button onClick={handleAiGroupAnalysis} disabled={isAiAnalyzing} className="w-full py-2 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors">{isAiAnalyzing ? "分析中..." : "✨ 幫我分析"}</button></div>
            )}
          </div>
          <div className="space-y-2">
             {shortlist.map(r => (
               <div key={r.id} onClick={() => setShowDetail(r)} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition-transform">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center font-bold text-gray-400 overflow-hidden">{r.photoUrl ? <img src={r.photoUrl} alt={r.name} className="w-full h-full object-cover" /> : r.name.charAt(0)}</div>
                    <div><h4 className="font-bold text-gray-700 text-sm">{r.name}</h4><div className="text-xs text-gray-400 flex gap-2"><span>{r.rating}★</span><span>{r.distance}km</span></div></div>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); handleSystemShare(r); }} className="p-2 text-teal-500 bg-teal-50 rounded-full hover:bg-teal-100"><Share2 size={16} /></button>
                    <button onClick={(e) => toggleShortlist(e, r)} className="p-2 text-red-400 bg-red-50 rounded-full hover:bg-red-100"><X size={16}/></button>
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );

  const MapSimulator = () => (
    <div className="fixed inset-0 z-50 bg-gray-900/95 flex flex-col items-center justify-center p-4 animate-in fade-in">
      <div className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin className="text-rose-500"/> 調整定位</h3><button onClick={() => setIsMapMode(false)} className="p-2 bg-gray-200 rounded-full"><X size={20}/></button></div>
        <div className="h-80 bg-blue-50 relative cursor-crosshair" onClick={(e) => {
               const rect = e.target.getBoundingClientRect();
               const latOffset = (0.5 - (e.clientY - rect.top) / rect.height) * 0.01;
               const lngOffset = ((e.clientX - rect.left) / rect.width - 0.5) * 0.01;
               setVirtualLocation(prev => ({ lat: prev.lat + latOffset, lng: prev.lng + lngOffset }));
             }}>
           <div className="absolute inset-0 opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#444 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"><div className="w-4 h-4 bg-rose-500 rounded-full border-2 border-white shadow-lg relative z-10"></div><div className="bg-black/70 text-white text-[10px] px-2 py-1 rounded mt-2">目前定位點</div></div>
        </div>
        <div className="p-4 space-y-3"><button onClick={() => setVirtualLocation(realLocation)} className="w-full py-3 bg-teal-500 text-white rounded-xl font-bold flex items-center justify-center gap-2"><Locate size={18}/> 回到真實位置</button><button onClick={() => setIsMapMode(false)} className="w-full py-3 bg-gray-800 text-white rounded-xl font-bold">確認位置</button></div>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-white max-w-md mx-auto relative overflow-hidden flex flex-col font-sans">
      {isMapMode && <MapSimulator />}
      {showProfileModal && <ProfileModal />}
      
      <div className="flex-1 overflow-y-auto no-scrollbar bg-white">
        {activeTab === 'home' && (!hasSearched ? <SearchPanel /> : <SearchResults />)}
        {activeTab === 'shortlist' && <ShortlistScreen />}
        {activeTab === 'social' && <SocialScreen />}
      </div>

      <div className="h-20 bg-white border-t border-gray-100 flex items-center justify-around px-2 pb-2 fixed bottom-0 w-full max-w-md z-30">
        <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors ${activeTab === 'home' ? 'text-gray-900' : 'text-gray-300'}`}><Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} /><span className="text-[10px] font-bold">搜尋</span></button>
        <button onClick={() => setActiveTab('shortlist')} className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors relative ${activeTab === 'shortlist' ? 'text-rose-500' : 'text-gray-300'}`}>
          <div className="relative"><Heart size={24} strokeWidth={activeTab === 'shortlist' ? 2.5 : 2} />{shortlist.length > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] rounded-full flex items-center justify-center border-2 border-white">{shortlist.length}</span>}</div><span className="text-[10px] font-bold">清單</span>
        </button>
        <button onClick={() => setActiveTab('social')} className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-colors relative ${activeTab === 'social' ? 'text-rose-500' : 'text-gray-300'}`}>
          <MessageCircle size={24} strokeWidth={activeTab === 'social' ? 2.5 : 2} /><span className="text-[10px] font-bold">揪團</span>
        </button>
      </div>
      <DetailModal />
    </div>
  );
}