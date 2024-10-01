import axios from 'axios';

const API_URL = 'http://localhost:3000/chat';

export const sendMessage = async (message: string, categoryId?: string) => {
  const response = await axios.post(API_URL, {
    message,
    categoryId,
  });
  return response.data;
};
