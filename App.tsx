import React, { useState } from 'react';
import { sendMessage } from './components/Chatbot';

const App: React.FC = () => {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);

  // Static categories for demonstration
  const categories = [
    { id: '1', name: 'Gutter' },
    { id: '2', name: 'Bathroom Remodeling' },
    { id: '3', name: 'Home Security' },
    { id: '4', name: 'Concrete Work' },
    { id: '5', name: 'Landscaping' },
    {id: '6', name: 'Electrical Work'},
    {id: '7', name: 'Plumbing'}
  ];

  const handleSendMessage = async () => {
    try {
      const data = await sendMessage(message, categoryId);
      setResponse(data.response);
      setMessage(''); // Clear the message input
      setCategoryId(undefined); // Reset the category selection
    } catch (error) {
      console.error('Error sending message:', error);
      setResponse('An error occurred while sending your message.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-r from-blue-500 to-purple-600">
    <div className="w-full max-w-lg p-6 bg-white shadow-lg rounded-lg">
      <h1 className="mb-6 text-3xl font-bold text-center text-gray-800">
        Service Selection Chatbot
      </h1>
      <div className="mb-4">
        <label className="block mb-2 text-lg font-semibold text-gray-700">Select a Category</label>
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>
            Select a category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </div>
      {response && (
        <div className="mt-6 p-4 bg-gray-100 border-l-4 border-blue-500 rounded-lg shadow-md mr-8 mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Response:</h2>
          <p className="text-gray-700">{response}</p>
        </div>
      )}

      <div className="mb-4">
        <label className="block mb-2 text-lg font-semibold text-gray-700">Your Message</label>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Type your message here..."
        />
      </div>

      <button
        onClick={handleSendMessage}
        className="w-full p-3 text-white bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg hover:shadow-lg hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-700 transition-all duration-300"
      >
        Send
      </button>


    </div>
  </div>
  );
};

export default App;
