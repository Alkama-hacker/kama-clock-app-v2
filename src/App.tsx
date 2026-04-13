import React, { useState, useEffect } from 'react';
import { Clock, Bluetooth, BluetoothOff, Send, Settings2, ShieldCheck, Zap, Activity, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';

type Mode = 'Normal' | 'Pro' | 'Ultra';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function App() {
  const [time, setTime] = useState('07:00');
  const [period, setPeriod] = useState<'a.m' | 'p.m'>('a.m');
  const [mode, setMode] = useState<Mode>('Normal');
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [device, setDevice] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'alarm' | 'test'>('alarm');
  const [pendingTest, setPendingTest] = useState<string | null>(null);

  const UART_SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
  const UART_TX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
  const UART_RX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 3));
  };

  const toggleDay = (index: number) => {
    setSelectedDays(prev => 
      prev.includes(index) ? prev.filter(d => d !== index) : [...prev, index].sort()
    );
  };

  const connectToDevice = async () => {
    setIsConnecting(true);
    try {
      await BleClient.initialize();
      const device = await BleClient.requestDevice();
      
      await BleClient.connect(device.deviceId, () => {
        setDevice(null);
        setBatteryLevel(null);
        addLog('Clock Disconnected');
      });

      setDevice(device);
      addLog('Clock Connected');

      await BleClient.startNotifications(
        device.deviceId,
        UART_SERVICE_UUID,
        UART_RX_CHARACTERISTIC_UUID,
        (value) => {
          const data = new TextDecoder().decode(value);
          if (data.startsWith('BAT:')) {
            setBatteryLevel(parseInt(data.split(':')[1]));
          } else if (data.startsWith('ALARM_ACTIVE')) {
            addLog('🔔 Alarm is Ringing!');
          }
        }
      );

      // Auto Sync Time & Date
      const now = new Date();
      const syncCmd = `SYNC|${now.getFullYear()}|${now.getMonth() + 1}|${now.getDate()}|${now.getDay()}|${now.getHours()}|${now.getMinutes()}\n`;
      await sendRawCommand(syncCmd);
      addLog('Time Synced to Clock');

    } catch (error: any) {
      addLog('Connection Failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const sendRawCommand = async (cmd: string) => {
    if (!device) return;
    try {
      await BleClient.write(
        device.deviceId, 
        UART_SERVICE_UUID, 
        UART_TX_CHARACTERISTIC_UUID, 
        numbersToDataView(Array.from(new TextEncoder().encode(cmd)))
      );
    } catch (e) {
      addLog('Command Failed');
    }
  };

  const updateAlarm = async () => {
    if (!device) {
      addLog('⚠️ Connect First');
      return;
    }
    const daysStr = selectedDays.length === 7 ? 'ALL' : selectedDays.join(',');
    const cmd = `ALARM|${time}|${period}|${mode.toUpperCase()}|${daysStr}\n`;
    await sendRawCommand(cmd);
    addLog('✅ Alarm Updated');
  };

  const testAction = async (type: 'BUZZER' | 'PUMP' | 'STOP') => {
    if (!device) {
      addLog('⚠️ Connect First');
      return;
    }
    setPendingTest(type);
    await sendRawCommand(`TEST|${type}\n`);
    addLog(`Test: ${type}`);
    setTimeout(() => setPendingTest(null), 1500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        
        {/* Header & Battery */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30">
              <Clock className="text-indigo-400" size={20} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold tracking-tight">Kama Clock</h1>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">Controller Pro</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {batteryLevel !== null && (
              <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                <div className="w-6 h-3 border border-slate-600 rounded-sm p-0.5 relative">
                  <div className={`h-full rounded-xs ${batteryLevel > 20 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${batteryLevel}%` }} />
                  <div className="absolute -right-1 top-0.5 w-0.5 h-1.5 bg-slate-600 rounded-r-sm" />
                </div>
                <span className="text-[10px] font-bold">{batteryLevel}%</span>
              </div>
            )}
            <button 
              onClick={connectToDevice}
              className={`p-2.5 rounded-xl transition-all ${device ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-slate-900 text-slate-500 border border-slate-800'}`}
            >
              <Bluetooth size={18} className={isConnecting ? 'animate-pulse' : ''} />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800 mx-2">
          <button
            onClick={() => setActiveTab('alarm')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${activeTab === 'alarm' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Clock size={14} />
            ALARM SETTINGS
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black transition-all ${activeTab === 'test' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Zap size={14} />
            TEST MODE
          </button>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'alarm' ? (
            <motion.div
              key="alarm"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Alarm Settings Card */}
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-[2.5rem] p-8 space-y-8 backdrop-blur-sm">
                <div className="relative">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Alarm Time</span>
                    <div className="flex gap-1 bg-slate-950/50 p-1 rounded-xl border border-slate-800">
                      {(['a.m', 'p.m'] as const).map(p => (
                        <button
                          key={p}
                          onClick={() => setPeriod(p)}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black transition-all ${period === p ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500'}`}
                        >
                          {p.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-center py-4 px-2">
                    <input 
                      type="time" 
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="bg-transparent text-7xl font-light focus:outline-none text-white w-full text-center tracking-tighter"
                      style={{ minWidth: '200px' }}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Repeat Days</span>
                    <span className="text-[10px] font-bold text-indigo-400">{selectedDays.length === 7 ? 'Everyday' : `${selectedDays.length} Days`}</span>
                  </div>
                  <div className="flex justify-between">
                    {DAYS.map((day, i) => (
                      <button
                        key={day}
                        onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all border ${selectedDays.includes(i) ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-600'}`}
                      >
                        {day[0]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'Normal', icon: <Activity size={20} />, label: 'NORMAL', activeClass: 'bg-gradient-to-br from-cyan-400 to-blue-600 shadow-blue-500/50' },
                    { id: 'Pro', icon: <ShieldCheck size={20} />, label: 'PRO', activeClass: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 shadow-pink-500/50' },
                    { id: 'Ultra', icon: <Zap size={20} />, label: 'ULTRA', activeClass: 'bg-gradient-to-br from-orange-500 to-red-600 shadow-red-500/50' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id as Mode)}
                      className={`flex flex-col items-center gap-3 p-5 rounded-[2rem] border transition-all duration-300 ${mode === m.id ? `${m.activeClass} text-white shadow-2xl scale-105` : 'bg-slate-950/40 border-slate-800/50 text-slate-500 hover:border-slate-700'}`}
                    >
                      <div className={`p-2 rounded-xl ${mode === m.id ? 'bg-white/20' : 'bg-slate-900'}`}>
                        {m.icon}
                      </div>
                      <span className="text-[10px] font-black tracking-widest">{m.label}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={updateAlarm}
                  className="w-full h-16 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
                >
                  <Send size={18} />
                  SEND COMMAND
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="test"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Test Mode Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-8">
                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Hardware Test</p>
                  <p className="text-xs text-slate-500 font-medium">Check your components individually</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button 
                    onClick={() => testAction('BUZZER')} 
                    className={`group bg-slate-950 border p-6 rounded-[2rem] flex items-center gap-6 transition-all active:scale-95 ${pendingTest === 'BUZZER' ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${pendingTest === 'BUZZER' ? 'bg-emerald-500 text-white border-emerald-400 animate-pulse' : 'bg-slate-900 border-slate-800 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20'}`}>
                      <Activity size={24} />
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-black uppercase tracking-widest ${pendingTest === 'BUZZER' ? 'text-emerald-400' : ''}`}>
                        {pendingTest === 'BUZZER' ? 'Buzzer Active...' : 'Test Buzzer'}
                      </p>
                      <p className="text-[10px] font-bold opacity-50 uppercase">Check Sound Output</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => testAction('PUMP')} 
                    className={`group bg-slate-950 border p-6 rounded-[2rem] flex items-center gap-6 transition-all active:scale-95 ${pendingTest === 'PUMP' ? 'border-blue-500 shadow-lg shadow-blue-500/20' : 'border-slate-800 text-slate-400 hover:text-indigo-400 hover:border-indigo-500/30'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${pendingTest === 'PUMP' ? 'bg-blue-500 text-white border-blue-400 animate-pulse' : 'bg-slate-900 border-slate-800 group-hover:bg-indigo-500/10 group-hover:border-indigo-500/20'}`}>
                      <Zap size={24} />
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-black uppercase tracking-widest ${pendingTest === 'PUMP' ? 'text-blue-400' : ''}`}>
                        {pendingTest === 'PUMP' ? 'Pump Active...' : 'Test Pump'}
                      </p>
                      <p className="text-[10px] font-bold opacity-50 uppercase">Check Water Spray</p>
                    </div>
                  </button>

                  <button 
                    onClick={() => testAction('STOP')} 
                    className={`group bg-red-500/5 border p-6 rounded-[2rem] flex items-center gap-6 transition-all active:scale-95 ${pendingTest === 'STOP' ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20' : 'border-red-500/10 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/30'}`}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all ${pendingTest === 'STOP' ? 'bg-red-500 text-white border-red-400' : 'bg-red-500/10 border-red-500/20 group-hover:bg-red-500/20'}`}>
                      <AlertCircle size={24} />
                    </div>
                    <div className="text-left">
                      <p className={`text-xs font-black uppercase tracking-widest ${pendingTest === 'STOP' ? 'text-red-500' : ''}`}>
                        {pendingTest === 'STOP' ? 'Stopping All...' : 'Emergency Stop'}
                      </p>
                      <p className="text-[10px] font-bold opacity-50 uppercase">Halt All Actions</p>
                    </div>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Logs */}
        <div className="text-center">
          <p className="text-[9px] font-bold text-slate-700 uppercase tracking-[0.3em]">
            {logs[0] || 'System Ready'}
          </p>
        </div>
      </motion.div>

      <style>{`
        input[type="time"]::-webkit-calendar-picker-indicator { display: none; }
      `}</style>
    </div>
  );
}
