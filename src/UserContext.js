import React, { createContext, useState, useContext } from "react";

// Shared localStorage key for cross-app profile selection
const STORAGE_KEY = "diperi-selected-user";

// Export the context so it can be imported directly
export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Get the stored user from localStorage
    const savedUser = localStorage.getItem(STORAGE_KEY);
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const saveUser = (selectedUser) => {
    if (selectedUser) {
      // Normalize user to have both _id and id for compatibility
      const normalized = {
        ...selectedUser,
        _id: selectedUser._id || `user:${selectedUser.id}`,
        id: selectedUser.id || selectedUser._id?.replace("user:", ""),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      setUser(normalized);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      setUser(null);
    }
  };

  const clearUser = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, saveUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
};

// Export the custom hook for your context
export const useUser = () => useContext(UserContext);

