'use client';
import React, { useState } from 'react';
import { Search, MoreVertical, Paperclip, Smile, Send, Menu, X, Check, CheckCheck, MessageCircle } from 'lucide-react';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, text: 'Olá! A ordem 48192 já foi para o corte?', sender: 'other', time: '10:30', status: 'read' },
    { id: 2, text: 'Bom dia! Sim, acabou de entrar na máquina.', sender: 'me', time: '10:32', status: 'read' },
    { id: 3, text: 'Perfeito, obrigado. Vou avisar o cliente.', sender: 'other', time: '10:35', status: 'read' },
  ]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const contacts = [
    { id: 1, name: 'João Silva (Corte)', lastMessage: 'Perfeito, obrigado. Vou avisar o cliente.', time: '10:35', unread: 0, online: true },
    { id: 2, name: 'Maria Oliveira (Costura)', lastMessage: 'Faltam 50 peças para finalizar o lote.', time: '09:15', unread: 2, online: false },
    { id: 3, name: 'Carlos Souza (Manutenção)', lastMessage: 'Máquina 3 consertada.', time: 'Ontem', unread: 0, online: true },
    { id: 4, name: 'Ana Lima (Qualidade)', lastMessage: 'Lote aprovado.', time: 'Ontem', unread: 0, online: false },
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      setMessages([...messages, { 
        id: Date.now(), 
        text: message, 
        sender: 'me', 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent'
      }]);
      setMessage('');
    }
  };

  return (
    <div className="h-full flex bg-gray-100 overflow-hidden relative">
      
      {/* Sidebar Overlay for Mobile */}
      {!isSidebarOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/20 z-20"
          onClick={() => setIsSidebarOpen(true)}
        />
      )}

      {/* Sidebar (Contatos) */}
      <div className={`
        absolute md:relative z-30 h-full bg-white border-r border-gray-200 flex flex-col transition-all duration-300 ease-in-out
        ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-80 -translate-x-full md:w-0 md:translate-x-0 overflow-hidden border-r-0'}
      `}>
        {/* Sidebar Header */}
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between min-w-[320px]">
          <h2 className="text-xl font-bold text-gray-800">Conversas</h2>
          <div className="flex gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
            <button 
              className="md:hidden p-2 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
              onClick={() => setIsSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-200 min-w-[320px]">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Pesquisar ou começar nova conversa" 
              className="w-full pl-10 pr-4 py-2 bg-gray-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          </div>
        </div>

        {/* Contact List */}
        <div className="flex-1 overflow-y-auto min-w-[320px]">
          {contacts.map(contact => (
            <div key={contact.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors">
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0">
                  {contact.name.charAt(0)}
                </div>
                {contact.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="text-sm font-semibold text-gray-800 truncate pr-2">{contact.name}</h3>
                  <span className="text-xs text-gray-500 flex-shrink-0">{contact.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500 truncate pr-2">{contact.lastMessage}</p>
                  {contact.unread > 0 && (
                    <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                      {contact.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#efeae2]">
        
        {/* Chat Header */}
        <div className="p-3 md:p-4 bg-white border-b border-gray-200 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <button 
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <Menu size={24} />
            </button>
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold flex-shrink-0">
              J
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-800">João Silva (Corte)</h2>
              <p className="text-xs text-green-500 font-medium">Online</p>
            </div>
          </div>
          <div className="flex gap-1 md:gap-2">
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Search size={20} />
            </button>
            <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-2 shadow-sm relative
                ${msg.sender === 'me' ? 'bg-[#dcf8c6] rounded-tr-none' : 'bg-white rounded-tl-none'}
              `}>
                <p className="text-sm text-gray-800 mb-1">{msg.text}</p>
                <div className="flex items-center justify-end gap-1">
                  <span className="text-[10px] text-gray-500">{msg.time}</span>
                  {msg.sender === 'me' && (
                    <span className="text-blue-500">
                      {msg.status === 'read' ? <CheckCheck size={14} /> : <Check size={14} />}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-gray-50 border-t border-gray-200">
          <form onSubmit={handleSendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
            <button type="button" className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
              <Smile size={24} />
            </button>
            <button type="button" className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-full transition-colors flex-shrink-0">
              <Paperclip size={24} />
            </button>
            <div className="flex-1 bg-white rounded-2xl border border-gray-300 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all overflow-hidden">
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite uma mensagem" 
                className="w-full max-h-32 min-h-[44px] py-3 px-4 outline-none resize-none text-sm"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
              />
            </div>
            <button 
              type="submit" 
              disabled={!message.trim()}
              className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-sm"
            >
              <Send size={20} className="ml-1" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
