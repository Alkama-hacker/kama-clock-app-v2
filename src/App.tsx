import React, { useState, useEffect } from 'react';
import { Clock, Bluetooth, BluetoothOff, Send, Settings2, ShieldCheck, Zap, Activity } from 'lucide-react';
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

  // Kama Clock Bluetooth UUIDs
  const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const UART_TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  useEffect(() => {
    const initBle = async () => {
      try {
        await BleClient.initialize();
      } catch (e) {
        console.error('BLE init error', e);
      }
    };
    initBle();
  }, []);

  const connectToDevice = async () => {
    setIsConnecting(true);
    setStatus('Scanning for Kama clock...');

    try {
      const device = await BleClient.requestDevice({
        services: [UART_SERVICE_UUID],
        name: 'Kama clock',
      });

      setStatus(`Connecting to ${device.name}...`);
      
      await BleClient.connect(device.deviceId, (deviceId) => {
        setDevice(null);
        setStatus('Kama clock disconnected');
      });

      setDevice(device);
      setStatus('Connected to Kama clock');

      // Auto-sync current phone date and time on connection
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const date = now.getDate();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      
      const syncCommand = `set datetime ${year} ${month} ${date} ${hours} ${minutes}\n`;
      const encoder = new TextEncoder();
      await BleClient.write(device.deviceId, UART_SERVICE_UUID, UART_TX_CHARACTERISTIC_UUID, numbersToDataView(Array.from(encoder.encode(syncCommand))));
      
      setStatus(`System synced: ${year}-${month}-${date} ${hours}:${minutes.toString().padStart(2, '0')}`);
      setTimeout(() => setStatus('Connected to Kama clock'), 3000);

    } catch (error: any) {
      console.error(error);
      setStatus(`Error: ${error.message || 'Connection failed'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const sendCommand = async () => {
    if (!device) {
      setStatus('Kama clock not connected.');
      return;
    }

    const command = `set alarm ${time} ${period} ${mode.toLowerCase()}\n`;
    setStatus(`Sending: ${command.trim()}`);

    try {
      const encoder = new TextEncoder();
      await BleClient.write(device.deviceId, UART_SERVICE_UUID, UART_TX_CHARACTERISTIC_UUID, numbersToDataView(Array.from(encoder.encode(command))));
      setStatus('Command sent successfully!');
      setTimeout(() => setStatus('Connected to Kama clock'), 3000);
    } catch (error) {
      console.error(error);
      setStatus('Failed to send command.');
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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-xl">
              <Clock className="w-6 h-6 text-indigo-400" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Kama Clock</h1>
          </div>
          <button 
            onClick={connectToDevice}
            disabled={isConnecting}
            className={`p-2 rounded-full transition-colors ${device ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
          >
            {device ? <Bluetooth className="w-5 h-5" /> : <BluetoothOff className="w-5 h-5" />}
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8">
          {/* Time Picker */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Set Alarm Time</label>
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-3xl font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none"
                />
              </div>
              <div className="flex flex-col gap-2">
                {(['a.m', 'p.m'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${period === p ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="space-y-4">
            <label className="text-sm font-medium text-slate-400 uppercase tracking-wider">Select Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300 ${mode === m.id ? `border-transparent bg-gradient-to-br ${m.color} text-white shadow-lg scale-105` : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'}`}
                >
                  {m.icon}
                  <span className="text-xs font-bold">{m.id}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Status Message */}
          <AnimatePresence mode="wait">
            {status && (
              <motion.div
                key={status}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <div className={`text-center text-sm font-medium p-3 rounded-xl ${status.includes('not connected') || status.includes('cancelled') || status.includes('blocked') || status.includes('⚠️') ? 'bg-red-500/10 text-red-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                  {status}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Send Button */}
          <button
            onClick={sendCommand}
            disabled={!device}
            className={`w-full font-bold py-5 rounded-2xl flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 ${
              device 
                ? 'bg-indigo-500 text-white shadow-xl shadow-indigo-500/20 hover:bg-indigo-600' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Send className="w-5 h-5" />
            <span className="tracking-wide uppercase text-sm">Send Command</span>
          </button>
        </div>

        {/* Footer info */}
        <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex items-center justify-center gap-2 text-slate-500 text-xs">
          <Settings2 className="w-3 h-3" />
          <span>Bluetooth Low Energy Controller</span>
        </div>
      </motion.div>
    </div>
  );
}
