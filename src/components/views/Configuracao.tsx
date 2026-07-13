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
  FileUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';
import Chat from './Chat';

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
}

export default function Configuracao({ 
  currentUser, 
  onUpdateCurrentUser 
}: ConfiguracaoProps) {
  const isAdmin = currentUser?.role === 'Admin' || currentUser?.['PAPEL'] === 'Admin';
  const [activeTab, setActiveTab] = useState<'acesso' | 'perfil' | 'chat'>(isAdmin ? 'acesso' : 'perfil');
  
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', role: 'Operador', email: '' });
  const [savingId, setSavingId] = useState<number | null>(null);

  const [openMenuId, setOpenMenuId] = useState<any | null>(null);
  const [editingUser, setEditingUser] = useState<any | null>(null);

  // States for Follow-up Sub-permissions Modal
  const [selectedSubPermUser, setSelectedSubPermUser] = useState<any | null>(null);
  const [subPermsForm, setSubPermsForm] = useState<any>(null);

  useEffect(() => {
    if (selectedSubPermUser) {
      setSubPermsForm({ ...(selectedSubPermUser.permissions || {}) });
    } else {
      setSubPermsForm(null);
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
      const currentId = u.id || u['ID'];
      if (currentId === userId) {
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
    const userToSave = updatedUsers.find(u => (u.id || u['ID']) === userId);
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
      } catch (err) {
        console.error('Erro ao salvar sub-permissões do usuário no banco:', err);
      } finally {
        setSavingId(null);
      }
    }
    
    setSelectedSubPermUser(null);
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
          followup_awb_anexar: true
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
              followup_awb_anexar: parsed.followup_awb_anexar !== false
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
      if (currentId === userId) {
        const updatedPermissions = { 
          ...u.permissions, 
          [module]: !u.permissions[module as keyof typeof u.permissions] 
        };
        return { ...u, permissions: updatedPermissions };
      }
      return u;
    }));
  };

  const toggleStatus = async (userId: any) => {
    const userToUpdate = users.find(u => (u.id || u['ID']) === userId);
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
      if (currentId === userId) {
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
    } catch (error) {
      console.error('Erro ao salvar status do usuário no banco:', error);
      // Reverte o estado local em caso de falha na API
      setUsers(users.map(u => {
        const currentId = u.id || u['ID'];
        if (currentId === userId) {
          return userToUpdate;
        }
        return u;
      }));
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveUser = async (userId: any) => {
    const user = users.find(u => (u.id || u.ID) === userId);
    if (!user) return;

    setSavingId(userId as number);
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
      
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
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
        const updatedUser = {
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
            followup_awb_anexar: true
          }
        };
        setUsers([...users, addedWithPerms]);
      }
      
      setNewUser({ name: '', role: 'Operador', email: '' });
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
              Configurações do Sistema
            </h1>
            <p className="text-sm text-gray-500">
              Gerencie suas informações de perfil, acesso e converse com a equipe.
            </p>
          </div>
          
          {activeTab === 'acesso' && isAdmin && (
            <button 
              onClick={() => {
                setEditingUser(null);
                setNewUser({ name: '', email: '', role: 'Operador' });
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
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-150 cursor-pointer ${
              activeTab === 'chat'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50'
            }`}
          >
            <MessageCircle size={16} />
            Chat Interno
          </button>
        </div>

        {/* Tabs Panels Container */}
        <div className="flex-1">
          {/* TAB 1: CONTROLE DE ACESSO */}
          {activeTab === 'acesso' && isAdmin && (
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
                                        onClick={() => setSelectedSubPermUser(user)}
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
                                          role: userRole
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
          )}

          {/* TAB 2: PERFIL DE USUÁRIOS */}
          {activeTab === 'perfil' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Summary Info Card */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-sky-500 flex items-center justify-center text-white text-3xl font-extrabold shadow-md mb-4 uppercase">
                  {profileName ? profileName.substring(0, 2) : 'US'}
                </div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-1.5 justify-center">
                  {profileName}
                  {isAdmin && <BadgeCheck className="text-blue-600" size={18} />}
                </h3>
                <p className="text-sm text-gray-500 mb-4">{profileEmail}</p>
                
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider mb-6 ${
                  isAdmin ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {isAdmin ? 'Administrador' : 'Operador'}
                </span>

                <div className="w-full border-t border-gray-100 pt-6 space-y-3 text-left">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Status da Conta:</span>
                    <span className="font-semibold text-green-600 flex items-center gap-1">
                      <Check size={12} /> Ativo
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>ID do Usuário:</span>
                    <span className="font-mono text-[11px] text-gray-600">{currentUser?.ID || currentUser?.id || 'N/D'}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Edit Profile Form */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:col-span-2">
                <h3 className="text-lg font-bold text-gray-800 mb-4 pb-3 border-b border-gray-100 flex items-center gap-2">
                  <User size={18} className="text-blue-600" />
                  Editar Detalhes do Perfil
                </h3>

                {profileSuccess && (
                  <div className="mb-4 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="text-green-600 flex-shrink-0" size={20} />
                    <span className="text-sm font-medium">Perfil atualizado com sucesso no banco de dados!</span>
                  </div>
                )}

                {profileError && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg flex items-center gap-3">
                    <XCircle className="text-red-600 flex-shrink-0" size={20} />
                    <span className="text-sm font-medium">{profileError}</span>
                  </div>
                )}

                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <User size={16} className="text-gray-400" />
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                      placeholder="Seu nome"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <Mail size={16} className="text-gray-400" />
                      E-mail Institucional
                    </label>
                    <input
                      type="email"
                      value={profileEmail}
                      onChange={(e) => setProfileEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                      placeholder="seu.email@grupodass.com.br"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                      <KeyRound size={16} className="text-gray-400" />
                      Alterar Senha (Opcional)
                    </label>
                    <input
                      type="password"
                      value={profilePassword}
                      onChange={(e) => setProfilePassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none text-gray-800 text-sm font-medium"
                      placeholder="Deixe em branco para manter a senha atual"
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingProfile}
                      className="bg-blue-600 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm font-semibold text-sm disabled:opacity-50 cursor-pointer"
                    >
                      {isSavingProfile ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save size={16} />
                          Salvar Perfil
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: CHAT INTERNO */}
          {activeTab === 'chat' && (
            <div className="h-[calc(100vh-210px)] rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
              <Chat />
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
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Função</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 outline-none bg-white text-gray-800 text-sm font-medium"
                  >
                    <option value="Operador">Operador</option>
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
        {selectedSubPermUser && subPermsForm && (
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
                        <p className="text-[11px] text-gray-500">Visualizar estoque, fornecedores e status de MP</p>
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
    </div>
  );
}
