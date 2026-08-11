import React, { useState, useEffect, useMemo } from 'react';
import { LayoutDashboard, FileText, Activity, MessageCircle, Settings, Menu, X, LogOut, Loader2, Download, Box, ClipboardList, CalendarClock, Layers, Shield, ChevronDown, ChevronRight, ShoppingCart, Scissors, FileUp, User, Radio, History } from 'lucide-react';
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
import CadastroEntrega from './components/views/CadastroEntrega';
import EntregaDublagem from './components/views/EntregaDublagem';
import DisponivelCentral from './components/views/DisponivelCentral';
import Producao from './components/views/Producao';
import ProgramacaoPCP from './components/views/ProgramacaoPCP';
import UploadScreen from './components/UploadScreen';
import StatusConexao from './components/views/StatusConexao';
import Historico from './components/views/Historico';

type ViewType = 'painel' | 'cadastro' | 'almox' | 'followup' | 'chat' | 'configuracao' | 'config_acesso' | 'config_perfil' | 'upload' | 'cadastroEntrega' | 'entregaDublagem' | 'disponivelCentral' | 'producao' | 'programacaoPCP' | 'status_conexao' | 'historico';

const menuItems = [
  { id: 'painel', label: 'Painel (Status)', icon: LayoutDashboard, perm: 'painel' },
  { id: 'cadastro', label: 'Cadastro', icon: FileText, perm: 'cadastro' },
  { id: 'almox', label: 'Almox', icon: Box, perm: 'almx' },
  { id: 'cadastroEntrega', label: 'Entrega do Almox', icon: FileText, perm: 'cadastroEntrega' },
  { id: 'entregaDublagem', label: 'Entrega Dublagem', icon: Layers, perm: 'entregaDublagem' },
  { id: 'disponivelCentral', label: 'Disponível na Central', icon: Box, perm: 'disponivelCentral' },
  { id: 'historico', label: 'Histórico', icon: History, perm: 'historico' },
  { id: 'producao', label: 'Produção', icon: ClipboardList, perm: 'producao' },
  { id: 'programacaoPCP', label: 'Programação PCP', icon: CalendarClock, perm: 'programacaoPCP' },
  { id: 'followup', label: 'Follow-up', icon: Activity, perm: 'followup' },
] as const;

const configItems = [
  { id: 'config_acesso', label: 'Controle de Acesso', icon: Shield, adminOnly: true },
  { id: 'config_perfil', label: 'Perfil de usuários', icon: User, adminOnly: false },
  { id: 'chat', label: 'Chat Interno', icon: MessageCircle, adminOnly: false },
  { id: 'upload', label: 'Upload', icon: FileUp, adminOnly: false },
] as const;

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  const [activeView, setActiveView] = useState<ViewType>('painel');
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
    let parsed: any = {};
    
    if (typeof perms === 'string' && perms.trim()) {
      try {
        parsed = JSON.parse(perms);
      } catch (e) {
        console.error('Erro ao parsear permissões do usuário');
      }
    } else if (perms && typeof perms === 'object') {
      parsed = perms;
    }

    // Papel do usuário
    const role = user.role || user['PAPEL'] || 'User';
    const isAdmin = role === 'Admin';

    // Se o objeto estiver vazio, assume padrão
    const hasKeys = parsed && Object.keys(parsed).length > 0;

    // Criar objeto completo de permissões com compatibilidade reversa (backward compatibility fallback)
    const baseCadastro = parsed.cadastro === true || (!hasKeys && isAdmin);

    return {
      painel: parsed.painel !== false,
      cadastro: parsed.cadastro !== undefined ? parsed.cadastro === true : baseCadastro,
      almx: parsed.almx !== undefined ? parsed.almx === true : baseCadastro,
      cadastroEntrega: parsed.cadastroEntrega !== undefined ? parsed.cadastroEntrega === true : baseCadastro,
      entregaDublagem: parsed.entregaDublagem !== undefined ? parsed.entregaDublagem === true : baseCadastro,
      disponivelCentral: parsed.disponivelCentral !== undefined ? parsed.disponivelCentral === true : baseCadastro,
      historico: parsed.historico !== undefined ? parsed.historico === true : true,
      producao: parsed.producao !== false,
      programacaoPCP: parsed.programacaoPCP !== false,
      followup: parsed.followup !== false,
      chat: parsed.chat !== false,
      config: parsed.config !== undefined ? parsed.config === true : isAdmin,
      config_acesso: parsed.config_acesso !== undefined ? parsed.config_acesso === true : isAdmin,
      config_perfil: parsed.config_perfil !== undefined ? parsed.config_perfil === true : true,
      config_chat: parsed.config_chat !== undefined ? parsed.config_chat === true : true,
      config_upload: parsed.config_upload !== undefined ? parsed.config_upload === true : true,
      almox_m2: parsed.almox_m2 !== false,
      almox_aviamento: parsed.almox_aviamento !== false
    };
  }, [user]);

  // Redireciona para o Painel caso o usuário tente acessar uma tela sem permissão
  useEffect(() => {
    if (isAuthenticated && permissions && activeView !== 'painel') {
      const currentMenuItem = menuItems.find(item => item.id === activeView);
      if (currentMenuItem) {
        const hasPermission = currentMenuItem.perm === 'producao' || currentMenuItem.perm === 'programacaoPCP' 
          ? (permissions as any)[currentMenuItem.perm] !== false 
          : (permissions as any)[currentMenuItem.perm] === true;
        
        if (!hasPermission) {
          console.warn(`[SEGURANÇA] Usuário sem permissão para acessar a tela [${activeView}]. Redirecionando para Painel (Status).`);
          setActiveView('painel');
        }
      } else {
        const currentConfigItem = configItems.find(item => item.id === activeView);
        if (currentConfigItem) {
          const hasConfigPerm = (permissions as any).config === true;
          const isUserAdmin = user?.role === 'Admin' || user?.['PAPEL'] === 'Admin';
          const hasAdminPerm = !currentConfigItem.adminOnly || isUserAdmin;

          let subPermKey = '';
          if (currentConfigItem.id === 'config_acesso') subPermKey = 'config_acesso';
          else if (currentConfigItem.id === 'config_perfil') subPermKey = 'config_perfil';
          else if (currentConfigItem.id === 'chat') subPermKey = 'config_chat';
          else if (currentConfigItem.id === 'upload') subPermKey = 'config_upload';

          let defaultVal = true;
          if (subPermKey === 'config_acesso') {
            defaultVal = isUserAdmin;
          }

          const hasSpecificPerm = (permissions as any)[subPermKey] !== undefined
            ? (permissions as any)[subPermKey] === true
            : defaultVal;

          if (!hasConfigPerm || !hasAdminPerm || !hasSpecificPerm) {
            console.warn(`[SEGURANÇA] Usuário sem permissão para acessar a tela de configuração [${activeView}]. Redirecionando para Painel (Status).`);
            setActiveView('painel');
          }
        }
      }
    }
  }, [activeView, permissions, isAuthenticated, user]);

  const handleLogout = () => {
    localStorage.removeItem('pcp_user');
    setUser(null);
    setIsAuthenticated(false);
  };

  const handleLoginSuccess = async () => {
    const storedUser = localStorage.getItem('pcp_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      let mergedUser = parsedUser;

      try {
        const allUsers = await api.post('getUsers');
        if (Array.isArray(allUsers)) {
          const currentUserEmail = parsedUser.email || parsedUser['E-MAIL'];
          const matchedUser = allUsers.find((u: any) => (u.email || u['E-MAIL']) === currentUserEmail);
          if (matchedUser) {
            mergedUser = { ...parsedUser, ...matchedUser };
            localStorage.setItem('pcp_user', JSON.stringify(mergedUser));
          }
        }
      } catch (err) {
        console.warn('[LOGIN] Não foi possível carregar dados completos do usuário:', err);
      }

      setUser(mergedUser);

      // Pré-carregamento de dados pós-login bem-sucedido (Prefetch)
      const prefetchPostLogin = async () => {
        try {
          await Promise.all([
            api.post('getPainelData').then(d => dataCache.set('painelData', d)),
            api.post('getWipData').then(d => dataCache.set('wipData', d)),
            api.post('getParametros').then(d => dataCache.set('parametros', d)),
            api.post('getMateriasData').then(d => dataCache.set('materiasData', d)),
            api.post('getAwbData').then(d => dataCache.set('awbData', d))
          ]);
          console.log('[PERFORMANCE] Cache pós-login aquecido com sucesso!');
        } catch (e) {
          console.warn('[PERFORMANCE] Falha no prefetch pós-login:', e);
        }
      };
      prefetchPostLogin();
      
      // Define a primeira visualização disponível baseada nas permissões
      const perms = mergedUser['Permissões de Tela (Módulos)'] || mergedUser.permissions;
      let pObj = perms;
      if (typeof perms === 'string') try { pObj = JSON.parse(perms); } catch(e) {}
      
      if (pObj) {
        const firstView = menuItems.find(item => {
          if (item.perm === 'producao' || item.perm === 'programacaoPCP') {
            return pObj[item.perm] !== false;
          }
          return pObj[item.perm] === true;
        })?.id;
        if (firstView) {
          setActiveView(firstView as any);
        } else {
          setActiveView('painel');
        }
      } else {
        setActiveView('painel');
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
                    api.post('getParametros').then(d => dataCache.set('parametros', d)),
                    api.post('getMateriasData').then(d => dataCache.set('materiasData', d)),
                    api.post('getAwbData').then(d => dataCache.set('awbData', d))
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
        return (permissions as any)[item.perm] !== false;
      }
      return (permissions as any)[item.perm] === true;
    });
  }, [permissions]);

  // Grupos e categorias para o Sidebar
  const groupReposicao = useMemo(() => ['painel', 'cadastro', 'almox', 'cadastroEntrega', 'entregaDublagem', 'disponivelCentral', 'historico'], []);
  const groupCorte = useMemo(() => ['producao', 'programacaoPCP'], []);
  const groupCompras = useMemo(() => ['followup'], []);
  const groupConfig = useMemo(() => ['config_acesso', 'config_perfil', 'chat', 'upload'], []);

  const [expandedGroups, setExpandedGroups] = useState({
    reposicao: true,
    corte: true,
    compras: true,
    config: true
  });

  const permittedReposicao = useMemo(() => {
    return filteredMenuItems.filter(item => groupReposicao.includes(item.id));
  }, [filteredMenuItems, groupReposicao]);

  const permittedCorte = useMemo(() => {
    return filteredMenuItems.filter(item => groupCorte.includes(item.id));
  }, [filteredMenuItems, groupCorte]);

  const permittedCompras = useMemo(() => {
    return filteredMenuItems.filter(item => groupCompras.includes(item.id));
  }, [filteredMenuItems, groupCompras]);

  const isAdmin = user?.role === 'Admin' || user?.['PAPEL'] === 'Admin';
  const permittedConfig = useMemo(() => {
    if (!permissions || (permissions as any).config !== true) return [];
    return configItems.filter(item => {
      let permKey = '';
      if (item.id === 'config_acesso') permKey = 'config_acesso';
      else if (item.id === 'config_perfil') permKey = 'config_perfil';
      else if (item.id === 'chat') permKey = 'config_chat';
      else if (item.id === 'upload') permKey = 'config_upload';

      // Default fallback if undefined:
      let defaultVal = true;
      if (permKey === 'config_acesso') {
        defaultVal = isAdmin;
      }
      
      const hasPerm = (permissions as any)[permKey] !== undefined 
        ? (permissions as any)[permKey] === true 
        : defaultVal;
      
      return hasPerm && (!item.adminOnly || isAdmin);
    });
  }, [isAdmin, permissions]);

  useEffect(() => {
    if (groupReposicao.includes(activeView)) {
      setExpandedGroups(prev => ({ ...prev, reposicao: true }));
    } else if (groupCorte.includes(activeView)) {
      setExpandedGroups(prev => ({ ...prev, corte: true }));
    } else if (groupCompras.includes(activeView)) {
      setExpandedGroups(prev => ({ ...prev, compras: true }));
    } else if (groupConfig.includes(activeView)) {
      setExpandedGroups(prev => ({ ...prev, config: true }));
    }
  }, [activeView, groupReposicao, groupCorte, groupCompras, groupConfig]);

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
          <p className="text-white font-bold text-lg tracking-widest">PCP</p>
          <p className="text-gray-400 font-medium animate-pulse text-sm">Sincronizando ambiente e permissões...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login 
        onLogin={() => {
          setAuthSuccessMessage(null);
          handleLoginSuccess();
        }} 
        onGoToRegister={() => {}} 
        successMessage={authSuccessMessage}
      />
    );
  }

  const renderView = () => {
    switch (activeView) {
      case 'painel': return <Painel />;
      case 'cadastro': return <Cadastro />;
      case 'almox': return <Almox />;
      case 'cadastroEntrega': return <CadastroEntrega currentUser={user} />;
      case 'entregaDublagem': return <EntregaDublagem currentUser={user} />;
      case 'disponivelCentral': return <DisponivelCentral currentUser={user} />;
      case 'historico': return <Historico currentUser={user} />;
      case 'producao': return <Producao />;
      case 'programacaoPCP': return <ProgramacaoPCP setHeaderContent={setHeaderContent} />;
      case 'followup': return <FollowUp isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} currentUser={user} />;
      case 'chat': return <Chat />;
      case 'config_acesso': return (
        <Configuracao 
          currentUser={user} 
          activeTab="acesso"
          onUpdateCurrentUser={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('pcp_user', JSON.stringify(updatedUser));
          }} 
        />
      );
      case 'config_perfil': return (
        <Configuracao 
          currentUser={user} 
          activeTab="perfil"
          onUpdateCurrentUser={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('pcp_user', JSON.stringify(updatedUser));
          }} 
        />
      );
      case 'upload': return <UploadScreen currentUser={user} />;
      case 'status_conexao': return <StatusConexao />;
      case 'configuracao': return (
        <Configuracao 
          currentUser={user} 
          onUpdateCurrentUser={(updatedUser) => {
            setUser(updatedUser);
            localStorage.setItem('pcp_user', JSON.stringify(updatedUser));
          }} 
        />
      );
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
        <div className="p-4 flex items-center justify-center border-b border-slate-800 relative">
          <h2 className="text-xl font-bold tracking-wider text-center">PCP</h2>
          <button 
            onClick={() => setIsSidebarOpen(false)} 
            className="absolute right-4 top-1/2 -translate-y-1/2 md:hidden p-1 hover:bg-slate-800 rounded"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-3 overflow-y-auto">
          {/* Grupo 1: Controle de Reposição */}
          {permittedReposicao.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, reposicao: !prev.reposicao }))}
                className="w-full flex items-center justify-between px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Layers size={16} className="text-orange-500 animate-pulse" />
                  <span>Controle de Reposição</span>
                </div>
                {expandedGroups.reposicao ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              <AnimatePresence initial={false}>
                {expandedGroups.reposicao && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {permittedReposicao.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveView(item.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors ${
                            isActive 
                              ? 'bg-slate-800 border-r-4 border-orange-500 font-semibold text-white' 
                              : 'text-white/75 hover:text-white hover:bg-slate-800/55'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Grupo 2: Plano de corte */}
          {permittedCorte.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, corte: !prev.corte }))}
                className="w-full flex items-center justify-between px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Scissors size={16} className="text-orange-500" />
                  <span>Plano de corte</span>
                </div>
                {expandedGroups.corte ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              <AnimatePresence initial={false}>
                {expandedGroups.corte && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {permittedCorte.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveView(item.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors ${
                            isActive 
                              ? 'bg-slate-800 border-r-4 border-orange-500 font-semibold text-white' 
                              : 'text-white/75 hover:text-white hover:bg-slate-800/55'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Grupo 3: Compras */}
          {permittedCompras.length > 0 && (
            <div className="space-y-1">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, compras: !prev.compras }))}
                className="w-full flex items-center justify-between px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ShoppingCart size={16} className="text-orange-500" />
                  <span>Compras</span>
                </div>
                {expandedGroups.compras ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              <AnimatePresence initial={false}>
                {expandedGroups.compras && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {permittedCompras.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveView(item.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors ${
                            isActive 
                              ? 'bg-slate-800 border-r-4 border-orange-500 font-semibold text-white' 
                              : 'text-white/75 hover:text-white hover:bg-slate-800/55'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Grupo 4: Configuração */}
          {permittedConfig.length > 0 && (
            <div className="space-y-1 pt-2 border-t border-slate-800/55">
              <button
                onClick={() => setExpandedGroups(prev => ({ ...prev, config: !prev.config }))}
                className="w-full flex items-center justify-between px-6 py-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800/40 transition-colors duration-150 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Settings size={16} className="text-orange-500" />
                  <span>Configuração</span>
                </div>
                {expandedGroups.config ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </button>
              
              <AnimatePresence initial={false}>
                {expandedGroups.config && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-0.5"
                  >
                    {permittedConfig.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            setActiveView(item.id);
                            if (window.innerWidth < 768) setIsSidebarOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 pl-10 pr-6 py-2 text-sm transition-colors ${
                            isActive 
                              ? 'bg-slate-800 border-r-4 border-orange-500 font-semibold text-white' 
                              : 'text-white/75 hover:text-white hover:bg-slate-800/55'
                          }`}
                        >
                          <Icon size={16} />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

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
                {menuItems.find(m => m.id === activeView)?.label || configItems.find(m => m.id === activeView)?.label}
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
