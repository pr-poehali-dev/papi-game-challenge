import { useState, useEffect, useRef, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Types ───────────────────────────────────────────────────────────────────
interface ChatMessage {
  id: number;
  user: string;
  text: string;
  color: string;
  banned?: boolean;
}

interface OfficeEvent {
  id: number;
  text: string;
  stressDelta: number;
  emoji: string;
}

type GameScreen = "menu" | "game" | "dead" | "win";

// ─── Constants ───────────────────────────────────────────────────────────────
const OFFICE_BG =
  "https://cdn.poehali.dev/projects/d974b6ba-c704-4567-9270-51cb60649b32/files/dcf2f89c-5200-4ccd-92e2-a3a28ed16aaa.jpg";

const GAME_START_HOUR = 9;
const GAME_END_HOUR = 18;
const GAME_DURATION_MS = 30 * 60 * 1000; // 30 минут реального времени
const MS_PER_GAME_HOUR = GAME_DURATION_MS / (GAME_END_HOUR - GAME_START_HOUR);

const CHAT_COLORS = [
  "#FF4444", "#FF8C00", "#FFD700", "#7CFC00",
  "#00CED1", "#6495ED", "#DA70D6", "#FF69B4",
  "#FF6347", "#40E0D0", "#EE82EE", "#F0E68C",
];

const CHAT_USERS = [
  "Хомяк_007", "papich_fan", "Banya_kek", "strimkek",
  "Dusha_Kompanii", "ZakatyChet", "lol_viewer", "knyazok",
  "BorisBritva", "vezdehod99", "ChatFriend", "Govnokomment",
  "SosatPapich", "DonPedro", "HypeTrainer", "ProPlayer2006",
  "StreamSniper", "NeLezNaSosnu", "NeSpuchi", "DedMoroz",
];

const CHAT_PHRASES = [
  "папич САСАААТЬ", "ну ты и лежааать", "чат, какой сос?",
  "папич лучший стример", "ха-ха коллеги бесят да",
  "стрим 10/10", "где донат", "покажи монитор",
  "я тоже в офисе умираю братан", "sos sos sos",
  "боссу привет передай", "ЛЕЖАААТЬ", "кто в чате?",
  "папич король", "когда конец рабочего дня",
  "я написал баг репорт на твоего босса",
  "Лежать или Сасать? голосуем", "чат мертвый",
  "ТЫ ЛУЧШИЙ ПАПИЧ", "держись брат", "ofis kek",
  "папич а ты сегодня ел", "стресс по чартам растет",
  "бро не умирай", "ты чо такой серьезный",
  "выходи уже", "заказ кофе +5 к жизни",
  "коллега раздражает лол", "начальник злой сегодня?",
];

const OFFICE_EVENTS_POOL: Omit<OfficeEvent, "id">[] = [
  { text: "Коллега жует чипсы рядом с тобой", stressDelta: 8, emoji: "🍟" },
  { text: "Совещание перенесли. Снова.", stressDelta: 6, emoji: "📅" },
  { text: "Кондиционер сломался", stressDelta: 10, emoji: "🥵" },
  { text: "Принтер застрял", stressDelta: 7, emoji: "🖨️" },
  { text: "Начальник смотрит в монитор через плечо", stressDelta: 15, emoji: "👔" },
  { text: "Корпоративный тренинг по командообразованию", stressDelta: 20, emoji: "🤝" },
  { text: "Интернет лагает", stressDelta: 9, emoji: "📡" },
  { text: "Коллега рассказывает анекдот 5й раз", stressDelta: 5, emoji: "😐" },
  { text: "В кофемашине кончился кофе", stressDelta: 12, emoji: "☕" },
  { text: "Опен спейс шумит как базар", stressDelta: 11, emoji: "📢" },
  { text: "Входящий звонок в тихий час", stressDelta: 8, emoji: "📱" },
  { text: "Кто-то греет рыбу в микроволновке", stressDelta: 18, emoji: "🐟" },
  { text: "Срочный дедлайн упал в 17:55", stressDelta: 25, emoji: "💥" },
  { text: "Уборщица пылесосит прямо сейчас", stressDelta: 7, emoji: "🧹" },
  { text: "HR прислала опрос на 40 вопросов", stressDelta: 14, emoji: "📋" },
  { text: "Сервак упал, всем капут", stressDelta: 22, emoji: "💻" },
  { text: "Коллега плачет в туалете (слышно через стену)", stressDelta: 6, emoji: "😭" },
  { text: "Зум-колл с включенной камерой. Обязательно.", stressDelta: 16, emoji: "🎥" },
];

const STRESS_RELIEF_EVENT: Omit<OfficeEvent, "id"> = {
  text: "Бесплатная пицца в столовой! Стресс снят.",
  stressDelta: -20,
  emoji: "🍕",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatTime(hour: number, minutes: number) {
  const h = Math.floor(hour);
  const m = Math.floor(minutes);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Speech synthesis ─────────────────────────────────────────────────────────
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ru-RU";
  utterance.pitch = 0.65;
  utterance.rate = 0.8;
  utterance.volume = 1;
  const voices = window.speechSynthesis.getVoices();
  const ruVoice =
    voices.find((v) => v.lang.startsWith("ru") && v.name.toLowerCase().includes("male")) ||
    voices.find((v) => v.lang.startsWith("ru"));
  if (ruVoice) utterance.voice = ruVoice;
  window.speechSynthesis.speak(utterance);
}

// ─── StressBar ────────────────────────────────────────────────────────────────
function StressBar({ stress }: { stress: number }) {
  const color =
    stress < 40 ? "#22c55e" : stress < 65 ? "#f59e0b" : stress < 85 ? "#f97316" : "#ef4444";
  const isPulsing = stress >= 75;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs font-oswald uppercase tracking-widest text-muted-foreground">
          Стресс папича
        </span>
        <span
          className={`text-sm font-oswald font-bold ${isPulsing ? "animate-stress-pulse" : ""}`}
          style={{ color }}
        >
          {Math.round(stress)}%
        </span>
      </div>
      <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isPulsing ? "animate-stress-pulse" : ""}`}
          style={{
            width: `${stress}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: stress > 70 ? `0 0 12px ${color}66` : "none",
          }}
        />
        {[40, 65, 85].map((mark) => (
          <div
            key={mark}
            className="absolute top-0 bottom-0 w-px bg-white/10"
            style={{ left: `${mark}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────
function ChatPanel({
  messages,
  bannedUsers,
  onBan,
}: {
  messages: ChatMessage[];
  bannedUsers: Set<string>;
  onBan: (user: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--chat-bg))] rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2 bg-secondary/50">
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-oswald uppercase tracking-widest text-foreground/80">
          LIVE ЧАТ
        </span>
        <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Icon name="Eye" size={12} />
          <span>{randomInt(1200, 4500).toLocaleString()}</span>
        </div>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto chat-scroll px-2 py-2 space-y-1"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`animate-chat-in flex items-start gap-1.5 group rounded px-1.5 py-0.5 hover:bg-white/5 transition-colors ${
              bannedUsers.has(msg.user) ? "opacity-30 line-through" : ""
            }`}
          >
            <span
              className="text-xs font-bold shrink-0 mt-0.5"
              style={{ color: msg.color }}
            >
              {msg.user}:
            </span>
            <span className="text-xs text-foreground/85 flex-1 leading-relaxed break-all">
              {msg.text}
            </span>
            {!bannedUsers.has(msg.user) && (
              <button
                onClick={() => onBan(msg.user)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-500/70 hover:text-red-400 ml-1"
                title="Забанить"
              >
                <Icon name="Ban" size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LaptopScreen ─────────────────────────────────────────────────────────────
function LaptopScreen({
  messages,
  bannedUsers,
  onBan,
  onLay,
  onSuck,
  isLayActive,
  isSuckActive,
}: {
  messages: ChatMessage[];
  bannedUsers: Set<string>;
  onBan: (user: string) => void;
  onLay: () => void;
  onSuck: () => void;
  isLayActive: boolean;
  isSuckActive: boolean;
}) {
  return (
    <div
      className="rounded-xl overflow-hidden border-2 border-[#1a1a2e]/80 shadow-2xl"
      style={{
        background: "hsl(var(--laptop-bg))",
        boxShadow: "0 0 40px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 bg-black/40">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        <span className="text-xs text-white/30 ml-2 font-mono">papich_stream — чат</span>
      </div>

      <div className="relative scanlines screen-flicker" style={{ height: "300px" }}>
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0d1117 0%, #161b22 40%, #0d1117 100%)",
          }}
        >
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-shrink-0 h-10 flex items-center justify-center border-b border-white/5">
              <span className="text-xs text-white/20 font-mono flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                papich в офисе — LIVE
              </span>
            </div>
            <div className="flex-1 px-2 pb-2 overflow-hidden">
              <ChatPanel messages={messages} bannedUsers={bannedUsers} onBan={onBan} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 border-t border-border">
        <button
          onClick={onSuck}
          className={`relative py-3 px-4 font-oswald text-sm uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2 border-r border-border
            ${isSuckActive ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80 text-foreground"}`}
          style={isSuckActive ? { boxShadow: "0 0 20px rgba(251,189,35,0.5)" } : {}}
        >
          <span className="text-lg">👄</span>
          САСАТЬ
        </button>
        <button
          onClick={onLay}
          className={`relative py-3 px-4 font-oswald text-sm uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-2
            ${isLayActive ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/80 text-foreground"}`}
          style={isLayActive ? { boxShadow: "0 0 20px rgba(251,189,35,0.5)" } : {}}
        >
          <span className="text-lg">😴</span>
          ЛЕЖАТЬ
        </button>
      </div>
    </div>
  );
}

// ─── EventNotification ────────────────────────────────────────────────────────
function EventNotification({
  event,
  onDismiss,
}: {
  event: OfficeEvent | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [event]);

  if (!event) return null;

  const isNegative = event.stressDelta > 0;

  return (
    <div
      className="animate-event-pop fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl border flex items-center gap-3 shadow-2xl"
      style={{
        background: isNegative
          ? "linear-gradient(135deg, #1a0a0a, #2d1515)"
          : "linear-gradient(135deg, #0a1a0a, #152d15)",
        borderColor: isNegative ? "#ef444444" : "#22c55e44",
        boxShadow: isNegative ? "0 0 30px rgba(239,68,68,0.3)" : "0 0 30px rgba(34,197,94,0.3)",
        minWidth: "300px",
        maxWidth: "500px",
      }}
    >
      <span className="text-2xl">{event.emoji}</span>
      <div className="flex-1">
        <p className="text-sm font-golos text-foreground">{event.text}</p>
        <p className={`text-xs font-oswald mt-0.5 ${isNegative ? "text-red-400" : "text-green-400"}`}>
          {isNegative ? `+${event.stressDelta}% стресс` : `${event.stressDelta}% стресс`}
        </p>
      </div>
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
        <Icon name="X" size={14} />
      </button>
    </div>
  );
}

// ─── StatsPanel ───────────────────────────────────────────────────────────────
function StatsPanel({
  stress, hour, minutes, bannedCount, layCount, suckCount,
}: {
  stress: number; hour: number; minutes: number;
  bannedCount: number; layCount: number; suckCount: number;
}) {
  const progress = ((hour - GAME_START_HOUR) / (GAME_END_HOUR - GAME_START_HOUR)) * 100;
  const difficultyLevel = Math.min(9, Math.floor(hour - GAME_START_HOUR) + 1);

  return (
    <div className="space-y-3">
      <div className="text-center">
        <div
          className="font-oswald text-4xl font-bold text-primary rounded-lg py-2 px-4 bg-secondary/30 border border-border"
          style={{ textShadow: "0 0 20px rgba(251,189,35,0.4)" }}
        >
          {formatTime(hour, minutes)}
        </div>
        <div className="mt-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-1000 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-0.5 px-0.5">
          <span>09:00</span>
          <span>18:00</span>
        </div>
      </div>

      <StressBar stress={stress} />

      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-oswald uppercase tracking-wider">Сложность</span>
        <div className="flex gap-0.5">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`w-2 h-3 rounded-sm transition-colors ${i < difficultyLevel ? "bg-primary" : "bg-secondary"}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Бан", value: bannedCount, emoji: "🔨" },
          { label: "Лежать", value: layCount, emoji: "😴" },
          { label: "Сасать", value: suckCount, emoji: "👄" },
        ].map((stat) => (
          <div key={stat.label} className="bg-secondary/40 rounded-lg p-2 text-center border border-border">
            <div className="text-lg mb-0.5">{stat.emoji}</div>
            <div className="font-oswald text-lg font-bold text-foreground">{stat.value}</div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BanToast ─────────────────────────────────────────────────────────────────
function BanToast({ user, onClose }: { user: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 2000);
    return () => clearTimeout(t);
  }, [user]);

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-event-pop bg-red-900/90 border border-red-600/50 rounded-xl px-4 py-3 flex items-center gap-3 shadow-2xl">
      <Icon name="Ban" size={18} className="text-red-400" />
      <div>
        <p className="text-sm font-oswald text-red-200">ЗАБАНЕН</p>
        <p className="text-xs text-red-400">{user}</p>
      </div>
    </div>
  );
}

// ─── KeyboardHandler ──────────────────────────────────────────────────────────
function KeyboardHandler({ onLay, onSuck }: { onLay: () => void; onSuck: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "e") onLay();
      if (e.key.toLowerCase() === "q") onSuck();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onLay, onSuck]);
  return null;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Index() {
  const [screen, setScreen] = useState<GameScreen>("menu");
  const [stress, setStress] = useState(0);
  const [gameTime, setGameTime] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [bannedUsers, setBannedUsers] = useState<Set<string>>(new Set());
  const [bannedCount, setBannedCount] = useState(0);
  const [layCount, setLayCount] = useState(0);
  const [suckCount, setSuckCount] = useState(0);
  const [currentEvent, setCurrentEvent] = useState<OfficeEvent | null>(null);
  const [isLayActive, setIsLayActive] = useState(false);
  const [isSuckActive, setIsSuckActive] = useState(false);
  const [banToast, setBanToast] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);

  const gameRunning = screen === "game";

  useEffect(() => {
    const load = () => {};
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis?.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    if (!gameRunning) return;
    const interval = setInterval(() => setGameTime((t) => t + 100), 100);
    return () => clearInterval(interval);
  }, [gameRunning]);

  const currentHour = GAME_START_HOUR + gameTime / MS_PER_GAME_HOUR;
  const currentHourInt = Math.floor(currentHour);
  const currentMinutes = (currentHour - currentHourInt) * 60;
  const difficultyMultiplier = 1 + ((currentHour - GAME_START_HOUR) / (GAME_END_HOUR - GAME_START_HOUR)) * 2;

  useEffect(() => {
    if (gameRunning && currentHour >= GAME_END_HOUR) setScreen("win");
  }, [currentHour, gameRunning]);

  function triggerShake() {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  }

  useEffect(() => {
    if (gameRunning && stress >= 100) {
      triggerShake();
      setTimeout(() => setScreen("dead"), 700);
    }
  }, [stress, gameRunning]);

  // Passive stress
  useEffect(() => {
    if (!gameRunning) return;
    const interval = setInterval(() => {
      setStress((s) => Math.min(100, s + 0.04 * difficultyMultiplier));
    }, 100);
    return () => clearInterval(interval);
  }, [gameRunning, difficultyMultiplier]);

  // Random office events
  useEffect(() => {
    if (!gameRunning) return;
    const baseInterval = Math.max(5000, 14000 - (difficultyMultiplier - 1) * 2500);
    const timeout = setTimeout(
      () => {
        const pool = Math.random() < 0.12 ? STRESS_RELIEF_EVENT : randomItem(OFFICE_EVENTS_POOL);
        const event: OfficeEvent = { ...pool, id: Date.now() };
        setCurrentEvent(event);
        setStress((s) => Math.min(100, Math.max(0, s + event.stressDelta * difficultyMultiplier * 0.65)));
        if (event.stressDelta > 10) triggerShake();
      },
      baseInterval + randomInt(-1500, 1500)
    );
    return () => clearTimeout(timeout);
  }, [gameRunning, difficultyMultiplier, currentEvent]);

  // Chat generator
  useEffect(() => {
    if (!gameRunning) return;
    const interval = setInterval(
      () => {
        const msg: ChatMessage = {
          id: Date.now() + Math.random(),
          user: randomItem(CHAT_USERS),
          text: randomItem(CHAT_PHRASES),
          color: randomItem(CHAT_COLORS),
        };
        setChatMessages((prev) => [...prev.slice(-80), msg]);
      },
      Math.max(400, 1500 - difficultyMultiplier * 150) + randomInt(-200, 200)
    );
    return () => clearInterval(interval);
  }, [gameRunning, difficultyMultiplier]);

  const handleBan = useCallback((user: string) => {
    setBannedUsers((prev) => new Set([...prev, user]));
    setBannedCount((c) => c + 1);
    setBanToast(user);
    speak(`${user} — Бан!`);
    setStress((s) => Math.max(0, s - 3));
  }, []);

  const handleLay = useCallback(() => {
    setIsLayActive(true);
    setLayCount((c) => c + 1);
    speak("Лежааать!");
    setStress((s) => Math.max(0, s - 8));
    setTimeout(() => setIsLayActive(false), 1500);
  }, []);

  const handleSuck = useCallback(() => {
    setIsSuckActive(true);
    setSuckCount((c) => c + 1);
    speak("Сасааать!");
    setStress((s) => Math.max(0, s - 5));
    setTimeout(() => setIsSuckActive(false), 1500);
  }, []);

  function startGame() {
    setStress(0);
    setGameTime(0);
    setChatMessages([]);
    setBannedUsers(new Set());
    setBannedCount(0);
    setLayCount(0);
    setSuckCount(0);
    setCurrentEvent(null);
    setIsLayActive(false);
    setIsSuckActive(false);
    setScreen("game");
  }

  const stressOverlayOpacity = stress > 60 ? (stress - 60) / 100 : 0;
  const stressOverlayColor =
    stress > 85
      ? `rgba(180, 0, 0, ${stressOverlayOpacity * 0.4})`
      : `rgba(150, 50, 0, ${stressOverlayOpacity * 0.25})`;

  // ─── MENU ──────────────────────────────────────────────────────────────────
  if (screen === "menu") {
    return (
      <div className="relative w-full h-screen overflow-hidden">
        <img
          src={OFFICE_BG}
          alt="Office"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.28) saturate(0.5)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/65 to-transparent" />

        <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
          <div className="text-center animate-fade-in">
            <div className="text-7xl mb-4">😤</div>
            <h1 className="font-oswald text-6xl md:text-8xl font-bold text-primary uppercase tracking-tight leading-none">
              ПАПИЧ
            </h1>
            <h2 className="font-oswald text-2xl md:text-3xl text-foreground/60 uppercase tracking-[0.35em] mt-2">
              Офисное Выживание
            </h2>

            <p className="mt-6 text-foreground/45 font-golos text-sm max-w-md mx-auto leading-relaxed">
              Просидеть с{" "}
              <span className="text-primary font-bold">9:00</span> до{" "}
              <span className="text-primary font-bold">18:00</span> в опен спейсе.
              Не умереть от стресса. Управлять чатом.{" "}
              <span className="text-foreground/70">30 минут реального времени.</span>
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3 max-w-sm mx-auto text-center">
              {[
                { icon: "😤", label: "Шкала стресса" },
                { icon: "💬", label: "Живой чат" },
                { icon: "🔨", label: "Бань зрителей" },
              ].map((f) => (
                <div key={f.label} className="bg-secondary/40 border border-border rounded-xl p-3">
                  <div className="text-2xl mb-1">{f.icon}</div>
                  <div className="text-xs text-muted-foreground font-golos">{f.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={startGame}
              className="mt-8 px-12 py-4 font-oswald text-xl uppercase tracking-widest bg-primary text-primary-foreground rounded-xl hover:brightness-110 transition-all duration-200"
              style={{ boxShadow: "0 0 30px rgba(251,189,35,0.35)" }}
            >
              Начать рабочий день
            </button>

            <p className="mt-4 text-xs text-muted-foreground/40 font-golos">
              [Q] Сасать · [E] Лежать · Наводи на ник в чате чтобы забанить
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── DEAD ──────────────────────────────────────────────────────────────────
  if (screen === "dead") {
    return (
      <div className="relative w-full h-screen overflow-hidden flex items-center justify-center">
        <img
          src={OFFICE_BG}
          alt="Office"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.12) saturate(0) grayscale(1)" }}
        />
        <div className="relative z-10 text-center animate-scale-in px-6">
          <div className="text-8xl mb-6">💀</div>
          <h1 className="font-oswald text-5xl font-bold text-red-500 uppercase">
            Папич не пережил
          </h1>
          <p className="text-foreground/50 mt-2 font-golos">
            Стресс достиг 100%. Офис победил.
          </p>
          <div className="mt-6 text-sm text-muted-foreground font-golos">
            Продержался до{" "}
            <span className="text-primary font-bold">
              {formatTime(currentHourInt, currentMinutes)}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-4 max-w-xs mx-auto">
            {[
              { label: "Бан", value: bannedCount, emoji: "🔨" },
              { label: "Лежать", value: layCount, emoji: "😴" },
              { label: "Сасать", value: suckCount, emoji: "👄" },
            ].map((s) => (
              <div key={s.label} className="bg-secondary/40 border border-border rounded-xl p-3 text-center">
                <div className="text-2xl">{s.emoji}</div>
                <div className="font-oswald text-2xl text-foreground">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <button
            onClick={startGame}
            className="mt-6 px-10 py-3 font-oswald text-lg uppercase tracking-widest bg-primary text-primary-foreground rounded-xl hover:brightness-110 transition-all"
          >
            Снова в офис
          </button>
          <button
            onClick={() => setScreen("menu")}
            className="mt-3 block mx-auto px-6 py-2 font-golos text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            В главное меню
          </button>
        </div>
      </div>
    );
  }

  // ─── WIN ───────────────────────────────────────────────────────────────────
  if (screen === "win") {
    return (
      <div className="relative w-full h-screen overflow-hidden flex items-center justify-center">
        <img
          src={OFFICE_BG}
          alt="Office"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: "brightness(0.4) saturate(0.9)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        <div className="relative z-10 text-center animate-scale-in px-6">
          <div className="text-8xl mb-4">🏆</div>
          <h1 className="font-oswald text-5xl font-bold text-primary uppercase">
            18:00! Выжил!
          </h1>
          <p className="text-foreground/60 mt-2 font-golos">
            Папич пережил рабочий день. Офис проиграл.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-4 max-w-xs mx-auto">
            {[
              { label: "Бан", value: bannedCount, emoji: "🔨" },
              { label: "Лежать", value: layCount, emoji: "😴" },
              { label: "Сасать", value: suckCount, emoji: "👄" },
            ].map((s) => (
              <div key={s.label} className="bg-secondary/40 border border-border rounded-xl p-3 text-center">
                <div className="text-2xl">{s.emoji}</div>
                <div className="font-oswald text-2xl text-primary">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-muted-foreground font-golos">
            Остаточный стресс:{" "}
            <span className={stress > 70 ? "text-red-400" : "text-green-400"}>
              {Math.round(stress)}%
            </span>
          </div>
          <button
            onClick={startGame}
            className="mt-6 px-10 py-3 font-oswald text-lg uppercase tracking-widest bg-primary text-primary-foreground rounded-xl hover:brightness-110 transition-all"
            style={{ boxShadow: "0 0 25px rgba(251,189,35,0.3)" }}
          >
            Новый рабочий день
          </button>
          <button
            onClick={() => setScreen("menu")}
            className="mt-3 block mx-auto px-6 py-2 font-golos text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            В главное меню
          </button>
        </div>
      </div>
    );
  }

  // ─── GAME ──────────────────────────────────────────────────────────────────
  return (
    <div
      className={`relative w-full h-screen overflow-hidden select-none ${isShaking ? "animate-shake" : ""}`}
    >
      <img
        src={OFFICE_BG}
        alt="Office"
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter: `brightness(${Math.max(0.3, 0.65 - stress * 0.003)}) saturate(${Math.max(0.35, 1 - stress * 0.007)})`,
          transition: "filter 1s ease",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.8) 100%)",
        }}
      />

      {/* Stress color overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-500"
        style={{ background: stressOverlayColor, zIndex: 5 }}
      />

      {/* Layout */}
      <div className="relative z-10 h-full flex gap-3 p-3" style={{ zIndex: 6 }}>

        {/* LEFT: Stats */}
        <div className="w-52 shrink-0 flex flex-col gap-3 bg-black/65 backdrop-blur-md rounded-xl p-3 border border-border">
          <div className="flex items-center gap-2 pb-2 border-b border-border">
            <span className="text-xl">😤</span>
            <span className="font-oswald text-sm uppercase tracking-widest text-primary">ПАПИЧ</span>
          </div>

          <StatsPanel
            stress={stress}
            hour={currentHourInt}
            minutes={currentMinutes}
            bannedCount={bannedCount}
            layCount={layCount}
            suckCount={suckCount}
          />

          <div className="mt-auto pt-2 border-t border-border space-y-2">
            <div className="text-xs text-muted-foreground font-golos">
              <span className="text-primary font-bold">[Q]</span> Сасать &nbsp;
              <span className="text-primary font-bold">[E]</span> Лежать
            </div>
            <button
              onClick={() => setScreen("menu")}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors font-golos flex items-center gap-1"
            >
              <Icon name="LogOut" size={11} />
              Выйти
            </button>
          </div>
        </div>

        {/* RIGHT: Office view + Laptop */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Office view */}
          <div className="flex-1 rounded-xl overflow-hidden relative border border-border/30 flex items-end justify-center pb-4">
            {stress > 70 && (
              <div className="animate-event-pop bg-red-900/80 border border-red-600/50 rounded-lg px-5 py-2 backdrop-blur-sm">
                <p className="text-red-300 text-sm font-oswald uppercase tracking-wider animate-stress-pulse">
                  ⚠️ Критический стресс! Жми [Q] или [E]!
                </p>
              </div>
            )}
          </div>

          {/* Laptop */}
          <div className="shrink-0">
            <LaptopScreen
              messages={chatMessages}
              bannedUsers={bannedUsers}
              onBan={handleBan}
              onLay={handleLay}
              onSuck={handleSuck}
              isLayActive={isLayActive}
              isSuckActive={isSuckActive}
            />
          </div>
        </div>
      </div>

      <EventNotification event={currentEvent} onDismiss={() => setCurrentEvent(null)} />
      {banToast && <BanToast user={banToast} onClose={() => setBanToast(null)} />}
      <KeyboardHandler onLay={handleLay} onSuck={handleSuck} />
    </div>
  );
}
