'use client';
import React, { useState, useEffect } from 'react';
import { Save, Shield, UserPlus, X, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '@/lib/api';
import { dataCache } from '@/lib/cache';

export default function Configuracao() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', role: 'Operador', email: '' });
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Usa cache de 30s para a lista de usuários na configuração
      const data = await dataCache.get('allUsers', () => api.post('getUsers'), 30000);
      // Processar os dados para garantir que as permissões sejam um objeto
      const processedUsers = (data || []).map((u: any) => {
        let permissions = { painel: true, cadastro: false, producao: true, programacaoPCP: true, followup: true, chat: true, config: false };
        
        // Tentar buscar da coluna da planilha
        const rawPermissions = u['Permissões de Tela (Módulos)'];
        if (rawPermissions) {
          try {
            const parsed = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions) : rawPermissions;
            permissions = {
              ...permissions,
              ...parsed
            };
          } catch (e) {
            console.warn('Erro ao parsear permissões para o usuário', u['USUÁRIO']);
          }
        } else {
          // Fallback baseado no papel se a coluna estiver vazia
          const role = u.role || u['PAPEL'] || 'User';
          permissions = {
            painel: true,
            cadastro: role === 'Admin',
            producao: true,
            programacaoPCP: true,
            followup: true,
            chat: true,
            config: role === 'Admin'
          };
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

  const toggleStatus = (userId: any) => {
    setUsers(users.map(u => {
      const currentId = u.id || u['ID'];
      if (currentId === userId) {
        const currentStatus = u.status || u['STATUS'] || 'ativo';
        const newStatus = currentStatus.toLowerCase() === 'ativo' ? 'inativo' : 'ativo';
        return { ...u, status: newStatus, 'STATUS': newStatus };
      }
      return u;
    }));
  };

  const handleSaveUser = async (userId: any) => {
    const user = users.find(u => (u.id || u.ID) === userId);
    if (!user) return;

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
      
      // Feedback de sucesso
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    } finally {
      setSavingId(null);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) return;
    
    try {
      const addedUser = await api.post('addUser', newUser);
      
      // Invalida o cache para que o novo usuário apareça
      dataCache.invalidate('allUsers');
      console.log('[DEBUG] Cache allUsers invalidado após adição de novo usuário');
      
      setUsers([...users, addedUser]);
      setNewUser({ name: '', role: 'Operador', email: '' });
      setIsModalOpen(false);
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error);
    }
  };

  return (
    <div className="p-6 h-full bg-gray-50 relative">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Shield className="text-red-800" />
            Controle de Acesso e Usuários
          </h1>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-red-800 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-red-900 transition-colors shadow-sm"
          >
            <UserPlus size={18} />
            Novo Usuário
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-red-800" size={40} />
              <p className="text-gray-500 font-medium">Carregando usuários...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 text-sm">
                    <th className="p-4 font-semibold">Usuário</th>
                    <th className="p-4 font-semibold">Função</th>
                    <th className="p-4 font-semibold text-center">Painel</th>
                    <th className="p-4 font-semibold text-center">Cadastro</th>
                    <th className="p-4 font-semibold text-center">Produção</th>
                    <th className="p-4 font-semibold text-center">Prog. PCP</th>
                    <th className="p-4 font-semibold text-center">Follow-up</th>
                    <th className="p-4 font-semibold text-center">Chat</th>
                    <th className="p-4 font-semibold text-center">Configuração</th>
                    <th className="p-4 font-semibold text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const userName = user.name || user['USUÁRIO'] || user['Usuário'] || 'Sem Nome';
                    const userEmail = user.email || user['E-MAIL'] || user['E-mail'] || 'Sem E-mail';
                    const userRole = user.role || user['PAPEL'] || user['Papel'] || 'User';
                    const userStatus = user.status || user['STATUS'] || user['Status'] || 'Ativo';
                    const userId = user.id || user['ID'] || Math.random();

                    return (
                      <tr key={userId} className={`border-b border-gray-100 hover:bg-gray-50 ${userStatus === 'Inativo' ? 'opacity-60' : ''}`}>
                        <td className="p-4 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${userStatus === 'Ativo' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                            <div>
                              {userName}
                              <div className="text-xs text-gray-400 font-normal">{userEmail}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-gray-600">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${userRole === 'Admin' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                            {userRole}
                          </span>
                        </td>
                        {['painel', 'cadastro', 'producao', 'programacaoPCP', 'followup', 'chat', 'config'].map(module => {
                          const permissions = user.permissions || {};
                          const hasPermission = permissions[module as keyof typeof permissions] || false;
                          return (
                            <td key={module} className="p-4 text-center">
                              <input 
                                type="checkbox" 
                                checked={hasPermission}
                                onChange={() => togglePermission(userId, module)}
                                disabled={userStatus === 'Inativo'}
                                className="w-4 h-4 text-red-800 rounded border-gray-300 focus:ring-red-800 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </td>
                          );
                        })}
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-3">
                            <button 
                              onClick={() => toggleStatus(userId)}
                              className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors ${
                                userStatus === 'Ativo' 
                                  ? 'text-red-700 bg-red-50 hover:bg-red-100' 
                                  : 'text-green-700 bg-green-50 hover:bg-green-100'
                              }`}
                              title={userStatus === 'Ativo' ? 'Desativar usuário' : 'Ativar usuário'}
                            >
                              {userStatus === 'Ativo' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                              {userStatus === 'Ativo' ? 'Inativar' : 'Ativar'}
                            </button>
                            <button 
                              onClick={() => handleSaveUser(userId)}
                              className="text-gray-500 hover:text-red-800 transition-colors disabled:opacity-50"
                              title="Salvar permissões"
                              disabled={userStatus === 'Inativo' || savingId === userId}
                            >
                              {savingId === userId ? (
                                <Loader2 size={18} className="animate-spin" />
                              ) : (
                                <Save size={18} className={userStatus === 'Inativo' ? 'opacity-50' : ''} />
                              )}
                            </button>
                          </div>
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

      {/* Modal Novo Usuário */}
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
                  <UserPlus className="text-red-800" size={24} />
                  Novo Usuário
                </h2>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-800 focus:border-red-800 outline-none"
                    placeholder="Ex: Maria Santos"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-800 focus:border-red-800 outline-none"
                    placeholder="maria@exemplo.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Função</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-800 focus:border-red-800 outline-none bg-white"
                  >
                    <option value="Operador">Operador</option>
                    <option value="Admin">Administrador</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-red-800 text-white rounded-lg hover:bg-red-900 transition-colors font-medium"
                  >
                    Adicionar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
