'use client';
import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, Loader2, Eye, EyeOff, Zap, ClipboardList, Box, FileText, Shield, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { api } from '@/lib/api';

export default function Login({ 
  onLogin, 
  onGoToRegister, 
  successMessage 
}: { 
  onLogin: () => void, 
  onGoToRegister?: () => void,
  successMessage?: string | null
}) {
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [internalSuccess, setInternalSuccess] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInternalSuccess(null);
    
    try {
      const user = await api.post('login', { email: email.trim(), password: password.trim() });
      if (user) {
        localStorage.setItem('pcp_user', JSON.stringify(user));
        onLogin();
      } else {
        setError('E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      if (err.message && err.message.includes('inativo')) {
        setError('Sua conta está inativa. Entre em contato com o administrador.');
      } else {
        setError(err.message || 'Erro ao realizar login. Verifique sua conexão.');
      }
      console.error('[DEBUG] Erro no login:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-800 flex items-center justify-center p-4 md:p-8 font-sans selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-center">
        
        {/* Left Side: Marketing & Branding */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-7 flex flex-col justify-center space-y-8 md:space-y-10"
        >
          {/* Logo Header */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-tr from-blue-600 to-sky-500 rounded-xl flex items-center justify-center shadow-md shadow-blue-500/20">
              <Zap className="text-white fill-white/20" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-wider text-slate-900">Dass ITB</h2>
              <p className="text-[10px] text-blue-600 font-extrabold tracking-widest uppercase">SISTEMA DE PRODUÇÃO {new Date().getFullYear()}</p>
            </div>
          </div>

          {/* Hero Headings */}
          <div className="space-y-4">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-tight">
              Controle Total da <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-sky-600 to-indigo-600">
                Produção Industrial
              </span>
            </h1>
            <p className="text-slate-600 text-sm md:text-base max-w-lg leading-relaxed">
              Gerencie sua fábrica com tecnologia avançada, métricas consolidadas e controle de suprimentos em tempo real.
            </p>
          </div>

          {/* Features Grid (2x2) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card 1: Produção */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 hover:border-blue-400 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ClipboardList className="text-blue-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Produção</h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Controle completo das linhas de montagem, setup e eficiência.
                </p>
              </div>
            </div>

            {/* Card 2: Suprimentos */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 hover:border-emerald-400 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Box className="text-emerald-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Suprimentos</h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Gestão de matéria-prima, retornos de estoque e monitoramento de lotes.
                </p>
              </div>
            </div>

            {/* Card 3: Relatórios */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 hover:border-amber-400 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <FileText className="text-amber-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Relatórios</h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Exportação rápida para PDF/Excel com filtros dinâmicos de turno.
                </p>
              </div>
            </div>

            {/* Card 4: Usuários */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex gap-4 hover:border-purple-400 hover:shadow-md transition-all duration-300">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Shield className="text-purple-600" size={20} />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Usuários</h4>
                <p className="text-slate-500 text-xs mt-1 leading-relaxed">
                  Matriz de permissões, perfis administrativos e limites de horário.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Text */}
          <div className="text-slate-400 text-xs pt-2 border-t border-slate-200">
            © Dass ITB Industrial Hub • Sistema Integrado de Gestão • Conectado à nuvem
          </div>
        </motion.div>

        {/* Right Side: Auth Card (Apenas Login) */}
        <motion.div 
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="lg:col-span-5 w-full flex justify-center"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-xl relative overflow-hidden">
            {/* Top decorative gradient bar */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-sky-500 to-indigo-600"></div>
            
            <div className="p-6 sm:p-8">
              {/* Title Header */}
              <div className="mb-6">
                <h3 className="text-2xl font-black text-slate-900">
                  Entrar no Sistema
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Acesse o painel de controle operativo
                </p>
              </div>

              {/* Status Messages */}
              {(successMessage || internalSuccess) && (
                <div className="mb-5 bg-emerald-50 text-emerald-800 p-3.5 rounded-xl text-sm border border-emerald-200 font-medium flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                  <span>{internalSuccess || successMessage}</span>
                </div>
              )}
              {error && (
                <div className="mb-5 bg-rose-50 text-rose-700 p-3.5 rounded-xl text-sm border border-rose-200 font-medium">
                  {error}
                </div>
              )}

              {/* FORM: LOGIN */}
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {/* Email Field */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 tracking-wider uppercase mb-1.5">EMAIL</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-colors text-slate-900 text-sm placeholder-slate-400"
                      placeholder="seu.email@grupodass.com.br"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-xs font-bold text-slate-700 tracking-wider uppercase">SENHA</label>
                    <span className="text-xs text-slate-400">Padrão da empresa</span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 outline-none transition-colors text-slate-900 text-sm placeholder-slate-400"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar no Sistema
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>

                <div className="text-center pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Acesso exclusivo para colaboradores autorizados Dass ITB.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </motion.div>

      </div>
    </div>
  );
}
