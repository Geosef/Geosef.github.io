import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NavRightContextValue {
  navRight: ReactNode;
  setNavRight: (node: ReactNode) => void;
}

const NavRightContext = createContext<NavRightContextValue>({
  navRight: null,
  setNavRight: () => {},
});

export function NavRightProvider({ children }: { children: ReactNode }) {
  const [navRight, setNavRight] = useState<ReactNode>(null);
  return (
    <NavRightContext.Provider value={{ navRight, setNavRight }}>
      {children}
    </NavRightContext.Provider>
  );
}

export function useNavRight() {
  return useContext(NavRightContext);
}
