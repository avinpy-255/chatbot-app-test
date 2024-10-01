import React, { useState } from 'react';
import { sendMessage } from './components/Chatbot';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const App: React.FC = () => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [categories] = useState([
    { id: '1', name: 'Gutter' },
    { id: '2', name: 'Bathroom Remodeling' },
    { id: '3', name: 'Home Security' },
    { id: '4', name: 'Concrete Work' },
    { id: '5', name: 'Landscaping' },
    { id: '6', name: 'Electrical Work' },
    { id: '7', name: 'Plumbing' },
  ]);

  const handleSendMessage = async () => {
    if (!message || !categoryId) {
      return;
    }

    setConversation([...conversation, { role: 'user', content: message }]);

    try {
      const data = await sendMessage(message, categoryId);
      setConversation((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setConversation((prev) => [...prev, { role: 'assistant', content: 'An error occurred while sending your message.' }]);
    }

    setMessage('');
  };

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(event.target.value);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-green">
      <div className="w-full max-w-lg p-6 bg-white shadow-lg rounded-lg">
        <h1 className="text-3xl font-bold text-center mb-6">Service Selection Chatbot</h1>

        <select
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={categoryId}
          onChange={handleCategoryChange}
        >
          <option value="" disabled>Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <div className="mt-6 p-4 bg-gray-50 h-64 overflow-y-auto border border-gray-300 rounded-lg">
          {conversation.map((msg, index) => (
            <div key={index} className={`mb-4 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-3 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
                <p>{msg.content}</p>
              </div>
            </div>
          ))}
        </div>

        <input
          type="text"
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-4"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
        />

        <button
          onClick={handleSendMessage}
          className="w-full p-3 text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-all duration-300 mt-4"
        >
          Send
        </button>


      </div>
    </div>
  );
};

export default App;