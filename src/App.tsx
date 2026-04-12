import React, { useState, useEffect } from 'react';
import { Clock, Bluetooth, BluetoothOff, Send, ShieldCheck, Zap, Activity, AlertCircle, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

type Mode = 'Normal' | 'Pro' | 'Ultra';

export default function App() {
  const [time, setTime] = useState('10:00');
  const [period, setPeriod] = useState<'a.m' | 'p.m'>('a.m');
  const [mode, setMode] = useState<Mode>('Normal');
  const [device, setDevice] = useState<any>(null);
  const [status, setStatus] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const UART_TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 5));
    setStatus(msg);
  };

  useEffect(() => {
    const initBle = async () => {
      try {
        await BleClient.initialize();
        addLog('System Ready');
      } catch (e) {
        addLog('BLE Init Error');
      }
    };
    initBle();
  }, []);

  const connectToDevice = async () => {
    setIsConnecting(true);
    setLogs([]);
    addLog('Initializing Bluetooth...');

    try {
      await BleClient.initialize();
      
      // ১. সরাসরি সিস্টেম পারমিশন প্রম্পট ট্রিগার করা (অ্যান্ড্রয়েড ১২+ এর জন্য)
      addLog('Requesting System Permissions...');
      await BleClient.requestPermissions();
      
      try {
        await BleClient.requestEnabled();
      } catch (e) {
        addLog('Bluetooth is OFF');
      }

      // ২. ডিভাইস খোঁজা (কোনো ফিল্টার ছাড়া)
      addLog('Searching for devices...');
      const device = await BleClient.requestDevice();

      addLog(`Connecting to ${device.name || 'Unknown'}...`);
      
      await BleClient.connect(device.deviceId, (deviceId) => {
        setDevice(null);
        addLog('Disconnected');
      });

      setDevice(device);
      addLog('Connected Successfully!');

      // ৩. অটো টাইম সিঙ্ক
      const now = new Date();
      const syncCommand = `set datetime ${now.getFullYear()} ${now.getMonth() + 1} ${now.getDate()} ${now.getHours()} ${now.getMinutes()}\n`;
      const encoder = new TextEncoder();
      await BleClient.write(device.deviceId, UART_SERVICE_UUID, UART_TX_CHARACTERISTIC_UUID, numbersToDataView(Array.from(encoder.encode(syncCommand))));
      
      addLog('Time Synced!');

    } catch (error: any) {
      console.error(error);
      addLog(`Error: ${error.message || 'Action Cancelled'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const sendCommand = async () => {
    if (!device) {
      addLog('⚠️ Connect Clock First!');
      return;
    }

    const command = `set alarm ${time} ${period} ${mode.toLowerCase()}\n`;
    try {
      const encoder = new TextEncoder();
      await BleClient.write(device.deviceId, UART_SERVICE_UUID, UART_TX_CHARACTERISTIC_UUID, numbersToDataView(Array.from(encoder.encode(command))));
      addLog('✅ Alarm Command Sent!');
    } catch (error) {
      addLog('❌ Send Failed');
    }
  };

  const modes: { id: Mode; icon: React.ReactNode; color: string }[] = [
    { id: 'Normal', icon: <Activity className="w-5 h-5" />, color: 'from-blue-600 to-cyan-500' },
    { id: 'Pro', icon: <ShieldCheck className="w-5 h-5" />, color: 'from-purple-600 to-pink-500' },
    { id: 'Ultra', icon: <Zap className="w-5 h-5" />, color: 'from-orange-600 to-red-500' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-800 overflow-hidden relative"
      >
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 blur-[100px] rounded-full" />
        
        <div className="p-8 pb-4 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20">
              <Clock className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Kama Clock</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-semibold">Controller Pro</p>
            </div>
          </div>
          <button 
            onClick={connectToDevice}
            disabled={isConnecting}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${device ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700 shadow-lg shadow-indigo-500/10'}`}
          >
            {isConnecting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                <Search className="w-5 h-5 text-indigo-400" />
              </motion.div>
            ) : device ? <Bluetooth className="w-5 h-5" /> : <BluetoothOff className="w-5 h-5" />}
          </button>
        </div>

        <div className="p-8 pt-4 space-y-8 relative z-10">
          <div className="bg-slate-800/50 rounded-[2rem] p-6 border border-slate-700/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alarm Time</span>
              <div className="flex gap-1">
                {(['a.m', 'p.m'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${period === p ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-900 text-slate-500'}`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <input 
              type="time" 
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-transparent text-6xl font-light tracking-tighter text-center focus:outline-none text-indigo-100"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`group relative flex flex-col items-center gap-3 p-5 rounded-3xl border transition-all duration-500 ${mode === m.id ? `border-transparent bg-gradient-to-br ${m.color} text-white shadow-xl scale-[1.02]` : 'border-slate-800 bg-slate-800/30 text-slate-500 hover:border-slate-700'}`}
              >
                <div className={`p-2 rounded-xl ${mode === m.id ? 'bg-white/20' : 'bg-slate-900 group-hover:bg-slate-800 transition-colors'}`}>
                  {m.icon}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest">{m.id}</span>
              </button>
            ))}
          </div>

          <div className="min-h-[60px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {logs.length > 0 ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-1"
                >
                  {logs.map((log, i) => (
                    <p key={i} className={`text-center text-[10px] font-medium ${i === 0 ? 'text-indigo-400' : 'text-slate-600 opacity-50'}`}>
                      {log}
                    </p>
                  ))}
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 text-slate-600">
                  <AlertCircle className="w-3 h-3" />
                  <span className="text-[10px] font-medium">Ready to sync</span>
                </div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={sendCommand}
            className="group relative w-full h-16 bg-indigo-500 hover:bg-indigo-600 text-white rounded-3xl flex items-center justify-center gap-3 transition-all duration-300 shadow-2xl shadow-indigo-500/40 overflow-hidden active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_2s_infinite]" />
            <Send className="w-5 h-5" />
            <span className="font-bold uppercase tracking-[0.2em] text-xs">Send Command</span>
          </button>
        </div>

        <div className="p-6 bg-slate-950/50 border-t border-slate-800/50 flex items-center justify-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3].map(i => <div key={i} className={`w-1 h-1 rounded-full ${device ? 'bg-green-500' : 'bg-slate-700'}`} />)}
          </div>
          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">BLE Secure Connection</span>
        </div>
      </motion.div>

      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        input[type="time"]::-webkit-calendar-picker-indicator {
          display: none;
        }
      `}</style>
    </div>
  );
}
