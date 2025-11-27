import React, { createContext, useState, useContext } from "react";

// Export the context so it can be imported directly
export const UserContext = createContext(null);

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    // Get the stored user from localStorage
    const savedUser = localStorage.getItem("selectedProfile");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const saveUser = (selectedUser) => {
    localStorage.setItem("selectedProfile", JSON.stringify(selectedUser));
    setUser(selectedUser);
  };

  return (
    <UserContext.Provider value={{ user, saveUser }}>
      {children}
    </UserContext.Provider>
  );
};

// Export the custom hook for your context
export const useUser = () => useContext(UserContext);
