import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(true);
  const [companyName, setCompanyName] = useState('HCM Lite');

  useEffect(() => {
    checkInitialState();
  }, []);

  async function checkInitialState() {
    try {
      setLoading(true);
      // Check setup status first
      const statusRes = await api.getSetupStatus();
      setIsConfigured(statusRes.isConfigured);
      if (statusRes.companyName) setCompanyName(statusRes.companyName);

      if (statusRes.isConfigured) {
        const token = localStorage.getItem('hcm_token');
        if (token) {
          try {
            const meRes = await api.getMe();
            setUser(meRes.user);
          } catch (err) {
            localStorage.removeItem('hcm_token');
            setUser(null);
          }
        }
      }
    } catch (err) {
      console.error('Failed to check initial setup/auth state:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const res = await api.login({ email, password });
    localStorage.setItem('hcm_token', res.token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    localStorage.removeItem('hcm_token');
    setUser(null);
    window.location.href = '/login';
  }

  async function updateCurrentUser(updatedFields) {
    setUser((prev) => ({ ...prev, ...updatedFields }));
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isConfigured,
        companyName,
        login,
        logout,
        checkInitialState,
        updateCurrentUser,
        isAdmin: user?.role === 'ADMIN',
        isHR: user?.role === 'HR',
        isEmployee: user?.role === 'EMPLOYEE',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
