import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SendHorizonal, Trash2, Sparkles } from 'lucide-react';
import { askBestGrafityAI, getSoSummary, getKeuanganSummary } from '../lib/aiAssistant';

/* ===== Custom bot logo (SVG modern, bukan ikon generik) ===== */
function BotLogo({ size = 46, withBadge = true }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 48 48" width={size} height={size} className="drop-shadow-[0_4px_14px_rgba(220,38,38,0.45)]">
        <defs>
          <linearGradient id="botGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="55%" stopColor="#e11d48" />
            <stop offset="100%" stopColor="#9f1239" />
          </linearGradient>
          <linearGradient id="botFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#fde8ec" />
          </linearGradient>
        </defs>
        {/* body rounded */}
        <rect x="3" y="3" width="42" height="42" rx="13" fill="url(#botGrad)" />
        {/* antena */}
        <line x1="24" y1="11" x2="24" y2="16" stroke="#ffffff" strokeWidth="1.6" strokeLinecap="round" opacity="0.85" />
        <circle cx="24" cy="9.6" r="2.4" fill="#ffffff" />
        {/* kepala bot */}
        <rect x="12.5" y="17.5" width="23" height="15.5" rx="5.5" fill="url(#botFace)" />
        {/* mata */}
        <circle cx="19.6" cy="24.5" r="2.1" fill="#be123c" />
        <circle cx="28.4" cy="24.5" r="2.1" fill="#be123c" />
        {/* senyum */}
        <path d="M20.5 29.4 Q24 32.2 27.5 29.4" stroke="#be123c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* telinga */}
        <rect x="9" y="20.5" width="3.4" height="9" rx="1.7" fill="#e11d48" />
        <rect x="35.6" y="20.5" width="3.4" height="9" rx="1.7" fill="#e11d48" />
      </svg>
      {withBadge && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-[#12141d]" />
      )}
    </div>
  );
}

/* ===== Renderer mini markdown: **bold**, `code`, baris baru ===== */
function renderMiniMd(text) {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = esc(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

function MsgBubble({ msg }) {
  if (msg.sender === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[86%] px-3.5 py-2.5 rounded-2xl rounded-br-md bg-gradient-to-br from-rose-500 to-red-700 text-white text-[13px] leading-relaxed shadow-lg shadow-red-950/40 whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2.5 items-start">
      <div className="mt-0.5 shrink-0">
        <BotLogo size={30} withBadge={false} />
      </div>
      <div className="max-w-[82%] px-3.5 py-2.5 rounded-2xl rounded-tl-md bg-[#151824]/95 border border-white/10 text-gray-100 text-[13px] leading-relaxed shadow-md">
        <span dangerouslySetInnerHTML={{ __html: renderMiniMd(msg.text) }} />
      </div>
    </div>
  );
}

export default function AiChatFloat({ soRows = [], salesRows = [] }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Halo! Aku **AI KDKMP** 🤖\nAku bisa bantu rekap **Stok Opname (SO)** dan **Keuangan** toko.\n\nCoba ketik:\n• *"rekap"* — ringkasan SO + keuangan\n• *"keuangan"* — omset & pendapatan\n• *"barang expired"* — cek kadaluarsa\n• *"cari milo"* — cek stok produk'
    }
  ]);
  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = async (raw) => {
    const q = (raw ?? input).trim();
    if (!q || typing) return;
    setMessages(prev => [...prev, { sender: 'user', text: q }]);
    setInput('');
    setTyping(true);
    try {
      const reply = await askBestGrafityAI(q, soRows, salesRows);
      setMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'bot', text: '⚠️ Terjadi kendala memproses permintaan. Coba lagi ya.' }]);
    } finally {
      setTyping(false);
    }
  };

  const clearChat = () => {
    setMessages([{ sender: 'bot', text: 'Chat dibersihkan ✨\nTanyakan apa saja tentang **SO** atau **Keuangan** KDKMP.' }]);
  };

  const so = getSoSummary(soRows);
  const keu = getKeuanganSummary(salesRows);

  const quickActions = [
    { icon: '📊', label: 'Rekap SO', desc: 'Ringkasan stok opname', cmd: 'Tampilkan rekap SO' },
    { icon: '💰', label: 'Keuangan', desc: 'Omset & pendapatan', cmd: 'Rekap keuangan' },
    { icon: '⚠️', label: 'Expired', desc: 'Cek kadaluarsa', cmd: 'Cek barang expired' },
    { icon: '🔍', label: 'Cari Produk', desc: 'Cek stok & gondola', cmd: 'cari ' }
  ];

  return (
    <>
      {/* ===== Panel chat floating ===== */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.94 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="fixed z-[70] bottom-24 right-3 sm:right-6 flex flex-col w-[calc(100vw-1.5rem)] max-w-[400px] h-[min(74vh,600px)] rounded-[26px] border border-white/10 bg-[#0a0b10]/92 backdrop-blur-2xl shadow-[0_30px_80px_rgba(0,0,0,0.65)] overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-4 py-3.5 border-b border-white/10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-red-950/60 via-[#151825] to-[#12141d]" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BotLogo size={44} />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-[14px] font-extrabold tracking-wide text-white">AI KDKMP</h3>
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-300 tracking-wider">ONLINE</span>
                    </div>
                    <p className="text-[10.5px] text-gray-400 flex items-center gap-1">
                      <Sparkles size={11} className="text-rose-400" /> bestgrafity · lokal · SO + Keuangan
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={clearChat}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
                    title="Bersihkan chat"
                    aria-label="Bersihkan chat"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition"
                    aria-label="Tutup chat"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick actions */}
            <div className="px-3 pt-2.5 pb-1.5 grid grid-cols-2 gap-1.5 bg-black/20 border-b border-white/5">
              {quickActions.map(a => (
                <button
                  key={a.label}
                  onClick={() => send(a.cmd)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-white/[0.04] hover:bg-rose-600/15 border border-white/[0.07] hover:border-rose-500/40 transition text-left"
                >
                  <span className="text-base">{a.icon}</span>
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-semibold text-gray-100 leading-tight">{a.label}</span>
                    <span className="block text-[9.5px] text-gray-500 leading-tight truncate">{a.desc}</span>
                  </span>
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 bg-[#07080c]/85 ai-scroll">
              {messages.map((m, i) => <MsgBubble key={i} msg={m} />)}
              {typing && (
                <div className="flex gap-2.5 items-start">
                  <BotLogo size={30} withBadge={false} />
                  <div className="bg-[#151824]/95 border border-white/10 rounded-2xl rounded-tl-md px-4 py-3 flex gap-1.5">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-rose-400"
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Data source footer */}
            <div className="px-3.5 py-1.5 flex items-center gap-2 bg-black/25 border-t border-white/5">
              <span className="text-[9.5px] text-gray-500">Sumber:</span>
              <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[9.5px] text-gray-300">
                📦 SO · {so.totalItems} item
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/10 text-[9.5px] text-gray-300">
                💰 Omset Rp{(keu.totalOmset || 0).toLocaleString('id-ID')}
              </span>
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); send(); }}
              className="p-3 bg-[#0d0e14] flex items-center gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tanya SO atau keuangan…"
                className="flex-1 bg-[#161824] border border-white/10 text-white text-[13px] rounded-full px-4 py-2.5 focus:outline-none focus:border-rose-500/70 placeholder-gray-500"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-red-700 hover:from-rose-400 hover:to-red-600 text-white flex items-center justify-center shadow-lg shadow-red-950/50 border border-white/15"
                aria-label="Kirim"
              >
                <SendHorizonal size={17} />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== Floating button ===== */}
      <motion.button
        onClick={() => setOpen(v => !v)}
        whileHover={{ scale: 1.07 }}
        whileTap={{ scale: 0.9 }}
        className="fixed z-[70] bottom-5 right-4 sm:right-6 w-[58px] h-[58px] rounded-full bg-gradient-to-br from-rose-500 to-red-800 border border-white/20 shadow-[0_12px_35px_rgba(225,29,72,0.5)] flex items-center justify-center"
        aria-label="Buka AI Assistant"
      >
        <AnimatePresence mode="wait">
          {open ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6 text-white" />
            </motion.span>
          ) : (
            <motion.span key="bot" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <BotLogo size={40} withBadge={false} />
            </motion.span>
          )}
        </AnimatePresence>
        {!open && (
          <motion.span
            className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#0a0b10]"
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>
    </>
  );
}
