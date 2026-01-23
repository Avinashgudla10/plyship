import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('session_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;