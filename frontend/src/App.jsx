import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, Clock, MapPin, Package, Filter, Eye, X, Bot, User, CheckCircle, AlertCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8000'; // Sesuaikan dengan URL backend Anda

const FoodOrderingChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [currentStep, setCurrentStep] = useState('welcome'); // welcome, menu, order, substitute, confirm
  const [conversationId, setConversationId] = useState(null);
  const [menuOptions, setMenuOptions] = useState([]);
  const [orderData, setOrderData] = useState({
    selectedItem: '',
    quantity: 1,
    address: '',
    timeWindow: '',
  });
  const [substitutions, setSubstitutions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logFilter, setLogFilter] = useState('');
  const [orderDetails, setOrderDetails] = useState(null);
  const messagesEndRef = useRef(null);
  const welcomeMessageSent = useRef(false); // Tambahkan baris ini

  const timeSlots = ['12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Hanya tampilkan pesan selamat datang jika ini adalah langkah 'welcome' DAN belum ada pesan
    if (currentStep === 'welcome' && messages.length === 0 && !welcomeMessageSent.current) {
      addMessage('provider', 'Selamat datang di Restoran Kami! 🍕🍔', 'welcome');
      welcomeMessageSent.current = true; // Tandai bahwa pesan sudah dikirim
    }
    // Reset penanda saat memulai percakapan baru
    if (currentStep === 'welcome' && messages.length === 0) {
      welcomeMessageSent.current = false;
    }
  }, [currentStep, messages.length]);

  const addMessage = (sender, content, type = 'text', data = null) => {
    const newMessage = {
      id: Date.now() + Math.random(),
      sender,
      content,
      type,
      data,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  const handleMenuRequest = async () => {
    setIsLoading(true);
    addMessage('customer', 'Bisa lihat menu yang tersedia? 📋');

    try {
      const response = await fetch(`${API_BASE}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          slot: null,
        }),
      });

      const data = await response.json();
      setConversationId(data.conversation_id);
      setMenuOptions(data.provider_response.content.opsi);

      addMessage('provider', 'Berikut menu yang tersedia hari ini:', 'menu', data.provider_response.content.opsi);
      setCurrentStep('order');
    } catch (error) {
      addMessage('provider', 'Maaf, terjadi kesalahan. Silakan coba lagi. 😔');
    }
    setIsLoading(false);
  };

  const handleOrderSubmit = async () => {
    if (!orderData.selectedItem || !orderData.address || !orderData.timeWindow) {
      addMessage('provider', 'Mohon lengkapi semua informasi pesanan ya! 📝');
      return;
    }

    setIsLoading(true);
    addMessage('customer', `Saya ingin pesan ${orderData.quantity}x ${orderData.selectedItem}\n📍 ${orderData.address}\n⏰ ${orderData.timeWindow}`);

    try {
      const response = await fetch(`${API_BASE}/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          item_menu: orderData.selectedItem,
          jumlah: orderData.quantity,
          alamat_pengiriman: orderData.address,
          time_window: orderData.timeWindow,
        }),
      });

      const data = await response.json();
      const providerResponse = data.provider_response;

      if (providerResponse.performative === 'disconfirm') {
        const content = providerResponse.content;
        if (content.substitusi && Array.isArray(content.substitusi)) {
          setSubstitutions(content.substitusi);
          addMessage('provider', 'Maaf, item tersebut tidak tersedia. 😞 Tapi saya punya alternatif untuk Anda:', 'substitution', content.substitusi);
          setCurrentStep('substitute');
        } else if (content.alasan) {
          addMessage('provider', `Maaf, ${content.alasan} 😔`);
        }
      } else if (providerResponse.performative === 'confirm') {
        setOrderDetails(providerResponse.content);
        addMessage('provider', 'Pesanan berhasil diproses! 🎉', 'order-confirm', providerResponse.content);
        setCurrentStep('confirm');
      }
    } catch (error) {
      addMessage('provider', 'Maaf, terjadi kesalahan. Silakan coba lagi. 😔');
    }
    setIsLoading(false);
  };

  const handleSubstitution = async (substitution) => {
    setIsLoading(true);
    addMessage('customer', `Oke, saya pilih ${substitution} sebagai pengganti. 👍`);

    try {
      const response = await fetch(`${API_BASE}/order/substitute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          substitusi: substitution,
        }),
      });

      const data = await response.json();
      const providerResponse = data.provider_response;

      // Cek jika ada 'alasan' untuk menandakan kegagalan
      if (providerResponse.alasan) {
        addMessage('provider', `Maaf, ${providerResponse.alasan} 😔`);
        setCurrentStep('order');
      } else {
        // Jika berhasil, providerResponse adalah kontennya
        setOrderData((prev) => ({ ...prev, selectedItem: substitution }));
        setOrderDetails(providerResponse);
        addMessage('provider', 'Substitusi berhasil! 🎉', 'order-confirm', providerResponse);
        setCurrentStep('confirm');
      }
    } catch (error) {
      addMessage('provider', 'Maaf, terjadi kesalahan. Silakan coba lagi. 😔');
    }
    setIsLoading(false);
  };

  const handleConfirmOrder = async () => {
    setIsLoading(true);
    addMessage('customer', 'Ya, saya konfirmasi pesanan ini! ✅');

    try {
      const response = await fetch(`${API_BASE}/order/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: conversationId,
        }),
      });

      const data = await response.json();
      addMessage('provider', 'Terima kasih! Pesanan telah dikonfirmasi. 🎊', 'final-confirm', data.provider_response);

      // Reset untuk pemesanan baru
      setTimeout(() => {
        setCurrentStep('welcome');
        setOrderData({
          selectedItem: '',
          quantity: 1,
          address: '',
          timeWindow: '',
        });
        setSubstitutions([]);
        setOrderDetails(null);
        setConversationId(null);
        setMessages([]);
        // Tidak perlu mereset welcomeMessageSent.current di sini, useEffect akan menanganinya
      }, 4000);
    } catch (error) {
      addMessage('provider', 'Maaf, terjadi kesalahan konfirmasi. 😔');
    }
    setIsLoading(false);
  };

  const fetchLogs = async () => {
    try {
      let url = `${API_BASE}/logs`;
      if (logFilter) {
        url = `${API_BASE}/logs/${logFilter}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };

  const renderInteractiveForm = () => {
    if (currentStep === 'order') {
      return (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-800">Isi data pesanan Anda:</span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Package className="w-4 h-4" />
                Pilih Menu
              </label>
              <select
                value={orderData.selectedItem}
                onChange={(e) => setOrderData((prev) => ({ ...prev, selectedItem: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">-- Pilih Menu --</option>
                {menuOptions.map((option, idx) => (
                  <option key={idx} value={option.item_menu}>
                    {option.item_menu} (Stok: {option.stok})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Jumlah</label>
              <input
                type="number"
                min="1"
                max="10"
                value={orderData.quantity}
                onChange={(e) => setOrderData((prev) => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4" />
                Alamat Pengiriman
              </label>
              <textarea
                value={orderData.address}
                onChange={(e) => setOrderData((prev) => ({ ...prev, address: e.target.value }))}
                placeholder="Masukkan alamat lengkap..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                rows="2"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4" />
                Waktu Pengiriman
              </label>
              <select
                value={orderData.timeWindow}
                onChange={(e) => setOrderData((prev) => ({ ...prev, timeWindow: e.target.value }))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              >
                <option value="">-- Pilih Waktu --</option>
                {timeSlots.map((slot, idx) => (
                  <option key={idx} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOrderSubmit}
              disabled={isLoading || !orderData.selectedItem || !orderData.address || !orderData.timeWindow}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Send className="w-4 h-4" />
              Pesan Sekarang
            </button>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderMessage = (message) => {
    const isCustomer = message.sender === 'customer';

    return (
      <div key={message.id} className={`flex ${isCustomer ? 'justify-end' : 'justify-start'} mb-4`}>
        <div className={`max-w-xs lg:max-w-sm relative ${isCustomer ? 'order-2' : 'order-1'}`}>
          {/* Avatar */}
          <div className={`absolute -top-1 ${isCustomer ? '-right-2' : '-left-2'} w-8 h-8 rounded-full flex items-center justify-center ${isCustomer ? 'bg-blue-500' : 'bg-gray-500'}`}>
            {isCustomer ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-white" />}
          </div>

          <div className={`px-4 py-3 rounded-2xl shadow-sm ${isCustomer ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-4' : 'bg-white text-gray-800 mr-4 border border-gray-200'}`}>
            {message.type === 'welcome' && (
              <div className="text-center">
                <p className="mb-3">{message.content}</p>
                <button onClick={handleMenuRequest} className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium">
                  Lihat Menu 📋
                </button>
              </div>
            )}

            {message.type === 'menu' && (
              <div>
                <p className="mb-3">{message.content}</p>
                <div className="space-y-2">
                  {message.data?.map((option, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg text-sm border">
                      <div className="font-semibold text-gray-800 mb-1">{option.item_menu}</div>
                      <div className="text-gray-600 text-xs space-y-1">
                        <div>📦 Stok: {option.stok}</div>
                        <div>⏱️ Waktu: {option.estimasi_waktu}</div>
                        <div>🚚 Ongkir: Rp {option.biaya_pengiriman.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {message.type === 'substitution' && (
              <div>
                <p className="mb-3">{message.content}</p>
                <div className="space-y-2">
                  {message.data?.map((sub, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSubstitution(sub)}
                      className="block w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white p-3 rounded-lg text-sm font-medium transition-all transform hover:scale-105"
                    >
                      Pilih {sub} 🔄
                    </button>
                  ))}
                </div>
              </div>
            )}

            {message.type === 'order-confirm' && (
              <div>
                <p className="mb-3">{message.content}</p>
                <div className="bg-green-50 border border-green-200 p-3 rounded-lg text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="font-medium text-green-800">Detail Pesanan:</span>
                  </div>
                  <div className="text-gray-700 space-y-1">
                    <div>
                      🍽️ {message.data?.item_menu} x{message.data?.jumlah}
                    </div>
                    <div>⏱️ {message.data?.estimasi_waktu}</div>
                    <div>📍 {message.data?.alamat_pengiriman}</div>
                    <div>⏰ {message.data?.time_window}</div>
                    <div>💰 Ongkir: Rp {message.data?.biaya_pengiriman?.toLocaleString()}</div>
                  </div>
                </div>
                <button
                  onClick={handleConfirmOrder}
                  disabled={isLoading}
                  className="w-full mt-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-400 text-white py-2 px-4 rounded-lg transition-all font-medium"
                >
                  Konfirmasi Pesanan ✅
                </button>
              </div>
            )}

            {message.type === 'final-confirm' && (
              <div>
                <p className="mb-3">{message.content}</p>
                <div className="bg-green-100 border-2 border-green-300 p-3 rounded-lg text-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-bold text-green-800">Pesanan Terkonfirmasi!</span>
                  </div>
                  <div className="text-green-700 space-y-1">
                    <div>📋 Order ID: {conversationId?.toUpperCase()}</div>
                    <div>✅ Status: Confirmed</div>
                    <div>💳 Payment: Pending</div>
                  </div>
                </div>
                <div className="mt-3 text-center text-sm text-gray-600">Pemesanan baru akan dimulai dalam beberapa detik...</div>
              </div>
            )}

            {message.type === 'text' && <p className="whitespace-pre-wrap">{message.content}</p>}

            <div className={`text-xs mt-2 ${isCustomer ? 'text-blue-100' : 'text-gray-500'}`}>{message.timestamp}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderLogsModal = () => {
    if (!showLogs) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl w-full max-w-4xl h-3/4 flex flex-col shadow-2xl">
          <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-xl">
            <h2 className="text-xl font-bold text-gray-800">📊 Log Percakapan</h2>
            <button onClick={() => setShowLogs(false)} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 border-b bg-gray-50">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Filter by Conversation ID..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <button onClick={fetchLogs} className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-all">
                <Filter className="w-4 h-4" />
                Filter
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {logs.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Tidak ada log yang ditemukan.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {logs.map((log, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${log.sender === 'Customer' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}`}>
                          {log.sender === 'Customer' ? '👤 Customer' : '🤖 Provider'}
                        </span>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            log.performative === 'request'
                              ? 'bg-yellow-100 text-yellow-800'
                              : log.performative === 'confirm'
                              ? 'bg-green-100 text-green-800'
                              : log.performative === 'disconfirm'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {log.performative}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>

                    <div className="text-sm">
                      <div className="font-medium text-gray-700 mb-2">
                        💬 Conversation ID: <span className="font-mono text-blue-600">{log.conversation_id}</span>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <pre className="whitespace-pre-wrap text-xs text-gray-600 overflow-x-auto">{JSON.stringify(log.content, null, 2)}</pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-gradient-to-b from-gray-50 to-white rounded-2xl shadow-2xl h-screen flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 via-blue-600 to-purple-600 text-white p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-black opacity-10"></div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">FoodieBot</h1>
              <p className="text-blue-100 text-sm">Pesan makanan favoritmu! 🍕</p>
            </div>
          </div>
          <button
            onClick={() => {
              setShowLogs(true);
              fetchLogs();
            }}
            className="p-3 hover:bg-white hover:bg-opacity-20 rounded-xl transition-all"
          >
            <Eye className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(renderMessage)}

        {/* Interactive Form in Chat */}
        {renderInteractiveForm()}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 text-gray-800 px-4 py-3 rounded-2xl shadow-sm mr-4">
              <div className="flex items-center gap-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-sm">Provider sedang mengetik...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Actions */}
      <div className="bg-white border-t border-gray-200 p-4">
        {currentStep === 'welcome' && messages.length === 1 && (
          <button
            onClick={handleMenuRequest}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-3 px-4 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
          >
            <Package className="w-5 h-5" />
            Mulai Pemesanan
          </button>
        )}

        {currentStep === 'menu' && (
          <div className="text-center text-gray-600">
            <Clock className="w-5 h-5 mx-auto mb-2 text-gray-400" />
            <p className="text-sm">Silakan isi form pesanan di atas 👆</p>
          </div>
        )}

        {currentStep === 'substitute' && (
          <div className="text-center text-gray-600">
            <AlertCircle className="w-5 h-5 mx-auto mb-2 text-orange-400" />
            <p className="text-sm">Pilih menu pengganti di atas 👆</p>
          </div>
        )}

        {currentStep === 'confirm' && (
          <div className="text-center text-gray-600">
            <CheckCircle className="w-5 h-5 mx-auto mb-2 text-green-400" />
            <p className="text-sm">Klik tombol konfirmasi di atas 👆</p>
          </div>
        )}
      </div>

      {/* Logs Modal */}
      {renderLogsModal()}
    </div>
  );
};

export default FoodOrderingChatbot;
