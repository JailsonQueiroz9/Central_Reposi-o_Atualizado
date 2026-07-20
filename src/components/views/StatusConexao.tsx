import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, Radio, Server, CheckCircle2, AlertTriangle, Clock, History, Globe } from 'lucide-react';
import { api } from '../../lib/api';

interface TestResult {
  timestamp: string;
  latency: number;
  status: 'online' | 'offline' | 'slow';
  message: string;
}

export default function StatusConexao() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isTesting, setIsTesting] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline' | 'error'>('checking');
  const [history, setHistory] = useState<TestResult[]>([]);
  const [activeTab, setActiveTab] = useState<'painel' | 'historico'>('painel');

  // Monitor navigator online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    testConnection();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const testConnection = async () => {
    if (isTesting) return;
    setIsTesting(true);
    setApiStatus('checking');

    const startTime = Date.now();
    try {
      // Use standard api path
      const result = await api.post('getParametros', {});
      const endTime = Date.now();
      const currentLatency = endTime - startTime;

      setLatency(currentLatency);
      
      let status: 'online' | 'slow' = 'online';
      let msg = 'Conexão excelente com a API';

      if (currentLatency > 1500) {
        status = 'slow';
        msg = 'Conexão lenta detectada';
        setApiStatus('online');
      } else {
        setApiStatus('online');
      }

      const newTest: TestResult = {
        timestamp: new Date().toLocaleTimeString(),
        latency: currentLatency,
        status,
        message: msg
      };

      setHistory(prev => [newTest, ...prev.slice(0, 9)]);
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setApiStatus('offline');
      setLatency(null);

      const newTest: TestResult = {
        timestamp: new Date().toLocaleTimeString(),
        latency: 0,
        status: 'offline',
        message: error.message || 'Erro de conexão com o servidor'
      };
      setHistory(prev => [newTest, ...prev.slice(0, 9)]);
    } finally {
      setIsTesting(false);
    }
  };

  const getLatencyColor = (ms: number | null) => {
    if (ms === null) return 'text-gray-400';
    if (ms < 400) return 'text-emerald-500';
    if (ms < 1200) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getLatencyBg = (ms: number | null) => {
    if (ms === null) return 'bg-gray-500/10 border-gray-500/20';
    if (ms < 400) return 'bg-emerald-500/10 border-emerald-500/20';
    if (ms < 1200) return 'bg-amber-500/10 border-amber-500/20';
    return 'bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 min-h-[calc(100vh-80px)] flex flex-col justify-start">
      {/* Header */}
      <div className="border-l-4 border-orange-500 pl-4">
        <h1 className="text-2xl font-black text-white flex items-center gap-2.5 tracking-tight">
          <Radio className="text-orange-500 animate-pulse" size={26} />
          Diagnóstico de Conectividade
        </h1>
        <p className="text-xs text-gray-400 mt-1">
          Monitore o estado e a latência de sua conexão com os servidores do Google Apps Script em tempo real.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setActiveTab('painel')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'painel' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white'
          }`}
        >
          Painel Geral
        </button>
        <button
          onClick={() => setActiveTab('historico')}
          className={`pb-3 text-sm font-bold transition-all relative ${
            activeTab === 'historico' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-gray-400 hover:text-white'
          }`}
        >
          Histórico de Testes
        </button>
      </div>

      {activeTab === 'painel' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Internet Status Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between h-56 relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
              <Globe size={160} />
            </div>

            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-slate-800">
                {isOnline ? (
                  <Wifi className="text-emerald-500" size={24} />
                ) : (
                  <WifiOff className="text-rose-500 animate-bounce" size={24} />
                )}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                isOnline ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {isOnline ? 'CONECTADO' : 'SEM INTERNET'}
              </span>
            </div>

            <div className="space-y-1 z-10">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Navegador</h3>
              <p className="text-2xl font-black text-white tracking-tight">
                {isOnline ? 'Internet Ativa' : 'Desconectado'}
              </p>
              <p className="text-xs text-gray-500">
                Seu dispositivo possui uma conexão de rede ativa com a internet.
              </p>
            </div>
          </div>

          {/* API Server Status Card */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between h-56 relative overflow-hidden group hover:border-slate-700 transition-all duration-300">
            <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none">
              <Server size={160} />
            </div>

            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-slate-800">
                <Server className={
                  apiStatus === 'online' ? 'text-emerald-500' :
                  apiStatus === 'checking' ? 'text-amber-500 animate-spin' : 'text-rose-500'
                } size={24} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                apiStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                apiStatus === 'checking' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {apiStatus === 'online' ? 'OPERACIONAL' : apiStatus === 'checking' ? 'TESTANDO' : 'INDISPONÍVEL'}
              </span>
            </div>

            <div className="space-y-1 z-10">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Servidor Banco de Dados</h3>
              <p className="text-2xl font-black text-white tracking-tight">
                {apiStatus === 'online' ? 'Google Sheets' : apiStatus === 'checking' ? 'Consultando...' : 'Sem Resposta'}
              </p>
              <p className="text-xs text-gray-500 truncate" title="API ativa baseada no Google Apps Script">
                Integridade com Google Apps Script
              </p>
            </div>
          </div>

          {/* Latency Card */}
          <div className={`rounded-2xl border p-6 flex flex-col justify-between h-56 transition-all duration-300 ${getLatencyBg(latency)}`}>
            <div className="flex items-center justify-between">
              <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/30">
                <Clock className={getLatencyColor(latency)} size={24} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                latency === null ? 'bg-gray-500/10 border-gray-500/20 text-gray-400' :
                latency < 400 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                latency < 1200 ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
              }`}>
                LATÊNCIA
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Tempo de Resposta</h3>
              <p className={`text-4xl font-black tracking-tight ${getLatencyColor(latency)}`}>
                {latency !== null ? `${latency}ms` : '--'}
              </p>
              <p className="text-xs text-gray-400 font-medium">
                {latency === null ? 'Aguardando teste de conexão' :
                 latency < 400 ? 'Velocidade excelente para transações.' :
                 latency < 1200 ? 'Latência moderada. Operações funcionais.' : 'Conexão lenta. Carregamentos podem demorar.'}
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* History Tab */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden p-6 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold pb-2 border-b border-slate-800">
            <History size={18} className="text-orange-500" />
            <span>Últimas Verificações de Conectividade</span>
          </div>

          {history.length === 0 ? (
            <div className="p-8 text-center text-gray-500 flex flex-col items-center gap-3">
              <Radio size={40} className="text-slate-700 animate-pulse" />
              <span className="text-sm font-semibold">Nenhum teste de conexão foi registrado nesta sessão.</span>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {history.map((test, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between hover:bg-slate-800/15 transition-colors rounded-lg px-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-500">{test.timestamp}</span>
                    <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                      test.status === 'online' ? 'text-emerald-500' :
                      test.status === 'slow' ? 'text-amber-500' : 'text-rose-500'
                    }`}>
                      {test.status === 'online' && <CheckCircle2 size={14} />}
                      {test.status === 'slow' && <AlertTriangle size={14} />}
                      {test.status === 'offline' && <WifiOff size={14} />}
                      {test.message}
                    </span>
                  </div>
                  <span className={`text-xs font-black px-2.5 py-1 rounded bg-slate-800 border ${
                    test.latency === 0 ? 'border-rose-500/20 text-rose-400' :
                    test.latency < 400 ? 'border-emerald-500/20 text-emerald-400' :
                    test.latency < 1200 ? 'border-amber-500/20 text-amber-400' : 'border-rose-500/20 text-rose-400'
                  }`}>
                    {test.latency === 0 ? 'OFFLINE' : `${test.latency} ms`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manual Test Action */}
      <div className="flex justify-center pt-4">
        <button
          onClick={testConnection}
          disabled={isTesting}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold px-8 py-3.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-3 hover:-translate-y-0.5 transform disabled:opacity-50 cursor-pointer text-sm"
        >
          <RefreshCw size={18} className={isTesting ? 'animate-spin' : ''} />
          {isTesting ? 'REALIZANDO PING TEST...' : 'DIAGNOSTICAR CONEXÃO AGORA'}
        </button>
      </div>
    </div>
  );
}
