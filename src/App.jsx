import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { PlusCircle, List, PiggyBank, Receipt, Calendar, Users, CheckCircle2, ChevronDown, ChevronUp, X, Copy, LogOut } from 'lucide-react';

// Membros iniciais (podem ser alterados no código se desejar)
const INITIAL_MEMBERS = ['Elton', 'Geo', 'Carol', 'Slash', 'Filipe', 'Yuri'];

// Chaves Pix (deixando algumas como exemplo pix12345 para alteração futura)
const PIX_KEYS = {
  Elton: 'elton_sn@outlook.com',
  Geo: '09613956646',
  Carol: 'caarolsilva34.cs@gmail.com',
  Slash: '15805376695',
  Filipe: '15613830665',
  Yuri: 'tá sem pix'
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('patota_user') || '');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // States para o formulário de nova despesa
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState(() => {
    const user = localStorage.getItem('patota_user');
    return (user && INITIAL_MEMBERS.includes(user)) ? user : INITIAL_MEMBERS[0];
  });

  // Garante que se o usuário mudar de perfil na mesma sessão, o campo atualize
  useEffect(() => {
    if (currentUser && members.includes(currentUser)) {
      setPayer(currentUser);
    }
  }, [currentUser, members]);
  const [dueDate, setDueDate] = useState('');
  const [involved, setInvolved] = useState([...INITIAL_MEMBERS]); // Todos marcados por padrão

  // States para Expandir Cards e Modal de Confirmação
  const [activeCardId, setActiveCardId] = useState(null);
  const [pendingSettlement, setPendingSettlement] = useState(null);
  const [settlementAmount, setSettlementAmount] = useState(''); // Novo state para Pagamento Parcial/Total
  const [copiedPix, setCopiedPix] = useState(false);

  // Carregar dados do Supabase ao iniciar
  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .order('date_added', { ascending: true });

      if (error) {
        console.error('Erro ao carregar despesas:', error.message);
      } else {
        // Mapear campos snake_case do banco para camelCase do app
        const mapped = data.map(row => ({
          id: row.id,
          title: row.title,
          amount: parseFloat(row.amount),
          payer: row.payer,
          dueDate: row.due_date || '',
          involved: row.involved,
          dateAdded: row.date_added,
          isSettlement: row.is_settlement,
        }));
        setExpenses(mapped);
      }
      setLoading(false);
    };

    fetchExpenses();
  }, []);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!title || !amount || !payer || involved.length === 0) {
      alert('Preencha os campos obrigatórios e selecione pelo menos um envolvido.');
      return;
    }

    const newExpense = {
      id: Date.now().toString(),
      title,
      amount: parseFloat(amount),
      payer,
      due_date: dueDate || null,
      involved,
      date_added: new Date().toISOString(),
      is_settlement: false,
    };

    const { error } = await supabase.from('expenses').insert([newExpense]);

    if (error) {
      console.error('Erro ao salvar despesa:', error.message);
      alert('Erro ao salvar despesa. Tente novamente.');
      return;
    }

    // Atualizar estado local com formato camelCase
    setExpenses([...expenses, {
      id: newExpense.id,
      title: newExpense.title,
      amount: newExpense.amount,
      payer: newExpense.payer,
      dueDate: newExpense.due_date || '',
      involved: newExpense.involved,
      dateAdded: newExpense.date_added,
      isSettlement: false,
    }]);
    
    // Resetar form
    setTitle('');
    setAmount('');
    setDueDate('');
    setInvolved([...members]);
    setPayer((currentUser && members.includes(currentUser)) ? currentUser : members[0]);
    setActiveTab('dashboard');
  };

  const handleToggleInvolved = (member) => {
    if (involved.includes(member)) {
      setInvolved(involved.filter(m => m !== member));
    } else {
      setInvolved([...involved, member]);
    }
  };

  const deleteExpense = async (id) => {
    if(confirm('Tem certeza que deseja apagar este registro?')) {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) {
        console.error('Erro ao deletar despesa:', error.message);
        alert('Erro ao deletar. Tente novamente.');
        return;
      }
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const confirmSettlement = async () => {
    if (pendingSettlement && settlementAmount) {
      const { from, to } = pendingSettlement;
      const parsedAmount = parseFloat(settlementAmount);
      
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Insira um valor válido para o pagamento.');
        return;
      }

      const settlement = {
        id: Date.now().toString(),
        title: `Pagamento de Dívida`,
        amount: parsedAmount,
        payer: from,
        due_date: null,
        involved: [to],
        date_added: new Date().toISOString(),
        is_settlement: true,
      };

      const { error } = await supabase.from('expenses').insert([settlement]);

      if (error) {
        console.error('Erro ao registrar pagamento:', error.message);
        alert('Erro ao registrar pagamento. Tente novamente.');
        return;
      }

      setExpenses([...expenses, {
        id: settlement.id,
        title: settlement.title,
        amount: settlement.amount,
        payer: settlement.payer,
        dueDate: '',
        involved: settlement.involved,
        dateAdded: settlement.date_added,
        isSettlement: true,
      }]);
      setPendingSettlement(null);
      setSettlementAmount('');
    }
  };

  const handleCopyPix = (pix, debtId) => {
    navigator.clipboard.writeText(pix);
    setCopiedPix(debtId);
    setTimeout(() => setCopiedPix(null), 2000);
  };

  const handleOpenSettlement = (debt, e) => {
    e.stopPropagation();
    setPendingSettlement(debt);
    setSettlementAmount(debt.amount.toFixed(2)); // Preenche com o valor total por padrão
  };

  // Lógica de Cálculo de Dívidas (Algoritmo Pareado corrigido)
  const debts = useMemo(() => {
    const pairData = {}; // key: pairKey, value: { balance: net (personA -> personB), details: [] }

    expenses.forEach(exp => {
      const splitAmount = exp.amount / exp.involved.length;
      
      exp.involved.forEach(debtor => {
        if (debtor !== exp.payer) {
           // Ordenamos alfabeticamente para gerar uma chave única para o par
           const personA = debtor < exp.payer ? debtor : exp.payer;
           const personB = debtor < exp.payer ? exp.payer : debtor;
           const pk = `${personA}-${personB}`;
           
           if (!pairData[pk]) pairData[pk] = { balance: 0, details: [] };
           
           // Se personA é quem recebeu a cobrança (debtor), então personA tem que pagar para personB
           // Balance positivo significa "personA deve a personB"
           const isPersonADebtor = (personA === debtor); 
           
           if (isPersonADebtor) {
              pairData[pk].balance += splitAmount;
           } else {
              pairData[pk].balance -= splitAmount;
           }
           
           pairData[pk].details.push({
             ...exp, 
             splitValue: splitAmount,
             whoOwes: debtor, // quem deve pagar a fatia
             whoPaid: exp.payer // quem pagou a conta inteira (recebedor)
           });
        }
      });
    });

    let pairwiseDebts = [];
    
    Object.keys(pairData).forEach(pk => {
       const [personA, personB] = pk.split('-');
       let net = pairData[pk].balance; 
       
       // Se o saldo for menor que 1 centavo, a dívida foi zerada
       if (Math.abs(net) < 0.01) return; 
       
       // Se positivo, personA deve a personB. Se negativo, personB deve a personA.
       let from = net > 0 ? personA : personB;
       let to = net > 0 ? personB : personA;
       let absAmount = Math.abs(net);

       // Procurar maior data limite entre os lançamentos que ainda não foram abatidos
       let dueDates = pairData[pk].details.map(d => d.dueDate).filter(Boolean);
       let maxDueDate = dueDates.length > 0 ? dueDates.sort().reverse()[0] : null;

       pairwiseDebts.push({
          id: pk,
          from,
          to,
          amount: absAmount,
          maxDueDate,
          details: pairData[pk].details
       });
    });

    // Ordenar dívidas (maiores valores primeiro)
    pairwiseDebts.sort((a, b) => b.amount - a.amount);
    return pairwiseDebts;
  }, [expenses]);

  // Filtro de Dívidas visíveis na aba Dashboard baseadas no usuário atual
  const displayedDebts = useMemo(() => {
    if (currentUser === 'Geral') return debts;
    return debts.filter(d => d.from === currentUser || d.to === currentUser);
  }, [debts, currentUser]);

  // View: LOADING
  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-cyan-400 animate-spin shadow-[0_0_20px_rgba(34,211,238,0.3)]"></div>
        <p className="text-gray-400 text-sm font-medium tracking-widest uppercase animate-pulse">Carregando dados...</p>
      </div>
    );
  }

  // View: SELECIONAR USUÁRIO
  if (!currentUser) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] z-50 flex items-center justify-center p-4 selection:bg-pink-500 selection:text-white">
        <div className="bg-black/50 backdrop-blur-xl border border-purple-500/30 w-full max-w-sm rounded-[2rem] p-6 shadow-[0_0_40px_rgba(168,85,247,0.15)] animate-in zoom-in-95 duration-300">
          <div className="text-center mb-4">
            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_15px_#00ffff,inset_0_0_10px_#00ffff] bg-gray-900 flex items-center justify-center mb-4">
              <img src="img/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
              <span className="text-4xl font-black text-pink-500 hidden drop-shadow-[0_0_5px_#ff007f]">P</span>
            </div>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400">Quem é você?</h2>
            <p className="text-gray-400 text-sm mt-2">Selecione seu perfil para visualizar apenas as suas contas.</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {members.map(m => (
              <button 
                key={m}
                onClick={() => { setCurrentUser(m); localStorage.setItem('patota_user', m); }}
                className="bg-gray-900/50 hover:bg-purple-900/40 border border-gray-700 hover:border-purple-500 text-gray-200 py-3 rounded-xl transition-all font-bold"
              >
                {m}
              </button>
            ))}
            <button 
                onClick={() => { setCurrentUser('Geral'); localStorage.setItem('patota_user', 'Geral'); }}
                className="col-span-2 bg-gradient-to-r from-cyan-600/20 to-purple-600/20 hover:from-cyan-500/40 hover:to-purple-500/40 border border-cyan-500/50 text-cyan-400 py-3 rounded-xl transition-all font-bold shadow-[0_0_10px_rgba(34,211,238,0.1)] mt-2"
              >
                Acessar Visão Geral
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 font-sans pb-20 selection:bg-pink-500 selection:text-white relative">
      
      {/* Modal de Confirmação de Pagamento */}
      {pendingSettlement && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-700 w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 to-pink-500"></div>
             
             <div className="text-center mb-6 mt-2">
                <CheckCircle2 className="w-12 h-12 text-yellow-400 mx-auto mb-3 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                <h3 className="text-xl font-bold text-white mb-2">Liquidar Dívida</h3>
                <p className="text-gray-400 text-sm mb-5">
                  Pagamento de <strong className="text-red-400">{pendingSettlement.from}</strong> para <strong className="text-green-400">{pendingSettlement.to}</strong>.
                </p>

                <div className="bg-black/50 border border-yellow-500/30 rounded-2xl p-4 flex flex-col items-center shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]">
                  <label className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-2">Valor do Pagamento</label>
                  <div className="relative w-full flex justify-center items-center">
                    <span className="text-yellow-500 font-bold text-xl mr-2">R$</span>
                    <input 
                      type="number" step="0.01" 
                      value={settlementAmount} 
                      onChange={(e) => setSettlementAmount(e.target.value)}
                      className="w-32 bg-transparent border-b-2 border-yellow-500/50 focus:border-yellow-400 py-1 text-center text-white text-3xl font-black outline-none transition-colors"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                    Total em aberto: <span className="font-bold text-gray-300">R$ {pendingSettlement.amount.toFixed(2)}</span>
                  </p>
                </div>
             </div>
             
             <div className="flex gap-3">
               <button 
                 onClick={() => { setPendingSettlement(null); setSettlementAmount(''); }}
                 className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded-xl font-medium transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmSettlement}
                 className="flex-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-3 rounded-xl shadow-[0_0_15px_rgba(219,39,119,0.4)] transition-all"
               >
                 Confirmar
               </button>
             </div>
          </div>
        </div>
      )}

      {/* Header Estilizado Neon */}
      <header className="bg-black/50 backdrop-blur-md border-b border-purple-500/30 sticky top-0 z-10">
        <div className="max-w-md mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-cyan-400 shadow-[0_0_9px_#00ffff,inset_0_0_9px_#00ffff] bg-gray-900 flex items-center justify-center">
              <img src="img/logo.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
              <span className="text-xl font-black text-pink-500 hidden drop-shadow-[0_0_5px_#ff007f]">P</span>
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-purple-500 to-cyan-400 leading-tight">
                Financeiro Patota
              </h1>
              <p className="text-[10px] text-gray-500 flex items-center gap-1 font-medium">
                <Users className="w-3 h-3" /> Acesso: <span className="text-cyan-400">{currentUser}</span>
              </p>
            </div>
          </div>
          <button 
            onClick={() => { setCurrentUser(''); localStorage.removeItem('patota_user'); }}
            className="p-2 border border-gray-800 bg-gray-900/50 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 rounded-xl transition-all text-gray-500"
            title="Trocar Perfil"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        
        {/* TAB: DASHBOARD (Quem deve quem) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-cyan-400 mb-1 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Acerto de Contas</h2>
              <p className="text-gray-400 text-sm">
                {currentUser === 'Geral' ? 'Resumo detalhado de todas as dívidas ativas.' : 'Resumo das suas dívidas ativas.'}
              </p>
            </div>

            {displayedDebts.length === 0 ? (
              <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center shadow-lg">
                <div className="w-16 h-16 mx-auto bg-green-500/10 rounded-full flex items-center justify-center mb-4 border border-green-500/30">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-200">
                  {currentUser === 'Geral' ? 'Tudo zerado!' : 'Sua barra está limpa!'}
                </h3>
                <p className="text-gray-500 mt-1">
                  {currentUser === 'Geral' ? 'Ninguém deve nada na Patotinha.' : 'Você não possui dívidas nem pendências a receber no momento.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedDebts.map((debt, idx) => {
                  const isExpanded = activeCardId === debt.id;
                  
                  return (
                    <div key={idx} className={`bg-gradient-to-br from-gray-900 to-black border ${isExpanded ? 'border-pink-500/50 shadow-[0_0_30px_rgba(236,72,153,0.1)]' : 'border-pink-500/20 shadow-[0_4px_20px_rgba(236,72,153,0.05)]'} rounded-2xl p-4 relative overflow-hidden transition-all duration-300`}>
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-pink-500 to-purple-600"></div>
                      
                      {/* HEADER DO CARD (Sempre Visível) */}
                      <div 
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => setActiveCardId(isExpanded ? null : debt.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-red-400 font-bold text-lg leading-tight">{debt.from}</span>
                          <span className="text-[11px] text-gray-500 font-bold tracking-wider">Deve a</span>
                          <span className="text-green-400 font-bold text-lg leading-tight">{debt.to}</span>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-yellow-200 drop-shadow-[0_0_10px_rgba(250,204,21,0.3)]">
                            R$ {debt.amount.toFixed(2)}
                          </span>
                          <div className="flex items-center gap-2 mt-2">
                             <button 
                               onClick={(e) => handleOpenSettlement(debt, e)}
                               className="text-[10px] uppercase font-bold tracking-wider bg-pink-500/10 hover:bg-pink-500/50 text-pink-400 hover:text-white border border-pink-500/30 px-3 py-[6px] rounded-full transition-all">
                               Liquidar Pgt
                             </button>
                             <div className="bg-gray-800 p-1.5 rounded-full text-gray-400 border border-gray-700">
                               {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4"/>}
                             </div>
                          </div>
                        </div>
                      </div>

                      {/* CORPO EXPANDIDO */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-gray-800 animate-in slide-in-from-top-2 fade-in duration-300">
                          
                          {/* Detalhamento de Composição */}
                          <div className="mb-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Composição do Valor</h4>
                            <div className="space-y-2">
                              {debt.details.map((det) => {
                                // Se o `from` desta dívida é quem devia originalmente, é soma (+)
                                // Se o `from` pagou, é abate (-)
                                const isAddition = det.whoOwes === debt.from;
                                const isSettlementFlag = det.isSettlement; 

                                return (
                                  <div key={det.id} className={`flex justify-between items-center text-xs p-2 rounded-lg ${isSettlementFlag ? 'bg-green-500/10 border border-green-500/20' : 'bg-black/50'}`}>
                                    <div className="flex-1 truncate pr-2">
                                      <span className={isSettlementFlag ? 'text-green-400 font-bold' : 'text-gray-300'}>{det.title}</span>
                                      {det.dueDate && !isSettlementFlag && <span className="text-[10px] text-gray-600 block">Venc: {new Date(det.dueDate).toLocaleDateString('pt-BR')}</span>}
                                    </div>
                                    <span className={`font-mono font-bold ${isAddition && !isSettlementFlag ? 'text-red-400' : 'text-green-400'}`}>
                                      {isAddition && !isSettlementFlag ? '+' : '-'} R$ {det.splitValue.toFixed(2)}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            {/* Data Limite */}
                            {debt.maxDueDate && (
                              <div className="flex-1 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex flex-col items-center justify-center text-center">
                                <Calendar className="w-4 h-4 text-yellow-400 mb-1" />
                                <span className="text-[10px] text-gray-400 uppercase font-bold">Vence em</span>
                                <span className="text-xs font-bold text-yellow-100">{new Date(debt.maxDueDate).toLocaleDateString('pt-BR')}</span>
                              </div>
                            )}

                            {/* Informação Pix */}
                            <div className={`border rounded-xl p-3 flex flex-col justify-center items-center relative overflow-hidden group ${copiedPix === debt.id ? 'bg-green-500/20 border-green-500/40' : 'bg-cyan-500/10 border-cyan-500/30'} ${debt.maxDueDate ? 'flex-1' : 'w-full'}`}>
                               <div className="text-[10px] text-gray-400 uppercase font-bold mb-1 flex items-center gap-1">
                                 Chave PIX ({debt.to})
                               </div>
                               <span className="text-xs font-medium text-cyan-100 truncate w-full text-center px-2">
                                 {PIX_KEYS[debt.to] || 'Não cadastrada'}
                               </span>
                               
                               <button 
                                 onClick={(e) => { e.stopPropagation(); handleCopyPix(PIX_KEYS[debt.to], debt.id); }}
                                 className={`absolute inset-0 backdrop-blur-sm flex items-center justify-center gap-2 transition-all font-bold text-sm ${copiedPix === debt.id ? 'opacity-100 bg-green-600/90 text-white' : 'opacity-0 group-hover:opacity-100 bg-cyan-900/80 text-cyan-100'}`}
                               >
                                 {copiedPix === debt.id ? <CheckCircle2 className="w-5 h-5 text-white"/> : <Copy className="w-5 h-5"/>}
                                 {copiedPix === debt.id ? 'Chave Copiada!' : 'Copiar'}
                               </button>
                            </div>
                          </div>
                          
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: NOVA DESPESA */}
        {activeTab === 'add' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl font-bold text-pink-500 mb-6 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)] flex items-center gap-2">
              <Receipt className="w-5 h-5" /> Adicionar Gasto
            </h2>
            
            <form onSubmit={handleAddExpense} className="space-y-5 bg-gray-900/80 p-5 rounded-3xl border border-gray-800 shadow-xl">
              
              {/* Valor */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Valor (R$)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-yellow-500 font-bold">R$</span>
                  <input 
                    type="number" step="0.01" required
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-black/50 border border-yellow-500/30 rounded-xl py-3 pl-12 pr-4 text-white text-xl font-bold focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400/50 transition-all placeholder:text-gray-700"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">O que foi?</label>
                <input 
                  type="text" required
                  value={title} onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-black/50 border border-purple-500/30 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/50 transition-all placeholder:text-gray-700"
                  placeholder="Ex: Fardo de breja, aquela questão..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Quem pagou */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quem Pagou?</label>
                  <select 
                    value={payer} onChange={(e) => setPayer(e.target.value)}
                    className="w-full bg-black/50 border border-cyan-500/30 rounded-xl py-3 px-4 text-white appearance-none focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50"
                  >
                    {members.map(m => <option key={m} value={m} className="bg-gray-900">{m}</option>)}
                  </select>
                </div>

                {/* Data Limite */}
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Pagar até</label>
                  <input 
                    type="date"
                    value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-black/50 border border-gray-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-gray-500 transition-all [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Divisão */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Dividir entre:</label>
                  <span className="text-xs text-pink-400 bg-pink-400/10 px-2 py-1 rounded-md mb-1 font-bold">
                    {involved.length} selecionados
                  </span>
                </div>
                {/* Botão prático: Todos / Nenhum */}
                <div className="flex gap-2 mb-3">
                   <button type="button" onClick={() => setInvolved([...members])} className="text-[10px] bg-gray-800 text-gray-300 py-1 px-3 rounded-lg flex-1 border border-gray-700">Todos</button>
                   <button type="button" onClick={() => setInvolved([payer])} className="text-[10px] bg-gray-800 text-gray-300 py-1 px-3 rounded-lg flex-1 border border-gray-700">Só pagador</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {members.map(m => (
                    <button
                      key={m} type="button"
                      onClick={() => handleToggleInvolved(m)}
                      className={`py-2 px-1 rounded-lg border text-sm font-medium transition-all ${
                        involved.includes(m) 
                        ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]' 
                        : 'bg-black/40 border-gray-800 text-gray-600 hover:border-gray-600'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                {amount && involved.length > 0 && (
                  <p className="text-center text-xs text-cyan-400 mt-3 font-medium border-t border-gray-800 pt-3">
                    = R$ {(parseFloat(amount) / involved.length).toFixed(2)} por pessoa envolvida
                  </p>
                )}
              </div>

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(219,39,119,0.4)] transform hover:scale-[1.02] transition-all flex items-center justify-center gap-2 mt-4"
              >
                <PlusCircle className="w-5 h-5" /> Lançar Despesa
              </button>
            </form>
          </div>
        )}

        {/* TAB: HISTÓRICO */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] flex items-center gap-2">
                <List className="w-5 h-5" /> Extrato Patota
              </h2>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded-lg border border-gray-700">
                {expenses.length} registros totais
              </span>
             </div>

            {expenses.length === 0 ? (
               <div className="text-center text-gray-500 py-10">
                 Nenhum gasto registrado ainda no sistema.
               </div>
            ) : (
              <div className="space-y-3">
                {[...expenses].reverse().map((exp) => (
                  <div key={exp.id} className={`bg-black/60 border rounded-xl p-4 relative ${exp.isSettlement ? 'border-green-500/30' : 'border-gray-800'}`}>
                    <button onClick={() => deleteExpense(exp.id)} className="absolute top-3 right-3 text-gray-600 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                    
                    <div className="pr-6">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className={`font-bold ${exp.isSettlement ? 'text-green-400' : 'text-gray-200'}`}>{exp.title}</h4>
                        <span className="font-black text-white">R$ {exp.amount.toFixed(2)}</span>
                      </div>
                      
                      {!exp.isSettlement ? (
                        <>
                          <div className="text-sm text-gray-400 mt-2">
                            <span className="text-cyan-400 font-medium">{exp.payer}</span> pagou para {exp.involved.length} pessoas
                          </div>
                          {exp.dueDate && (
                            <div className="text-xs text-pink-400 mt-2 flex items-center gap-1 bg-pink-500/10 inline-block px-2 py-1 rounded border border-pink-500/20">
                              <Calendar className="w-3 h-3 inline" /> Vence: {new Date(exp.dueDate).toLocaleDateString('pt-BR')}
                            </div>
                          )}
                        </>
                      ) : (
                         <div className="text-sm text-gray-400 mt-2">
                            <span className="text-green-400 font-medium">{exp.payer}</span> transferiu para <span className="text-yellow-400 font-medium">{exp.involved[0]}</span>
                          </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Navegação Inferior (Bottom Nav) */}
      <nav className="fixed bottom-0 w-full max-w-md left-1/2 -translate-x-1/2 bg-gray-950/90 backdrop-blur-lg border-t border-gray-800 pb-safe">
        <div className="flex justify-around items-center p-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center p-3 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'text-cyan-400 bg-cyan-400/10' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <PiggyBank className={`w-6 h-6 mb-1 ${activeTab === 'dashboard' ? 'drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Dívidas</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('add')}
            className={`flex flex-col items-center p-3 rounded-2xl transition-all -mt-6 bg-gray-900 border-2 ${activeTab === 'add' ? 'text-pink-500 border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]' : 'text-gray-400 border-gray-800'}`}
          >
            <div className={`p-2 rounded-xl ${activeTab === 'add' ? 'bg-pink-500/20' : 'bg-gray-800'}`}>
              <PlusCircle className="w-7 h-7" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Lançar</span>
          </button>

          <button 
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center p-3 rounded-2xl transition-all ${activeTab === 'history' ? 'text-yellow-400 bg-yellow-400/10' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <List className={`w-6 h-6 mb-1 ${activeTab === 'history' ? 'drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : ''}`} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Histórico</span>
          </button>
        </div>
      </nav>

    </div>
  );
}