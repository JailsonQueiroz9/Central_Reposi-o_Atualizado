import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, FileText, Activity, MessageCircle, Settings, Menu, X, LogOut, Loader2, Download, Box, ClipboardList, CalendarClock, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from './lib/api';
import { dataCache } from './lib/cache';

import Cadastro from './components/views/Cadastro';
import Almox from './components/views/Almox';
import Painel from './components/views/Painel';
import FollowUp from './components/views/FollowUp';
import Chat from './components/views/Chat';
import Configuracao from './components/views/Configuracao';
import Login from './components/views/Login';
import Register from './components/views/Register';
import CadastroEntrega from './components/views/CadastroEntrega';
import EntregaDublagem from './components/views/EntregaDublagem';
import DisponivelCentral from './components/views/DisponivelCentral';
import Producao from './components/views/Producao';
import ProgramacaoPCP from './components/views/ProgramacaoPCP';

type ViewType = 'painel' | 'cadastro' | 'almox' | 'followup' | 'chat' | 'configuracao' | 'cadastroEntrega' | 'entregaDublagem' | 'disponivelCentral' | 'producao' | 'programacaoPCP';

const menuItems = [
  { id: 'painel', label: 'Painel (Status)', icon: LayoutDashboard, perm: 'painel' },
  { id: 'cadastro', label: 'Cadastro', icon: FileText, perm: 'cadastro' },
  { id: 'almox', label: 'Almox', icon: Box, perm: 'almx' },
  { id: 'cadastroEntrega', label: 'Cadastro Entrega', icon: FileText, perm: 'cadastro' },
  { id: 'entregaDublagem', label: 'Entrega Dublagem', icon: Layers, perm: 'cadastro' },
  { id: 'disponivelCentral', label: 'Disponível na Central', icon: Box, perm: 'cadastro' },
  { id: 'producao', label: 'Produção', icon: ClipboardList, perm: 'producao' },
  { id: 'programacaoPCP', label: 'Programação PCP', icon: CalendarClock, perm: 'programacaoPCP' },
  { id: 'followup', label: 'Follow-up', icon: Activity, perm: 'followup' },
  { id: 'chat', label: 'Chat', icon: MessageCircle, perm: 'chat' },
  { id: 'configuracao', label: 'Configuração', icon: Settings, perm: 'config' },
] as const;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [user, setUser] = useState<any>(null);
  
  const [activeView, setActiveView] = useState<ViewType>('cadastro');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInIframe, setIsInIframe] = useState(false);
  const [headerContent, setHeaderContent] = useState<React.ReactNode | null>(null);
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    setIsInIframe(window.self !== window.top);

    const handleBeforeInstallPrompt = (e: any) => {
      console.log('beforeinstallprompt fired');
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      console.log('App was installed');
      setShowInstallBtn(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };

  // Parse permissions from user object
  const permissions = useMemo(() => {
    if (!user) return null;
    
    // Prioriza a coluna da planilha que é a fonte da verdade em tempo real
    let perms = user['Permissões de Tela (Módulos)'] || user.permissions;
    
    if (typeof perms === 'string' && perms.trim()) {
      try {
        const parsed = JSON.parse(perms);
        // Só retorna se for um objeto válido com chaves
        return (parsed && typeof parsed === 'object') ? parsed : null;
      } catch (e) {
        console.error('Erro ao parsear permissões do usuário');
        return null;
      }
    }
    
    // Se for objeto, retorna, senão null
    return (perms && typeof perms === 'object') ? perms : null;
  }, [user]);

  const handleLogout = () => {
    localStorage.removeItem('pcp_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = () => {
    const storedUser = localStorage.getItem('pcp_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      
      // Define a primeira visualização disponível baseada nas permissões
      const perms = parsedUser['Permissões de Tela (Módulos)'] || parsedUser.permissions;
      let pObj = perms;
      if (typeof perms === 'string') try { pObj = JSON.parse(perms); } catch(e) {}
      
      if (pObj) {
        const firstView = menuItems.find(item => {
          if (item.perm === 'producao' || item.perm === 'programacaoPCP') {
            return pObj[item.perm] !== false;
          }
          return pObj[item.perm] === true;
        })?.id;
        if (firstView) setActiveView(firstView as any);
      }
    }
    setIsAuthenticated(true);
  };

  // Check for existing session on mount with server verification
  useEffect(() => {
    const initAuth = async () => {
      const startTime = performance.now();
      try {
        const storedUser = localStorage.getItem('pcp_user');
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          
          // Busca dados atualizados do servidor com cache de 30s para redundância inicial
          const allUsersData = await dataCache.get('allUsers', () => api.post('getUsers'), 30000);
          const allUsers = Array.isArray(allUsersData) ? allUsersData : [];
          
          const currentUserEmail = parsedUser.email || parsedUser['E-MAIL'];
          const updatedUser = allUsers.find((u: any) => (u.email || u['E-MAIL']) === currentUserEmail);

          if (updatedUser) {
            const status = (updatedUser.status || updatedUser['STATUS'] || '').toLowerCase();
            if (status === 'ativo') {
              const newUserObj = { ...parsedUser, ...updatedUser };
              setUser(newUserObj);
              setIsAuthenticated(true);
              localStorage.setItem('pcp_user', JSON.stringify(newUserObj));
              
              // Pré-carregamento de dados críticos em segundo plano (Prefetch)
              const prefetchData = async () => {
                console.log('[PERFORMANCE] Iniciando Pré-carregamento de dados...');
                try {
                  // Dispara as buscas em paralelo sem travar a UI
                  await Promise.all([
                    api.post('getPainelData').then(d => dataCache.set('painelData', d)),
                    api.post('getWipData').then(d => dataCache.set('wipData', d)),
                    api.post('getParametros').then(d => dataCache.set('parametros', d))
                  ]);
                  console.log('[PERFORMANCE] Cache aquecido com sucesso!');
                } catch (e) {
                  console.warn('[PERFORMANCE] Falha no pré-carregamento:', e);
                }
              };
              prefetchData();
              
              // Define active view based on permissions
              const perms = updatedUser['Permissões de Tela (Módulos)'];
              let pObj = perms;
              if (typeof perms === 'string') try { pObj = JSON.parse(perms); } catch(e) {}
              if (pObj) {
                const firstView = menuItems.find(item => {
                  if (item.perm === 'producao' || item.perm === 'programacaoPCP') {
                    return pObj[item.perm] !== false;
                  }
                  return pObj[item.perm] === true;
                })?.id;
                if (firstView) setActiveView(firstView as any);
              }
            } else {
              console.warn('[DEBUG] Usuário inativo detectado no boot');
              localStorage.removeItem('pcp_user');
              setIsAuthenticated(false);
              setUser(null);
            }
          } else {
            console.warn('[DEBUG] Usuário não encontrado no boot');
            localStorage.removeItem('pcp_user');
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (e: any) {
        console.error('[DEBUG] Erro ao inicializar autenticação:', e);
        // Se o erro for de usuário inativo, limpa a sessão
        if (e.message && e.message.includes('inativo')) {
          localStorage.removeItem('pcp_user');
          setUser(null);
          setIsAuthenticated(false);
        }
      } finally {
        const endTime = performance.now();
        console.log(`[DEBUG] Inicialização do sistema concluída em ${Math.round(endTime - startTime)}ms`);
        setIsInitialLoading(false);
      }
    };

    initAuth();
  }, []);

  // Verificação em tempo real (Polling)
  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const checkRealTimeStatus = async () => {
      try {
        // Usa cache de 10s para evitar chamadas redundantes
        const allUsersData = await dataCache.get('allUsers', () => api.post('getUsers'), 10000);
        const allUsers = Array.isArray(allUsersData) ? allUsersData : [];
        
        const currentUserEmail = user.email || user['E-MAIL'];
        const updatedUser = allUsers.find((u: any) => (u.email || u['E-MAIL']) === currentUserEmail);

        if (!updatedUser) {
          console.warn('[DEBUG] Usuário removido do banco durante polling');
          handleLogout();
          return;
        }

        const newStatus = (updatedUser.status || updatedUser['STATUS'] || '').toLowerCase();
        const newPermissions = updatedUser['Permissões de Tela (Módulos)'];

        // Se inativado, desloga na hora
        if (newStatus !== 'ativo') {
          console.warn('[DEBUG] Usuário inativado durante polling');
          handleLogout();
          return;
        }

        // Se as permissões mudaram, atualiza o estado e o localStorage
        if (JSON.stringify(newPermissions) !== JSON.stringify(user['Permissões de Tela (Módulos)'])) {
          console.log('[DEBUG] Permissões alteradas detectadas. Atualizando interface...');
          const newUserObj = { ...user, ...updatedUser };
          setUser(newUserObj);
          localStorage.setItem('pcp_user', JSON.stringify(newUserObj));
        }
      } catch (error) {
        console.error('[DEBUG] Erro na verificação em tempo real:', error);
      }
    };

    // Verifica a cada 60 segundos (otimizado para reduzir carga)
    const interval = setInterval(checkRealTimeStatus, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  // Filtra os itens do menu baseados nas permissões do banco de dados
  const filteredMenuItems = useMemo(() => {
    if (!permissions) return [];
    return menuItems.filter(item => {
      if (item.perm === 'producao' || item.perm === 'programacaoPCP') {
        return permissions[item.perm as any] !== false;
      }
      return permissions[item.perm as any] === true;
    });
  }, [permissions]);

  // Só considera o sistema "carregado" se o carregamento de autenticação inicial terminou
  const isAppReady = !isInitialLoading;

  // Adiciona um pequeno delay visual para garantir que as permissões foram aplicadas
  const [isFullyReady, setIsFullyReady] = useState(false);
  
  useEffect(() => {
    if (isAppReady) {
      const timer = setTimeout(() => setIsFullyReady(true), 800);
      return () => clearTimeout(timer);
    } else {
      setIsFullyReady(false);
    }
  }, [isAppReady]);

  if (!isFullyReady) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 gap-4 text-white">
        <div className="relative">
          <Loader2 className="animate-spin text-orange-500" size={56} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full animate-ping"></div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-white font-bold text-lg tracking-widest">CONTROLE DE REP</p>
          <p className="text-gray-400 font-medium animate-pulse text-sm">Sincronizando ambiente e permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (authView === 'login') {
      return <Login onLogin={handleLoginSuccess} onGoToRegister={() => setAuthView('register')} />;
    }
    return <Register onRegister={handleLoginSuccess} onGoToLogin={() => setAuthView('login')} />;
  }

  const renderView = () => {
    switch (activeView) {
      case 'painel': return <Painel />;
      case 'cadastro': return <Cadastro />;
      case 'almox': return <Almox />;
      case 'cadastroEntrega': return <CadastroEntrega />;
      case 'entregaDublagem': return <EntregaDublagem />;
      case 'disponivelCentral': return <DisponivelCentral />;
      case 'producao': return <Producao />;
      case 'programacaoPCP': return <ProgramacaoPCP setHeaderContent={setHeaderContent} />;
      case 'followup': return <FollowUp />;
      case 'chat': return <Chat />;
      case 'configuracao': return <Configuracao />;
      default: return <div className="p-8 text-center text-gray-500">Selecione um módulo no menu lateral.</div>;
    }
  };

  return (
    <div className="flex h-screen w-full bg-slate-950 text-white overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/55 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? 256 : 0,
          opacity: isSidebarOpen ? 1 : 0,
          visibility: isSidebarOpen ? 'visible' : 'hidden'
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed md:relative z-50 h-full bg-slate-900 border-r border-slate-800 text-white flex flex-col shadow-2xl overflow-hidden whitespace-nowrap print:hidden"
      >
        <div className="p-4 flex items-center justify-between border-b border-slate-800">
          <h2 className="text-xl font-bold tracking-wider">CONTROLE DE REP</h2>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1 hover:bg-slate-800 rounded">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveView(item.id);
                  if (window.innerWidth < 768) setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-6 py-3 transition-colors ${
                  isActive 
                    ? 'bg-slate-800 border-r-4 border-orange-500 font-semibold' 
                    : 'hover:bg-slate-800/55 text-white/80 hover:text-white'
                }`}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </button>
            );
          })}
          {filteredMenuItems.length === 0 && permissions !== null && (
            <div className="px-6 py-4 text-xs text-white/50 italic">
              Nenhuma permissão de acesso configurada.
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-4">
          {/* User Profile Info */}
          <div className="flex items-center gap-3 px-2 py-2 bg-slate-800/40 rounded-lg border border-slate-850">
            <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-inner">
              {(user?.nome || user?.['USUÁRIO'] || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{user?.nome || user?.['USUÁRIO'] || 'Usuário'}</p>
              <p className="text-[10px] text-white/60 truncate uppercase tracking-tighter">
                {user?.role || user?.['PAPEL'] || 'Colaborador'}
              </p>
            </div>
          </div>

          {showInstallBtn ? (
            <button 
              onClick={handleInstallClick}
              className="w-full flex items-center gap-3 px-2 py-2 bg-orange-600 hover:bg-orange-700 text-white transition-colors rounded shadow-lg animate-pulse"
            >
              <Download size={20} />
              <div className="text-left">
                <p className="text-xs font-bold">Instalar App</p>
                <p className="text-[10px] opacity-80">Versão Mobile/Desktop</p>
              </div>
            </button>
          ) : null}

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-2 py-2 hover:bg-slate-800 text-white/80 hover:text-white transition-colors rounded print:hidden"
          >
            <LogOut size={20} />
            <span>Sair</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full bg-slate-950">
        {/* Top Header */}
        <header className={`bg-slate-900 border-b border-slate-800 flex items-center px-4 md:px-6 shadow-sm z-10 print:hidden transition-all duration-300 ${activeView === 'programacaoPCP' ? 'py-4 min-h-[5.5rem]' : 'h-14'}`}>
          <div className="flex items-center gap-4 w-full">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-800 rounded-lg text-gray-400 transition-colors flex-shrink-0"
            >
              <Menu size={20} />
            </button>
            {activeView === 'programacaoPCP' && headerContent ? (
              <div className="flex-1 min-w-0">
                {headerContent}
              </div>
            ) : (
              <div className="ml-2 font-semibold text-white capitalize">
                {menuItems.find(m => m.id === activeView)?.label}
              </div>
            )}
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-auto relative">
          {renderView()}
        </div>
      </main>
    </div>
  );
}
