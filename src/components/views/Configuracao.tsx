'use client';
import React, { useState, useEffect } from 'react';
import { 
  Save, 
  Shield, 
  UserPlus, 
  X, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  User, 
  Mail, 
  KeyRound, 
  Check, 
  MessageCircle,
  Lock,
  BadgeCheck,
  MoreVertical,
  Edit2,
  UserCheck,
  UserX,
  Settings,
  Plane,
  Box,
  Activity,
  Plus,
  FileUp,
  Wifi,
  WifiOff,
  RefreshCw,
  Radio,
  Server,
  Clock,
  History,
  Globe,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import Chat from './Chat';
import UploadScreen from '../UploadScreen';

const ToggleSwitch = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        checked ? 'bg-blue-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
};

const MODULES = [
  { key: 'painel', label: 'Painel' },
  { key: 'cadastro', label: 'Cadastro' },
  { key: 'almx', label: 'Almox' },
  { key: 'cadastroEntrega', label: 'Ent. Almox' },
  { key: 'entregaDublagem', label: 'Ent. Dublagem' },
  { key: 'disponivelCentral', label: 'Disp. Central' },
  { key: 'producao', label: 'Produção' },
  { key: 'programacaoPCP', label: 'Prog. PCP' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'chat', label: 'Chat' },
  { key: 'config', label: 'Configuração' },
 ] as const;

interface ConfiguracaoProps {
  currentUser?: any;
  onUpdateCurrentUser?: (user: any) => void;
  activeTab?: 'acesso' | 'perfil' | 'chat_upload' | 'conexao';
}

export default function Configuracao({ 
  currentUser, 
  onUpdateCurrentUser,
  activeTab: forcedActiveTab
}: ConfiguracaoProps) {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.['PAPEL'] === 'Admin';
  const [activeTab, setActiveTab] = useState<'acesso' | 'perfil' | 'chat_upload' | 'conexao'>(
    forcedActiveTab || (isAdmin ? 'acesso' : 'perfil')
  );
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'upload'>('chat');

  useEffect(() => {
    if (forcedActiveTab) {
      setActiveTab(forcedActiveTab);
    }
  }, [forcedActiveTab]);
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', role: 'Operador', email: '', password: '' });
  const [savingId, setSavingId] = useState<number | null>(null);

  // States for Connection status
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionLatency, setConnectionLatency] = useState<number | null>(null);
  const [apiConnectionStatus, setApiConnectionStatus] = useState<'checking' | 'online' | 'offline' | 'error'>('checking');
  const [connectionHistory, setConnectionHistory] = useState<Array<{
    timestamp: string;
    latency: number;
    status: 'online' | 'offline' | 'slow';
    message: string;
  }>>([]);

  const runPingTest = async () => {
    if (isTestingConnection) return;
    setIsTestingConnection(true);
    setApiConnectionStatus('checking');

    const startTime = Date.now();
    try {
      const result = await api.post('getParametros', {});
      const endTime = Date.now();
      const currentLatency = endTime - startTime;

      setConnectionLatency(currentLatency);
      
      let status: 'online' | 'slow' = 'online';
      let msg = 'Conexão excelente com a API';

      if (currentLatency > 1500) {
        status = 'slow';
        msg = 'Conexão lenta detectada';
        setApiConnectionStatus('online');
      } else {
        setApiConnectionStatus('online');
      }

      const newTest = {
        timestamp: new Date().toLocaleTimeString(),
        latency: currentLatency,
        status,
        message: msg
      };

      setConnectionHistory(prev => [newTest, ...prev.slice(0, 9)]);
    } catch (error: any) {
      console.error('Connection test failed:', error);
      setApiConnectionStatus('offline');
      setConnectionLatency(null);

      const newTest = {
        timestamp: new Date().toLocaleTimeString(),
        latency: 0,
        status: 'offline' as const,
        message: error.message || 'Erro de conexão com o servidor'
      };
      setConnectionHistory(prev => [newTest, ...prev.slice(0, 9)]);
    } finally {
      setIsTestingConnection(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Run first ping check
    runPingTest();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [openMenuId, setOpenMenuId] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // States for Follow-up Sub-permissions Modal
  const [selectedSubPermUser, setSelectedSubPermUser] = useState<any | null>(null);
  const [activeSubPermModule, setActiveSubPermModule] = useState<'followup' | 'config' | 'cadastroEntrega' | null>(null);
  const [subPermsForm, setSubPermsForm] = useState<any>(null);

  useEffect(() => {
    if (selectedSubPermUser) {
      setSubPermsForm({ ...(selectedSubPermUser.permissions || {}) });
    } else {
      setSubPermsForm(null);
      setActiveSubPermModule(null);
    }
  }, [selectedSubPermUser]);

  const handleToggleFormSubPerm = (key: string) => {
    setSubPermsForm((prev: any) => {
      if (!prev) return prev;
      
      const updated = {
        ...prev,
        [key]: !prev[key]
      };
      
      // Se desativar o followup_awb, desliga as sub-permissões dele também para consistência visual
      if (key === 'followup_awb' && !updated[key]) {
        updated.followup_awb_novo = false;
        updated.followup_awb_acoes = false;
        updated.followup_awb_anexar = false;
      }
      
      // Se ativar o followup_awb e as sub-permissões estavam todas desligadas, liga-as como padrão
      if (key === 'followup_awb' && updated[key]) {
        if (!updated.followup_awb_novo && !updated.followup_awb_acoes && !updated.followup_awb_anexar) {
          updated.followup_awb_novo = true;
          updated.followup_awb_acoes = true;
          updated.followup_awb_anexar = true;
        }
      }

      return updated;
    });
  };

  const handleSaveSubPerms = async () => {
    if (!selectedSubPermUser || !subPermsForm) return;
    const userId = selectedSubPermUser.id || selectedSubPermUser['ID'];
    
    // Atualiza localmente a lista de usuários com as novas permissões consolidadas
    const updatedUsers = users.map(u => {
      const currentId = u.id || u['ID'] || u.ID;
      if (String(currentId) === String(userId)) {
        return {
          ...u,
          permissions: {
            ...u.permissions,
            ...subPermsForm
          }
        };
      }
      return u;
    });
    setUsers(updatedUsers);
    
    // Salva no banco de dados via API
    const userToSave = updatedUsers.find(u => String(u.id || u['ID'] || u.ID) === String(userId));
    if (userToSave) {
      setSavingId(userId);
      try {
        const dataToSave = { 
          ...userToSave, 
          ID: userId,
          'Permissões de Tela (Módulos)': JSON.stringify(userToSave.permissions)
        };
        await api.post('updateUser', dataToSave);
        dataCache.invalidate('allUsers');
        alert('Sub-permissões salvas com sucesso no banco de dados!');
      } catch (err: any) {
        console.error('Erro ao salvar sub-permissões do usuário no banco:', err);
        alert('Erro ao salvar sub-permissões no banco de dados: ' + (err.message || err));
      } finally {
        setSavingId(null);
      }
    } else {
      alert('Erro interno: Usuário não encontrado para salvar.');
    }
    
    setSelectedSubPermUser(null);
    setActiveSubPermModule(null);
  };

  // Profile Form States
  const [profileName, setProfileName] = useState(currentUser?.nome || currentUser?.USUÁRIO || currentUser?.name || '');
  const [profileEmail, setProfileEmail] = useState(currentUser?.email || currentUser?.['E-MAIL'] || '');
  const [profilePassword, setProfilePassword] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Sync profile values if currentUser changes (e.g. on load)
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.nome || currentUser.USUÁRIO || currentUser.name || '');
      setProfileEmail(currentUser.email || currentUser['E-MAIL'] || '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Usa cache de 30s para a lista de usuários na configuração
      const data = await dataCache.get('allUsers', () => api.post('getUsers'), 30000);
      // Processar os dados para garantir que as permissões sejam um objeto
      const processedUsers = (data || []).map((u: any) => {
        const role = u.role || u['PAPEL'] || 'User';
        const isAdminUser = role === 'Admin';
        
        let permissions = {
          painel: true,
          cadastro: isAdminUser,
          almx: isAdminUser,
          cadastroEntrega: isAdminUser,
          entregaDublagem: isAdminUser,
          disponivelCentral: isAdminUser,
          producao: true,
          programacaoPCP: true,
          followup: true,
          chat: true,
          config: isAdminUser,
          followup_solicitacoes: true,
          followup_materias: true,
          followup_awb: true,
          followup_awb_novo: true,
          followup_awb_acoes: true,
          followup_awb_anexar: true,
          config_acesso: isAdminUser,
          config_perfil: true,
          config_chat: true,
          config_upload: true,
          almox_m2: true,
          almox_aviamento: true
        };
        
        // Tentar buscar da coluna da planilha
        const rawPermissions = u['Permissões de Tela (Módulos)'];
        if (rawPermissions) {
          try {
            const parsed = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions) : rawPermissions;
            const hasKeys = parsed && Object.keys(parsed).length > 0;
            const baseCadastro = parsed.cadastro === true || (!hasKeys && isAdminUser);
            
            permissions = {
              painel: parsed.painel !== false,
              cadastro: parsed.cadastro !== undefined ? parsed.cadastro === true : baseCadastro,
              almx: parsed.almx !== undefined ? parsed.almx === true : baseCadastro,
              cadastroEntrega: parsed.cadastroEntrega !== undefined ? parsed.cadastroEntrega === true : baseCadastro,
              entregaDublagem: parsed.entregaDublagem !== undefined ? parsed.entregaDublagem === true : baseCadastro,
              disponivelCentral: parsed.disponivelCentral !== undefined ? parsed.disponivelCentral === true : baseCadastro,
              producao: parsed.producao !== false,
              programacaoPCP: parsed.programacaoPCP !== false,
              followup: parsed.followup !== false,
              chat: parsed.chat !== false,
              config: parsed.config !== undefined ? parsed.config === true : isAdminUser,
              followup_solicitacoes: parsed.followup_solicitacoes !== false,
              followup_materias: parsed.followup_materias !== false,
              followup_awb: parsed.followup_awb !== false,
              followup_awb_novo: parsed.followup_awb_novo !== false,
              followup_awb_acoes: parsed.followup_awb_acoes !== false,
              followup_awb_anexar: parsed.followup_awb_anexar !== false,
              config_acesso: parsed.config_acesso !== undefined ? parsed.config_acesso === true : isAdminUser,
              config_perfil: parsed.config_perfil !== undefined ? parsed.config_perfil === true : true,
              config_chat: parsed.config_chat !== undefined ? parsed.config_chat === true : true,
              config_upload: parsed.config_upload !== undefined ? parsed.config_upload === true : true,
              almox_m2: parsed.almox_m2 !== false,
              almox_aviamento: parsed.almox_aviamento !== false
            };
          } catch (e) {
            console.warn('Erro ao parsear permissões para o usuário', u['USUÁRIO']);
          }
        }

        return { ...u, permissions };
      });
      setUsers(processedUsers);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (userId: any, module: string) => {
    setUsers(users.map(u => {
      const currentId = u.id || u['ID'];
      if (String(currentId) === String(userId)) {
        const currentlyHas = u.permissions[module as keyof typeof u.permissions] || false;
        const updatedPermissions = { 
          ...u.permissions, 
          [module]: !currentlyHas
        };

        // If enabling config and sub-permissions are completely missing, populate them for convenience:
        if (module === 'config' && !currentlyHas) {
          const isUserAdmin = u.role === 'Admin' || u['PAPEL'] === 'Admin';
          if (updatedPermissions.config_acesso === undefined) {
            updatedPermissions.config_acesso = isUserAdmin;
          }
          if (updatedPermissions.config_perfil === undefined) {
            updatedPermissions.config_perfil = true;
          }
          if (updatedPermissions.config_chat === undefined) {
            updatedPermissions.config_chat = true;
          }
          if (updatedPermissions.config_upload === undefined) {
            updatedPermissions.config_upload = true;
          }
        }

        // If enabling cadastroEntrega and sub-permissions are completely missing, populate them for convenience:
        if (module === 'cadastroEntrega' && !currentlyHas) {
          if (updatedPermissions.almox_m2 === undefined) {
            updatedPermissions.almox_m2 = true;
          }
          if (updatedPermissions.almox_aviamento === undefined) {
            updatedPermissions.almox_aviamento = true;
          }
        }

        return { ...u, permissions: updatedPermissions };
      }
      return u;
    }));
  };

  const toggleStatus = async (userId: any) => {
    const userToUpdate = users.find(u => String(u.id || u['ID']) === String(userId));
    if (!userToUpdate) return;

    const currentStatus = userToUpdate.status || userToUpdate['STATUS'] || 'ativo';
    const newStatus = currentStatus.toLowerCase() === 'ativo' ? 'inativo' : 'ativo';
    
    // Atualiza localmente primeiro para resposta rápida na interface
    const updatedUser = { 
      ...userToUpdate, 
      status: newStatus, 
      'STATUS': newStatus 
    };

    setUsers(users.map(u => {
      const currentId = u.id || u['ID'];
      if (String(currentId) === String(userId)) {
        return updatedUser;
      }
      return u;
    }));

    setSavingId(userId);
    try {
      const dataToSave = {
        ...updatedUser,
        ID: userId,
        'Permissões de Tela (Módulos)': JSON.stringify(updatedUser.permissions || {})
      };
      await api.post('updateUser', dataToSave);
      dataCache.invalidate('allUsers');
      console.log('[DEBUG] Status do usuário salvo com sucesso no banco de dados:', newStatus);
      alert('Status do usuário atualizado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar status do usuário no banco:', error);
      alert('Erro ao atualizar status do usuário no banco: ' + (error.message || error));
      // Reverte o estado local em caso de falha na API
      setUsers(users.map(u => {
        const currentId = u.id || u['ID'];
        if (String(currentId) === String(userId)) {
          return userToUpdate;
        }
        return u;
      }));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveUser = async (userId: any) => {
    const user = users.find(u => String(u.id || u.ID || u['ID']) === String(userId));
    if (!user) {
      alert('Erro: Usuário não encontrado para salvar.');
      return;
    }

    setSavingId(userId);
    try {
      // Preparamos os dados para salvar, incluindo a stringificação das permissões
      // para a coluna correta da planilha
      const dataToSave = { 
        ...user, 
        ID: userId,
        'Permissões de Tela (Módulos)': JSON.stringify(user.permissions)
      };
      
      await api.post('updateUser', dataToSave);
      
      // Invalida o cache para que as mudanças sejam refletidas em todo o sistema
      dataCache.invalidate('allUsers');
      console.log('[DEBUG] Cache allUsers invalidado após atualização de usuário');
      alert('Alterações de permissões salvas com sucesso no banco de dados!');
    } catch (error: any) {
      console.error('Erro ao salvar usuário:', error);
      alert('Erro ao salvar alterações no banco de dados: ' + (error.message || error));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;
    
    try {
      if (editingUser) {
        // Editar usuário existente
        const updatedUser: any = {
          ...editingUser,
          'USUÁRIO': newUser.name,
          'E-MAIL': newUser.email,
          'PAPEL': newUser.role,
          nome: newUser.name,
          email: newUser.email,
          role: newUser.role,
          name: newUser.name,
          ID: editingUser.id || editingUser.ID,
          id: editingUser.id || editingUser.ID
        };

        const passStr = String(newUser.password || '').trim();
        if (passStr !== '') {
          updatedUser['SENHA'] = passStr;
          updatedUser['password'] = passStr;
        }

        await api.post('updateUser', updatedUser);
        dataCache.invalidate('allUsers');
        
        // Atualizar localmente
        setUsers(users.map(u => {
          const currentId = u.id || u['ID'];
          const editId = editingUser.id || editingUser['ID'];
          if (currentId === editId) {
            return { ...u, ...updatedUser };
          }
          return u;
        }));
        setEditingUser(null);
      } else {
        // Adicionar novo usuário
        const addedUser = await api.post('addUser', newUser);
        dataCache.invalidate('allUsers');
        
        // Setup de permissões default para o novo usuário
        const addedWithPerms = {
          ...addedUser,
          permissions: {
            painel: true,
            cadastro: newUser.role === 'Admin',
            almx: newUser.role === 'Admin',
            cadastroEntrega: newUser.role === 'Admin',
            entregaDublagem: newUser.role === 'Admin',
            disponivelCentral: newUser.role === 'Admin',
            producao: true,
            programacaoPCP: true,
            followup: true,
            chat: true,
            config: newUser.role === 'Admin',
            followup_solicitacoes: true,
            followup_materias: true,
            followup_awb: true,
            followup_awb_novo: true,
            followup_awb_acoes: true,
            followup_awb_anexar: true,
            config_acesso: newUser.role === 'Admin',
            config_perfil: true,
            config_chat: true,
            config_upload: true,
            almox_m2: true,
            almox_aviamento: true
          }
        };
        setUsers([...users, addedWithPerms]);
      }
      
      setNewUser({ name: '', role: 'Operador', email: '', password: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName || !profileEmail) {
      setProfileError('Nome e E-mail são obrigatórios.');
      return;
    }
    
    setIsSavingProfile(true);
    setProfileSuccess(false);
    setProfileError(null);

    try {
      const updatedUser = {
        ...currentUser,
        ID: currentUser?.ID || currentUser?.id,
        'USUÁRIO': profileName,
        'E-MAIL': profileEmail,
        'SENHA': profilePassword || currentUser?.['SENHA'] || currentUser?.password || '123456',
        nome: profileName,
        email: profileEmail,
        name: profileName
      };

      await api.post('updateUser', updatedUser);
      
      // Invalidate cache and update state
      dataCache.invalidate('allUsers');
      if (onUpdateCurrentUser) {
        onUpdateCurrentUser(updatedUser);
      }
      
      setProfileSuccess(true);
      setProfilePassword(''); // Reset password input after save
    } catch (error: any) {
      setProfileError(error.message || 'Erro ao atualizar perfil.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="p-6 min-h-screen bg-gray-50 flex flex-col w-full">
      <div className="w-full flex-1 flex flex-col">
        {/* Header Title & Subtitle */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              {forcedActiveTab ? (
                activeTab === 'acesso' ? 'Controle de Acesso' : 'Perfil de Usuários'
              ) : (
                'Configurações do Sistema'
              )}
            </h1>
            <p className="text-sm text-gray-500">
              {forcedActiveTab ? (
                activeTab === 'acesso' 
                  ? 'Gerencie as permissões e níveis de acesso de cada usuário.' 
                  : 'Atualize seus dados pessoais e altere sua senha de acesso.'
              ) : (
                'Gerencie suas informações de perfil, acesso e converse com a equipe.'
              )}
            </p>
          </div>
          
          {activeTab === 'acesso' && isAdmin && (
            <button 
              onClick={() => {
                setEditingUser(null);
                setNewUser({ name: '', email: '', role: 'Operador', password: '' });
                setIsModalOpen(true);
              }}
              className="bg-blue-600 text-white px-4.5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-blue-700 transition-all duration-150 shadow-md font-semibold text-sm self-start md:self-auto cursor-pointer"
            >
              <UserPlus size={18} />
              Novo Usuário
            </button>
          )}
        </div>

        {/* Tab Navigator */}
        {!forcedActiveTab && (
          <div className="flex border-b border-gray-200 mb-6 overflow-x-auto whitespace-nowrap scrollbar-none">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('acesso')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${
                  activeTab === 'acesso'
                    ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
                }`}
              >
                <Shield size={16} />
                Controle de Acesso
              </button>
            )}
            <button
              onClick={() => setActiveTab('perfil')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'perfil'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
              }`}
            >
              <User size={16} />
              Perfil de usuários
            </button>
            <button
              onClick={() => setActiveTab('chat_upload')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'chat_upload'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
              }`}
            >
              <MessageCircle size={16} />
              Chat Interno e upload
            </button>
            <button
              onClick={() => setActiveTab('conexao')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${
                activeTab === 'conexao'
                  ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
              }`}
            >
              <Radio size={16} className="text-orange-500 animate-pulse" />
              Verificar Conexão
            </button>
          </div>
        )}

        {/* Tabs Panels Container */}
        <div className="flex-1">
          {/* TAB 1: CONTROLE DE ACESSO */}
          {activeTab === 'acesso' && isAdmin && (
            <div className="space-y-4">
              {/* Mini Connection Status Widget */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4.5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                    <Radio size={20} className={isTestingConnection ? "animate-pulse text-orange-500" : "text-blue-600"} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800">Conexão com a Base de Dados (Google Sheets)</h3>
                    <p className="text-xs text-gray-500 flex flex-wrap items-center gap-2 mt-1 font-medium">
                      <span>Status de Rede:</span>
                      <span className={`inline-flex items-center gap-1 font-bold ${isOnline ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {isOnline ? 'Online' : 'Desconectado'}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span>Status do Servidor:</span>
                      <span className={`font-bold ${apiConnectionStatus === 'online' ? 'text-emerald-600' : apiConnectionStatus === 'checking' ? 'text-amber-500' : 'text-rose-600'}`}>
                        {apiConnectionStatus === 'online' ? 'Operacional' : apiConnectionStatus === 'checking' ? 'Verificando...' : 'Sem Resposta'}
                      </span>
                      {connectionLatency !== null && (
                        <>
                          <span className="text-gray-300">|</span>
                          <span>Latência:</span>
                          <span className="font-extrabold text-gray-700">{connectionLatency}ms</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={runPingTest}
                  disabled={isTestingConnection}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold border border-gray-200 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={13} className={isTestingConnection ? "animate-spin" : ""} />
                  {isTestingConnection ? 'Verificando...' : 'Testar Conexão'}
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <Loader2 className="animate-spin text-blue-600" size={40} />
                  <p className="text-gray-500 font-medium">Carregando usuários...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[1200px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-xs font-semibold uppercase tracking-wider">
                        <th className="p-4">Usuário</th>
                        <th className="p-4">Função</th>
                        {MODULES.map(m => (
                          <th key={m.key} className="p-2 text-center font-semibold text-[11px] min-w-[80px] whitespace-nowrap">
                            {m.label}
                          </th>
                        ))}
                        <th className="p-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => {
                        const userName = user.name || user['USUÁRIO'] || user['Usuário'] || 'Sem Nome';
                        const userEmail = user.email || user['E-MAIL'] || user['E-mail'] || 'Sem E-mail';
                        const userRole = user.role || user['PAPEL'] || user['Papel'] || 'User';
                        const userStatus = user.status || user['STATUS'] || user['Status'] || 'Ativo';
                        const userId = user.id || user['ID'] || Math.random();
                        const isInactive = userStatus.toLowerCase() === 'inativo';

                        return (
                          <tr 
                            key={userId} 
                            className={`border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${
                              openMenuId === userId ? 'z-30 relative' : ''
                            }`}
                          >
                            <td className="p-4">
                              <div className={`flex items-center gap-3 transition-opacity duration-150 ${isInactive ? 'opacity-50' : ''}`}>
                                <div className="relative flex-shrink-0">
                                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm uppercase ${isInactive ? 'bg-gray-400 grayscale' : 'bg-gradient-to-tr from-blue-600 to-sky-500'}`}>
                                    {userName.substring(0, 2)}
                                  </div>
                                  <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white flex-shrink-0 ${isInactive ? 'bg-gray-400' : 'bg-green-500'}`}></div>
                                </div>
                                <div className="truncate max-w-[180px]">
                                  <span className={`block font-semibold text-sm truncate ${isInactive ? 'text-gray-500 line-through' : 'text-gray-950'}`} title={userName}>
                                    {userName} {isInactive && <span className="text-[10px] font-bold text-red-500 line-through-none no-underline ml-1">(Inativo)</span>}
                                  </span>
                                  <span className="block text-xs text-gray-500 font-medium truncate mt-0.5" title={userEmail}>{userEmail}</span>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-gray-600">
                              <div className={`transition-opacity duration-150 ${isInactive ? 'opacity-50' : ''}`}>
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isInactive ? 'bg-gray-200 text-gray-500 border border-gray-300' : userRole === 'Admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {userRole}
                                </span>
                              </div>
                            </td>
                            {MODULES.map(m => {
                              const permissions = user.permissions || {};
                              const hasPermission = permissions[m.key as keyof typeof permissions] || false;
                              return (
                                <td key={m.key} className="p-2 text-center">
                                  <div className={`flex flex-col items-center justify-center gap-1 transition-opacity duration-150 ${isInactive ? 'opacity-50' : ''}`}>
                                    <ToggleSwitch 
                                      checked={hasPermission}
                                      onChange={() => togglePermission(userId, m.key)}
                                      disabled={isInactive}
                                    />
                                    {m.key === 'followup' && hasPermission && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSubPermUser(user);
                                          setActiveSubPermModule('followup');
                                        }}
                                        className="mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 text-slate-600 flex items-center gap-1 cursor-pointer transition-colors font-medium shadow-sm"
                                        title="Configurar sub-permissões"
                                        disabled={isInactive}
                                      >
                                        <Settings size={10} className="text-orange-500 animate-spin-slow" />
                                        <span>Acesso</span>
                                      </button>
                                    )}
                                    {m.key === 'cadastroEntrega' && hasPermission && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSubPermUser(user);
                                          setActiveSubPermModule('cadastroEntrega');
                                        }}
                                        className="mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 text-slate-600 flex items-center gap-1 cursor-pointer transition-colors font-medium shadow-sm"
                                        title="Configurar sub-permissões"
                                        disabled={isInactive}
                                      >
                                        <Settings size={10} className="text-orange-500 animate-spin-slow" />
                                        <span>Acesso</span>
                                      </button>
                                    )}
                                    {m.key === 'config' && hasPermission && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedSubPermUser(user);
                                          setActiveSubPermModule('config');
                                        }}
                                        className="mt-1 px-1.5 py-0.5 rounded text-[10px] bg-slate-100 hover:bg-orange-50 hover:text-orange-600 border border-slate-200 text-slate-600 flex items-center gap-1 cursor-pointer transition-colors font-medium shadow-sm"
                                        title="Configurar sub-permissões"
                                        disabled={isInactive}
                                      >
                                        <Settings size={10} className="text-orange-500 animate-spin-slow" />
                                        <span>Acesso</span>
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                            <td className={`p-4 text-center relative ${openMenuId === userId ? 'z-50' : 'z-10'}`}>
                              <div className="flex items-center justify-center">
                                <button 
                                  onClick={() => setOpenMenuId(openMenuId === userId ? null : userId)}
                                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                                  title="Ações"
                                >
                                  <MoreVertical size={18} />
                                </button>
                              </div>

                              {/* Dropdown Menu Popup */}
                              {openMenuId === userId && (
                                <>
                                  {/* Invisible backdrop to capture clicks outside */}
                                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                                  
                                  <div className="absolute right-4 top-12 w-44 rounded-xl bg-white border border-gray-200 shadow-xl z-50 py-1.5 overflow-hidden text-left animate-in fade-in slide-in-from-top-1 duration-100">
                                    <button
                                      onClick={() => {
                                        setEditingUser(user);
                                        setNewUser({
                                          name: userName,
                                          email: userEmail,
                                          role: userRole,
                                          password: String(user.password || user['SENHA'] || '')
                                        });
                                        setIsModalOpen(true);
                                        setOpenMenuId(null);
                                      }}
                                      className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer"
                                    >
                                      <Edit2 size={15} className="text-gray-500" />
                                      Editar
                                    </button>

                                    <button
                                      onClick={() => {
                                        toggleStatus(userId);
                                        setOpenMenuId(null);
                                      }}
                                      className={`w-full px-4 py-2.5 text-sm flex items-center gap-2.5 font-medium cursor-pointer ${
                                        isInactive 
                                          ? 'text-green-600 hover:bg-green-50'
                                          : 'text-red-600 hover:bg-red-50'
                                      }`}
                                    >
                                      {isInactive ? (
                                        <>
                                          <UserCheck size={15} className="text-green-500" />
                                          Ativar
                                        </>
                                      ) : (
                                        <>
                                          <UserX size={15} className="text-red-500" />
                                          Inativar
                                        </>
                                      )}
                                    </button>

                                    <div className="border-t border-gray-100 my-1"></div>

                                    <button
                                      onClick={() => {
                                        handleSaveUser(userId);
                                        setOpenMenuId(null);
                                      }}
                                      disabled={savingId === userId}
                                      className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2.5 font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      {savingId === userId ? (
                                        <Loader2 size={15} className="animate-spin text-blue-500" />
                                      ) : (
                                        <Save size={15} className="text-blue-500" />
                                      )}
                                      Salvar
                                    </button>
                                  </div>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
          )}

          {/* TAB 2: PERFIL DE USUÁRIOS */}
          {activeTab === 'perfil' && (() => {
            const userRole = currentUser?.role || currentUser?.['PAPEL'] || currentUser?.Papel || 'Operador';
            
            // Modern, dynamic badges based on roles
            const getRoleStyles = (role: string) => {
              const normalized = String(role || '').trim().toUpperCase();
              if (normalized === 'ADMIN' || normalized === 'ADMINISTRADOR') {
                return {
                  label: 'Administrador',
                  bg: 'bg-red-50 text-red-700 border-red-200/60 bg-gradient-to-tr from-red-50 to-rose-100/40',
                  iconColor: 'text-red-500'
                };
              }
              if (normalized === 'COORDENADOR') {
                return {
                  label: 'Coordenador',
                  bg: 'bg-orange-50 text-orange-800 border-orange-200/60 bg-gradient-to-tr from-orange-50/70 to-amber-100/50',
                  iconColor: 'text-orange-500'
                };
              }
              if (normalized === 'GERENTE') {
                return {
                  label: 'Gerente',
                  bg: 'bg-purple-50 text-purple-800 border-purple-200/60 bg-gradient-to-tr from-purple-50/70 to-indigo-100/50',
                  iconColor: 'text-purple-500'
                };
              }
              if (normalized === 'LIDER' || normalized === 'LÍDER') {
                return {
                  label: 'Líder',
                  bg: 'bg-indigo-50 text-indigo-800 border-indigo-200/60 bg-gradient-to-tr from-indigo-50/70 to-blue-100/50',
                  iconColor: 'text-indigo-500'
                };
              }
              if (normalized === 'ASSISTENTE') {
                return {
                  label: 'Assistente',
                  bg: 'bg-teal-50 text-teal-800 border-teal-200/60 bg-gradient-to-tr from-teal-50/70 to-cyan-100/50',
                  iconColor: 'text-teal-500'
                };
              }
              if (normalized === 'AUXILIAR') {
                return {
                  label: 'Auxiliar',
                  bg: 'bg-slate-100 text-slate-800 border-slate-200 bg-gradient-to-tr from-slate-50 to-slate-100',
                  iconColor: 'text-slate-500'
                };
              }
              // Fallback Operador
              return {
                label: role || 'Operador',
                bg: 'bg-blue-50 text-blue-700 border-blue-200/60 bg-gradient-to-tr from-blue-50 to-sky-100/40',
                iconColor: 'text-blue-500'
              };
            };

            const roleStyle = getRoleStyles(userRole);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                {/* Left Column: Premium Summary Info Card */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-150 overflow-hidden relative">
                  {/* Visual Header Banner - Modern gradient mirroring sidebar accents */}
                  <div className="h-28 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 w-full relative overflow-hidden flex items-center justify-center">
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f97316_1px,transparent_1px)] [background-size:16px_16px]"></div>
                    <div className="absolute top-2 right-4 flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-extrabold text-orange-500 bg-slate-900/65 px-2 py-0.5 rounded border border-slate-800">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      <span>SISTEMA ATIVO</span>
                    </div>
                  </div>

                  {/* Body Content with Overlapping Avatar */}
                  <div className="px-6 pb-8 pt-0 flex flex-col items-center text-center relative">
                    {/* circular avatar overlapping the header */}
                    <div className="relative -mt-14 mb-4">
                      <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-orange-500 to-amber-600 flex items-center justify-center text-white text-4xl font-black shadow-xl border-4 border-white transition-transform duration-300 hover:scale-105">
                        {profileName ? profileName.substring(0, 2).toUpperCase() : 'US'}
                      </div>
                      {/* Floating pulse active badge */}
                      <span className="absolute bottom-1 right-1 flex h-5 w-5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-5 w-5 bg-green-500 border-4 border-white shadow"></span>
                      </span>
                    </div>

                    <h3 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2 justify-center">
                      {profileName}
                      {isAdmin && (
                        <span className="inline-flex items-center justify-center bg-blue-100 text-blue-800 p-0.5 rounded-full" title="Administrador Autorizado">
                          <BadgeCheck className="text-blue-600" size={18} />
                        </span>
                      )}
                    </h3>
                    <p className="text-sm font-semibold text-gray-400 mb-6 flex items-center gap-1.5 justify-center">
                      <Mail size={14} className="text-gray-300" />
                      {profileEmail}
                    </p>
                    
                    {/* Modern Badge styling */}
                    <div className="mb-8">
                      <span className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${roleStyle.bg} shadow-sm`}>
                        {roleStyle.label}
                      </span>
                    </div>

                    {/* Corporate Specs block */}
                    <div className="w-full border-t border-gray-100 pt-6 text-left">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">
                        Informações Corporativas
                      </h4>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <Shield size={16} className={`${roleStyle.iconColor}`} />
                            <span className="text-xs font-bold text-slate-500">Cargo / Função</span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-tight">{roleStyle.label}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <Lock size={16} className="text-slate-400" />
                            <span className="text-xs font-bold text-slate-500">Unidade</span>
                          </div>
                          <span className="text-xs font-extrabold text-slate-700">Grupo Dass</span>
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 border border-gray-100">
                          <div className="flex items-center gap-2.5">
                            <Check size={16} className="text-green-500" />
                            <span className="text-xs font-bold text-slate-500">Status de Acesso</span>
                          </div>
                          <span className="text-xs font-extrabold text-green-600 flex items-center gap-1">
                            Ativo
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Edit Profile Form */}
                <div className="bg-white rounded-2xl shadow-md border border-gray-150 p-6 lg:col-span-2">
                  <div className="border-l-4 border-orange-500 pl-4 mb-6">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
                      <User size={22} className="text-orange-500" />
                      Editar Detalhes do Perfil
                    </h3>
                    <p className="text-xs text-gray-400 mt-1">Atualize seus dados pessoais e modifique sua senha de acesso ao sistema.</p>
                  </div>

                  {profileSuccess && (
                    <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl flex items-center gap-3 shadow-sm animate-fadeIn">
                      <CheckCircle2 className="text-emerald-600 flex-shrink-0 animate-bounce" size={20} />
                      <div>
                        <span className="text-sm font-bold block">Sucesso!</span>
                        <span className="text-xs text-emerald-700">Perfil atualizado com sucesso no banco de dados!</span>
                      </div>
                    </div>
                  )}

                  {profileError && (
                    <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl flex items-center gap-3 shadow-sm">
                      <XCircle className="text-rose-600 flex-shrink-0" size={20} />
                      <div>
                        <span className="text-sm font-bold block">Falha na atualização</span>
                        <span className="text-xs text-rose-700">{profileError}</span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          Nome Completo
                        </label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/30 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-800 text-sm font-semibold transition-all duration-200 hover:border-gray-300"
                          placeholder="Seu nome completo"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail size={14} className="text-gray-400" />
                          E-mail Institucional
                        </label>
                        <input
                          type="email"
                          value={profileEmail}
                          onChange={(e) => setProfileEmail(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/30 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-800 text-sm font-semibold transition-all duration-200 hover:border-gray-300"
                          placeholder="seu.email@grupodass.com.br"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      <label className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                        <KeyRound size={14} className="text-slate-400" />
                        Alterar Senha de Acesso
                      </label>
                      <input
                        type="password"
                        value={profilePassword}
                        onChange={(e) => setProfilePassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none text-slate-800 text-sm font-semibold transition-all duration-200"
                        placeholder="Deixe em branco para manter a senha atual"
                      />
                      <p className="text-[10px] text-gray-400 font-medium pt-1">
                        Dica de segurança: utilize letras maiúsculas, minúsculas e números para uma senha mais segura.
                      </p>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <button
                        type="submit"
                        disabled={isSavingProfile}
                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold px-6 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 hover:-translate-y-0.5 transform disabled:opacity-50 cursor-pointer text-sm"
                      >
                        {isSavingProfile ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Salvando Alterações...</span>
                          </>
                        ) : (
                          <>
                            <Save size={16} />
                            <span>Salvar Configurações</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}

          {/* TAB 3: CHAT INTERNO E UPLOAD */}
          {activeTab === 'chat_upload' && (
            <div className="flex flex-col h-[calc(100vh-210px)] bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex border-b border-gray-200 bg-gray-50/50 p-2 gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('chat')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    activeSubTab === 'chat'
                      ? 'bg-blue-600 text-white shadow-sm font-bold'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <MessageCircle size={14} />
                  Chat Interno
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab('upload')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                    activeSubTab === 'upload'
                      ? 'bg-blue-600 text-white shadow-sm font-bold'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'
                  }`}
                >
                  <FileUp size={14} />
                  Importar Planilhas (Wip042 / Follow MP)
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                {activeSubTab === 'chat' ? (
                  <div className="h-full">
                    <Chat />
                  </div>
                ) : (
                  <UploadScreen currentUser={currentUser} />
                )}
              </div>
            </div>
          )}

          {/* TAB 4: VERIFICAR CONEXÃO */}
          {activeTab === 'conexao' && (
            <div className="space-y-6">
              <div className="border-l-4 border-orange-500 pl-4 mb-2">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-2.5">
                  <Radio className="text-orange-500 animate-pulse" size={24} />
                  Diagnóstico de Conectividade
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Monitore o estado e a latência de sua conexão com os servidores do Google Sheets e Apps Script em tempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Internet Status Card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm hover:border-gray-300 transition-all duration-300">
                  <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none text-gray-400">
                    <Globe size={140} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-gray-50">
                      {isOnline ? (
                        <Wifi className="text-emerald-600" size={24} />
                      ) : (
                        <WifiOff className="text-rose-600" size={24} />
                      )}
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {isOnline ? 'CONECTADO' : 'SEM INTERNET'}
                    </span>
                  </div>

                  <div className="space-y-1 z-10">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Sua Internet</h3>
                    <p className="text-xl font-black text-slate-800 tracking-tight">
                      {isOnline ? 'Navegador Online' : 'Desconectado'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Seu dispositivo possui uma conexão ativa com a internet.
                    </p>
                  </div>
                </div>

                {/* API Server Status Card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm hover:border-gray-300 transition-all duration-300">
                  <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none text-gray-400">
                    <Server size={140} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-gray-50">
                      <Server className={
                        apiConnectionStatus === 'online' ? 'text-emerald-600' :
                        apiConnectionStatus === 'checking' ? 'text-amber-500 animate-spin' : 'text-rose-600'
                      } size={24} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      apiConnectionStatus === 'online' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      apiConnectionStatus === 'checking' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {apiConnectionStatus === 'online' ? 'OPERACIONAL' : apiConnectionStatus === 'checking' ? 'TESTANDO' : 'INDISPONÍVEL'}
                    </span>
                  </div>

                  <div className="space-y-1 z-10">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Banco de Dados</h3>
                    <p className="text-xl font-black text-slate-800 tracking-tight">
                      {apiConnectionStatus === 'online' ? 'Google Sheets' : apiConnectionStatus === 'checking' ? 'Consultando...' : 'Sem Resposta'}
                    </p>
                    <p className="text-xs text-gray-500 truncate" title="API ativa baseada no Google Apps Script">
                      Integridade com Google Apps Script
                    </p>
                  </div>
                </div>

                {/* Latency Card */}
                <div className={`bg-white rounded-2xl border p-6 flex flex-col justify-between h-52 relative overflow-hidden shadow-sm hover:border-gray-300 transition-all duration-300 ${
                  connectionLatency === null ? 'border-gray-200' :
                  connectionLatency < 400 ? 'border-emerald-200 bg-emerald-50/10' :
                  connectionLatency < 1200 ? 'border-amber-200 bg-amber-50/10' : 'border-rose-200 bg-rose-50/10'
                }`}>
                  <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 opacity-5 pointer-events-none text-gray-400">
                    <Clock size={140} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-gray-50">
                      <Clock className={
                        connectionLatency === null ? 'text-gray-400' :
                        connectionLatency < 400 ? 'text-emerald-600' :
                        connectionLatency < 1200 ? 'text-amber-500' : 'text-rose-600'
                      } size={24} />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${
                      connectionLatency === null ? 'bg-gray-50 text-gray-600 border-gray-200' :
                      connectionLatency < 400 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      connectionLatency < 1200 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      LATÊNCIA
                    </span>
                  </div>

                  <div className="space-y-1 z-10">
                    <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest">Tempo de Resposta</h3>
                    <p className={`text-3xl font-black tracking-tight ${
                      connectionLatency === null ? 'text-gray-400' :
                      connectionLatency < 400 ? 'text-emerald-600' :
                      connectionLatency < 1200 ? 'text-amber-500' : 'text-rose-600'
                    }`}>
                      {connectionLatency !== null ? `${connectionLatency}ms` : '--'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {connectionLatency === null ? 'Aguardando teste de conexão' :
                       connectionLatency < 400 ? 'Velocidade excelente para salvar dados.' :
                       connectionLatency < 1200 ? 'Latência moderada. Operações funcionais.' : 'Conexão lenta. Carregamentos podem demorar.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* History Section */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden p-6 shadow-sm">
                <div className="flex items-center gap-2 text-slate-800 font-bold pb-3 border-b border-gray-100 mb-4">
                  <History size={18} className="text-orange-500" />
                  <span className="text-sm">Últimas Verificações nesta Sessão</span>
                </div>

                {connectionHistory.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-3">
                    <Radio size={36} className="text-gray-300 animate-pulse" />
                    <span className="text-xs font-semibold">Nenhum teste de conexão foi registrado nesta sessão.</span>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 font-medium">
                    {connectionHistory.map((test, idx) => (
                      <div key={idx} className="py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors rounded-lg px-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-gray-400">{test.timestamp}</span>
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                            test.status === 'online' ? 'text-emerald-600' :
                            test.status === 'slow' ? 'text-amber-600' : 'text-rose-600'
                          }`}>
                            {test.status === 'online' && <CheckCircle2 size={14} className="text-emerald-500" />}
                            {test.status === 'slow' && <AlertTriangle size={14} className="text-amber-500" />}
                            {test.status === 'offline' && <WifiOff size={14} className="text-rose-500" />}
                            {test.message}
                          </span>
                        </div>
                        <span className={`text-xs font-black px-2.5 py-1 rounded bg-gray-50 border ${
                          test.latency === 0 ? 'border-rose-200 text-rose-600 bg-rose-50/10' :
                          test.latency < 400 ? 'border-emerald-200 text-emerald-600 bg-emerald-50/10' :
                          test.latency < 1200 ? 'border-amber-200 text-amber-600 bg-amber-50/10' : 'border-rose-200 text-rose-600 bg-rose-50/10'
                        }`}>
                          {test.latency === 0 ? 'OFFLINE' : `${test.latency} ms`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={runPingTest}
                  disabled={isTestingConnection}
                  className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold px-8 py-3.5 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-3 hover:-translate-y-0.5 transform disabled:opacity-50 cursor-pointer text-sm"
                >
                  <RefreshCw size={18} className={isTestingConnection ? 'animate-spin' : ''} />
                  {isTestingConnection ? 'REALIZANDO PING TEST...' : 'DIAGNOSTICAR CONEXÃO AGORA'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo/Editar Usuário (Controle de Acesso) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  {editingUser ? <Edit2 className="text-blue-600" size={24} /> : <UserPlus className="text-blue-600" size={24} />}
                  {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleSaveUserForm} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                    placeholder="Ex: Maria Santos"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                    placeholder="maria@exemplo.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Senha {editingUser && <span className="text-gray-400 font-normal text-xs">(Deixe em branco para não alterar)</span>}
                  </label>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                    placeholder={editingUser ? "Manter senha atual" : "Digite a senha para o novo usuário"}
                    required={!editingUser}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Função</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-800 text-sm font-medium"
                  >
                    <option value="Operador">Operador</option>
                    <option value="Auxiliar">Auxiliar</option> 
                    <option value="Líder">Lider</option> 
                    <option value="Assistente">Assistente</option>
                    <option value="Coordenador ">Coordenador </option> 
                    <option value="Gerente  ">Gerente  </option> 
                    <option value="Admin">Administrador</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm cursor-pointer"
                  >
                    {editingUser ? 'Salvar' : 'Adicionar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Sub-permissões Follow-up (Controle de Acesso) */}
      <AnimatePresence>
        {selectedSubPermUser && subPermsForm && activeSubPermModule === 'followup' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubPermUser(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="text-orange-500" size={20} />
                    Nível de Acesso: Follow-up
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Defina as permissões específicas do usuário: <span className="font-semibold text-gray-700">{selectedSubPermUser.name || selectedSubPermUser['USUÁRIO']}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSubPermUser(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-auto">
                {/* 1. SEÇÃO: ACESSO ÀS SUB-TELAS PRINCIPAIS */}
                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sub-telas Disponíveis</h3>
                  
                  {/* Solicitações */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Activity size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Follow-up Solicitações</p>
                        <p className="text-[11px] text-gray-500">Visualizar e acompanhar as solicitações de compras</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.followup_solicitacoes}
                      onChange={() => handleToggleFormSubPerm('followup_solicitacoes')}
                    />
                  </div>

                  {/* Matéria-Prima */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Box size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Matéria-Prima</p>
                        <p className="text-[11px] text-gray-500">Visualizar estoque, fornecedores and status de MP</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.followup_materias}
                      onChange={() => handleToggleFormSubPerm('followup_materias')}
                    />
                  </div>

                  {/* Follow-up AWB */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Plane size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Follow Up AWB</p>
                        <p className="text-[11px] text-gray-500">Acompanhar remessas aéreas, tracking e NFs</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.followup_awb}
                      onChange={() => handleToggleFormSubPerm('followup_awb')}
                    />
                  </div>
                </div>

                {/* 2. SEÇÃO: CONTROLE DETALHADO DENTRO DE AWB */}
                <AnimatePresence initial={false}>
                  {subPermsForm.followup_awb && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 pt-2 border-t border-slate-100 overflow-hidden"
                    >
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Permissões de Ação (Follow Up AWB)</h3>
                      
                      <div className="pl-4 border-l-2 border-orange-500 space-y-3">
                        {/* Novo Embarque */}
                        <div className="flex items-center justify-between p-3 bg-orange-50/20 rounded-xl border border-orange-500/10">
                          <div>
                            <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <Plus size={14} className="text-orange-600" />
                              Novo Embarque
                            </p>
                            <p className="text-[10px] text-gray-500">Permitir cadastrar novas remessas de AWB</p>
                          </div>
                          <ToggleSwitch 
                            checked={!!subPermsForm.followup_awb_novo}
                            onChange={() => handleToggleFormSubPerm('followup_awb_novo')}
                          />
                        </div>

                        {/* Ações */}
                        <div className="flex items-center justify-between p-3 bg-orange-50/20 rounded-xl border border-orange-500/10">
                          <div>
                            <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <Settings size={14} className="text-orange-600" />
                              Ações (Editar/Excluir)
                            </p>
                            <p className="text-[10px] text-gray-500">Permitir editar e excluir remessas existentes</p>
                          </div>
                          <ToggleSwitch 
                            checked={!!subPermsForm.followup_awb_acoes}
                            onChange={() => handleToggleFormSubPerm('followup_awb_acoes')}
                          />
                        </div>

                        {/* Anexar Novo Documento (PDF) */}
                        <div className="flex items-center justify-between p-3 bg-orange-50/20 rounded-xl border border-orange-500/10">
                          <div>
                            <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                              <FileUp size={14} className="text-orange-600" />
                              Anexar Novo Documento (PDF)
                            </p>
                            <p className="text-[10px] text-gray-500">Permitir subir e anexar novos arquivos PDF às NFs</p>
                          </div>
                          <ToggleSwitch 
                            checked={!!subPermsForm.followup_awb_anexar}
                            onChange={() => handleToggleFormSubPerm('followup_awb_anexar')}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-6 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSubPermUser(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubPerms}
                  disabled={savingId === selectedSubPermUser.id || savingId === selectedSubPermUser['ID']}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 animate-pulse-once"
                >
                  {savingId === selectedSubPermUser.id || savingId === selectedSubPermUser['ID'] ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Sub-permissões Configuração (Controle de Acesso) */}
      <AnimatePresence>
        {selectedSubPermUser && subPermsForm && activeSubPermModule === 'config' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubPermUser(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Settings className="text-orange-500 animate-spin-slow" size={20} />
                    Nível de Acesso: Configuração
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Defina as permissões específicas do usuário: <span className="font-semibold text-gray-700">{selectedSubPermUser.name || selectedSubPermUser['USUÁRIO']}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSubPermUser(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-auto">
                {/* 1. SEÇÃO: ACESSO ÀS SUB-TELAS PRINCIPAIS */}
                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Sub-telas Disponíveis</h3>
                  
                  {/* Controle de Acesso */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Shield size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Controle de Acesso</p>
                        <p className="text-[11px] text-gray-500">Gerenciar permissões e usuários do sistema</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.config_acesso}
                      onChange={() => handleToggleFormSubPerm('config_acesso')}
                    />
                  </div>

                  {/* Perfil de usuários */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <User size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Perfil de Usuários</p>
                        <p className="text-[11px] text-gray-500">Visualizar e editar dados de perfil próprio</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.config_perfil}
                      onChange={() => handleToggleFormSubPerm('config_perfil')}
                    />
                  </div>

                  {/* Chat Interno */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <MessageCircle size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Chat Interno</p>
                        <p className="text-[11px] text-gray-500">Acessar e interagir no chat da equipe</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.config_chat}
                      onChange={() => handleToggleFormSubPerm('config_chat')}
                    />
                  </div>

                  {/* Upload */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <FileUp size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Upload</p>
                        <p className="text-[11px] text-gray-500">Fazer upload e gerenciar arquivos</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={!!subPermsForm.config_upload}
                      onChange={() => handleToggleFormSubPerm('config_upload')}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSubPermUser(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubPerms}
                  disabled={savingId === selectedSubPermUser.id || savingId === selectedSubPermUser['ID']}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 animate-pulse-once"
                >
                  {savingId === selectedSubPermUser.id || savingId === selectedSubPermUser['ID'] ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Sub-permissões Entrega do Almox */}
      <AnimatePresence>
        {selectedSubPermUser && subPermsForm && activeSubPermModule === 'cadastroEntrega' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSubPermUser(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg relative z-10 overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-slate-50">
                <div>
                  <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <Shield className="text-orange-500" size={20} />
                    Nível de Acesso: Entrega do Almox
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">
                    Defina as permissões específicas do usuário: <span className="font-semibold text-gray-700">{selectedSubPermUser.name || selectedSubPermUser['USUÁRIO']}</span>
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedSubPermUser(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-5 max-h-[70vh] overflow-auto">
                <div className="space-y-3.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Telas de Entrega</h3>
                  
                  {/* M² */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Box size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Itens Pendentes para Entrega M² (M²)</p>
                        <p className="text-[11px] text-gray-500">Visualizar e registrar a entrega de itens de medida M²</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={subPermsForm.almox_m2 !== false}
                      onChange={() => handleToggleFormSubPerm('almox_m2')}
                    />
                  </div>

                  {/* Aviamentos */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                        <Box size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Itens Pendentes para Entrega Aviamento</p>
                        <p className="text-[11px] text-gray-500">Visualizar e registrar a entrega de aviamentos (PAR, UND, KG, M, MIL)</p>
                      </div>
                    </div>
                    <ToggleSwitch 
                      checked={subPermsForm.almox_aviamento !== false}
                      onChange={() => handleToggleFormSubPerm('almox_aviamento')}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-slate-50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedSubPermUser(null)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors font-semibold text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSubPerms}
                  disabled={savingId === selectedSubPermUser.id || savingId === selectedSubPermUser['ID']}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm cursor-pointer flex items-center justify-center gap-2 animate-pulse-once"
                >
                  {savingId === selectedSubPermUser.id || savingId === selectedSubPermUser['ID'] ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Salvar Alterações
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
